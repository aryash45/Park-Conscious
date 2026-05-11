import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkEvent() {
    await mongoose.connect(MONGODB_URI);
    const event = await mongoose.connection.db.collection('events').findOne({ 
        _id: new mongoose.Types.ObjectId("6a020c5d83c0f6252ddcab34") 
    });
    console.log('Event:', JSON.stringify(event, null, 2));
    await mongoose.disconnect();
}

checkEvent().catch(console.error);
