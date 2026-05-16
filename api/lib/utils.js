/**
 * api/lib/utils.js
 * 
 * Purpose: General utility functions for the API.
 * Includes data normalization (events), standard JSON response helpers, 
 * JWT verification, cookie issuance for cross-subdomain sessions, 
 * CORS configuration, and request body parsing.
 */
import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import mongoose from 'mongoose';
import './env.js';

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_65271829";

export function normalizeEvent(evt) {
    if (!evt) return null;
    const e = evt.toObject ? evt.toObject() : evt;
    
    // Title/Name Sync
    e.name = e.name || e.title || "Untitled Experience";
    e.title = e.title || e.name || "Untitled Experience";
    
    // Location/Venue Sync
    const locName = e.location?.name || e.locationName || e.venue || "TBA";
    const locAddr = e.location?.address || e.locationAddress || e.venueCity || "Delhi NCR, India";
    
    e.venue = locName;
    e.locationName = locName;
    e.locationAddress = locAddr;
    e.venueCity = locAddr;
    
    if (!e.location) {
        e.location = { 
            name: locName, 
            address: locAddr, 
            coordinates: { lat: 0, lng: 0 } 
        };
    }

    // Pricing Sync
    e.price = e.price ?? e.regularPrice ?? 0;
    e.regularPrice = e.regularPrice ?? e.price ?? 0;
    
    // Image Sync
    e.image = e.image || (e.images && e.images[0]) || "";
    if (e.image && (!e.images || e.images.length === 0)) e.images = [e.image];
    
    e.badge = e.badge || (e.status === 'published' ? 'LIVE' : '');
    
    // Visibility & Monetization
    e.isPublic = e.isPublic ?? false;
    e.listingPaid = e.listingPaid ?? false;
    
    // Ensure nested arrays exist
    e.hosts = e.hosts || [];
    e.ticketTiers = e.ticketTiers || [];
    
    // Ensure ID is present for frontend links
    e.id = e._id?.toString() || e.id;
    
    return e;
}

/**
 * pruneEvent
 * Security wrapper to remove sensitive fields before sending to client.
 */
export const pruneEvent = (event, isAdmin = false) => {
    if (!event) return null;
    const e = event.toObject ? event.toObject() : JSON.parse(JSON.stringify(event));
    
    // Optimization for public views: Keep IDs for navigation
    if (!isAdmin) {
        delete e.bankDetails;
        delete e.payouts;
        delete e.organizerPayout;
        delete e.platformFee;
        // Don't delete _id or id! The frontend needs them for links.
    }
    
    return normalizeEvent(e);
};

export const json = (res, status, data) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = status;
    res.end(JSON.stringify(data));
};

export const normalizeUrl = (url) => {
    // Force lowercase, remove trailing slash, and collapse multiple slashes
    let cleaned = (url || '/').toLowerCase().split('?')[0].replace(/\/+/g, '/');
    if (cleaned.endsWith('/') && cleaned.length > 1) cleaned = cleaned.slice(0, -1);
    return cleaned;
};

export const verifyUser = (req) => {
    // 1. Prioritize Authorization header (explicit client session)
    if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    // 2. Fallback to cookies
    if (!token) {
        const cookies = parse(req.headers.cookie || '');
        token = cookies.token;
    }

    if (!token) return null;

    try { 
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded; 
    } catch(e) { 
        return null; 
    }
};

export const issueCookie = (req, res, u) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    
    // Core payload stabilization: Ensure both id and uid exist
    const payload = { 
        ...u, 
        id: u.id || u._id, 
        uid: u.uid || u.id || u._id 
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    
    // Unified domain strategy: Use '.parkconscious.in' to share session across all subdomains
    let domainPattern = undefined;
    if (host.includes('parkconscious.in')) {
        domainPattern = '.parkconscious.in';
    }

    res.setHeader('Set-Cookie', serialize('token', token, {
        httpOnly: true, 
        secure: true, 
        sameSite: 'lax', 
        domain: domainPattern, 
        maxAge: 7 * 24 * 60 * 60, 
        path: '/'
    }));
    return token;
};

export const setupCors = (req, res) => {
    const allowed = [
        'https://events.parkconscious.in', 
        'https://admin.events.parkconscious.in', 
        'https://parkconscious.in',
        'https://www.parkconscious.in',
        'http://localhost:5173',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin;
    const isAllowed = origin && (
        allowed.some(a => origin.startsWith(a)) || 
        origin.endsWith('.parkconscious.in') || 
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
    );

    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return true;
    }
    return false;
};

export const getBody = async (req) => {
    if (req.body) {
        if (typeof req.body === 'object' && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) return req.body;
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
            const raw = req.body.toString('utf-8');
            try { return JSON.parse(raw); } catch(e) { return {}; }
        }
        if (typeof req.body === 'string' && req.body.trim().length > 0) {
            try { return JSON.parse(req.body); } catch(e) { return {}; }
        }
    }

    const contentType = req.headers['content-type'] || '';
    const method = req.method || 'GET';
    if ((method === 'POST' || method === 'PUT') && !contentType.includes('multipart/form-data')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString();
        if (raw) {
            try { return JSON.parse(raw); } catch(e) { return {}; }
        }
    }
    return {};
};

/**
 * logSystemError
 * Centralized error logging to the database for observability.
 */
export const logSystemError = async (source, type, message, stack, metadata = {}) => {
    try {
        const { SystemLog } = await import('./models.js');
        const hash = jwt.sign({ source, message }, JWT_SECRET).slice(-32); // Simple hash for deduplication
        
        await SystemLog.findOneAndUpdate(
            { hash },
            { 
                $set: { source, type, message, stack, metadata, lastSeenAt: new Date() },
                $inc: { count: 1 }
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('[LOGGER_FAILURE]:', err);
    }
};
