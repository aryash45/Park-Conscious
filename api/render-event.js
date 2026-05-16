/**
 * api/render-event.js
 * 
 * Purpose: Dynamic Server-Side Rendering of meta tags for event pages.
 * Fetches the actual index.html and injects event-specific metadata 
 * to ensure perfect social media previews (WhatsApp, Slack, etc.) 
 * while maintaining the full React SPA experience for users.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import { normalizeEvent } from './lib/utils.js';

const { Event } = models;

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id || id.length < 24) {
        return res.redirect('/');
    }

    try {
        await connectDB();
        const eventData = await Event.findById(id).lean();

        if (!eventData) {
            return res.redirect('/');
        }

        const event = normalizeEvent(eventData);
        
        // Prepare metadata
        const title = `${event.title} | BACKSTAGE`;
        const description = event.description?.substring(0, 160) || "Join us for an exclusive event experience.";
        
        // Use a high-res fallback if the event image is missing
        const imageUrl = event.images?.[0] || event.image || 'https://events.parkconscious.in/new_backstage.png';
        
        // Ensure image URL is absolute and uses HTTPS
        let absoluteImageUrl = imageUrl;
        if (imageUrl.startsWith('/')) {
            absoluteImageUrl = `https://events.parkconscious.in${imageUrl}`;
        }
        
        // Optimize Cloudinary image for Social Media
        // Optimize Cloudinary image for Social Media (1200x630 is the gold standard)
        if (absoluteImageUrl.includes('res.cloudinary.com')) {
            absoluteImageUrl = absoluteImageUrl.replace(/\/v\d+\//, '/').replace('/upload/', '/upload/q_auto,f_auto,w_1200,h_630,c_pad,b_black/');
        }

        const canonicalUrl = `https://events.parkconscious.in/event/${id}`;

        // Fetch the actual index.html from the build
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'events.parkconscious.in';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        
        let html = '';
        try {
            const indexUrl = `${protocol}://${host}/index.html`;
            console.log(`[RENDERER]: Fetching index from ${indexUrl}`);
            const indexResponse = await fetch(indexUrl, { 
                headers: { 'User-Agent': 'Backstage-SEO-Renderer' },
                timeout: 3000
            });
            if (indexResponse.ok) {
                html = await indexResponse.text();
            }
        } catch (fetchErr) {
            console.error('[RENDERER] Fetch index.html failed:', fetchErr.message);
        }

        // Fallback HTML if fetching index.html failed (avoids the "Logo-only" redirect)
        if (!html) {
            html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><head><body><div id="root"></div></body></html>`;
        }

        // Inject our dynamic meta tags by replacing the static ones
        const metaTags = `
    <!-- Dynamic SEO Injected by Backstage Renderer -->
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="BACKSTAGE">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${absoluteImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${absoluteImageUrl}">
        `;

        // More robust replacement logic
        html = html.replace(/<title>.*?<\/title>/gi, '');
        html = html.replace(/<meta property="og:.*?".*?>/gi, '');
        html = html.replace(/<meta name="twitter:.*?".*?>/gi, '');
        html = html.replace(/<meta name="description".*?>/gi, '');
        html = html.replace(/<!-- SEO & Social Media Metadata -->/gi, '');
        
        // Insert into head
        html = html.replace(/<head>/i, `<head>${metaTags}`);

        res.setHeader('Content-Type', 'text/html');
        // Explicitly tell scrapers NOT to cache this result
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.statusCode = 200;
        res.end(html);
    } catch (err) {
        console.error('Render Error:', err);
        return res.redirect('/');
    }
}
