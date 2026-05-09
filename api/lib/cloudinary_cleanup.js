/**
 * api/lib/cloudinary_cleanup.js
 * 
 * Purpose: Backend utility to purge Cloudinary assets for expired events.
 * This helps manage "Credits" by removing large video/PPT assets 
 * once their respective events are over.
 */
import { v2 as cloudinary } from 'cloudinary';
import { Event } from './models.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const purgeEventAssets = async (eventId) => {
    try {
        const event = await Event.findById(eventId);
        if (!event) return;

        // Extract public IDs from URLs (Background Video, Images)
        const assetsToPurge = [];
        if (event.backgroundVideo) assetsToPurge.push(extractPublicId(event.backgroundVideo));
        if (event.posterImage) assetsToPurge.push(extractPublicId(event.posterImage));
        
        // Purge using Cloudinary Admin API
        const validIds = assetsToPurge.filter(Boolean);
        if (validIds.length > 0) {
            await cloudinary.api.delete_resources(validIds);
            console.log(`[CLOUDINARY_CLEANUP] Purged ${validIds.length} assets for event: ${eventId}`);
        }
    } catch (err) {
        console.error('[CLOUDINARY_CLEANUP_ERROR]:', err);
    }
};

function extractPublicId(url) {
    try {
        // Simple regex to get public ID from Cloudinary URL
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.split('.')[0];
    } catch (e) {
        return null;
    }
}
