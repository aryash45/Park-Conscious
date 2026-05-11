import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const hostSchema = new mongoose.Schema({
    name: String,
    role: String,
    image: String,
    socialLink: String,
    instagram: String,
    socials: mongoose.Schema.Types.Mixed
});

const eventSchema = new mongoose.Schema({
    name: String,
    hosts: [hostSchema]
});

const Event = mongoose.model('Event', eventSchema);

async function check() {
    await mongoose.connect(MONGODB_URI);
    const events = await Event.find({}).lean();
    events.forEach(e => {
        console.log(`Event: ${e.name}`);
        console.log(`Hosts:`, JSON.stringify(e.hosts, null, 2));
    });
    await mongoose.disconnect();
}

check().catch(console.error);
