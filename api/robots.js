/**
 * api/robots.js
 * 
 * Purpose: Serves a dynamic robots.txt based on the host.
 * Ensures sitemaps are discoverable and API routes for metadata are crawlable.
 */
export default function handler(req, res) {
    const host = req.headers.host || 'parkconscious.in';
    const isEvents = host.includes('events.');
    
    let robots = `User-agent: *
Disallow: /owner/
Disallow: /AdminPanel/
`;

    if (isEvents) {
        // Event Subdomain Rules
        robots += `Allow: /api/sitemap.js
Allow: /api/sitemap.xml
Sitemap: https://${host}/sitemap.xml
`;
    } else {
        // Main Domain Rules
        robots += `Disallow: /api/
Allow: /api/sitemap.js
Allow: /api/sitemap.xml
Sitemap: https://${host}/sitemap.xml
`;
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(robots);
}
