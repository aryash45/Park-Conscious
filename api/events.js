/**
 * api/events.js
 * 
 * Purpose: Public and protected API for event-related operations.
 * Handles event discovery, featured events, event submission proposals, 
 * community discussions/comments, and administrative CRUD operations for events.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import { json, setCors, getBody, verifyUser, normalizeEvent, pruneEvent, logSystemError } from './lib/utils.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getCache, setCache, delCache } from './lib/redis.js';

const { Event, Discussion, Comment, Contact } = models;

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

    // Parse URL cleanly — preserve query string separately
    const fullUrl = req.url || '/';
    const [pathPart, queryPart] = fullUrl.split('?');
    const url = pathPart.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    const body = await getBody(req);
    const user = verifyUser(req);

    try {
        await connectDB();

        // -- Health Check --
        if (url.includes('/health')) {
            return json(res, 200, { status: 'ONLINE', timestamp: new Date().toISOString() });
        }

        // -- Event Promotion Payment --
        if (url.includes('/events/promote')) {
            if (!user) return json(res, 401, { message: 'Auth required' });
            
            const KEY_ID = process.env.RAZORPAY_KEY_ID;
            const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
            
            if (!KEY_ID || !KEY_SECRET) {
                console.error("[PROMOTION_ERROR]: Razorpay Keys missing");
                return json(res, 500, { message: 'Razorpay configuration error' });
            }

            const razorpay = new Razorpay({
                key_id: KEY_ID,
                key_secret: KEY_SECRET,
            });

            // Create Order for ₹499
            if (url.endsWith('/order') && method === 'POST') {
                try {
                    const { eventId } = body;
                    if (!eventId) return json(res, 400, { message: 'Event ID required' });

                    const event = await Event.findById(eventId);
                    if (!event) return json(res, 404, { message: 'Event not found' });
                    if (String(event.organizerId) !== String(user.id)) {
                        return json(res, 403, { message: 'Access Denied: You do not own this event' });
                    }

                    const options = {
                        amount: 49900, // ₹499 in paise
                        currency: "INR",
                        receipt: `PROMO_${eventId.slice(-8)}`,
                        notes: { eventId, userId: user.id }
                    };

                    const order = await razorpay.orders.create(options);
                    return json(res, 200, { 
                        success: true, 
                        orderId: order.id, 
                        amount: options.amount, 
                        key: KEY_ID 
                    });
                } catch (err) {
                    console.error("[PROMOTION_ORDER_FATAL]:", err);
                    return json(res, 500, { message: 'Failed to create Razorpay order: ' + err.message });
                }
            }

            // Verify Payment & Promote
            if (url.endsWith('/verify') && method === 'POST') {
                try {
                    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId } = body;
                    if (!eventId) return json(res, 400, { message: 'Event ID required' });

                    const event = await Event.findById(eventId);
                    if (!event) return json(res, 404, { message: 'Event not found' });
                    if (String(event.organizerId) !== String(user.id)) {
                        return json(res, 403, { message: 'Access Denied: Ownership verification failed' });
                    }
                    
                    const bodyString = razorpay_order_id + "|" + razorpay_payment_id;
                    const expectedSignature = crypto
                        .createHmac("sha256", KEY_SECRET)
                        .update(bodyString.toString())
                        .digest("hex");

                    if (expectedSignature === razorpay_signature) {
                        await Event.findByIdAndUpdate(eventId, { 
                            isPublic: true, 
                            listingPaid: true 
                        });
                        return json(res, 200, { success: true, message: 'Event promoted successfully!' });
                    } else {
                        return json(res, 400, { success: false, message: 'Invalid signature' });
                    }
                } catch (err) {
                    console.error("[PROMOTION_VERIFY_FATAL]:", err);
                    return json(res, 500, { message: 'Verification process failed' });
                }
            }
        }

        // -- Event Submission / Proposals --
        if (url.includes('/event-request')) {
            if (method === 'POST') {
                const { eventName, contactName, contactEmail, description } = body;
                if (!eventName || !contactName || !contactEmail) {
                    return json(res, 400, { message: 'Required fields missing: eventName, contactName, contactEmail' });
                }
                const request = await models.EventRequest.create({ 
                    eventName, contactName, contactEmail, description 
                });
                return json(res, 201, { success: true, id: request._id });
            }
            return json(res, 405, { message: 'Method Not Allowed' });
        }

        // -- Event Management --
        if (url.includes('/events')) {
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1];
            // An individual event is being requested if the last segment looks like a MongoDB ObjectId
            const isIndividual = lastPart && lastPart.length >= 24 && /^[a-f0-9]+$/i.test(lastPart);
            const eventId = isIndividual ? lastPart : null;

            if (url.endsWith('/upload') && method === 'POST') {
                return json(res, 501, { message: 'Image uploads are temporarily disabled.' });
            }

            if (method === 'GET') {
                // Fetch single event
                if (isIndividual) {
                    const cacheKey = `event:${eventId}`;
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        console.log(`[REDIS] CACHE HIT: ${cacheKey}`);
                        return json(res, 200, cached);
                    }

                    console.log(`[REDIS] CACHE MISS: ${cacheKey}. Fetching from MongoDB...`);
                    const event = await Event.findById(eventId).lean();
                    if (!event) return json(res, 404, { message: 'Event not found' });
                    
                    // SECURITY: Ensure draft events are only visible to admins or the organizer
                    const isPublished = ['published', 'Published'].includes(event.status);
                    const isOrganizer = user && (String(event.organizerId) === String(user.id));
                    const isAdmin = user && (user.role === 'superadmin' || user.role === 'admin');
                    
                    if (!isPublished && !isOrganizer && !isAdmin) {
                        return json(res, 403, { message: 'This event is currently in draft mode and not visible to the public.' });
                    }

                    const normalized = normalizeEvent(event);
                    // Only cache published events to keep draft logic secure
                    if (isPublished) await setCache(cacheKey, normalized, 600); // 10 mins cache
                    return json(res, 200, normalized);
                }

                // Admin: fetch all events (restricted by role)
                if (url.includes('admin/all')) {
                    if (!user) {
                        console.warn(`[EVENT API] Unauthorized access attempt from ${req.headers.host}`);
                        return json(res, 401, { message: 'Auth required' });
                    }
                    
                    console.log(`[EVENT API] Session: ${user.email} (${user.role}) fetching admin registry`);
                    
                    let query = {};
                    if (user.role !== 'superadmin' && user.role !== 'admin') {
                        query.organizerId = user.id;
                        console.log(`[EVENT API] Scope restricted to UID: ${user.id}`);
                    }

                    const list = await Event.find(query).sort({ date: 1 }).lean();
                    console.log(`[EVENT API] Successfully resolved ${list.length} events for ${user.role}`);
                    return json(res, 200, list.map(normalizeEvent));
                }

                // Fetch featured events (e.g. ?featured=true)
                const params = new URLSearchParams(queryPart || '');
                if (params.get('featured') === 'true') {
                    const cacheKey = 'events:featured';
                    const cached = await getCache(cacheKey);
                    if (cached) {
                        console.log(`[REDIS] CACHE HIT: ${cacheKey}`);
                        return json(res, 200, cached);
                    }

                    console.log(`[REDIS] CACHE MISS: ${cacheKey}. Fetching from MongoDB...`);
                    const featuredList = await Event.find({ 
                        isFeatured: true, 
                        isPublic: true, 
                        status: { $in: ['published', 'Published'] }
                    }).sort({ createdAt: -1 }).lean();
                    
                    const result = featuredList.map(pruneEvent);
                    await setCache(cacheKey, result, 300); // 5 mins cache
                    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
                    return json(res, 200, result);
                }

                // Public: fetch promoted events
                const cacheKey = 'events:public';
                const cached = await getCache(cacheKey);
                if (cached) {
                    console.log(`[REDIS] CACHE HIT: ${cacheKey}`);
                    return json(res, 200, cached);
                }

                console.log(`[REDIS] CACHE MISS: ${cacheKey}. Fetching from MongoDB...`);
                const evts = await Event.find({ 
                    status: { $in: ['published', 'Published'] },
                    isPublic: true // Must be explicitly true
                }).sort({ date: 1 }).lean();
                
                const result = evts.map(pruneEvent);
                await setCache(cacheKey, result, 300); // 5 mins cache
                res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
                return json(res, 200, result);
            }

            if (method === 'POST') {
                if (!user) return json(res, 401, { message: 'Auth required' });
                const event = await Event.create({ ...body, organizerId: user.id });
                
                // Invalidate public lists
                await delCache('events:public');
                await delCache('events:featured');
                
                return json(res, 201, normalizeEvent(event.toObject()));
            }

            if (method === 'PUT' && isIndividual) {
                if (!user) return json(res, 401, { message: 'Auth required' });
                
                const event = await Event.findById(eventId);
                if (!event) return json(res, 404, { message: 'Event not found' });
                
                // Permission Check: Superadmin or the exact organizer
                if (user.role !== 'superadmin' && String(event.organizerId) !== String(user.id)) {
                    return json(res, 403, { message: 'Access Denied: You do not own this event' });
                }

                const updated = await Event.findByIdAndUpdate(eventId, body, { new: true }).lean();
                
                // Invalidate cache
                await delCache(`event:${eventId}`);
                await delCache('events:public');
                await delCache('events:featured');
                
                return json(res, 200, normalizeEvent(updated));
            }

            if (method === 'DELETE' && isIndividual) {
                if (!user) return json(res, 401, { message: 'Auth required' });
                
                const event = await Event.findById(eventId);
                if (!event) return json(res, 404, { message: 'Event not found' });

                // Permission Check: Superadmin or the exact organizer
                if (user.role !== 'superadmin' && String(event.organizerId) !== String(user.id)) {
                    return json(res, 403, { message: 'Access Denied: You do not own this event' });
                }

                await Event.findByIdAndDelete(eventId);
                
                // Invalidate cache
                await delCache(`event:${eventId}`);
                await delCache('events:public');
                await delCache('events:featured');
                
                return json(res, 200, { message: 'Event removed' });
            }
        }
        // -- Parkings (Public) --
        if (url.includes('/parking') && method === 'GET') {
            const SecParking = models.getSecondaryModel('Parking');
            const parkings = await SecParking.find({ 
                Status: { $in: ["Active", "Recommended", "active"] } 
            }).lean();
            return json(res, 200, parkings);
        }

        // -- Discussions & Comments --
        if (url.includes('/discussions')) {
            const params = new URLSearchParams(queryPart || '');
            const id = params.get('id'); // Discussion ID from query string
            
            if (method === 'GET') {
                if (id) {
                    const disc = await Discussion.findById(id).lean();
                    if (!disc) return json(res, 404, { message: 'Discussion not found' });
                    const comms = await Comment.find({ discussionId: id }).sort({ createdAt: -1 }).lean();
                    return json(res, 200, { ...disc, comments: comms });
                }
                
                const page = parseInt(params.get('page')) || 1;
                const limit = parseInt(params.get('limit')) || 6;
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
                if (!user) return json(res, 401, { message: 'Auth required' });
                
                // POST /api/discussions/comments?id=... (Create Comment)
                if (url.includes('/comments') && id) {
                    const comment = await Comment.create({
                        discussionId: id,
                        parentId: body.parentId || null,
                        text: body.text,
                        authorName: user.name,
                        authorUid: user.id,
                        authorPhoto: user.picture || ""
                    });
                    // Update discussion comment count
                    await Discussion.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
                    return json(res, 201, comment.toObject());
                }
                
                // POST /api/discussions (Create Discussion)
                const disc = await Discussion.create({ 
                    ...body, 
                    authorUid: user.id, 
                    authorName: user.name,
                    authorPhoto: user.picture || ""
                });
                return json(res, 201, disc.toObject());
            }

            if (method === 'PATCH') {
                if (!user) return json(res, 401, { message: 'Auth required' });
                
                // PATCH /api/discussions/details?id=... (Vote Discussion)
                if (url.includes('/details') && id) {
                    const { action } = body; // 'upvote' or 'downvote'
                    const disc = await Discussion.findById(id);
                    if (!disc) return json(res, 404, { message: 'Not found' });
                    
                    disc.upvotes = disc.upvotes.filter(uid => uid !== user.id);
                    disc.downvotes = disc.downvotes.filter(uid => uid !== user.id);
                    
                    if (action === 'upvote') disc.upvotes.push(user.id);
                    else if (action === 'downvote') disc.downvotes.push(user.id);
                    
                    await disc.save();
                    return json(res, 200, { upvotes: disc.upvotes, downvotes: disc.downvotes });
                }
                
                // PATCH /api/discussions/comments?id=... (Vote Comment)
                if (url.includes('/comments') && id) {
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
        }

        return json(res, 404, { message: 'Events endpoint not matched: ' + url });
    } catch (err) {
        if (err.missingConfig) {
             return json(res, 200, { success: false, missingConfig: true, message: 'Missing database configuration.' });
        }
        
        await logSystemError('events_api', 'api_fatal', err.message, err.stack, { url });
        console.error('[EVENTS_ERROR]:', err);
        return json(res, 500, { message: 'Server Error: ' + err.message });
    }
}
