/**
 * api/events.js
 * 
 * Main handler for event-related operations.
 * Proxied from events.parkconscious.in and admin.parkconscious.in
 */
import './lib/env.js';
import mongoose from "mongoose";
import connectDB from "./lib/mongodb.js";
import * as models from "./lib/models.js";
import { 
    json, 
    getBody, 
    setupCors,
    verifyUser, 
    normalizeEvent, 
    pruneEvent, 
    logSystemError 
} from "./lib/utils.js";
import crypto from "crypto";
import axios from "axios";
import { getCache, setCache, delCache } from "./lib/redis.js";
import { getMemoryCache, setMemoryCache, clearMemoryCache } from "./lib/memoryCache.js";

const PLATFORM_ADMIN_ROLES = new Set(['admin', 'superadmin']);
const EVENT_MANAGER_ROLES = new Set(['admin', 'superadmin', 'organizer', 'owner']);

const getUserRole = (user) => (user?.role || '').toLowerCase();
const isPlatformAdminRole = (role) => PLATFORM_ADMIN_ROLES.has(role);

async function getUniqueSlug(titleOrSlug, EventModel, excludeId = null) {
    let sanitized = titleOrSlug ? titleOrSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '';
    let baseSlug = sanitized || 'event';
    let slug = baseSlug;
    let slugCount = 1;
    while (true) {
        const query = { slug };
        if (excludeId) query._id = { $ne: excludeId };
        const exists = await EventModel.exists(query);
        if (!exists) break;
        slug = `${baseSlug}-${slugCount++}`;
    }
    return slug;
}

export default async function handler(req, res) {
    // 1. Initial configuration
    if (setupCors(req, res)) return;

    // 2. Main Logic wrapper
    try {
        await connectDB();
        const { Event, Discussion, Comment, Spotlight } = models;

        // Health check (Now accurately reflects the connection)
        const fullUrl = req.url || "/";
        if (fullUrl.includes("/health")) {
            const dbStatus = mongoose.connection.readyState;
            const dbName = mongoose.connection.name;
            const isConnected = dbStatus === 1;
            return json(res, 200, { 
                status: "ONLINE", 
                timestamp: new Date().toISOString(),
                env: process.env.VERCEL_ENV || "production",
                database: {
                    connected: dbStatus === 1,
                    readyState: dbStatus, // 0=disc, 1=conn, 2=connecting, 3=disconnecting
                    name: dbName || "none",
                    counts: {
                        events: isConnected ? await mongoose.connection.db?.collection('events').countDocuments() : 0,
                        discussions: isConnected ? await mongoose.connection.db?.collection('discussions').countDocuments() : 0
                    },
                    active_db: mongoose.connection.db?.databaseName || "none",
                    uri_found: !!process.env.MONGODB_URI,
                    target_db: process.env.MONGODB_URI ? process.env.MONGODB_URI.split('/').pop().split('?')[0] : 'missing'
                },
                security: {
                    hasJwtSecret: !!process.env.JWT_SECRET,

                    hasGoogleId: !!(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
                }
            });
        }

        const host = req.headers.host || 'localhost';
        const parsedUrl = new URL(req.url, `http://${host}`);
        const [pathPart] = (req.url || '/').split('?');
        const urlPath = pathPart.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        const method = req.method || 'GET';

        const action = parsedUrl.searchParams.get('action');

        // -- Brand Spotlight Curation endpoints --
        if (urlPath.includes('/spotlight')) {
            // GET /api/spotlight: Fetch the active spotlight populated with events
            if (method === "GET") {
                let spotlight = await Spotlight.findOne({ isActive: true }).populate('eventIds').lean();
                if (!spotlight) {
                    return json(res, 200, {
                        title: "Brand Spotlight",
                        subtitle: "Curated experiences from our premier partner networks.",
                        brandPoster: "",
                        eventIds: [],
                        isActive: false
                    });
                }
                if (spotlight.eventIds && Array.isArray(spotlight.eventIds)) {
                    spotlight.eventIds = spotlight.eventIds
                        .filter(event => event && (event.isPublic || event.status === 'published'))
                        .map(event => pruneEvent(event, false));
                }
                return json(res, 200, spotlight);
            }

            // PUT /api/spotlight: Save or update the global spotlight config (Super Admin only!)
            if (method === "PUT") {
                const user = verifyUser(req);
                if (!user) return json(res, 401, { error: "Unauthorized" });

                const isSuperAdmin = user && user.role === 'superadmin';
                if (!isSuperAdmin) return json(res, 403, { error: "Permission denied" });

                const body = await getBody(req);
                
                let spotlight = await Spotlight.findOne({ isActive: true });
                if (!spotlight) {
                    spotlight = new Spotlight({ isActive: true });
                }

                spotlight.title = body.title || "";
                spotlight.subtitle = body.subtitle || "";
                spotlight.brandPoster = body.brandPoster || "";
                spotlight.eventIds = body.eventIds || [];
                
                await spotlight.save();

                clearMemoryCache();
                await delCache(`events:public`);
                await delCache(`events:featured`);

                return json(res, 200, spotlight.toObject());
            }

            return json(res, 405, { error: "Method not allowed for spotlight" });
        }

        // -- Discussions & Comments --
        if (urlPath.includes('/discussions') || (action && action.startsWith('discussions'))) {
            const id = parsedUrl.searchParams.get('id'); // Discussion ID
            
            if (method === 'GET') {
                if (id) {
                    const disc = await Discussion.findById(id).lean();
                    if (!disc) return json(res, 404, { message: 'Discussion not found' });
                    const comms = await Comment.find({ discussionId: id }).sort({ createdAt: -1 }).lean();
                    return json(res, 200, { ...disc, comments: comms });
                }
                
                // Sanitize and clamp pagination values
                let page = parseInt(parsedUrl.searchParams.get('page')) || 1;
                let limit = parseInt(parsedUrl.searchParams.get('limit')) || 6;
                
                page = Math.max(1, page);
                limit = Math.max(1, Math.min(100, limit)); // Clamp limit between 1 and 100
                const skip = (page - 1) * limit;

                const total = await Discussion.countDocuments();
                const discussions = await Discussion.find()
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                console.log(`[DIAGNOSTIC]: Discussions query. Total in DB: ${total}, Found in this page: ${discussions.length}`);

                return json(res, 200, { 
                    discussions, 
                    totalPages: Math.ceil(total / limit) || 1,
                    currentPage: page
                });
            }

            if (method === 'POST') {
                const user = verifyUser(req);
                if (!user) return json(res, 401, { message: 'Auth required' });
                const body = await getBody(req);
                
                // Create Comment with guards
                if (urlPath.includes('/comments') || action === 'discussions_comments') {
                    if (!id) return json(res, 400, { message: 'Discussion ID required for comments' });
                    
                    const exists = await Discussion.findById(id);
                    if (!exists) return json(res, 404, { message: 'Discussion not found' });

                    const comment = await Comment.create({
                        discussionId: id,
                        parentId: body.parentId || null,
                        text: body.text,
                        authorName: user.name,
                        authorUid: user.id,
                        authorPhoto: user.picture || ""
                    });
                    await Discussion.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
                    return json(res, 201, comment.toObject());
                }
                
                // Ensure Discussion creation doesn't collide with Comment path
                if (urlPath.endsWith('/discussions') || action === 'discussions') {
                    // Logic for Discussion.create would go here if matched
                }
                const disc = await Discussion.create({ 
                    ...body, 
                    authorUid: user.id, 
                    authorName: user.name,
                    authorPhoto: user.picture || ""
                });
                return json(res, 201, disc.toObject());
            }

            if (method === 'PATCH') {
                const user = verifyUser(req);
                if (!user) return json(res, 401, { message: 'Auth required' });
                const body = await getBody(req);
                
                // Vote Discussion
                if ((urlPath.includes('/details') || action === 'discussions_details') && id) {
                    const { action: voteAction } = body;
                    const disc = await Discussion.findById(id);
                    if (!disc) return json(res, 404, { message: 'Not found' });
                    
                    disc.upvotes = disc.upvotes.filter(uid => uid !== user.id);
                    disc.downvotes = disc.downvotes.filter(uid => uid !== user.id);
                    
                    if (voteAction === 'upvote') disc.upvotes.push(user.id);
                    else if (voteAction === 'downvote') disc.downvotes.push(user.id);
                    
                    await disc.save();
                    return json(res, 200, { upvotes: disc.upvotes, downvotes: disc.downvotes });
                }
                
                // Vote Comment
                if ((urlPath.includes('/comments') || action === 'discussions_comments') && id) {
                    const { commentId, action: voteAction } = body;
                    const comment = await Comment.findById(commentId);
                    if (!comment) return json(res, 404, { message: 'Not found' });
                    
                    comment.upvotes = comment.upvotes.filter(uid => uid !== user.id);
                    comment.downvotes = comment.downvotes.filter(uid => uid !== user.id);
                    
                    if (voteAction === 'upvote') comment.upvotes.push(user.id);
                    else if (voteAction === 'downvote') comment.downvotes.push(user.id);
                    
                    await comment.save();
                    return json(res, 200, { upvotes: comment.upvotes, downvotes: comment.downvotes });
                }
            }
            
            return json(res, 405, { error: "Method not allowed for discussions" });
        }

        // GET: List or Single Event
        if (req.method === "GET") {
            let eventId = parsedUrl.searchParams.get("id");
            
            // Extract from path if not in query (Vercel rewrite scenario)
            if (!eventId) {
                const pathParts = urlPath.split('/');
                // Exact match: ['', 'events', '<id>'] OR ['', 'api', 'events', '<id>']
                const isExactEventsPath = 
                    (pathParts.length === 3 && pathParts[1] === 'events') ||
                    (pathParts.length === 4 && pathParts[1] === 'api' && pathParts[2] === 'events');
                if (isExactEventsPath) {
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && lastPart !== '') {
                        eventId = lastPart;
                    }
                }
            }

            const user = verifyUser(req);
            const role = getUserRole(user);
            const isConnected = mongoose.connection.readyState === 1;
            console.log(`[AUTH_DEBUG]: Active Session User:`, JSON.stringify(user));
            
            // Global Admin roles (can see everything)
            const isGlobalAdmin = isPlatformAdminRole(role);

            if (eventId) {
                // NITPICK: Fast-path for public users (hits cache before DB fetch)
                if (!user && !isGlobalAdmin) {
                    const publicCached = await getCache(`event:${eventId}:public`);
                    if (publicCached) return json(res, 200, publicCached);
                }

                // Prefer slug lookup first, then fallback to _id lookup if no match is found
                let event = await Event.findOne({ slug: eventId }).lean();
                if (!event && mongoose.Types.ObjectId.isValid(eventId)) {
                    event = await Event.findOne({ _id: eventId }).lean();
                }
                if (!event) return json(res, 404, { error: "Event not found" });

                // Normalize eventId to the actual document ID for cache keys to prevent cache duplication
                const actualId = event._id.toString();

                const isOwner = user && (String(event.organizerId) === String(user.id));
                const canSeePrivate = isGlobalAdmin || isOwner;
                
                // Enforce visibility: Non-admins/non-owners only see public published events
                const isPublished = ['active', 'published', 'Active', 'Published'].includes(event.status);
                if (!canSeePrivate && (!isPublished || !event.isPublic)) {
                    return json(res, 404, { error: "Event not found" });
                }

                // OPTIMIZATION: Check In-Memory Cache First
                const memCacheKey = `event_${actualId}_${canSeePrivate ? 'privileged' : 'public'}`;
                const memCachedEvent = getMemoryCache(memCacheKey);
                
                if (memCachedEvent) {
                    console.log(`[PERF]: Serving single event from warm memory cache (0ms)`);
                    return json(res, 200, memCachedEvent);
                }

                const cacheKey = `event:${actualId}:${canSeePrivate ? 'privileged' : 'public'}`;
                const cached = await getCache(cacheKey);
                if (cached) {
                    setMemoryCache(memCacheKey, cached, 60); // Store in memory cache too
                    return json(res, 200, cached);
                }

                const data = pruneEvent(event, canSeePrivate);
                await setCache(cacheKey, data, 300); // 5 min cache
                setMemoryCache(memCacheKey, data, 60); // 1 min memory cache
                
                return json(res, 200, data);
            }

            const host = req.headers['x-forwarded-host'] || req.headers.host || '';
            // Support 'admin.parkconscious.in' AND Vercel previews like 'admin-events-xxx.vercel.app'
            const isAdminHost = host.startsWith('admin.') || host.includes('admin-') || host.includes('.admin.');
            
            // -- Administrative List (Full access or Organizer scoped) --
            if (urlPath.includes('/admin/all')) {
                if (!user) return json(res, 401, { message: 'Authentication required' });
                if (!EVENT_MANAGER_ROLES.has(role)) return json(res, 403, { message: 'Permission denied' });
                
                const query = isGlobalAdmin ? {} : { organizerId: user.id };

                console.log(`[ADMIN_DEBUG]: Fetching all events. User: ${user.email}, Role: ${user.role}, Query:`, JSON.stringify(query));
                const events = await Event.find(query).sort({ createdAt: -1 }).lean();
                console.log(`[ADMIN_DEBUG]: Found ${events.length} events.`);
                return json(res, 200, events.map(e => normalizeEvent(e)));
            }

            const filter = {};
            
            // Apply strict filters unless specifically on the Admin Host
            if (!isGlobalAdmin || !isAdminHost) {
                const publicFilter = {
                    status: { $in: ["active", "published", "Active", "Published"] },
                    isPublic: true
                };

                // Organizers on the public site see public events PLUS their own (drafts included)
                if (user && user.role === 'organizer' && !isAdminHost) {
                    filter.$or = [
                        publicFilter,
                        { organizerId: user.id }
                    ];
                } else if (isGlobalAdmin && !isAdminHost) {
                    // Admins on public site: Show only public events to mirror user experience
                    Object.assign(filter, publicFilter);
                } else if (!isGlobalAdmin) {
                    // Everyone else only sees public events
                    Object.assign(filter, publicFilter);
                }
            }
            const type = parsedUrl.searchParams.get("type");
            if (type) filter.type = type;

            const featured = parsedUrl.searchParams.get("featured");
            let sortObj = { date: 1 };
            let selectStr = '-description -requiredFields -customForms -faqs';

            if (featured === "true") {
                filter.isFeatured = true;
                sortObj = { featuredOrder: 1, date: 1 };
                // Keep description for featured banner ticket stub display
                selectStr = '-requiredFields -customForms -faqs';

                // Enforce time-gated scheduling filters
                const now = new Date();
                filter.$and = [
                    {
                        $or: [
                            { featuredStart: null },
                            { featuredStart: { $exists: false } },
                            { featuredStart: { $lte: now } }
                        ]
                    },
                    {
                        $or: [
                            { featuredEnd: null },
                            { featuredEnd: { $exists: false } },
                            { featuredEnd: { $gte: now } }
                        ]
                    }
                ];
            }
            
            // OPTIMIZATION: Check In-Memory Cache First
            const keyFilter = { ...filter };
            delete keyFilter.$and;
            const memCacheKey = `events_feed_${JSON.stringify(keyFilter)}`;
            const memCachedEvents = getMemoryCache(memCacheKey);
            
            if (memCachedEvents) {
                console.log(`[PERF]: Serving events feed from warm memory cache (0ms)`);
                return json(res, 200, memCachedEvents.map(e => {
                    const isOwner = user && (String(e.organizerId) === String(user.id));
                    return pruneEvent(e, isGlobalAdmin || isOwner);
                }));
            }
            
            // OPTIMIZATION: Projection excludes large text fields for standard feed list views, but preserves descriptions for banners
            const events = await Event.find(filter)
                .select(selectStr)
                .sort(sortObj)
                .limit(50)
                .lean();

            if (events.length === 0) {
                console.log(`[DIAGNOSTIC]: Filter returned 0 events.`);
            }

            // Save to memory cache for 60 seconds
            setMemoryCache(memCacheKey, events, 60);

            return json(res, 200, events.map(e => {
                const isOwner = user && (String(e.organizerId) === String(user.id));
                return pruneEvent(e, isGlobalAdmin || isOwner);
            }));
        }

        // POST: Create Event or Razorpay Order
        if (req.method === "POST") {
            const user = verifyUser(req);
            if (!user) return json(res, 401, { error: "Unauthorized" });
            const role = getUserRole(user);
            if (!EVENT_MANAGER_ROLES.has(role)) return json(res, 403, { error: "Permission denied" });

            const body = await getBody(req);
            const isGlobalAdmin = isPlatformAdminRole(role);

            // Strip featured properties for standard users to prevent spoofing homepage slots
            if (!isGlobalAdmin) {
                delete body.isFeatured;
                delete body.featuredTitle;
                delete body.featuredSubtitle;
                delete body.featuredLabel;
                delete body.bannerImage;
                delete body.featuredOrder;
                delete body.featuredStart;
                delete body.featuredEnd;
            }
            
            // Handle Google Form Import
            if (action === "import_google_form" || body.action === "import_google_form") {
                const { url } = body;
                if (!url) {
                    return json(res, 400, { error: "Google Form URL is required" });
                }
                
                try {
                    // Normalize the URL
                    let targetUrl = url.trim();
                    if (targetUrl.includes('/edit')) {
                        targetUrl = targetUrl.replace(/\/edit(\?.*)?$/, '/viewform');
                    }
                    if (!targetUrl.includes('/viewform') && !targetUrl.match(/\/forms\/d\/e\/[a-zA-Z0-9_-]+\/?$/)) {
                        if (targetUrl.includes('/viewform')) {
                            // already has it
                        } else {
                            if (targetUrl.endsWith('/')) {
                                targetUrl += 'viewform';
                            } else if (!targetUrl.endsWith('viewform')) {
                                targetUrl += '/viewform';
                            }
                        }
                    }

                    console.log(`[IMPORT_GOOGLE_FORM]: Fetching and parsing form from URL: ${targetUrl}`);
                    const response = await axios.get(targetUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        },
                        timeout: 10000
                    });

                    const html = response.data;
                    
                    // Parse FB_PUBLIC_LOAD_DATA_ using the matching bracket parser
                    const startIndex = html.indexOf('FB_PUBLIC_LOAD_DATA_');
                    if (startIndex === -1) {
                        return json(res, 400, { error: "Could not find form data in the page. Please ensure the Google Form is public and accessible." });
                    }
                    
                    const bracketIndex = html.indexOf('[', startIndex);
                    if (bracketIndex === -1) {
                        return json(res, 400, { error: "Failed to parse Google Form data structure." });
                    }
                    
                    let bracketCount = 0;
                    let jsonEndIndex = -1;
                    let inString = false;
                    let stringChar = '';
                    let escaped = false;
                    
                    for (let i = bracketIndex; i < html.length; i++) {
                        const char = html[i];
                        if (escaped) {
                            escaped = false;
                            continue;
                        }
                        if (char === '\\') {
                            escaped = true;
                            continue;
                        }
                        if (char === '"' || char === "'") {
                            if (!inString) {
                                inString = true;
                                stringChar = char;
                            } else if (stringChar === char) {
                                inString = false;
                            }
                        }
                        if (!inString) {
                            if (char === '[') {
                                bracketCount++;
                            } else if (char === ']') {
                                bracketCount--;
                                if (bracketCount === 0) {
                                    jsonEndIndex = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (jsonEndIndex === -1) {
                        return json(res, 400, { error: "Failed to locate matching JSON array boundaries in the form page." });
                    }
                    
                    const dataStr = html.slice(bracketIndex, jsonEndIndex);
                    let data;
                    try {
                        data = JSON.parse(dataStr);
                    } catch (parseErr) {
                        console.error("[IMPORT_GOOGLE_FORM_JSON_PARSE_ERROR]:", parseErr);
                        return json(res, 400, { error: "Malformed form data. Could not parse JSON structure." });
                    }

                    if (!data || !data[1] || !Array.isArray(data[1][1])) {
                        return json(res, 400, { error: "No questions found in this Google Form. Please ensure it has input fields." });
                    }

                    const title = data[1][8] || "";
                    const description = data[1][0] || "";
                    const questionsList = data[1][1];
                    const customFields = [];

                    for (let i = 0; i < questionsList.length; i++) {
                        const item = questionsList[i];
                        const itemId = String(item[0] || Date.now() + i);
                        const label = item[1];
                        const typeCode = item[3];

                        // Skip layout fields/headers that don't collect data (have no label or no item[4])
                        if (!label || !item[4]) continue;

                        let type = 'text';
                        switch (typeCode) {
                            case 0: type = 'text'; break;
                            case 1: type = 'textarea'; break;
                            case 2: type = 'select'; break;
                            case 3: type = 'select'; break;
                            case 4: type = 'select'; break; // check box maps to select (multi-option) in our system
                            case 5: type = 'select'; break; // linear scale maps to select
                            case 11: type = 'file'; break; // file upload
                            default: type = 'text'; break;
                        }

                        let required = false;
                        let options = [];

                        const itemInfo = item[4];
                        if (itemInfo && itemInfo[0]) {
                            const nestedInfo = itemInfo[0];
                            required = nestedInfo[2] === 1 || nestedInfo[2] === true;
                            
                            const optionsArray = nestedInfo[1];
                            if (optionsArray && Array.isArray(optionsArray)) {
                                options = optionsArray.map(opt => opt[0]).filter(opt => typeof opt === 'string' && opt.trim() !== '');
                            }
                        }

                        customFields.push({
                            id: `gf_${itemId}`,
                            label: label.trim(),
                            type,
                            required,
                            options
                        });
                    }

                    return json(res, 200, {
                        title,
                        description,
                        customForms: customFields
                    });

                } catch (fetchErr) {
                    console.error("[IMPORT_GOOGLE_FORM_FETCH_ERROR]:", fetchErr);
                    return json(res, 500, { error: "Failed to fetch Google Form" });
                }
            }

            // Handle Razorpay Order Creation (if requested)
            if (body.action === "create_order") {
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

            // RBAC: Validate organizerId mapping to prevent spoofing/claiming other organizers
            let organizerId = user.id;
            if (body.organizerId && body.organizerId !== user.id) {
                if (!isGlobalAdmin) {
                    return json(res, 403, { error: "Permission denied: only admins can assign events to other organizers" });
                }
                organizerId = body.organizerId;
            }

            // Generate unique SEO slug with retry-on-duplicate safety
            let sanitized = body.title ? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '';
            let baseSlug = sanitized || 'event';
            let slugCount = 0;

            // Create Event with retry-on-duplicate-key handling
            let newEvent;
            let retries = 10;
            while (retries > 0) {
                // Generate next candidate at the top of the loop to ensure every computed slug is attempted
                let slug = slugCount === 0 ? baseSlug : `${baseSlug}-${slugCount}`;
                try {
                    newEvent = await Event.create({
                        ...body,
                        slug,
                        organizerId,
                        status: body.status || 'draft'
                    });
                    break;
                } catch (err) {
                    if (err.code === 11000 && (err.message.includes('slug') || JSON.stringify(err.keyValue || {}).includes('slug'))) {
                        slugCount++;
                        retries--;
                    } else {
                        throw err;
                    }
                }
            }

            if (!newEvent) {
                return json(res, 500, { error: "Failed to generate unique slug after multiple attempts" });
            }

            // Invalidate list caches
            await delCache(`events:public`);
            await delCache(`events:featured`);
            clearMemoryCache();

            return json(res, 201, normalizeEvent(newEvent));
        }

        // PUT: Update Event
        if (req.method === "PUT") {
            const user = verifyUser(req);
            if (!user) return json(res, 401, { error: "Unauthorized" });

            const eventId = parsedUrl.searchParams.get("id") || urlPath.split('/').pop();
            const body = await getBody(req);

            const event = await Event.findById(eventId);
            if (!event) return json(res, 404, { error: "Event not found" });

            // RBAC: Only owner or Global Admin can update
            const isOwner = String(event.organizerId) === String(user.id);
            const role = getUserRole(user);
            const isGlobalAdmin = isPlatformAdminRole(role);

            if (!isOwner && !isGlobalAdmin) {
                return json(res, 403, { error: "Permission denied" });
            }

            // Strip featured/promotional settings for standard creators to maintain platform curation
            if (!isGlobalAdmin) {
                delete body.isFeatured;
                delete body.featuredTitle;
                delete body.featuredSubtitle;
                delete body.featuredLabel;
                delete body.bannerImage;
                delete body.featuredOrder;
                delete body.featuredStart;
                delete body.featuredEnd;
            }

            // Clean/sanitize slug if updated (including if set to an empty string)
            if (body.hasOwnProperty('slug')) {
                body.slug = await getUniqueSlug(body.slug, Event, eventId);
            }

            // Perform Update
            const updatedEvent = await Event.findByIdAndUpdate(
                eventId,
                { $set: body },
                { new: true, runValidators: true }
            );

            // Invalidate caches
            await delCache(`event:${eventId}:public`);
            await delCache(`event:${eventId}:privileged`);
            await delCache(`events:public`);
            await delCache(`events:featured`);
            clearMemoryCache();

            return json(res, 200, normalizeEvent(updatedEvent));
        }

        // DELETE: Remove Event
        if (req.method === "DELETE") {
            const user = verifyUser(req);
            if (!user) return json(res, 401, { error: "Unauthorized" });

            const eventId = parsedUrl.searchParams.get("id") || urlPath.split('/').pop();
            const event = await Event.findById(eventId);
            if (!event) return json(res, 404, { error: "Event not found" });

            const isOwner = String(event.organizerId) === String(user.id);
            const role = getUserRole(user);
            const isGlobalAdmin = isPlatformAdminRole(role);

            if (!isOwner && !isGlobalAdmin) {
                return json(res, 403, { error: "Permission denied" });
            }

            await Event.findByIdAndDelete(eventId);

            // Invalidate caches
            await delCache(`event:${eventId}:public`);
            await delCache(`event:${eventId}:privileged`);
            await delCache(`events:public`);
            await delCache(`events:featured`);
            clearMemoryCache();

            return json(res, 200, { success: true, message: "Event terminated" });
        }

        return json(res, 405, { error: "Method not allowed" });

    } catch (error) {
        console.error("[FATAL_HANDLER_ERROR]:", error);
        await logSystemError("API_EVENTS_HANDLER", "router_fatal", error.message, error.stack, { url: req.url });
        
        return json(res, 500, { 
            error: "Internal Server Error", 
            message: error.message,
            code: error.code || "UNKNOWN_CRASH",
            status: "CRASHED"
        });
    }
}
