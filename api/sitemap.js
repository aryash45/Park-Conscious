/**
 * api/sitemap.js
 * 
 * Purpose: Generates a dynamic XML sitemap for Google Search Console.
 * Fetches all active/published events from MongoDB and includes them in the crawl list.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import './lib/env.js';

export default async function handler(req, res) {
    try {
        await connectDB();
        const Event = models.Event;

        // Fetch all public, published events
        const events = await Event.find({ 
            status: { $in: ["active", "published", "Active", "Published"] },
            isPublic: true 
        }).select('_id updatedAt').lean();

        const host = req.headers.host || 'events.parkconscious.in';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>`;

        // Add each event to the sitemap
        events.forEach(event => {
            const lastMod = event.updatedAt ? new Date(event.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            xml += `
  <url>
    <loc>${baseUrl}/event/${event._id}</loc>
    <lastmod>${lastMod}</lastmod>
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
