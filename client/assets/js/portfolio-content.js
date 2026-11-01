// All editable portfolio sections read the same JSON records as the admin panel.
(() => {
    function node(tag, className, value) {
        const item = document.createElement(tag);
        if (className) item.className = className;
        if (value !== undefined) item.textContent = String(value);
        return item;
    }
    function safeUrl(value) {
        if (typeof value !== 'string' || !value || value === '#') return null;
        try {
            const url = new URL(value, location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
        } catch { return null; }
    }
    const emptyStates = {
        skills: ['fas fa-layer-group', 'A toolkit in the making', 'New skills and technologies will appear here as the journey grows.'],
        projects: ['fas fa-laptop-code', 'Good things are being built', 'A new collection of ideas, experiments, and finished projects is on its way.'],
        experience: ['fas fa-briefcase', 'The next chapter awaits', 'New roles, collaborations, and milestones will be shared here.'],
        education: ['fas fa-graduation-cap', 'A journey of learning', 'Education and academic milestones will appear here soon.'],
        certificates: ['fas fa-award', 'Always learning, always growing', 'New certificates and learning milestones will be shared here.']
    };
    function stateCard(collection, errorMessage) {
        const [icon, title, description] = emptyStates[collection] || emptyStates.projects;
        const card = node('div', 'portfolio-empty-state');
        card.setAttribute('role', 'status');
        const symbol = node('i', errorMessage ? 'fas fa-cloud' : icon);
        symbol.setAttribute('aria-hidden', 'true');
        const artwork = node('div', 'empty-state-art'); artwork.append(symbol);
        card.append(artwork, node('span', 'empty-state-eyebrow', errorMessage ? 'A little pause' : 'More to come'),
            node('h3', '', errorMessage ? 'We’ll be back in a moment' : title),
            node('p', '', errorMessage || description));
        if (errorMessage) {
            const retry = node('button', 'empty-state-action', 'Try again'); retry.type = 'button';
            retry.addEventListener('click', () => load(card.parentElement)); card.append(retry);
        }
        return card;
    }
    function status(container, message) {
        container.replaceChildren(stateCard(container.dataset.content, message));
        container.classList.add('content-empty');
    }
    function empty(container) {
        container.replaceChildren(stateCard(container.dataset.content));
        container.classList.add('content-empty');
    }
    function image(src, alt, fallback) {
        const img = node('img'); img.src = src; img.alt = alt; img.loading = 'lazy'; img.draggable = false;
        img.addEventListener('error', () => { if (fallback) img.replaceWith(fallback); else img.remove(); });
        return img;
    }
    function renderSkills(container, records) {
        for (const skill of records) {
            const bar = node('div', 'bar'); const info = node('div', 'info');
            const fallback = node('span', 'skill-fallback', String(skill.name || '?').slice(0, 2));
            const url = safeUrl(skill.icon);
            info.append(url ? image(url, '', fallback) : fallback, node('span', '', skill.name));
            bar.append(info); container.append(bar);
        }
    }
    function previewRecords(container, records) {
        const limit = Number(container.dataset.previewLimit);
        return Number.isInteger(limit) && limit > 0 ? records.slice(0, limit) : records;
    }
    function renderProjects(container, records) {
        const grid = container.dataset.projectLayout === 'grid';
        for (const project of previewRecords(container, records)) {
            const card = node('article', 'box project-card');
            const basename = typeof project.image === 'string' && /^[a-zA-Z0-9_-]+$/.test(project.image);
            const src = basename ? `/assets/images/projects/${encodeURIComponent(project.image)}.PNG` : safeUrl(project.image);
            const preview = node('div', 'project-preview');
            const placeholder = node('div', 'project-placeholder');
            const placeholderIcon = node('i', 'fas fa-laptop-code');
            placeholderIcon.setAttribute('aria-hidden', 'true');
            placeholder.append(placeholderIcon, node('span', '', project.name || 'Project preview'));
            preview.append(src ? image(src, project.name || 'Project preview', placeholder) : placeholder);
            const categories = { basicweb: 'Web development', mern: 'MERN stack', android: 'Android app', lamp: 'LAMP stack' };
            preview.append(node('span', 'project-category', categories[project.category] || project.category || 'Project'));
            card.append(preview);
            const content = node('div', 'content'); const tag = node('div', 'tag');
            tag.append(node('h3', '', project.name));
            const description = node('div', 'desc'); description.append(node('p', '', project.desc));
            const links = node('div', 'btns');
            for (const [key, label, icon] of [['view', 'View', 'fas fa-eye'], ['code', 'Code', 'fas fa-code']]) {
                const url = safeUrl(project.links?.[key]);
                const link = node(url ? 'a' : 'button', 'btn');
                if (url) {
                    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
                    link.setAttribute('aria-label', `${label} ${project.name || 'project'} (opens in a new tab)`);
                } else {
                    link.type = 'button'; link.disabled = true;
                    link.title = `${label} link coming soon`;
                    link.setAttribute('aria-label', `${label} ${project.name || 'project'} — link coming soon`);
                }
                const symbol = node('i', icon); symbol.setAttribute('aria-hidden', 'true');
                link.append(symbol, document.createTextNode(` ${label}`)); links.append(link);
            }
            description.append(links); content.append(tag, description); card.append(content);
            if (grid) {
                const wrapper = node('div', 'grid-item'); wrapper.dataset.category = project.category;
                wrapper.append(card); container.append(wrapper);
            } else container.append(card);
        }
        if (grid) {
            const filterStatus = stateCard('projects');
            filterStatus.classList.add('project-filter-empty');
            filterStatus.querySelector('h3').textContent = 'No projects in this category yet';
            filterStatus.querySelector('p').textContent = 'Explore the other categories to see what I have been building.';
            const reset = node('button', 'empty-state-action', 'View all projects');
            reset.type = 'button';
            reset.addEventListener('click', () => document.querySelector('#filters [data-filter="*"]')?.click());
            filterStatus.append(reset);
            filterStatus.hidden = true;
            container.append(filterStatus);
            const applyFilter = button => {
                const category = button.dataset.filter.replace(/^\./, '');
                let shown = 0;
                container.querySelectorAll('.grid-item').forEach(item => {
                    item.hidden = category !== '*' && item.dataset.category !== category;
                    if (!item.hidden) shown++;
                });
                document.querySelectorAll('#filters button').forEach(filter => {
                    filter.classList.toggle('is-checked', filter === button);
                    filter.setAttribute('aria-pressed', String(filter === button));
                });
                filterStatus.hidden = shown > 0;

            };
            document.querySelectorAll('#filters button').forEach(button => button.addEventListener('click', () => applyFilter(button)));
            const selected = document.querySelector('#filters .is-checked'); if (selected) applyFilter(selected);
        }
    }
    function renderExperience(container, records) {
        // Sort year-wise descending — latest end year on top.
        // "Present" / "current" = this year so active roles always float first.
        function extractEndYear(period) {
            if (!period) return 0;
            const lower = period.toLowerCase();
            if (lower.includes('present') || lower.includes('current')) return new Date().getFullYear();
            const years = period.match(/\b(19|20)\d{2}\b/g);
            if (years && years.length) return parseInt(years[years.length - 1], 10);
            return 0;
        }
        const sorted = [...records].sort((a, b) => extractEndYear(b.period) - extractEndYear(a.period));
        previewRecords(container, sorted).forEach((experience, index) => {
            const row = node('div', `container ${index % 2 === 0 ? 'left' : 'right'}`);
            const content = node('div', 'content'); const tag = node('div', 'tag');
            tag.append(node('h2', '', experience.title));
            const description = node('div', 'desc');
            description.append(node('h3', '', experience.role), node('p', '', experience.period));
            if (experience.description) description.append(node('p', 'experience-description', experience.description));
            content.append(tag, description); row.append(content); container.append(row);
        });
    }
    function renderEducation(container, records) {
        for (const education of records) {
            const card = node('div', 'box');
            const imageUrl = safeUrl(education.image);
            if (imageUrl) {
                const preview = node('div', 'image');
                preview.append(image(imageUrl, `${education.institution || education.title} logo`));
                card.append(preview);
            }
            const content = node('div', 'content');
            content.append(
                node('h3', '', education.title),
                node('p', '', education.institution),
                node('h4', '', education.period)
            );
            if (education.description) content.append(node('p', '', education.description));
            card.append(content);
            container.append(card);
        }
    }
    function certificatePlaceholder() {
        const placeholder = node('div', 'certificate-placeholder');
        const badge = node('img'); badge.src = '/assets/images/certificate-badge.svg'; badge.alt = ''; badge.width = 80; badge.height = 96;
        placeholder.append(badge, node('span', '', 'Certificate'));
        placeholder.setAttribute('aria-hidden', 'true');
        return placeholder;
    }
    function renderCertificates(container, records) {
        if (!records.length) {
            const empty = node('div', 'certificate-empty');
            const badge = node('img'); badge.src = '/assets/images/certificate-badge.svg'; badge.alt = ''; badge.width = 80; badge.height = 96;
            empty.append(badge, node('h3', '', 'The learning journey continues'), node('p', '', 'Certificates will appear here as new milestones are added.'));
            container.append(empty);
            return;
        }
        for (const certificate of records) {
            const card = node('article', 'certificate-card');
            const preview = node('div', 'certificate-preview');
            const imageUrl = safeUrl(certificate.image);
            preview.append(imageUrl ? image(imageUrl, `${certificate.title} certificate`, certificatePlaceholder()) : certificatePlaceholder());
            const body = node('div', 'certificate-body');
            body.append(node('p', 'certificate-issuer', certificate.issuer), node('h3', '', certificate.title));
            if (certificate.issuedOn) {
                const date = new Date(`${certificate.issuedOn}T00:00:00Z`);
                if (!Number.isNaN(date.getTime())) {
                    const issued = node('time', 'certificate-date', `Issued ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)}`);
                    issued.dateTime = certificate.issuedOn; body.append(issued);
                }
            }
            if (certificate.description) body.append(node('p', 'certificate-description', certificate.description));
            if (certificate.credentialId) {
                const credential = node('p', 'certificate-id', 'Credential ID: ');
                credential.append(node('span', '', certificate.credentialId)); body.append(credential);
            }
            const url = safeUrl(certificate.url) || imageUrl;
            if (url) {
                const footer = node('div', 'certificate-footer');
                const link = node('a', 'certificate-link'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
                link.setAttribute('aria-label', `View ${certificate.title} certificate (opens in a new tab)`);
                const arrow = node('span', '', '\u2197'); arrow.setAttribute('aria-hidden', 'true');
                link.append(node('span', '', 'View certificate'), arrow); footer.append(link); body.append(footer);
            }
            card.append(preview, body); container.append(card);
        }
    }
    const renderers = { skills: renderSkills, projects: renderProjects, experience: renderExperience, education: renderEducation, certificates: renderCertificates };
    async function load(container) {
        const collection = container.dataset.content;
        container.setAttribute('aria-busy', 'true');
        const pending = node('div', 'section-loading');
        pending.setAttribute('role', 'status');
        const ring = node('span', 'section-loading-ring'); ring.setAttribute('aria-hidden', 'true');
        pending.append(ring, node('span', '', 'Loading ' + collection + '…'));
        container.classList.remove('content-empty'); container.replaceChildren(pending);
        try {
            const response = await portfolioFetch(`/${collection}.json`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Unable to load portfolio content.');
            const text = await response.text();
            const records = text.trim() ? JSON.parse(text) : [];
            if (!Array.isArray(records)) throw new Error('Invalid portfolio data.');
            container.replaceChildren(); container.classList.remove('content-empty');
            if (!records.length) { empty(container); return; }
            renderers[collection](container, records);
            // Register freshly loaded cards without restarting existing reveals.
            window.PortfolioMotion?.refresh(container);
        } catch {
            status(container, `Could not load ${collection}. Please refresh the page.`);
        } finally { container.setAttribute('aria-busy', 'false'); }
    }
    Promise.all(Array.from(document.querySelectorAll('[data-content]'), load)).finally(() => {
        document.dispatchEvent(new Event('portfolio:ready'));
    });
    async function loadActiveResume() {
        try {
            const response = await portfolioFetch('/api/resumes/active', { cache: 'no-store' });
            if (!response.ok) throw new Error('Unable to load the active resume.');
            const result = await response.json();
            if (typeof result.url === 'string' && result.url.startsWith('/resumes/')) {
                const link = document.querySelector('#resume-link');
                if (link) link.href = portfolioApiUrl(result.url);
            }
        } catch (error) {
            console.error('Could not load the active resume:', error);
        }
    }
    loadActiveResume();
})();
