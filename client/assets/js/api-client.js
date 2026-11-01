(() => {
    const config = document.querySelector('meta[name="portfolio-api-url"]');
    if (!config) throw new Error('The frontend API URL is not configured.');

    const apiOrigin = new URL(config.content);
    window.portfolioApiUrl = path => new URL(path, apiOrigin).href;
    window.portfolioFetch = (path, options = {}) => fetch(window.portfolioApiUrl(path), {
        ...options,
        credentials: 'include'
    });
    window.portfolioWebSocketUrl = path => {
        const url = new URL(path, apiOrigin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return url.href;
    };
})();
