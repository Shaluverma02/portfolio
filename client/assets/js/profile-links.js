(() => {
    const labels = { LinkedIn: 'linkedin', GitHub: 'github', Twitter: 'twitter', Telegram: 'telegram', Instagram: 'instagram', Hackerrank: 'hackerrank' };
    portfolioFetch('/api/profile', { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error('Profile unavailable');
        return response.json();
    }).then(profile => {
        function safeUrl(value) {
            try {
                const url = new URL(value);
                return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
            } catch { return null; }
        }
        const aboutImage = document.querySelector('#about .image img');
        const imageUrl = safeUrl(profile.aboutImageUrl);
        if (aboutImage && imageUrl) {
            const original = aboutImage.getAttribute('src');
            aboutImage.addEventListener('error', () => { aboutImage.src = original; }, { once: true });
            aboutImage.src = imageUrl;
        }
        for (const social of profile.customSocials || []) {
            const href = safeUrl(social.url);
            if (!href) continue;
            for (const container of document.querySelectorAll('.social-icons, .footer .share')) {
                const link = document.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
                link.className = 'custom-social-link'; link.setAttribute('aria-label', social.label); link.title = social.label;
                const iconUrl = safeUrl(social.iconUrl);
                const fallback = () => {
                    const symbol = document.createElement('span'); symbol.textContent = '\u2197'; symbol.setAttribute('aria-hidden', 'true');
                    link.replaceChildren(symbol);
                };
                if (iconUrl) {
                    const icon = document.createElement('img'); icon.src = iconUrl; icon.alt = ''; icon.loading = 'lazy';
                    icon.addEventListener('error', fallback, { once: true }); link.append(icon);
                } else fallback();
                if (container.matches('ul')) {
                    const item = document.createElement('li'); item.append(link); container.append(item);
                } else container.append(link);
            }
        }
        document.querySelectorAll('a[aria-label]').forEach(link => {
            if (link.classList.contains('custom-social-link')) return;
            const key = labels[link.getAttribute('aria-label')];
            if (!key || !(key in profile.socials)) return;
            const value = profile.socials[key];
            const wrapper = link.closest('.social-icons li') || link;
            if (!value) { wrapper.hidden = true; return; }
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
            wrapper.hidden = false; link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        });
    }).catch(() => { /* Existing links remain available if the request fails. */ });
})();