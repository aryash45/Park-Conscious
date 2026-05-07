/**
 * api/render-event.js
 * 
 * Purpose: Server-side rendering of meta tags for event pages.
 * This function is used to provide dynamic Open Graph and Twitter Card 
 * metadata for social media scrapers (WhatsApp, Facebook, Twitter, etc.)
 * which do not execute client-side JavaScript.
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
        const imageUrl = event.images?.[0] || event.image || 'https://events.parkconscious.in/new_backstage.png';
        
        // Ensure image URL is absolute and uses HTTPS
        let absoluteImageUrl = imageUrl;
        if (imageUrl.startsWith('/')) {
            absoluteImageUrl = `https://events.parkconscious.in${imageUrl}`;
        }
        // Optimize Cloudinary image if applicable
        if (absoluteImageUrl.includes('res.cloudinary.com')) {
            absoluteImageUrl = absoluteImageUrl.replace('/upload/', '/upload/q_auto,f_auto,w_1200,h_630,c_fill/');
        }

        const canonicalUrl = `https://events.parkconscious.in/event/${id}`;

        // Return HTML with injected meta tags
        // We include a minimal structure that looks like our index.html
        // and a script that handles the redirect to the actual React app
        // for real users while providing the tags for crawlers.
        
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${absoluteImageUrl}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${canonicalUrl}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${absoluteImageUrl}">
</head>
<body>
    <h1>${event.title}</h1>
    <p>${description}</p>
    <img src="${absoluteImageUrl}" alt="${event.title}" />
</body>
</html>
        `);
    } catch (err) {
        console.error('Render Error:', err);
        return res.redirect('/');
    }
}
