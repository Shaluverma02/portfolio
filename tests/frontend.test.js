const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { WebSocket, WebSocketServer } = require('ws');
const { createFrontendServer } = require('../frontend/server');

async function fixture(t) {
    const backend = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Set-Cookie', 'session=test; HttpOnly; SameSite=Strict; Path=/');
            res.end(JSON.stringify({ path: req.url, host: req.headers.host, origin: req.headers.origin,
                cookie: req.headers.cookie, body: Buffer.concat(chunks).toString() }));
        });
    });
    const wss = new WebSocketServer({ server: backend });
    wss.on('connection', ws => ws.on('message', message => ws.send(message)));
    backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
    const frontend = createFrontendServer({ backendUrl: 'http://127.0.0.1:' + backend.address().port });
    frontend.listen(0, '127.0.0.1'); await once(frontend, 'listening');
    t.after(async () => {
        for (const client of wss.clients) client.terminate();
        for (const server of [frontend, backend]) {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
        wss.close();
    });
    return { frontend, backend, base: 'http://127.0.0.1:' + frontend.address().port };
}

test('frontend serves design and keeps private files inaccessible', async t => {
    const { base } = await fixture(t);
    for (const route of ['/', '/projects/', '/experience/', '/assets/css/refresh.css']) {
        assert.equal((await fetch(base + route)).status, 200);
    }
    for (const route of ['/.env', '/contacts.json', '/server.js', '/backend/server.js', '/lib/admin-auth.js', '/.admin/credentials.json']) {
        assert.equal((await fetch(base + route)).status, 404);
    }
});

test('proxy preserves origin, host, session cookies, query and upload body', async t => {
    const { base } = await fixture(t);
    const body = '%PDF-1.7\nexample upload';
    const response = await fetch(base + '/api/admin/resumes?filename=test.pdf', { method: 'POST',
        headers: { Origin: base, Cookie: 'session=test', 'Content-Type': 'application/pdf' }, body });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    const data = await response.json();
    assert.equal(data.origin, base); assert.equal(data.host, new URL(base).host);
    assert.equal(data.cookie, 'session=test'); assert.equal(data.body, body);
    assert.equal(data.path, '/api/admin/resumes?filename=test.pdf');
    for (const route of ['/skills.json', '/projects.json', '/experience.json', '/certificates.json', '/admin', '/resumes/example']) {
        assert.equal((await (await fetch(base + route)).json()).path, route);
    }
});

test('visitor and admin WebSocket traffic passes through frontend', async t => {
    const { base } = await fixture(t);
    for (const route of ['/ws/chat?sid=test', '/ws/admin/chat']) {
        const socket = new WebSocket(base.replace('http:', 'ws:') + route);
        await once(socket, 'open');
        const received = once(socket, 'message'); socket.send('hello');
        assert.equal((await received)[0].toString(), 'hello');
        socket.close(); await once(socket, 'close');
    }
});

test('frontend shows a useful error when backend is stopped', async t => {
    const { base, backend } = await fixture(t);
    backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve));
    const response = await fetch(base + '/skills.json');
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /npm run backend/);
    assert.equal((await fetch(base)).status, 200);
});
