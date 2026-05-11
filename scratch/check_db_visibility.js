import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkEvent() {
    await mongoose.connect(MONGODB_URI);
    const event = await mongoose.connection.db.collection('events').findOne({ 
        _id: new mongoose.Types.ObjectId("6a020c5d83c0f6252ddcab34") 
    });
    console.log('Event Status:', event ? event.status : 'NOT FOUND');
    console.log('Event Date:', event ? event.date : 'NOT FOUND');
    console.log('Event Name:', event ? event.name : 'NOT FOUND');
    
    // Check what the query would return
    const allPublished = await mongoose.connection.db.collection('events').find({
        status: { $in: ['published', 'Published'] }
    }).toArray();
    
    console.log(`Total published events: ${allPublished.length}`);
    const foundInQuery = allPublished.find(e => e._id.toString() === "6a020c5d83c0f6252ddcab34");
    console.log(`Is event in published query?: ${!!foundInQuery}`);

    await mongoose.disconnect();
}

checkEvent().catch(console.error);
