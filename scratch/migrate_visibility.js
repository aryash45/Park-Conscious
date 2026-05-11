import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateEvents() {
    if (!MONGODB_URI) {
        console.error("No MONGODB_URI found.");
        process.exit(1);
    }
    
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;
        
        // Find events that are published but have isPublic: false
        const hiddenEvents = await db.collection('events').find({
            status: { $in: ['published', 'Published'] },
            isPublic: false
        }).toArray();
        
        console.log(`Found ${hiddenEvents.length} events that are published but hidden due to isPublic: false`);
        
        if (hiddenEvents.length > 0) {
            const result = await db.collection('events').updateMany(
                { status: { $in: ['published', 'Published'] }, isPublic: false },
                { $set: { isPublic: true } }
            );
            console.log(`Updated ${result.modifiedCount} events to isPublic: true`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

migrateEvents();
