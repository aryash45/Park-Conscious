/**
 * api/pay.js
 * 
 * Purpose: Payment lifecycle management via Razorpay.
 * Handles payment order creation, callback verification (signatures), 
 * free ticket processing, check-ins, individual booking status checks, 
 * and fetching a user's full booking history across multiple databases.
 */
import axios from 'axios';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import { json, setCors, getBody, normalizeEvent, verifyUser } from './lib/utils.js';
import { dispatchTicketEmail } from './lib/email.js';

const { Booking, Owner, User, Event } = models;
const PLATFORM_FEE_PERCENT = 0.08; // 8% commission

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

    const fullUrl = req.url || '/';
    const [pathPart, queryPart] = fullUrl.split('?');
    const url = pathPart.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    const body = await getBody(req);

    try {
        // Default to backstage_events for general payment logic
        await connectDB('backstage_events');
        
        // Check if this is a request for the user's personal history
        const isHistoryRequest = url.includes('/bookings/') && !url.includes('/status') && !url.includes('/check-in');
        if (url.includes('/pay') && !url.includes('/payment-callback') && method === 'POST') {
            const { name, amount, phone, eventId, orderId, userId, screenshotUrl, customData } = body;
            const targetEventId = eventId || orderId;
            const targetUserId = userId || name || "Guest";

            // SECURITY: Ensure the event is published before allowing bookings
            if (targetEventId && targetEventId.length === 24) {
                const event = await models.Event.findById(targetEventId).lean();
                if (!event) return json(res, 404, { message: 'Event not found' });
                if (!['published', 'Published'].includes(event.status)) {
                    return json(res, 403, { message: 'Bookings are only allowed for published events.' });
                }
            }
            
            // PREVENT DUPLICATE BOOKINGS: Ensure the user/email/phone hasn't already booked this event
            const emailFilter = body.email ? { email: body.email } : null;
            const phoneFilter = phone ? { phone: phone } : null;
            const userFilter = targetUserId !== "Guest" ? { userId: targetUserId } : null;
            
            const orConditions = [emailFilter, phoneFilter, userFilter].filter(Boolean);
            
            if (orConditions.length > 0) {
                const existingCompleteBooking = await Booking.findOne({
                    eventId: targetEventId,
                    status: "Confirmed",
                    $or: orConditions
                });

                if (existingCompleteBooking) {
                    return json(res, 400, { 
                        message: "A confirmed ticket already exists for this email, phone, or account on this event." 
                    });
                }
            }
            
            const KEY_ID = process.env.RAZORPAY_KEY_ID;
            const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

            if (!KEY_ID || !KEY_SECRET) {
                console.error("[SECURITY ALERT]: Razorpay Keys are missing from environment variables.");
                return json(res, 500, { 
                    message: "Internal Configuration Error: Payment keys not found." 
                });
            }
            
            const txId = "TXN_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
            const origin = req.headers.origin || `https://events.parkconscious.in`;
            // Ensure redirected traffic points back to the client application properly
            const redirectBase = origin;

            const numericAmount = Math.round(parseFloat(amount) * 100);

            // Handle FREE tickets (amount = 0) instantly bypassing Razorpay
            if (numericAmount === 0 || !amount) {
                const ticketId = "TK-" + crypto.randomUUID().slice(0, 8).toUpperCase();
                const newBooking = await Booking.create({ 
                    transactionId: txId, 
                    eventId: targetEventId, 
                    userId: targetUserId, 
                    amount: "0", 
                    screenshotUrl: screenshotUrl || null,
                    status: "Confirmed",
                    phone: phone,
                    name: name || body.name || null,
                    email: body.email || null,
                    ticketId: ticketId,
                    tierName: body.tierName || null,
                    customData: customData || {},
                    ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
                    userAgent: req.headers['user-agent'] || null
                });

                if (targetEventId && targetEventId.length === 24) {
                    const tierName = body.tierName;
                    const filter = { _id: targetEventId };
                    const updateQuery = { $inc: { capacity: -1 } };
                    
                    if (tierName) {
                        const event = await models.Event.findById(targetEventId).lean();
                        if (event && event.ticketTiers?.some(t => t.name === tierName)) {
                            filter["ticketTiers.name"] = tierName;
                            updateQuery.$inc["ticketTiers.$.capacity"] = -1;
                        }
                    }

                    const eventBefore = await models.Event.findById(targetEventId).lean();
                    const updateResult = await models.Event.findOneAndUpdate(filter, updateQuery, { new: true }).lean();
                    
                    console.log(`[BOOKING_DEBUG_FREE] CID: ${targetEventId} Tier: ${tierName}`);
                    console.log(`[BOOKING_DEBUG_FREE] BEFORE: Cap=${eventBefore?.capacity}`);
                    console.log(`[BOOKING_DEBUG_FREE] AFTER:  Cap=${updateResult?.capacity}`);
                } else {
                    console.warn(`[BOOKING_DEBUG_FREE] Skipping capacity decrement for non-ObjectId: ${targetEventId}`);
                }

                // Dispatch ticket email (Smart Dual-Mode)
                dispatchTicketEmail(newBooking._id);

                return json(res, 200, { success: true, redirectUrl: `${redirectBase}/payment-success?txnId=${txId}` });
            }

            const razorpay = new Razorpay({
                key_id: KEY_ID,
                key_secret: KEY_SECRET,
            });

            // Create Razorpay Order
            const options = {
                amount: numericAmount,
                currency: "INR",
                receipt: txId,
            };

            const order = await razorpay.orders.create(options);

            await Booking.create({ 
                transactionId: order.id, 
                eventId: targetEventId, 
                userId: targetUserId, 
                amount, 
                screenshotUrl: screenshotUrl || null,
                status: "Initiated",
                phone: phone,
                name: name || body.name || null,
                email: body.email || null,
                tierName: body.tierName || null,
                customData: customData || {},
                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null
            });

            return json(res, 200, { 
                success: true, 
                orderId: order.id, 
                amount: numericAmount, 
                key: KEY_ID 
            });
        }


        // -- Razorpay Payment Callback (Verification) --
        if (url.includes('/payment-callback')) {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
            
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return json(res, 400, { message: "Invalid payment details" });
            }

            const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

            // Verify signature
            const bodyString = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac("sha256", KEY_SECRET)
                .update(bodyString.toString())
                .digest("hex");

            const isAuthentic = expectedSignature === razorpay_signature;

            if (isAuthentic) {
                const booking = await Booking.findOne({ transactionId: razorpay_order_id });
                if (!booking) return json(res, 404, { message: "Booking record not found" });

                const totalAmount = parseFloat(booking.amount) || 0;
                const platformFee = Math.round(totalAmount * PLATFORM_FEE_PERCENT * 100) / 100;
                const organizerPayout = totalAmount - platformFee;

                const updatedBooking = await Booking.findOneAndUpdate(
                    { transactionId: razorpay_order_id, status: { $ne: "Confirmed" } }, 
                    { $set: { 
                        status: "Confirmed", 
                        ticketId: "TK-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
                        platformFee,
                        organizerPayout
                    } },
                    { new: true }
                );

                if (updatedBooking && updatedBooking.eventId && updatedBooking.eventId.length === 24) {
                    const tierName = updatedBooking.tierName;
                    const filter = { _id: updatedBooking.eventId };
                    const updateQuery = { $inc: { capacity: -1 } };
                    
                    if (tierName) {
                        const event = await models.Event.findById(updatedBooking.eventId).lean();
                        if (event && event.ticketTiers?.some(t => t.name === tierName)) {
                            filter["ticketTiers.name"] = tierName;
                            updateQuery.$inc["ticketTiers.$.capacity"] = -1;
                        }
                    }

                    const eventBefore = await models.Event.findById(updatedBooking.eventId).lean();
                    const updateResult = await models.Event.findOneAndUpdate(filter, updateQuery, { new: true }).lean();
                    
                    console.log(`[BOOKING_DEBUG] CID: ${updatedBooking.eventId} Tier: ${tierName}`);
                    console.log(`[BOOKING_DEBUG] BEFORE: Cap=${eventBefore?.capacity}`);
                    console.log(`[BOOKING_DEBUG] AFTER:  Cap=${updateResult?.capacity}`);
                } else {
                    console.warn(`[BOOKING_DEBUG] Skipping capacity decrement for non-ObjectId: ${updatedBooking?.eventId}`);
                }
                
                // Dispatch ticket email (Smart Dual-Mode)
                dispatchTicketEmail(updatedBooking._id);

                return json(res, 200, { success: true, message: "Payment verified successfully", txnId: razorpay_order_id });
            } else {
                return json(res, 400, { success: false, message: "Invalid signature" });
            }
        }

        // -- Check-in / Attendance Management --
        if (url.includes('/bookings/check-in') || url.includes('/bookings/un-check-in')) {
            if (method !== 'POST') return json(res, 405, { message: 'Method Not Allowed' });
            
            const { ticketId } = body;
            if (!ticketId) return json(res, 400, { message: 'Ticket ID required' });

            const isUncheck = url.includes('un-check-in');
            
            // Try Events DB first
            let booking = await Booking.findOneAndUpdate(
                { ticketId: ticketId },
                { $set: { attended: !isUncheck } },
                { new: true }
            );

            if (!booking) {
                // Try Parking DB
                const SecBooking = models.getSecondaryModel('Booking');
                booking = await SecBooking.findOneAndUpdate(
                    { ticketId: ticketId },
                    { $set: { attended: !isUncheck } },
                    { new: true }
                );
            }

            if (!booking) return json(res, 404, { message: 'Booking code not found' });
            return json(res, 200, { success: true, attended: booking.attended });
        }

        // -- Booking Status Check --
        if (url.includes('/booking/status/') && method === 'GET') {
            const txnId = url.split('/').pop();
            if (!txnId) return json(res, 400, { message: 'Transaction ID missing' });
            
            // Try Events DB first
            let booking = await Booking.findOne({ transactionId: txnId }).lean();
            
            if (!booking) {
                // Try Parking DB
                const SecBooking = models.getSecondaryModel('Booking');
                booking = await SecBooking.findOne({ transactionId: txnId }).lean();
            }

            if (!booking) return json(res, 404, { message: 'Booking not found' });
            
            if (booking.eventId && booking.eventId.length === 24) {
                const event = await models.Event.findById(booking.eventId).lean();
                if (event) booking.event = normalizeEvent(event);
            } else if (booking.parkingId) {
                const SecParking = models.getSecondaryModel('Parking');
                const pk = await SecParking.findOne({ $or: [{ _id: booking.parkingId }, { ID: booking.parkingId }] }).lean();
                if (pk) booking.event = { title: pk.Location, location: pk.Location, date: booking.createdAt };
            }
            
            return json(res, 200, booking);
        }

        // -- User's Personal Bookings (My Tickets) --
        if (url.includes('/bookings/') && !url.includes('/status') && method === 'GET') {
            const userId = url.split('/').pop();
            // Secure Solution: Extract the user's email directly from their session for truth
            const authUser = verifyUser(req);
            let targetEmail = authUser?.email?.toLowerCase()?.trim();

            // Fallback: If no session, try to get email from database records via userId
            if (!targetEmail && userId && userId !== 'undefined') {
                let seedUser = await Owner.findOne({ $or: [{ _id: userId }, { uid: userId }] }).lean();
                if (!seedUser) seedUser = await User.findOne({ $or: [{ _id: userId }, { uid: userId }] }).lean();
                if (seedUser) targetEmail = seedUser.email?.toLowerCase()?.trim();
            }
            
            if (!targetEmail && (!userId || userId === 'undefined')) {
                return json(res, 400, { message: 'Identification failed. Please sign in again.' });
            }

            let query = { status: { $in: ["Confirmed", "confirmed"] } };
            
            if (targetEmail) {
                // Bridge: Resolve EVERY ID associated with this verified email
                const allOwners = await Owner.find({ email: targetEmail }).select('_id uid').lean();
                const allUsers = await User.find({ email: targetEmail }).select('_id uid').lean();
                
                const allIds = new Set();
                if (userId && userId !== 'undefined') allIds.add(String(userId));
                [...allOwners, ...allUsers].forEach(u => {
                    if (u._id) allIds.add(String(u._id));
                    if (u.uid) allIds.add(String(u.uid));
                });
                
                // Final Collective Query
                query.$or = [
                    { userId: { $in: Array.from(allIds) } },
                    { email: new RegExp(`^${targetEmail}$`, 'i') }
                ];
            } else {
                query.userId = String(userId);
            }

            const bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();

            // BRIDGE: Fetch from Park Conscious database as well
            try {
                const SecBooking = models.getSecondaryModel('Booking');
                const parkingBookings = await SecBooking.find(query).sort({ createdAt: -1 }).lean();
                if (parkingBookings && parkingBookings.length > 0) {
                    bookings.push(...parkingBookings);
                    bookings.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
                }
            } catch (err) {
                console.error('[DATABASE_MERGE_ERROR]:', err);
            }

            for (let b of bookings) {
                const eid = String(b.eventId || b.parkingId || '');
                if (eid && (eid.length === 24 || eid.startsWith('PRK_'))) {
                    // Try to find in Event collection first
                    const evt = await models.Event.findById(eid).lean();
                    if (evt) {
                        b.event = normalizeEvent(evt);
                    } else {
                        // Try to find in Parking collection
                        const SecParking = models.getSecondaryModel('Parking');
                        const pk = await SecParking.findOne({ $or: [{ _id: eid }, { ID: eid }] }).lean();
                        if (pk) {
                            b.event = { title: pk.Location, location: pk.Location, date: b.createdAt };
                        } else {
                            b.event = { title: "Activity Pass", date: b.createdAt, location: "TBA" };
                        }
                    }
                } else {
                    const formatTitle = (str) => {
                       if (!str) return "Experience Pass";
                       return str.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    };
                    b.event = { title: formatTitle(eid), date: b.createdAt, location: "TBA" };
                }
            }

            return json(res, 200, bookings);
        }

        return json(res, 404, { message: 'Payment endpoint not matched: ' + url });
    } catch (err) {
        if (err.missingConfig) {
             return json(res, 200, { success: false, missingConfig: true, message: 'Missing database configuration.' });
        }
        
        console.error('[PAYMENT_PROCESS_ERROR]:', err);
        
        // Specific handling for Razorpay Connection/Auth issues
        if (err.statusCode === 401 || err.description?.includes('Unauthorized')) {
             return json(res, 500, { 
                success: false, 
                message: 'Razorpay Authentication failed. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file.' 
             });
        }

        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
            return json(res, 503, { 
                success: false, 
                message: 'Network connection lost while reaching payment gateway. Please check your internet or Razorpay status.' 
            });
        }

        return json(res, 500, { success: false, message: 'Server error processing payment: ' + err.message });
    }
}
