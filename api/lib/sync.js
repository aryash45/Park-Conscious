/**
 * api/lib/sync.js
 * 
 * Purpose: Utility for cross-database identity synchronization.
 * Mirrored user and owner profiles from 'backstage_events' to 'park_conscious' 
 * to ensure consistent session data across both platforms.
 */
import mongoose from 'mongoose';
import { getSecondaryModel } from './models.js';

/**
 * Ensures user identity (Owner or User) is synced to the secondary database (Park Conscious).
 * Since they are physically separated databases, we do a quick upsert in the background.
 */
export async function syncIdentity(data, isOwner = false) {
    if (!data || !data.email) return;

    // Fire and forget: We don't await this in the main handler to prevent blocking
    const runSync = async () => {
        try {
            const cleanData = JSON.parse(JSON.stringify(data));
            delete cleanData._id;

            const SecModel = isOwner ? getSecondaryModel('Owner') : getSecondaryModel('User');

            // Use a timeout for the DB operation
            await Promise.race([
                SecModel.findOneAndUpdate(
                    { email: cleanData.email },
                    { $set: cleanData },
                    { upsert: true, new: true }
                ),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Sync Timeout")), 2000))
            ]);

            console.log(`[SYNC] Success: ${cleanData.email} mirrored.`);
        } catch (err) {
            console.error(`[SYNC ERROR] Failed to mirror identity for ${data.email}:`, err.message);
        }
    };

    runSync(); // Execute in background
}
