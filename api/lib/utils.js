/**
 * api/lib/utils.js
 * 
 * Purpose: Utility functions for API handlers.
 * Optimized for resilience and data visibility.
 */
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";

// NOTE: We no longer cache JWT_SECRET at the top level to avoid race conditions with dotenv loading.

/**
 * Standard JSON response utility.
 * Signature matches existing codebase: (res, status, data)
 */
export const json = (res, status, data) => {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status || 200;
    res.end(JSON.stringify(data || {}));
};

export const getBody = async (req) => {
    // If Express middleware (like express.raw) already consumed the body, use it
    if (req.body) {
        try {
            const raw = Buffer.isBuffer(req.body) ? req.body.toString() : 
                        (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return typeof req.body === 'object' ? req.body : {};
        }
    }

    // Immediate return for methods that shouldn't have bodies to avoid hangs
    if (["GET", "DELETE", "HEAD", "OPTIONS"].includes(req.method)) {
        return {};
    }

    return new Promise((resolve) => {
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", () => {
            try { resolve(body ? JSON.parse(body) : {}); } 
            catch (e) { resolve({}); }
        });
        req.on("error", () => { resolve({}); });
        
        // Safety timeout for the stream
        setTimeout(() => resolve({}), 5000);
    });
};

export const verifyUser = (req) => {
    try {
        const cookies = parse(req.headers.cookie || "");
        let token = cookies.token;

        // Fallback: Check Authorization header (used by some Admin clients)
        const authHeader = req.headers.authorization;
        if (!token && authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) return null;
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is missing.");
        return jwt.verify(token, secret);
    } catch (e) {
        console.error("[AUTH_VERIFY_ERROR]:", e.message);
        return null;
    }
};

export const issueCookie = (req, res, payload) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is missing.");
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });
    
    // Set the cookie globally, with conditional Domain/Secure for localhost testing
    const host = req.headers.host || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const domain = isLocalhost ? undefined : '.parkconscious.in';
    const secure = !isLocalhost;
    
    res.setHeader("Set-Cookie", serialize("token", token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        domain,
        maxAge: 7 * 24 * 60 * 60,
        path: "/"
    }));
    
    return token;
};

export const normalizeEvent = (event) => {
    if (!event) return null;
    const obj = event.toObject ? event.toObject() : event;
    return {
        ...obj,
        id: obj._id?.toString() || obj.id,
    };
};

/**
 * Prune sensitive internal fields but KEEP all functional data 
 * required by the frontend (like customForms, hosts, etc.)
 */
export const pruneEvent = (event) => {
    if (!event) return null;
    const obj = event.toObject ? event.toObject() : event;
    
    // We only remove true internal overhead, NOT functional fields
    const { 
        __v, 
        ...rest 
    } = obj;
    
    return {
        ...rest,
        id: obj._id?.toString() || obj.id
    };
};

export const logSystemError = async (source, type, message, stack, metadata = {}) => {
    try {
        const { SystemLog } = await import("./models.js");
        const crypto = await import('crypto');
        
        // Create a unique hash for this specific error from this source
        const hash = crypto.default.createHash('md5').update(`${source}:${message}`).digest('hex');

        await SystemLog.findOneAndUpdate(
            { hash, resolved: false },
            { 
                $inc: { count: 1 },
                $set: { 
                    source, 
                    type, 
                    message, 
                    stack, 
                    metadata,
                    lastSeenAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true, new: true }
        );
    } catch (e) {
        console.error('[LOGGER_CRASH]:', e.message);
    }
};

export const setCors = (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://events.parkconscious.in',
        'https://admin.events.parkconscious.in',
        'https://parkconscious.in',
        'https://www.parkconscious.in',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175'
    ];

    // For local development, be permissive with localhost origins to support dynamic port assignment
    if (origin && (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // Fallback to primary production domain. Never reflect untrusted origins.
        res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,PATCH,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
};
