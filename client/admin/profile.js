(() => {
    const platforms = { linkedin: 'LinkedIn', github: 'GitHub', twitter: 'Twitter / X', telegram: 'Telegram', instagram: 'Instagram', hackerrank: 'HackerRank' };
    const form = document.querySelector('#profile-form');
    const fields = document.querySelector('#social-fields');
    const status = document.querySelector('#profile-status');
    const save = document.querySelector('#profile-save');
    for (const [key, label] of Object.entries(platforms)) {
        const field = document.createElement('div'); field.className = 'editor-field';
        const name = document.createElement('label'); name.htmlFor = key; name.textContent = label;
        const input = document.createElement('input'); input.id = key; input.name = key; input.type = 'url';
        input.maxLength = 2048; input.placeholder = 'https://'; input.autocomplete = 'url';
        const badge = document.createElement('span'); badge.className = 'profile-platform-badge platform-' + key;
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = { linkedin: 'in', github: 'GH', twitter: 'X', telegram: 'TG', instagram: 'IG', hackerrank: 'H' }[key];
        const header = document.createElement('div'); header.className = 'profile-platform-heading'; header.append(badge, name);
        field.classList.add('profile-platform-field'); field.append(header, input); fields.append(field);
    }
    const customFields = document.querySelector('#custom-social-fields');
    const addSocial = document.querySelector('#add-social');
    const aboutUrl = document.querySelector('#about-image-url');
    const preview = document.querySelector('#about-image-preview');
    const previewError = document.querySelector('#image-preview-error');
    const emptyCustom = document.querySelector('#custom-social-empty');
    function updateCustomState() {
        if (emptyCustom) emptyCustom.hidden = customFields.children.length > 0;
    }
    let nextId = 0;
    function addCustomSocial(item = {}) {
        if (customFields.children.length >= 30) return;
        const row = document.createElement('div'); row.className = 'custom-social-row';
        for (const [key, label, type] of [['label', 'Platform name', 'text'], ['url', 'Social link URL', 'url'], ['iconUrl', 'Icon image URL (optional)', 'url']]) {
            const field = document.createElement('div'); field.className = 'editor-field';
            const input = document.createElement('input'); input.type = type; input.dataset.field = key;
            input.id = 'custom-social-' + nextId++; input.maxLength = key === 'label' ? 80 : 2048;
            input.required = key !== 'iconUrl'; input.value = item[key] || '';
            input.placeholder = type === 'url' ? 'https://' : 'e.g. YouTube';
            const name = document.createElement('label'); name.htmlFor = input.id; name.textContent = label;
            field.append(name, input); row.append(field);
        }
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-secondary'; remove.textContent = 'Remove';
        remove.addEventListener('click', () => { row.remove(); updateCustomState(); addSocial.disabled = false; addSocial.focus(); });
        row.append(remove); customFields.append(row); updateCustomState(); addSocial.disabled = customFields.children.length >= 30;
        return row;
    }
    addSocial.addEventListener('click', () => addCustomSocial()?.querySelector('input').focus());
    function updatePreview() {
        previewError.hidden = true; preview.hidden = false;
        preview.src = aboutUrl.value.trim() || '/assets/images/profile2.jpg';
    }
    aboutUrl.addEventListener('input', updatePreview);
    preview.addEventListener('error', () => { preview.hidden = true; previewError.hidden = false; });
    preview.addEventListener('load', () => { preview.hidden = false; previewError.hidden = true; });
    function message(text, failed = false) {
        status.textContent = text; status.className = failed ? 'form-error' : 'success-message';
        status.setAttribute('role', failed ? 'alert' : 'status');
    }
    async function request(options) {
        const response = await portfolioFetch('/api/admin/profile', { cache: 'no-store', ...options });
        if (response.status === 401) { location.assign('/admin/login.html'); throw new Error('Please sign in again.'); }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save profile settings.');
        return result;
    }
    request().then(profile => {
        for (const key of Object.keys(platforms)) form.elements[key].value = profile.socials[key] || '';
        (profile.customSocials || []).forEach(addCustomSocial);
        aboutUrl.value = profile.aboutImageUrl || ''; updatePreview();
        addSocial.disabled = customFields.children.length >= 30;
        message('Your profile is ready to edit.'); save.disabled = false;
    }).catch(error => message(error.message, true));
    form.addEventListener('submit', async event => {
        event.preventDefault(); save.disabled = true; save.textContent = 'Saving...';
        const socials = Object.fromEntries(Object.keys(platforms).map(key => [key, form.elements[key].value.trim()]));
        try {
            await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ socials, aboutImageUrl: aboutUrl.value.trim(), customSocials: Array.from(customFields.children, row => Object.fromEntries(Array.from(row.querySelectorAll('input'), input => [input.dataset.field, input.value.trim()]))) }) });
            message('Profile settings saved. Your portfolio links are updated.');
        } catch (error) { message(error.message, true); }
        finally { save.disabled = false; save.textContent = 'Save changes'; }
    });
})();