const http = require('node:http');
const { createApp } = require('./app');
const { attachChat } = require('./lib/chat');

async function startBackend() {
    const app = await createApp({ serveFrontend: false });
    const server = http.createServer(app);
    attachChat(server, app.locals._auth);
    server.on('close', () => app.locals._dataStore.close().catch(error => console.error(error.message)));
    const port = Number(process.env.BACKEND_PORT) || 5501;
    server.listen(port, () => console.log('Backend: http://localhost:' + port));
    return server;
}
if (require.main === module) startBackend().catch(error => {
    console.error('Backend could not start:', error.message);
    process.exitCode = 1;
});
module.exports = { startBackend };
