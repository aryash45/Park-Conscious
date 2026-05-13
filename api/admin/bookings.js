/**
 * api/admin/bookings.js
 * 
 * Purpose: Booking management, attendees list, bulk emailing tickets, and payment reconciliation.
 */
import crypto from 'crypto';
import axios from 'axios';
import { Resend } from 'resend';
import { json, normalizeEvent } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Booking, Event, User, Owner, Parking } = models;

export async function handleBookings(url, method, body, user, res) {
    // -- Admin Attendees/Bookings List --
    if (url.includes('bookings/all') && method === 'GET') {
        if (!user) return json(res, 401, { message: 'Authentication required. Please log in again.' });
        
        const role = (user.role || '').toLowerCase();
        let query = { status: { $in: ["Confirmed", "confirmed"] } };
        
        // Superadmin sees everything. Everyone else is scoped to their events.
        if (role !== 'superadmin' && role !== 'admin') {
            const myEvents = await Event.find({ organizerId: user.id }).select('_id').lean();
            const myEventIds = myEvents.map(e => String(e._id));
            query.eventId = { $in: myEventIds };
        }

        const bookings = await Booking.find(query).sort({ createdAt: -1 }).limit(200).lean();
        
        // Gather unique IDs to fetch in bulk
        const eventIds = new Set();
        const userOwnerIds = new Set();
        for (let b of bookings) {
            const eid = String(b.eventId || b.parkingId || '');
            if (eid && (eid.length === 24 || eid.startsWith('PRK_') || eid.length < 12)) eventIds.add(eid);
            const uid = String(b.userId || '');
            if (uid && uid.length === 24 && /^[a-f0-9]+$/i.test(uid)) userOwnerIds.add(uid);
        }
        
        const [eventsList, usersList, ownersList, parkingsList] = await Promise.all([
           Event.find({ _id: { $in: Array.from(eventIds) } }).lean(),
           User.find({ _id: { $in: Array.from(userOwnerIds) } }).lean(),
           Owner.find({ _id: { $in: Array.from(userOwnerIds) } }).lean(),
           Parking.find({ $or: [{ _id: { $in: Array.from(eventIds) } }, { ID: { $in: Array.from(eventIds) } }] }).lean()
        ]);
        
        const eventMap = {};
        eventsList.forEach(e => eventMap[String(e._id)] = normalizeEvent(e));
        parkingsList.forEach(p => eventMap[String(p._id || p.ID)] = { title: p.Location, location: p.Location });
        
        const userMap = {};
        usersList.forEach(u => userMap[String(u._id)] = { name: u.name, email: u.email });
        ownersList.forEach(o => userMap[String(o._id)] = { name: o.name, email: o.email });
        
        for (let b of bookings) {
            const eid = String(b.eventId || b.parkingId || '');
            if (eid === 'tedx_ggsipu_2026') b.event = { title: 'TEDx GGSIPU SANGAM', date: new Date('2026-04-10T10:00:00Z') };
            else if (eid === 'farewell_2024' || eid === 'afsana_2026') b.event = { title: 'AFSANA 2026 Farewell', date: new Date('2026-05-25T18:00:00Z') };
            else if (eventMap[eid]) b.event = eventMap[eid];
            
            let resolvedName = String(b.userId || 'Guest');
            let resolvedEmail = b.email || b.phone || 'N/A';
            if (userMap[resolvedName]) {
                const profile = userMap[resolvedName];
                resolvedName = profile.name;
                if (resolvedEmail === 'N/A' || !resolvedEmail) resolvedEmail = profile.email;
            }
            b.user = { name: resolvedName, email: resolvedEmail };
        }
        return json(res, 200, bookings);
    }

    // -- Bulk Emailing --
    if (url.includes('email-batch') && method === 'POST') {
        if (!user) return json(res, 403, { message: 'Access Denied' });
        
        const { bookingIds } = body;
        if (!Array.isArray(bookingIds) || bookingIds.length === 0) return json(res, 400, { message: 'bookingIds array required' });

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) return json(res, 500, { success: false, message: 'RESEND_API_KEY not configured.' });

        const resend = new Resend(RESEND_API_KEY);
        const role = (user.role || '').toLowerCase();
        let bookingQuery = { _id: { $in: bookingIds }, emailSent: { $ne: true }, status: { $in: ["Confirmed", "confirmed"] } };
        
        if (role !== 'superadmin' && role !== 'admin') {
            const myEvents = await Event.find({ organizerId: user.id }).select('_id').lean();
            const myEventIds = myEvents.map(e => String(e._id));
            bookingQuery.eventId = { $in: myEventIds };
        }

        const bookings = await Booking.find(bookingQuery).lean();
        if (bookings.length === 0) return json(res, 200, { success: true, sent: 0, message: 'No eligible bookings found.' });

        const uids = [...new Set(bookings.map(b => b.userId).filter(id => id && id.length === 24))];
        const eids = [...new Set(bookings.map(b => String(b.eventId || '')).filter(id => id && id.length === 24))];
        
        const [usersList, ownersList, eventsList] = await Promise.all([
            User.find({ _id: { $in: uids } }).lean(),
            Owner.find({ _id: { $in: uids } }).lean(),
            Event.find({ _id: { $in: eids } }).lean()
        ]);

        const userMap = {};
        usersList.forEach(u => userMap[String(u._id)] = u.name);
        ownersList.forEach(o => userMap[String(o._id)] = o.name);

        const eventMap = {};
        eventsList.forEach(e => eventMap[String(e._id)] = e.displayTitle || e.title);

        const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

        const emailsToSend = [];
        for (let b of bookings) {
            if (!b.email) continue;
            let bName = userMap[String(b.userId)] || "Attendee";
            const ticketNumber = b.ticketId || b.transactionId || String(b._id).slice(-8);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketNumber)}&ecc=L&margin=0`;
            
            let eventName = "BACKSTAGE Experience";
            if (b.eventId === "tedx_ggsipu_2026") eventName = "TEDx GGSIPU SANGAM";
            else if (b.eventId === "farewell_2024" || b.eventId === "afsana_2026") eventName = "AFSANA '26 Farewell";
            else if (eventMap[String(b.eventId)]) eventName = eventMap[String(b.eventId)];

            emailsToSend.push({
               from: process.env.EMAIL_FROM || 'BACKSTAGE <tickets@parkconscious.in>',
               to: b.email,
               subject: `Your Admittance Pass for ${eventName}`,
               html: `
                  <div style="font-family: 'Outfit', sans-serif; max-width: 600px; margin: 0 auto; background-color: #050507; color: #ffffff; padding: 60px 40px; border-radius: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                     <h1 style="color: #ffffff; margin: 0 0 12px 0; font-size: 32px; font-weight: 900; text-transform: uppercase;">YOUR TICKET IS READY</h1>
                     <p style="color: #64748b; margin-bottom: 40px;">Hi ${esc(bName)}, see you at ${esc(eventName)}!</p>
                     <div style="background-color: #ffffff; padding: 30px; border-radius: 30px; display: inline-block; margin-bottom: 40px;">
                        <img src="${qrUrl}" alt="QR" width="220" height="220" style="display: block; border-radius: 12px;" />
                     </div>
                     <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 24px; text-align: left;">
                        <p style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0;">${esc(bName)}</p>
                        <p style="color: #6366f1; font-size: 18px; font-weight: 800; margin: 0;">${esc(eventName)}</p>
                        <p style="color: #ffffff; font-family: monospace; font-size: 20px; font-weight: 900; margin: 0;">#${esc(ticketNumber)}</p>
                     </div>
                  </div>
               `
            });
        }

        if (emailsToSend.length === 0) return json(res, 200, { success: true, sent: 0 });

        try {
           const { data, error } = await resend.batch.send(emailsToSend);
           if (error) return json(res, 500, { success: false, message: error.message });
           await Booking.updateMany({ _id: { $in: bookings.map(b => b._id) } }, { $set: { emailSent: true } });
           return json(res, 200, { success: true, sent: emailsToSend.length });
        } catch (err) {
           return json(res, 500, { success: false, message: 'Error processing batch', error: String(err) });
        }
    }

    // -- Delete Booking (Admin Only) --
    if (url.includes('bookings/') && method === 'DELETE') {
        if (!user) return json(res, 403, { message: 'Access Denied' });
        const bookingId = url.split('/').pop();
        const booking = await Booking.findById(bookingId);
        if (!booking) return json(res, 404, { message: 'Booking not found' });

        const role = (user.role || '').toLowerCase();
        if (role !== 'superadmin' && role !== 'admin') {
            const event = await Event.findById(booking.eventId);
            if (!event || String(event.organizerId) !== String(user.id)) return json(res, 403, { message: 'Access Denied' });
        }

        if (booking.status && booking.status.toLowerCase() === "confirmed" && booking.eventId && booking.eventId.length === 24) {
           await Event.findByIdAndUpdate(booking.eventId, { $inc: { capacity: 1 } });
        }

        await Booking.findByIdAndDelete(bookingId);
        return json(res, 200, { success: true, message: 'Booking removed' });
    }

    // -- Payment Reconciliation (Force Sync with PhonePe) --
    if (url.includes('reconcile') && method === 'POST') {
        const role = (user.role || '').toLowerCase();
        if (!user || role !== 'admin') return json(res, 403, { message: 'Access Denied' });

        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const pendingBookings = await Booking.find({ status: "Initiated", createdAt: { $lt: fiveMinsAgo } }).limit(20);

        if (pendingBookings.length === 0) return json(res, 200, { success: true, recovered: 0 });

        const { PHONEPE_MERCHANT_ID: MERCHANT_ID, PHONEPE_SALT_KEY: SALT_KEY, PHONEPE_SALT_INDEX: SALT_INDEX, PHONEPE_BASE_URL: ENV_BASE_URL } = process.env;
        if (!MERCHANT_ID || !SALT_KEY || !SALT_INDEX) return json(res, 500, { success: false, message: "PhonePe credentials missing." });

        let recoveredCount = 0;
        let failureCount = 0;

        for (const b of pendingBookings) {
            try {
                const txId = b.transactionId;
                const checkSum = crypto.createHash("sha256").update(`/pg/v1/status/${MERCHANT_ID}/${txId}` + SALT_KEY).digest("hex") + "###" + SALT_INDEX;
                const response = await axios.get(`${ENV_BASE_URL}/pg/v1/status/${MERCHANT_ID}/${txId}`, {
                    headers: { "X-VERIFY": checkSum, "X-MERCHANT-ID": MERCHANT_ID },
                    timeout: 5000
                });

                const data = response.data;
                const state = data?.data?.state;

                if (data?.success && state === "COMPLETED") {
                    // ATOMIC CAPACITY GUARD: Check and decrement first
                    let capacityUpdate = null;
                    if (b.eventId && b.eventId.length === 24) {
                        capacityUpdate = await Event.findOneAndUpdate(
                            { _id: b.eventId, capacity: { $gt: 0 } },
                            { $inc: { capacity: -1 } },
                            { new: true }
                        );
                        
                        if (!capacityUpdate) {
                            console.error(`[RECONCILE_OVERSOLD] Event ${b.eventId} is full. Skipping.`);
                            continue;
                        }
                    }

                    const updated = await Booking.findOneAndUpdate(
                        { _id: b._id, status: "Initiated" },
                        { $set: { status: "Confirmed", ticketId: "TK-" + crypto.randomUUID().slice(0, 8).toUpperCase() } },
                        { new: true }
                    );

                    if (updated) {
                        recoveredCount++;
                    } else if (capacityUpdate) {
                        // Rollback capacity if booking update failed
                        await Event.findByIdAndUpdate(b.eventId, { $inc: { capacity: 1 } });
                    }
                } else if (state === "FAILED" || state === "CANCELLED") {
                    await Booking.findByIdAndUpdate(b._id, { $set: { status: "Failed" } });
                    failureCount++;
                } else if (!data || !data.success) {
                    // Treat missing data or success:false as failure to avoid TypeErrors
                    await Booking.findByIdAndUpdate(b._id, { $inc: { failureCount: 1 } });
                }
            } catch (err) { console.error(`Reconcile failed:`, err.message); }
        }
        return json(res, 200, { success: true, recovered: recoveredCount, failed: failureCount });
    }

    return null;
}
