/**
 * api/events.js
 * 
 * Main handler for event-related operations.
 * Proxied from events.parkconscious.in and admin.parkconscious.in
 */
import mongoose from "mongoose";
import connectDB from "./lib/mongodb.js";
import * as models from "./lib/models.js";
import { 
    json, 
    setCors, 
    getBody, 
    verifyUser, 
    normalizeEvent, 
    pruneEvent, 
    logSystemError 
} from "./lib/utils.js";
import crypto from "crypto";
import { getCache, setCache, delCache } from "./lib/redis.js";

export default async function handler(req, res) {
    // 1. Initial configuration
    setCors(req, res);
    if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.end();
        return;
    }

    // 2. Health check (Priority)
    const fullUrl = req.url || "/";
    if (fullUrl.includes("/health")) {
        const dbStatus = mongoose.connection.readyState;
        const dbName = mongoose.connection.name;
        return json(res, 200, { 
            status: "ONLINE", 
            timestamp: new Date().toISOString(),
            env: process.env.VERCEL_ENV || "development",
            database: {
                connected: dbStatus === 1,
                name: dbName || "none",
                status: ["disconnected", "connected", "connecting", "disconnecting"][dbStatus]
            }
        });
    }

    // 3. Main Logic wrapper
    try {
        await connectDB();
        const { Event, Discussion } = models;

        // GET: List or Single Event
        if (req.method === "GET") {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const eventId = url.searchParams.get("id");

            if (eventId) {
                // Try cache first
                const cached = await getCache(`event:${eventId}`);
                if (cached) return json(res, 200, cached);

                const event = await Event.findById(eventId);
                if (!event) {
                    return json(res, 404, { error: "Event not found" });
                }

                const data = pruneEvent(event);
                await setCache(`event:${eventId}`, data, 300); // 5 min cache
                return json(res, 200, data);
            }

            // List Filtered Events
            const filter = { status: "active" };
            const type = url.searchParams.get("type");
            if (type) filter.type = type;
            
            const events = await Event.find(filter)
                .sort({ startDate: 1 })
                .limit(50);

            return json(res, 200, events.map(pruneEvent));
        }

        // POST: Create or Update (Requires Auth)
        if (req.method === "POST") {
            const user = verifyUser(req);
            if (!user) return json(res, 401, { error: "Unauthorized" });

            const body = await getBody(req);
            
            // Handle Razorpay Order Creation (if requested)
            if (body.action === "create_order") {
                // Dynamic import to prevent initialization crashes
                const { default: Razorpay } = await import("razorpay");
                
                if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                    return json(res, 500, { error: "Payment gateway misconfigured" });
                }

                const rzp = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET,
                });

                const order = await rzp.orders.create({
                    amount: body.amount * 100, // in paise
                    currency: "INR",
                    receipt: `receipt_${Date.now()}`,
                });

                return json(res, 200, order);
            }

            // Standard Event Create/Update logic...
            // (Placeholder for brevity, assuming standard CRUD)
            return json(res, 200, { message: "Action processed" });
        }

        return json(res, 405, { error: "Method not allowed" });

    } catch (error) {
        console.error("[FATAL_HANDLER_ERROR]:", error);
        await logSystemError("API_EVENTS_HANDLER", error);
        
        return json(res, 500, { 
            error: "Internal Server Error", 
            message: error.message,
            code: error.code || "UNKNOWN_CRASH",
            status: "CRASHED"
        });
    }
}
