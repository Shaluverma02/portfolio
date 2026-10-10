// Compatibility entry point for the original combined server.
const { spawn } = require('node:child_process');
const path = require('node:path');
if (require.main === module) {
    const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'app.js'], {
        cwd: path.join(__dirname, 'backend'), stdio: 'inherit'
    });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code || 0; });
} else module.exports = require('./backend/app');
