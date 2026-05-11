import mongoose from 'mongoose';
import * as models from '../api/lib/models.js';
import dotenv from 'dotenv';

dotenv.config();

const { Event } = models;

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // Update all existing events to be public and listingPaid by default (since they were created under the old model)
        const result = await Event.updateMany(
            { isPublic: { $exists: false } },
            { $set: { isPublic: true, listingPaid: true } }
        );

        console.log(`Migration complete. Updated ${result.modifiedCount} events.`);
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
