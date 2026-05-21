/**
 * api/robots.js
 * 
 * Purpose: Serves a dynamic robots.txt based on the host.
 * Ensures sitemaps are discoverable and API routes for metadata are crawlable.
 */
const WWW_ORIGIN = process.env.CANONICAL_ORIGIN || 'https://www.parkconscious.in';
const EVENTS_ORIGIN = process.env.EVENTS_CANONICAL_ORIGIN || 'https://events.parkconscious.in';

export default function handler(req, res) {
    const host = req.headers.host || '';
    const isEvents = host.includes('events.');
    
    let robots = `User-agent: *
Disallow: /owner/
Disallow: /AdminPanel/
`;

    if (isEvents) {
        robots += `Sitemap: ${EVENTS_ORIGIN}/sitemap.xml
`;
    } else {
        robots += `Disallow: /api/
Sitemap: ${WWW_ORIGIN}/sitemap.xml
`;
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(robots);
}
