/**
 * api/lib/utils.js
 * 
 * Purpose: Utility functions for API handlers, including:
 * - Request body parsing (safe)
 * - Authentication (JWT)
 * - Error logging and standardization
 * - CORS management
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_not_for_prod";

export const json = (res, data, status = 200) => {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(JSON.stringify(data));
};

export const getBody = async (req) => {
    // Immediate return for methods that shouldn't have bodies to avoid hangs in serverless
    if (["GET", "DELETE", "HEAD", "OPTIONS"].includes(req.method)) {
        return {};
    }

    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                console.error("[BODY_PARSE_ERROR]:", e.message);
                resolve({});
            }
        });
        req.on("error", (err) => {
            console.error("[BODY_STREAM_ERROR]:", err.message);
            reject(err);
        });
    });
};

export const verifyUser = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.split(" ")[1];
        if (!token) return null;

        if (process.env.JWT_SECRET === undefined) {
            console.warn("[AUTH_WARN]: JWT_SECRET is undefined. Auth will likely fail.");
        }

        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        console.error("[VERIFY_USER_ERROR]:", e.message);
        return null;
    }
};

export const issueCookie = (payload) => {
    if (!process.env.JWT_SECRET) {
        console.error("[AUTH_ERROR]: Cannot issue cookie, JWT_SECRET missing.");
        return null;
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const normalizeEvent = (event) => {
    if (!event) return null;
    return {
        ...event.toObject ? event.toObject() : event,
        id: event._id?.toString() || event.id,
    };
};

export const pruneEvent = (event) => {
    if (!event) return null;
    const { 
        __v, 
        managedBy, 
        isDeleted, 
        customForms, 
        paymentSettings,
        ...rest 
    } = event.toObject ? event.toObject() : event;
    
    return {
        ...rest,
        id: event._id?.toString() || event.id
    };
};

export const logSystemError = async (context, error) => {
    console.error(`[SYSTEM_ERROR][${context}]:`, error);
    try {
        // Dynamic import to avoid circular dependency
        const { SystemLog } = await import("./models.js");
        await SystemLog.create({
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
        });
    } catch (e) {
        console.error("[LOGGING_FAILED]:", e.message);
    }
};

export const setCors = (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        "https://events.parkconscious.in",
        "https://admin.parkconscious.in",
        "https://www.parkconscious.in",
        "http://localhost:3000",
        "http://localhost:3001"
    ];

    if (origin && (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app"))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // Fallback for safety during debug
        res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,PATCH,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
};
