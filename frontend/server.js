const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const express = require('express');
const ROOT = __dirname;

function createFrontendServer({ backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5501' } = {}) {
    const target = new URL(backendUrl);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('BACKEND_URL must use HTTP or HTTPS.');
    const transport = target.protocol === 'https:' ? https : http;
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
    // Preserve the browser's Host and Origin for existing session and CSRF checks.
    // Stream bodies unchanged, including PDF uploads; never parse them in the proxy.
    app.use((req, res, next) => {
        const route = req.path;
        if (!/^\/(api|admin|resumes)(\/|$)/.test(route) && route !== '/showdata.html' &&
            !/^\/(skills|projects|experience|certificates)\.json$/.test(route)) return next();
        const upstream = transport.request({ hostname: target.hostname, port: target.port || undefined,
            path: req.originalUrl, method: req.method, headers: req.headers }, response => {
            res.writeHead(response.statusCode, response.headers);
            response.on('error', () => res.destroy());
            response.pipe(res);
        });
        upstream.setTimeout(30000, () => upstream.destroy(new Error('Backend timeout')));
        upstream.on('error', () => {
            if (res.headersSent) return res.destroy();
            res.status(502).json({ error: 'Backend is unavailable. Start npm run backend and try again.' });
        });
        req.on('aborted', () => upstream.destroy());
        res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
        req.pipe(upstream);
    });
    // Allowlist public files. Project root, .env, contacts, and server code stay private.
    for (const directory of ['assets', 'projects', 'experience']) {
        app.use('/' + directory, express.static(path.join(ROOT, directory), { dotfiles: 'deny' }));
    }
    app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
    app.get('/404.html', (req, res) => res.sendFile(path.join(ROOT, '404.html')));
    app.use((req, res) => res.status(404).sendFile(path.join(ROOT, '404.html')));
    const server = http.createServer(app);
    server.on('upgrade', (req, socket, head) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (!['/ws/chat', '/ws/admin/chat'].includes(pathname)) return socket.destroy();
        const upstream = transport.request({ hostname: target.hostname, port: target.port || undefined,
            path: req.url, method: req.method, headers: req.headers });
        upstream.setTimeout(15000, () => upstream.destroy());
        upstream.on('upgrade', (response, backendSocket, backendHead) => {
            upstream.setTimeout(0);
            const headers = ['HTTP/1.1 ' + response.statusCode + ' ' + response.statusMessage];
            for (let i = 0; i < response.rawHeaders.length; i += 2) headers.push(response.rawHeaders[i] + ': ' + response.rawHeaders[i + 1]);
            socket.write(headers.join('\r\n') + '\r\n\r\n');
            if (backendHead.length) socket.write(backendHead);
            if (head.length) backendSocket.write(head);
            socket.on('error', () => backendSocket.destroy());
            backendSocket.on('error', () => socket.destroy());
            socket.on('close', () => backendSocket.destroy());
            backendSocket.on('close', () => socket.destroy());
            socket.pipe(backendSocket).pipe(socket);
        });
        upstream.on('response', response => { response.resume(); socket.end('HTTP/1.1 ' + response.statusCode + ' Rejected\r\nConnection: close\r\n\r\n'); });
        upstream.on('error', () => socket.destroy());
        upstream.end();
    });
    return server;
}
if (require.main === module) {
    const port = Number(process.env.FRONTEND_PORT) || 5500;
    createFrontendServer().listen(port, () => {
        console.log('Frontend: http://localhost:' + port);
        console.log('Admin: http://localhost:' + port + '/admin');
    });
}
module.exports = { createFrontendServer };
