const socialDefaults = {
    linkedin: 'https://www.linkedin.com/in/shalu-verma-065785273/',
    github: 'https://github.com/shalu22082002',
    twitter: 'https://twitter.com/sve52562',
    telegram: 'http://t.me/Amanverma_31',
    instagram: 'https://www.instagram.com/shalu_verma__31',
    hackerrank: 'https://www.hackerrank.com/profile/sve52562'
};
function validateProfile(body) {
    const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !body.socials || typeof body.socials !== 'object' || Array.isArray(body.socials)) invalid('Enter social media links.');
    const socials = {};
    for (const key of Object.keys(socialDefaults)) {
        const value = body.socials[key] ?? '';
        if (typeof value !== 'string' || value.length > 2048) invalid(key + ': enter a valid URL.');
        socials[key] = value.trim();
        if (!socials[key]) continue;
        try {
            const url = new URL(socials[key]);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
            socials[key] = url.href;
        } catch { invalid(key + ': use a full https:// or http:// URL.'); }
    }
    const profile = { socials };
    const validUrl = (value, label) => {
        if (typeof value !== 'string' || value.length > 2048) invalid(label + ': enter a valid URL.');
        if (!value.trim()) return '';
        try {
            const url = new URL(value.trim());
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
            return url.href;
        } catch { invalid(label + ': use a full https:// or http:// URL.'); }
    };
    if (body.aboutImageUrl !== undefined) profile.aboutImageUrl = validUrl(body.aboutImageUrl, 'About image');
    if (body.customSocials !== undefined) {
        if (!Array.isArray(body.customSocials) || body.customSocials.length > 30) invalid('You can add up to 30 custom social links.');
        profile.customSocials = body.customSocials.map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item) ||
                typeof item.label !== 'string' || !item.label.trim() || item.label.length > 80) invalid('Enter a social media name (up to 80 characters).');
            const url = validUrl(item.url, item.label);
            if (!url) invalid(item.label + ': a link URL is required.');
            return { label: item.label.trim(), url, iconUrl: validUrl(item.iconUrl ?? '', item.label + ' icon') };
        });
    }
    return profile;
}
module.exports = { socialDefaults, validateProfile };