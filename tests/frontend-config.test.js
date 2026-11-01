const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const clientPackage = require('../client/package.json');
const viteConfig = require('../client/vite.config');

test('frontend uses localhost consistently for the split-origin admin session', () => {
    const config = viteConfig({ mode: 'test' });
    assert.equal(config.server.host, 'localhost');
    assert.equal(config.preview.host, 'localhost');
    assert.equal(config.server.proxy, undefined);
    assert.equal(config.preview.proxy, undefined);
    assert.ok(clientPackage.scripts.dev.includes('--config vite.config.js'));
    assert.ok(!clientPackage.scripts.dev.includes('--host 127.0.0.1'));
});

test('frontend admin pages are included in the independent production build', () => {
    const config = viteConfig({ mode: 'test' });
    const inputs = config.build.rollupOptions.input.map(file => path.basename(file));
    assert.ok(inputs.includes('login.html'));
    assert.ok(inputs.includes('dashboard.html'));
    assert.ok(fs.existsSync(path.join(__dirname, '../client/assets/js/api-client.js')));
});
