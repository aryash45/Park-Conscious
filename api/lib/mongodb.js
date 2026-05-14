/**
 * api/lib/mongodb.js
 * 
 * Optimized MongoDB connection for serverless environments.
 * Uses a global cache to prevent multiple connections during cold starts.
 */
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.warn("[DB_WARN]: MONGODB_URI is not defined in environment variables.");
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and across function invocations in serverless.
 */
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        if (!process.env.MONGODB_URI) {
            throw new Error("Please define the MONGODB_URI environment variable");
        }

        const opts = {
            bufferCommands: false,
            // Force the database name to backstage_events to restore production visibility
            dbName: process.env.DB_NAME || "backstage_events",
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            console.log("[DB_SUCCESS]: Connected to MongoDB ->", mongoose.connection.name);
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error("[DB_ERROR]: Connection failed:", e.message);
        throw e;
    }

    return cached.conn;
}

export default connectToDatabase;
