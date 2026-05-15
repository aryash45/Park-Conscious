/**
 * api/lib/mongodb.js
 * 
 * Optimized MongoDB connection for serverless environments.
 * Uses a global cache to prevent multiple connections during cold starts.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
    dotenv.config({ path: '.env.local', override: true });
}

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();

if (!MONGODB_URI) {
    console.warn("[DB_WARN]: MONGODB_URI is not defined or is empty.");
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
        // Double check we are on the correct database
        const targetDb = process.env.DB_NAME || "backstage_events";
        if (cached.conn.connection.name === targetDb) {
            return cached.conn;
        }
        console.warn(`[DB_RECONNECT]: Connection mismatch (${cached.conn.connection.name} vs ${targetDb}). Reconnecting...`);
        cached.conn = null;
        cached.promise = null;
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
