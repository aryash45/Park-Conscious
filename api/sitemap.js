/**
 * api/sitemap.js
 *
 * Purpose: Generates a dynamic XML sitemap for Google Search Console.
 * Serves marketing pages + public events. Always returns valid XML.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import './lib/env.js';

const WWW_ORIGIN = (() => {
    const raw = process.env.CANONICAL_ORIGIN || process.env.NEXT_PUBLIC_CANONICAL_ORIGIN || 'https://www.parkconscious.in';
    try {
        return new URL(raw).origin;
    } catch {
        return 'https://www.parkconscious.in';
    }
})();

const EVENTS_ORIGIN = (() => {
    const raw = process.env.EVENTS_CANONICAL_ORIGIN || 'https://events.parkconscious.in';
    try {
        return new URL(raw).origin;
    } catch {
        return 'https://events.parkconscious.in';
    }
})();

const MARKETING_PATHS = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/find-parking.html', priority: '0.9', changefreq: 'weekly' },
    { path: '/about.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/contact.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/technology.html', priority: '0.8', changefreq: 'monthly' },
];

const escapeXml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.toString().replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

const urlEntry = (loc, { lastmod, priority = '0.8', changefreq = 'weekly' } = {}) => {
    let entry = `\n  <url>\n    <loc>${escapeXml(loc)}</loc>`;
    if (lastmod) entry += `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`;
    entry += `\n    <priority>${escapeXml(priority)}</priority>`;
    if (changefreq) entry += `\n    <changefreq>${escapeXml(changefreq)}</changefreq>`;
    entry += `\n  </url>`;
    return entry;
};

const buildFallbackSitemap = (origin) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(origin)}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`;

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method Not Allowed');
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    if (req.method === 'HEAD') {
        return res.status(200).end();
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const siteParam = req.query.site || '';
    const isEvents = host.includes('events.') || siteParam === 'events';
    const origin = isEvents ? EVENTS_ORIGIN : WWW_ORIGIN;

    try {
        await connectDB();
        const Event = models.Event;

        const events = await Event.find({
            status: { $in: ['published', 'active', 'Published', 'Active'] },
            isPublic: true,
        }).select('_id slug updatedAt').lean();

        const today = new Date().toISOString().split('T')[0];
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        if (isEvents) {
            // Events site sitemap: only show events app pages
            xml += urlEntry(`${EVENTS_ORIGIN}/`, { lastmod: today, priority: '1.0', changefreq: 'daily' });

            events.forEach((event) => {
                const lastMod = event.updatedAt
                    ? new Date(event.updatedAt).toISOString().split('T')[0]
                    : today;
                const segment = event.slug || event._id;
                xml += urlEntry(`${EVENTS_ORIGIN}/event/${segment}`, {
                    lastmod: lastMod,
                    priority: '0.8',
                    changefreq: 'weekly',
                });
            });
        } else {
            // Marketing site sitemap: only show marketing pages
            MARKETING_PATHS.forEach(({ path, priority, changefreq }) => {
                xml += urlEntry(`${WWW_ORIGIN}${path}`, { lastmod: today, priority, changefreq });
            });
        }

        xml += '\n</urlset>';
        return res.status(200).send(xml);
    } catch (err) {
        console.error('[SITEMAP_ERROR]:', err);
        return res.status(200).send(buildFallbackSitemap(origin));
    }
}
