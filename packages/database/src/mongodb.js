/**
 * api/lib/mongodb.js
 * 
 * Purpose: MongoDB connection management using Mongoose.
 * Implements connection caching for serverless environments and 
 * ensures connection to the primary 'backstage_events' database.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (!MONGODB_URI) {
    const error = new Error("MONGODB_URI_MISSING");
    error.missingConfig = true;
    throw error;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: 'backstage_events', // Always use the primary database globally
    };

    console.log(`[MONGODB] Connecting to primary database: backstage_events`);
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;

