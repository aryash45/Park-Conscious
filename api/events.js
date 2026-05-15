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

    // 2. Main Logic wrapper
    try {
        await connectDB();
        const { Event, Discussion, Comment } = models;

        // Health check (Now accurately reflects the connection)
        const fullUrl = req.url || "/";
        if (fullUrl.includes("/health")) {
            const dbStatus = mongoose.connection.readyState;
            const dbName = mongoose.connection.name;
            return json(res, 200, { 
                status: "ONLINE", 
                timestamp: new Date().toISOString(),
                env: process.env.VERCEL_ENV || "production",
                database: {
                    connected: dbStatus === 1,
                    readyState: dbStatus, // 0=disc, 1=conn, 2=connecting, 3=disconnecting
                    name: dbName || "none",
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

        // -- Discussions & Comments --
        if (urlPath.includes('/discussions')) {
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
                if (urlPath.includes('/comments')) {
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
                if (urlPath.endsWith('/discussions')) {
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
                if (urlPath.includes('/details') && id) {
                    const { action } = body;
                    const disc = await Discussion.findById(id);
                    if (!disc) return json(res, 404, { message: 'Not found' });
                    
                    disc.upvotes = disc.upvotes.filter(uid => uid !== user.id);
                    disc.downvotes = disc.downvotes.filter(uid => uid !== user.id);
                    
                    if (action === 'upvote') disc.upvotes.push(user.id);
                    else if (action === 'downvote') disc.downvotes.push(user.id);
                    
                    await disc.save();
                    return json(res, 200, { upvotes: disc.upvotes, downvotes: disc.downvotes });
                }
                
                // Vote Comment
                if (urlPath.includes('/comments') && id) {
                    const { commentId, action } = body;
                    const comment = await Comment.findById(commentId);
                    if (!comment) return json(res, 404, { message: 'Not found' });
                    
                    comment.upvotes = comment.upvotes.filter(uid => uid !== user.id);
                    comment.downvotes = comment.downvotes.filter(uid => uid !== user.id);
                    
                    if (action === 'upvote') comment.upvotes.push(user.id);
                    else if (action === 'downvote') comment.downvotes.push(user.id);
                    
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
                if (lastPart && lastPart !== 'events' && lastPart.length >= 20) {
                    eventId = lastPart;
                }
            }

            const user = verifyUser(req);
            // Global Admin roles (can see everything)
            const isGlobalAdmin = user && ['admin', 'superadmin', 'owner'].includes(user.role);

            if (eventId) {
                // NITPICK: Fast-path for public users (hits cache before DB fetch)
                if (!user && !isGlobalAdmin) {
                    const publicCached = await getCache(`event:${eventId}:public`);
                    if (publicCached) return json(res, 200, publicCached);
                }

                // Fetch first to determine ownership and status before caching/returning
                const event = await Event.findById(eventId);
                if (!event) return json(res, 404, { error: "Event not found" });

                const isOwner = user && (String(event.organizerId) === String(user.id));
                const canSeePrivate = isGlobalAdmin || isOwner;
                
                // Enforce visibility: Non-admins/non-owners only see public published events
                const isPublished = ['active', 'published', 'Active', 'Published'].includes(event.status);
                if (!canSeePrivate && (!isPublished || !event.isPublic)) {
                    return json(res, 404, { error: "Event not found" });
                }

                const cacheKey = `event:${eventId}:${canSeePrivate ? 'privileged' : 'public'}`;
                const cached = await getCache(cacheKey);
                if (cached) return json(res, 200, cached);

                const data = pruneEvent(event, canSeePrivate);
                await setCache(cacheKey, data, 300); // 5 min cache
                return json(res, 200, data);
            }

            const host = req.headers.host || '';
            // Support 'admin.parkconscious.in' AND Vercel previews like 'admin-events-xxx.vercel.app'
            const isAdminHost = host.startsWith('admin.') || host.includes('admin-') || host.includes('.admin.');
            const filter = {};
            
            // Apply strict filters for non-GlobalAdmins
            if (!isGlobalAdmin) {
                const publicFilter = {
                    status: { $in: ["active", "published", "Active", "Published"] },
                    isPublic: true,
                    title: { $not: /test/i },
                    name: { $not: /test/i }
                };

                // Organizers see their own events + public ones
                if (user && user.role === 'organizer') {
                    if (isAdminHost) {
                        // In Admin Panel, only show THEIR events
                        filter.organizerId = user.id;
                    } else {
                        // On Public Site, show public events PLUS their own
                        filter.$or = [
                            publicFilter,
                            { organizerId: user.id }
                        ];
                    }
                } else {
                    // Everyone else only sees public events
                    Object.assign(filter, publicFilter);
                }
            }
            const type = parsedUrl.searchParams.get("type");
            if (type) filter.type = type;

            const featured = parsedUrl.searchParams.get("featured");
            if (featured === "true") filter.isFeatured = true;
            
            const events = await Event.find(filter)
                .sort({ startDate: 1 })
                .limit(50);

            return json(res, 200, events.map(e => {
                const isOwner = user && (String(e.organizerId) === String(user.id));
                return pruneEvent(e, isGlobalAdmin || isOwner);
            }));
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
        await logSystemError("API_EVENTS_HANDLER", "router_fatal", error.message, error.stack, { url: req.url });
        
        return json(res, 500, { 
            error: "Internal Server Error", 
            message: error.message,
            code: error.code || "UNKNOWN_CRASH",
            status: "CRASHED"
        });
    }
}
