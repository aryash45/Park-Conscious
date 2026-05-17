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
import { getCache, setCache, delCache } from "./lib/redis.js";
import { getMemoryCache, setMemoryCache } from "./lib/memoryCache.js";

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
        const { Event, Discussion, Comment } = models;

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
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart !== 'events' && lastPart !== '') {
                    eventId = lastPart;
                }
            }

            const user = verifyUser(req);
            const isConnected = mongoose.connection.readyState === 1;
            console.log(`[AUTH_DEBUG]: Active Session User:`, JSON.stringify(user));
            
            // Global Admin roles (can see everything)
            const isGlobalAdmin = user && ['admin', 'superadmin', 'owner'].includes(user.role);

            if (eventId) {
                // NITPICK: Fast-path for public users (hits cache before DB fetch)
                if (!user && !isGlobalAdmin) {
                    const publicCached = await getCache(`event:${eventId}:public`);
                    if (publicCached) return json(res, 200, publicCached);
                }

                // Determine if eventId is a Mongo ObjectId or a slug
                const isObjectId = mongoose.Types.ObjectId.isValid(eventId);
                const query = isObjectId ? { _id: eventId } : { slug: eventId };

                // Fetch first to determine ownership and status before caching/returning
                const event = await Event.findOne(query).lean();
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
                
                let query = {};
                if (!isGlobalAdmin && user.role !== 'organizer') {
                    query.organizerId = user.id;
                }

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
            if (featured === "true") filter.isFeatured = true;
            
            console.log(`[DEBUG_API]: Querying Event model. DB: ${Event.db.name}, Filter:`, JSON.stringify(filter));
            
            // OPTIMIZATION: Check In-Memory Cache First
            const memCacheKey = `events_feed_${JSON.stringify(filter)}`;
            const memCachedEvents = getMemoryCache(memCacheKey);
            
            if (memCachedEvents) {
                console.log(`[PERF]: Serving events feed from warm memory cache (0ms)`);
                return json(res, 200, memCachedEvents.map(e => {
                    const isOwner = user && (String(e.organizerId) === String(user.id));
                    return pruneEvent(e, isGlobalAdmin || isOwner);
                }));
            }
            
            // OPTIMIZATION: Projection excludes large text fields for list views
            const events = await Event.find(filter)
                .select('-description -requiredFields -customForms -faqs')
                .sort({ date: 1 })
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

            const body = await getBody(req);
            
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

            // Generate unique SEO slug with retry-on-duplicate safety
            let sanitized = body.title ? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '';
            let baseSlug = sanitized || 'event';
            let slug = baseSlug;
            let slugCount = 1;

            // Create Event with retry-on-duplicate-key handling
            let newEvent;
            let retries = 10;
            while (retries > 0) {
                try {
                    newEvent = await Event.create({
                        ...body,
                        slug,
                        organizerId: body.organizerId || user.id, // Use provided or default to creator
                        status: body.status || 'draft'
                    });
                    break;
                } catch (err) {
                    if (err.code === 11000 && (err.message.includes('slug') || JSON.stringify(err.keyValue || {}).includes('slug'))) {
                        slug = `${baseSlug}-${slugCount++}`;
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
            const isGlobalAdmin = ['admin', 'superadmin', 'owner'].includes(user.role);

            if (!isOwner && !isGlobalAdmin) {
                return json(res, 403, { error: "Permission denied" });
            }

            // Clean/sanitize slug if updated
            if (body.slug) {
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
            const isGlobalAdmin = ['admin', 'superadmin', 'owner'].includes(user.role);

            if (!isOwner && !isGlobalAdmin) {
                return json(res, 403, { error: "Permission denied" });
            }

            await Event.findByIdAndDelete(eventId);

            // Invalidate caches
            await delCache(`event:${eventId}:public`);
            await delCache(`event:${eventId}:privileged`);
            await delCache(`events:public`);
            await delCache(`events:featured`);

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
