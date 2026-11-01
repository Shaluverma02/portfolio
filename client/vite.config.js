const { loadEnv } = require('vite');
const path = require('node:path');
const fs = require('node:fs');

function copyStaticFiles() {
    return {
        name: 'portfolio-copy-static-files',
        closeBundle() {
            const output = path.resolve(__dirname, 'dist');
            fs.cpSync(path.join(__dirname, 'assets'), path.join(output, 'assets'), { recursive: true });
            for (const [folder, files] of Object.entries({
                admin: ['admin.css', 'chat-admin.js', 'dashboard.js', 'login.js', 'profile.js'],
                experience: ['script.js', 'style.css'],
                projects: ['script.js', 'style.css']
            })) {
                for (const file of files) {
                    fs.copyFileSync(path.join(__dirname, folder, file), path.join(output, folder, file));
                }
            }
        }
    };
}

function frontendRoutes() {
    const rewrite = (req, res, next) => {
        const routes = {
            '/admin': '/admin/login.html',
            '/admin/': '/admin/login.html',
            '/admin/login': '/admin/login.html',
            '/admin/dashboard': '/admin/dashboard.html',
            '/admin/profile': '/admin/dashboard.html#profile',
            '/showdata.html': '/admin/dashboard.html#messages'
        };
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (routes[pathname]) {
            res.statusCode = 302;
            res.setHeader('Location', routes[pathname]);
            res.end();
            return;
        }
        next();
    };

    return {
        name: 'portfolio-frontend-routes',
        configureServer(server) {
            server.middlewares.use(rewrite);
        },
        configurePreviewServer(server) {
            server.middlewares.use(rewrite);
        }
    };
}

module.exports = ({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const apiUrl = env.VITE_API_URL || env.API_URL || `http://localhost:${Number(env.PORT) || 5500}`;
    const parsedApiUrl = new URL(apiUrl);
    if (!['http:', 'https:'].includes(parsedApiUrl.protocol) || parsedApiUrl.username ||
        parsedApiUrl.password || parsedApiUrl.pathname !== '/' || parsedApiUrl.search || parsedApiUrl.hash) {
        throw new Error('VITE_API_URL must be an http(s) origin without a path or credentials.');
    }
    const websocketOrigin = `${parsedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsedApiUrl.host}`;

    return {
        appType: 'mpa',
        plugins: [{
            name: 'portfolio-api-config',
            transformIndexHtml(html) {
                const isAdminPage = /<meta name="robots" content="noindex, nofollow">/.test(html);
                const policy = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http: data:; connect-src 'self' ${parsedApiUrl.origin} ${websocketOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
                const config = `<meta name="portfolio-api-url" content="${parsedApiUrl.origin}">${isAdminPage ? `<meta http-equiv="Content-Security-Policy" content="${policy}">` : ''}<script src="/assets/js/api-client.js" defer></script>`;
                return html.replace(/<head[^>]*>/i, head => `${head}${config}`);
            }
        }, frontendRoutes(), copyStaticFiles()],
        server: {
            host: 'localhost',
            port: Number(env.CLIENT_PORT) || 5173,
            strictPort: true
        },
        preview: {
            host: 'localhost',
            port: Number(env.CLIENT_PORT) || 5173,
            strictPort: true
        },
        build: {
            rollupOptions: {
                input: [
                    'index.html',
                    '404.html',
                    'showdata.html',
                    'projects/index.html',
                    'experience/index.html',
                    'admin/login.html',
                    'admin/dashboard.html',
                    'admin/profile.html'
                ].map(file => path.resolve(__dirname, file))
            }
        }
    };
};
