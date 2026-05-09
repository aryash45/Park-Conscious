import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB.");
    
    // Connect to the specific database
    const db = mongoose.connection.useDb('backstage_events', { useCache: true });
    
    // Define the schema inline for the script
    const bookingSchema = new mongoose.Schema({}, { strict: false });
    const Booking = db.model('Booking', bookingSchema);

    const bookings = await Booking.find({});
    let deletedCount = 0;

    for (let b of bookings) {
        if (b.customData) {
            let corrupted = false;
            for (let key in b.customData) {
                if (typeof b.customData[key] === 'string' && b.customData[key].includes("Upload Failed")) {
                    corrupted = true;
                    break;
                }
            }
            if (corrupted) {
                await Booking.findByIdAndDelete(b._id);
                console.log(`Deleted corrupted booking: ${b._id}`);
                deletedCount++;
            }
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} corrupted bookings.`);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
