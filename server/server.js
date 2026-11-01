const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { createAdminAuth } = require('./lib/admin-auth');
const { createMongoStore } = require('./lib/mongo-store');
const { attachChat } = require('./lib/chat');
const ROOT = path.resolve(__dirname, '..');
const MAX_RESUME_SIZE = 15 * 1024 * 1024;

function configuredOrigins(env) {
    const clientPort = Number(env.CLIENT_PORT) || 5173;
    const configured = env.CLIENT_ORIGIN || `http://localhost:${clientPort},http://127.0.0.1:${clientPort}`;
    return new Set(configured.split(',').map(value => new URL(value.trim()).origin));
}

async function createApp({ dataDir = ROOT, env = process.env, dataStore: suppliedDataStore } = {}) {
    const app = express();
    const auth = await createAdminAuth({ dataDir, env });
    const dataStore = suppliedDataStore || await createMongoStore({ dataDir, env });
    const clientOrigins = configuredOrigins(env);
    app.disable('x-powered-by');
    app.locals._auth = auth; // exposed so startup block can pass to attachChat
    app.locals._dataStore = dataStore;
    app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
    app.use((req, res, next) => {
        const origin = req.get('origin');
        if (origin && clientOrigins.has(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            if (!origin || !clientOrigins.has(origin)) {
                return res.status(403).json({ error: 'Origin not allowed.' });
            }
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            return res.sendStatus(204);
        }
        next();
    });
    app.use(express.json({ limit: '16kb' }));
    app.use(['/api/admin', '/api/contacts'], (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        next();
    });
    app.get('/api/profile', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json(await dataStore.getProfile());
    });
    app.get('/api/admin/profile', auth.requireApi, async (req, res) => {
        res.json(await dataStore.getProfile());
    });
    app.put('/api/admin/profile', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json(await dataStore.setProfile(req.body));
    });
    app.post('/api/admin/login', auth.sameOrigin, auth.login);
    app.post('/api/admin/logout', auth.sameOrigin, auth.logout);
    app.get('/api/admin/session', auth.requireApi, (req, res) => res.json({ username: req.admin.username }));
    app.get('/api/admin/resumes', auth.requireApi, async (req, res) => {
        res.json({ resumes: await dataStore.listResumes() });
    });
    app.post('/api/admin/resumes', auth.requireApi, auth.sameOriginRequest, async (req, res) => {
        if (req.headers['content-type'] !== 'application/pdf') {
            return res.status(415).json({ error: 'Upload a PDF resume.' });
        }
        if (Number(req.headers['content-length']) > MAX_RESUME_SIZE) {
            return res.status(413).json({ error: 'Resume is too large. Maximum size is 15 MB.' });
        }
        const rawName = typeof req.query.filename === 'string' ? req.query.filename : '';
        const filename = rawName.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').trim();
        if (!filename || filename.length > 180 || !/\.pdf$/i.test(filename)) {
            return res.status(400).json({ error: 'Choose a PDF file with a valid filename.' });
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
            size += chunk.length;
            if (size > MAX_RESUME_SIZE) {
                return res.status(413).json({ error: 'Resume is too large. Maximum size is 15 MB.' });
            }
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);
        if (!data.length || data.subarray(0, 5).toString() !== '%PDF-') {
            return res.status(400).json({ error: 'The selected file is not a valid PDF.' });
        }
        const resume = await dataStore.uploadResume(filename, data);
        if (!(await dataStore.getActiveResume())) await dataStore.setActiveResume(resume.id);
        const savedResume = (await dataStore.listResumes()).find(item => item.id === resume.id);
        res.status(201).json({ resume: savedResume });
    });
    app.patch('/api/admin/resumes/:id/active', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json({ resumes: await dataStore.setActiveResume(req.params.id) });
    });
    app.delete('/api/admin/resumes/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        let resumes = await dataStore.deleteResume(req.params.id);
        if (resumes.length && !resumes.some(resume => resume.active)) {
            resumes = await dataStore.setActiveResume(resumes[0].id);
        }
        res.json({ resumes });
    });
    app.get('/api/resumes/active', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const resume = await dataStore.getActiveResume();
        res.json({ url: resume ? `/resumes/${encodeURIComponent(resume.id)}` : null });
    });
    app.get('/resumes/:id', async (req, res, next) => {
        const resume = await dataStore.getResume(req.params.id);
        if (!resume) return res.status(404).send('Resume not found.');
        const stream = dataStore.openResume(req.params.id);
        if (!stream) return res.status(404).send('Resume not found.');
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': String(resume.size),
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(resume.filename)}`,
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff'
        });
        stream.on('error', next);
        stream.pipe(res);
    });
    app.get('/api/admin/dashboard', auth.requireApi, async (req, res) => {
        const [contacts, projects, skills, experience, certificates] = await Promise.all([
            dataStore.readContacts(), dataStore.read('projects'), dataStore.read('skills'), dataStore.read('experience'), dataStore.read('certificates')
        ]);
        res.json({ username: req.admin.username,
            counts: { projects: projects.length, skills: skills.length, experience: experience.length, certificates: certificates.length, messages: contacts.length },
            contacts: contacts.slice().reverse(), projects, skills, experience, certificates });
    });
    app.get('/api/admin/content/:collection', auth.requireApi, async (req, res) => {
        res.json({ items: await dataStore.read(req.params.collection) });
    });
    app.post('/api/admin/content/:collection', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.status(201).json(await dataStore.mutate(req.params.collection, 'add', null, req.body));
    });
    app.put('/api/admin/content/:collection/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json(await dataStore.mutate(req.params.collection, 'edit', req.params.id, req.body));
    });
    app.delete('/api/admin/content/:collection/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json(await dataStore.mutate(req.params.collection, 'delete', req.params.id));
    });
    app.delete('/api/admin/messages/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid message ID.' });
        await dataStore.deleteContact(req.params.id);
        res.json({ contacts: (await dataStore.readContacts()).slice().reverse() });
    });
    app.get('/api/contacts', auth.requireApi, async (req, res) => res.json(await dataStore.readContacts()));

    app.post('/api/save-contact-data', async (req, res) => {
        const body = req.body;
        if (!body || typeof body.name !== 'string' || typeof body.email !== 'string' || !body.name.trim() || !body.email.trim()) {
            return res.status(400).json({ error: 'Name and email are required.' });
        }
        const limits = { name: 150, email: 254, phone: 60, message: 6000 };
        const entry = {};
        for (const [key, maxLength] of Object.entries(limits)) {
            const value = body[key] ?? '';
            if (typeof value !== 'string' || value.length > maxLength) return res.status(400).json({ error: `Please enter a valid ${key}.` });
            entry[key] = value.trim();
        }
        entry.timestamp = new Date().toISOString();
        await dataStore.addContact(entry);
        res.status(200).json({ message: 'Data saved successfully.' });
    });
    for (const collection of ['skills', 'projects', 'experience', 'certificates']) {
        app.get(`/${collection}.json`, async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.json(await dataStore.read(collection));
        });
    }
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found.' });
    });
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : [400, 404].includes(error.status) ? error.status : 500;
        res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.status ? error.message : 'Invalid request.' });
    });
    return app;
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 5500;
    const clientPort = Number(process.env.CLIENT_PORT) || 5173;
    createApp().then(app => {
        const server = http.createServer(app);
        server.on('close', () => {
            app.locals._dataStore.close().catch(error => {
                console.error('MongoDB connection could not close:', error.message);
            });
        });
        const auth = app.locals._auth;
        attachChat(server, auth);
        server.listen(port, () => {
            console.log(`Backend API: http://localhost:${port}`);
            console.log(`Allowed client origins: ${process.env.CLIENT_ORIGIN || `http://localhost:${clientPort},http://127.0.0.1:${clientPort}`}`);
            console.log('First-run login details: .admin/login-details.txt');
        });
    }).catch(error => { console.error('Server could not start:', error.message); process.exitCode = 1; });
}
module.exports = { createApp };
