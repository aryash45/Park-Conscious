/**
 * api/sitemap.xml.js
 * 
 * Purpose: Generates a dynamic XML sitemap for Google Search Console.
 * Fetches all active/published events from MongoDB and includes them in the crawl list.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import './lib/env.js';

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

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method Not Allowed');
    }

    try {
        await connectDB();
        const Event = models.Event;

        // Fetch all public, published events
        const events = await Event.find({ 
            status: { $in: ["published"] },
            isPublic: true 
        }).select('_id slug updatedAt').lean();

        const rawBaseUrl = process.env.CANONICAL_ORIGIN || process.env.NEXT_PUBLIC_CANONICAL_ORIGIN || 'https://events.parkconscious.in';
        const baseUrl = rawBaseUrl.replace(/\/+$/, '');

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(baseUrl)}/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>`;

        // Add each event to the sitemap
        events.forEach(event => {
            const lastMod = event.updatedAt ? new Date(event.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const eventUrl = event.slug ? `${baseUrl}/event/${event.slug}` : `${baseUrl}/event/${event._id}`;
            xml += `
  <url>
    <loc>${escapeXml(eventUrl)}</loc>
    <lastmod>${escapeXml(lastMod)}</lastmod>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>`;
        });

        xml += `\n</urlset>`;

        res.setHeader('Content-Type', 'text/xml');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
        return res.status(200).send(xml);
    } catch (err) {
        console.error('[SITEMAP_ERROR]:', err);
        return res.status(500).send('Error generating sitemap');
    }
}
