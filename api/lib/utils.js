/**
 * api/lib/utils.js
 * 
 * Purpose: Utility functions for API handlers.
 * Optimized for resilience and data visibility.
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_not_for_prod";

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

        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
};

export const issueCookie = (payload) => {
    if (!process.env.JWT_SECRET) return null;
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
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

export const logSystemError = async (context, error) => {
    console.error(`[SYSTEM_ERROR][${context}]:`, error);
    try {
        const { SystemLog } = await import("./models.js");
        await SystemLog.create({
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
        });
    } catch (e) {}
};

export const setCors = (req, res) => {
    const origin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,PATCH,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
};
