const http = require('node:http');
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createAdminAuth } = require('./lib/admin-auth');
const { createContentStore } = require('./lib/content-store');
const { attachChat } = require('./lib/chat');
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const ALLOWED_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function readList(file) {
    try {
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!Array.isArray(data)) throw new Error('Expected a JSON array');
        return data;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function createApp({ dataDir = ROOT, env = process.env } = {}) {
    const app = express();
    const contactFile = path.join(dataDir, 'contacts.json');
    const auth = await createAdminAuth({ dataDir, env });
    const contentStore = await createContentStore(dataDir);
    let contactWrites = Promise.resolve();
    app.disable('x-powered-by');
    app.locals._auth = auth; // exposed so startup block can pass to attachChat
    app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
    app.use(express.json({ limit: '16kb' }));
    app.use(['/admin', '/api/admin', '/api/contacts'], (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        next();
    });
    for (const file of ['admin.css', 'login.js', 'dashboard.js', 'chat-admin.js']) {
        app.get(`/admin/assets/${file}`, (req, res) => res.sendFile(path.join(ROOT, 'admin', file)));
    }
    app.get(['/admin', '/admin/login', '/admin/index.html'], (req, res) => {
        if (auth.getSession(req)) return res.redirect('/admin/dashboard');
        res.sendFile(path.join(ROOT, 'admin', 'login.html'));
    });
    app.get(['/admin/dashboard', '/admin/dashboard.html'], auth.requirePage, (req, res) => {
        res.sendFile(path.join(ROOT, 'admin', 'dashboard.html'));
    });
    app.get('/showdata.html', (req, res) => res.redirect('/admin/dashboard#messages'));
    app.post('/api/admin/login', auth.sameOrigin, auth.login);
    app.post('/api/admin/logout', auth.sameOrigin, auth.logout);
    app.get('/api/admin/session', auth.requireApi, (req, res) => res.json({ username: req.admin.username }));
    app.get('/api/admin/dashboard', auth.requireApi, async (req, res) => {
        const [contacts, projects, skills, experience, certificates] = await Promise.all([
            readList(contactFile), contentStore.read('projects'), contentStore.read('skills'), contentStore.read('experience'), contentStore.read('certificates')
        ]);
        res.json({ username: req.admin.username,
            counts: { projects: projects.length, skills: skills.length, experience: experience.length, certificates: certificates.length, messages: contacts.length },
            contacts: contacts.slice().reverse(), projects, skills, experience, certificates });
    });
    app.get('/api/admin/content/:collection', auth.requireApi, async (req, res) => {
        res.json({ items: await contentStore.read(req.params.collection) });
    });
    app.post('/api/admin/content/:collection', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.status(201).json(await contentStore.mutate(req.params.collection, 'add', null, req.body));
    });
    app.put('/api/admin/content/:collection/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json(await contentStore.mutate(req.params.collection, 'edit', req.params.id, req.body));
    });
    app.delete('/api/admin/content/:collection/:id', auth.requireApi, auth.sameOrigin, async (req, res) => {
        res.json(await contentStore.mutate(req.params.collection, 'delete', req.params.id));
    });
    app.get('/api/contacts', auth.requireApi, async (req, res) => res.json(await readList(contactFile)));

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
        // Serialize writes so simultaneous submissions are not lost.
        const write = contactWrites.then(async () => {
            const contacts = await readList(contactFile);
            contacts.push(entry);
            await fs.writeFile(`${contactFile}.tmp`, JSON.stringify(contacts, null, 2), 'utf8');
            await fs.rename(`${contactFile}.tmp`, contactFile);
        });
        contactWrites = write.catch(() => {});
        await write;
        res.status(200).json({ message: 'Data saved successfully.' });
    });
    // Image upload API — admin only, raw binary body
    app.post('/api/admin/upload-image', auth.requireApi, async (req, res) => {
        try {
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const mime = (req.headers['content-type'] || '').split(';')[0].trim();
            const ext = ALLOWED_MIME[mime];
            if (!ext) return res.status(415).json({ error: 'Unsupported image type. Use JPG, PNG, GIF, WebP, SVG, or AVIF.' });
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > MAX_IMAGE_SIZE) return res.status(413).json({ error: 'Image is too large. Maximum size is 5 MB.' });
                chunks.push(chunk);
            }
            const filename = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
            await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.concat(chunks));
            res.json({ url: `/uploads/${filename}` });
        } catch (err) {
            res.status(500).json({ error: 'Upload failed. Please try again.' });
        }
    });
    // Only public portfolio content is served; credentials, contacts and source stay private.
    app.use('/uploads', express.static(UPLOADS_DIR, { dotfiles: 'deny' }));
    app.use('/assets', express.static(path.join(ROOT, 'assets'), { dotfiles: 'deny' }));
    app.use('/experience', express.static(path.join(ROOT, 'experience'), { dotfiles: 'deny' }));
    app.use('/projects', express.static(path.join(ROOT, 'projects'), { dotfiles: 'deny' }));
    app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
    for (const collection of ['skills', 'projects', 'experience', 'certificates']) {
        app.get(`/${collection}.json`, async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.json(await contentStore.read(collection));
        });
    }
    app.get('/404.html', (req, res) => res.sendFile(path.join(ROOT, '404.html')));
    app.use((req, res) => {
        if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
        res.status(404).sendFile(path.join(ROOT, '404.html'));
    });
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : [400, 404].includes(error.status) ? error.status : 500;
        res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.status ? error.message : 'Invalid request.' });
    });
    return app;
}

if (require.main === module) {
    createApp().then(app => {
        const port = Number(process.env.PORT) || 5500;
        const server = http.createServer(app);
        // Attach WebSocket-based live chat
        const auth = app.locals._auth;
        attachChat(server, auth);
        server.listen(port, () => {
            console.log(`Portfolio: http://localhost:${port}`);
            console.log(`Admin login: http://localhost:${port}/admin`);
            console.log('First-run login details: .admin/login-details.txt');
        });
    }).catch(error => { console.error('Server could not start:', error.message); process.exitCode = 1; });
}
module.exports = { createApp };
