// Apply the saved theme before paint; storage may be unavailable in private contexts.
(() => {
    const root = document.documentElement;
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    let saved;
    try { saved = localStorage.getItem('portfolio-theme'); } catch {}
    if (saved !== 'light' && saved !== 'dark') saved = null;
    function apply(theme) {
        root.dataset.theme = theme;
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        const dark = theme === 'dark';
        button.setAttribute('aria-pressed', String(dark));
        button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
    apply(saved || (system.matches ? 'dark' : 'light'));
    system.addEventListener('change', () => {
        if (!saved) apply(system.matches ? 'dark' : 'light');
    });
    window.addEventListener('storage', event => {
        if (event.key !== 'portfolio-theme') return;
        saved = ['dark', 'light'].includes(event.newValue) ? event.newValue : null;
        apply(saved || (system.matches ? 'dark' : 'light'));
    });
    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        button.hidden = false;
        apply(root.dataset.theme);
        button.addEventListener('click', () => {
            saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
            apply(saved);
            try { localStorage.setItem('portfolio-theme', saved); } catch {}
        });
    });
})();
