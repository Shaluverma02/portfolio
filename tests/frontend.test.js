const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

test('combined server serves website and API while keeping private files inaccessible', async t => {
    const tempRoot = await fs.realpath(os.tmpdir());
    const dataDir = await fs.mkdtemp(path.join(tempRoot, 'portfolio-combined-'));
    t.after(async () => {
        const target = await fs.realpath(dataDir);
        assert.equal(path.dirname(target), tempRoot);
        assert.ok(path.basename(target).startsWith('portfolio-combined-'));
        await fs.rm(target, { recursive: true, force: true });
    });
    const app = await createApp({ dataDir, env: { ADMIN_PASSWORD: 'Test-only-password-123!' },
        dataStore: { read: async () => [{ name: 'Example' }] } });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const route of ['/', '/projects/', '/experience/', '/assets/css/refresh.css', '/admin']) {
        assert.equal((await fetch(base + route)).status, 200, route);
    }
    for (const route of ['/.env', '/contacts.json', '/server.js', '/lib/admin-auth.js', '/.admin/credentials.json', '/package.json', '/.check-atlas.cjs']) {
        assert.equal((await fetch(base + route)).status, 404, route);
    }
    for (const route of ['/skills.json', '/projects.json', '/experience.json', '/certificates.json']) {
        const response = await fetch(base + route);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), [{ name: 'Example' }]);
    }
    assert.equal((await fetch(base + '/api/admin/session')).status, 401);
});
