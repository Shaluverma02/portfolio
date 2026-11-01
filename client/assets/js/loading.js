(() => {
    const overlay = document.createElement('div');
    overlay.className = 'portfolio-loader';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'Loading portfolio');
    const inner = document.createElement('div'); inner.className = 'portfolio-loader-inner';
    const emblem = document.createElement('div'); emblem.className = 'loading-emblem'; emblem.setAttribute('aria-hidden', 'true');
    const monogram = document.createElement('span'); monogram.className = 'loading-monogram'; monogram.textContent = 'S.';
    emblem.append(monogram);
    const title = document.createElement('p'); title.className = 'portfolio-loader-title'; title.textContent = 'A little moment…';
    const caption = document.createElement('p'); caption.className = 'portfolio-loader-caption'; caption.textContent = 'Getting things ready for you';
    const dots = document.createElement('div'); dots.className = 'loading-dots'; dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) dots.append(document.createElement('span'));
    inner.append(emblem, title, caption, dots); overlay.append(inner); document.body.append(overlay);
    let finished = false;
    const dismiss = () => {
        if (finished) return;
        finished = true; clearTimeout(timeout);
        document.removeEventListener('portfolio:ready', dismiss);
        overlay.classList.add('is-leaving');
        setTimeout(() => overlay.remove(), 400);
    };
    const timeout = setTimeout(dismiss, 5000);
    document.addEventListener('portfolio:ready', dismiss, { once: true });
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.querySelector('[data-content]')) dismiss();
    }, { once: true });
})();