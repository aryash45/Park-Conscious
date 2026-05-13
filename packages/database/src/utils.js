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
import crypto from 'crypto';

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
    
    // Ensure nested arrays exist
    e.hosts = (e.hosts || []).map(h => ({
        ...h,
        socialLink: h.socialLink || h.instagram || h.socials?.instagram || ""
    }));
    e.ticketTiers = e.ticketTiers || [];
    
    // Admin Fix Defaults
    e.isTBA = e.isTBA ?? false;
    e.isOnline = e.isOnline ?? false;
    e.registrationProtocolConfig = e.registrationProtocolConfig || {
      attendeeLabel: 'Attendee',
      attendeeSubtitle: 'General Entry Access',
      startupLabel: 'Founder',
      startupSubtitle: 'Pitching & Stall Access'
    };
    
    return e;
}

/**
 * Prune event data for public listings to reduce payload size.
 */
export function pruneEvent(evt) {
    if (!evt) return null;
    const e = normalizeEvent(evt);
    
    // Keep only essential fields for the grid
    return {
        _id: e._id,
        title: e.title,
        name: e.name,
        date: e.date,
        image: e.image,
        images: [e.image],
        category: e.category,
        price: e.price,
        venue: e.venue,
        venueCity: e.venueCity,
        isFeatured: e.isFeatured,
        status: e.status,
        badge: e.badge,
        accentColor: e.accentColor
    };
}

/**
 * Centralized Error Logger with Deduplication
 */
export async function logSystemError(source, type, message, stack, metadata = {}) {
    try {
        const { SystemLog } = await import('./models.js');
        
        // Generate a hash based on source and message to group identical errors
        const hash = crypto.createHash('md5').update(`${source}:${message}`).digest('hex');
        
        // Check for an existing unresolved log with this hash
        const existing = await SystemLog.findOne({ hash, resolved: false });
        
        if (existing) {
            existing.count += 1;
            existing.lastSeenAt = new Date();
            if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
            await existing.save();
            return existing;
        }
        
        return await SystemLog.create({
            source, type, message, stack, hash, metadata
        });
    } catch (e) {
        console.error('[CRITICAL_LOGGER_FAILURE]:', e.message);
        return null;
    }
}

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
    const cookies = parse(req.headers.cookie || '');
    let token = cookies.token;
    
    // Fallback: Check Authorization header (used by AdminPanel)
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch(e) { return null; }
};

export const issueCookie = (req, res, u) => {
    const host = req.headers.host || '';
    
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

export const setCors = (req, res) => {
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
