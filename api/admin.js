/**
 * api/admin.js
 * 
 * Purpose: Multi-purpose Administrative API handler. 
 * Manages inquiries, system diagnostics, error logging, user/admin accounts, 
 * booking listings, dashboard stats, bulk emailing (tickets/QR codes), 
 * booking deletions, and payment reconciliation with PhonePe.
 * Implements role-based access control for SuperAdmins, Admins, and Organizers.
 */
import bcrypt from 'bcryptjs';
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import crypto from 'crypto';
import axios from 'axios';
import { json, setCors, getBody, verifyUser, normalizeEvent } from './lib/utils.js';
import { syncIdentity } from './lib/sync.js';
import { Resend } from 'resend';

const { Booking, Event, User, Owner, Parking, SystemLog, Contact, EventRequest } = models;

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

    const fullUrl = req.url || '/';
    const url = fullUrl.split('?')[0].replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    const body = await getBody(req);
    const user = verifyUser(req);

    try {
        await connectDB();
        
        // -- Inquiries Management (SuperAdmin Only) --
        if (url.includes('inquiries')) {
            if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
                return json(res, 403, { message: 'Access Denied: Administrative privileges required' });
            }

            // Fetch all inquiries
            if (method === 'GET') {
                const [contacts, requests] = await Promise.all([
                    Contact.find({}).sort({ createdAt: -1 }).limit(100).lean(),
                    EventRequest.find({}).sort({ createdAt: -1 }).limit(100).lean()
                ]);
                return json(res, 200, { contacts, requests });
            }

            // Update Event Request status
            if (url.includes('request/') && method === 'PATCH') {
                const requestId = url.split('/').pop();
                const { status } = body;
                if (!['pending', 'approved', 'rejected'].includes(status)) {
                    return json(res, 400, { message: 'Invalid status' });
                }
                const updated = await EventRequest.findByIdAndUpdate(requestId, { status }, { new: true });
                return json(res, 200, { success: true, request: updated });
            }

            // Delete/Archive Contact message
            if (url.includes('contact/') && method === 'DELETE') {
                const contactId = url.split('/').pop();
                await Contact.findByIdAndDelete(contactId);
                return json(res, 200, { success: true, message: 'Message removed' });
            }
        }

        // -- System Diagnostics --
        if (url.includes('diagnose') && method === 'GET') {
            if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
                return json(res, 403, { message: 'Diagnostics Restricted', detectedRole: user?.role });
            }

            const stats = {
                authenticatedAs: user.email,
                role: user.role,
                counts: {
                    bookings: await Booking.countDocuments(),
                    confirmedBookings: await Booking.countDocuments({ status: { $in: ["Confirmed", "confirmed"] } }),
                    events: await Event.countDocuments(),
                    owners: await Owner.countDocuments(),
                    users: await User.countDocuments()
                },
                dbState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
                env: {
                    hasMongoUri: !!process.env.MONGODB_URI,
                    hasJwtSecret: !!process.env.JWT_SECRET,
                    nodeEnv: process.env.NODE_ENV
                }
            };
            return json(res, 200, stats);
        }
        
        // -- Unified Error Reporting (Public/Semi-Public) --
        if (url.includes('logs') && method === 'POST') {
            const { source, type, message, stack, url: errorUrl, metadata } = body;
            if (!source || !message) return json(res, 400, { message: 'Missing source or message' });
            
            const log = await SystemLog.create({
                source,
                type: type || 'frontend_crash',
                message,
                stack,
                url: errorUrl,
                metadata: metadata || {}
            });
            
            console.log(`[SYSTEM LOG] [${source}] ${message}`);
            return json(res, 201, { success: true, logId: log._id });
        }

        // -- System Status Audit (Admin Only or Cron) --
        if (url.includes('system-status') && method === 'GET') {
            const isCron = req.headers['x-cron-secret'] === process.env.CRON_SECRET;
            if (!isCron && (!user || (user.role !== 'superadmin' && user.role !== 'admin'))) {
                return json(res, 403, { message: 'Access Denied' });
            }

            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentLogs = await SystemLog.find({
                resolved: false,
                createdAt: { $gte: twentyFourHoursAgo }
            }).sort({ createdAt: -1 }).limit(50).lean();

            return json(res, 200, {
                status: recentLogs.length > 0 ? 'attention_required' : 'healthy',
                unresolvedCount: recentLogs.length,
                logs: recentLogs
            });
        }

        // -- System Log Management (SuperAdmin Only) --
        if (url.includes('logs') && method === 'GET') {
            if (!user || user.role !== 'superadmin') {
                return json(res, 403, { message: 'Access Denied: SuperAdmin privileges required' });
            }
            
            const logs = await SystemLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
            return json(res, 200, logs);
        }

        if (url.includes('logs/') && method === 'PATCH') {
            if (!user || user.role !== 'superadmin') {
                return json(res, 403, { message: 'Access Denied: SuperAdmin privileges required' });
            }
            
            const logId = url.split('/').pop();
            const { resolved } = body;
            
            const updatedLog = await SystemLog.findByIdAndUpdate(
                logId,
                { $set: { resolved: resolved ?? true } },
                { new: true }
            );
            
            if (!updatedLog) return json(res, 404, { message: 'Log not found' });
            return json(res, 200, { success: true, log: updatedLog });
        }

        // -- User Management (SuperAdmin Only) --
        if (url.includes('users') && method === 'GET') {
            if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) return json(res, 403, { message: 'Access Denied: Administrative privileges required' });
            const admins = await Owner.find({}).select('-password').lean();
            return json(res, 200, admins);
        }

        if (url.includes('users') && method === 'POST') {
            try {
                if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) return json(res, 403, { message: 'Access Denied: Administrative privileges required' });
                
                const { name, email, password, role, assignedEventIds } = body;
                if (!name || !email || !password) return json(res, 400, { message: 'Missing required fields' });

                const existing = await Owner.findOne({ email: email.toLowerCase() });
                if (existing) return json(res, 400, { message: 'User already exists' });

                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = await Owner.create({
                    name,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: role || 'organizer'
                });

                // Handle bulk event assignment
                if (Array.isArray(assignedEventIds) && assignedEventIds.length > 0) {
                   if (role === 'scanner') {
                       await Event.updateMany(
                           { _id: { $in: assignedEventIds } },
                           { $addToSet: { scannerIds: String(newUser._id) } }
                       );
                   } else {
                       await Event.updateMany(
                           { _id: { $in: assignedEventIds } },
                           { $set: { organizerId: String(newUser._id) } }
                       );
                   }
                   console.log(`[USER MGMT] Assigned ${assignedEventIds.length} events to new user ${newUser._id} as ${role}`);
                }

                // Mirror new admin/organizer to Park Conscious database
                await syncIdentity(newUser, true);

                return json(res, 201, { 
                    success: true, 
                    user: { id: newUser._id, name, email, role: newUser.role },
                    assignedCount: assignedEventIds?.length || 0
                });
            } catch (error) {
                console.error("[USER CREATION ERROR]:", error);
                await SystemLog.create({
                    source: 'admin_api',
                    type: 'user_creation_error',
                    message: error.message,
                    stack: error.stack
                });
                return json(res, 500, { message: `Internal Server Error: ${error.message}` });
            }
        }

        if (url.includes('users/') && method === 'DELETE') {
            if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) return json(res, 403, { message: 'Access Denied: Administrative privileges required' });
            
            const userId = url.split('/').pop();
            if (String(user.id) === userId) return json(res, 400, { message: 'Cannot delete your own account' });

            await Owner.findByIdAndDelete(userId);
            return json(res, 200, { success: true, message: 'User removed' });
        }

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
            console.log(`[ADMIN API] Bookings fetched for role ${user.role}: ${bookings.length}`);
            
            // Gather unique IDs to fetch in bulk
            const eventIds = new Set();
            const userOwnerIds = new Set();
            for (let b of bookings) {
                const eid = String(b.eventId || b.parkingId || '');
                // Allow MongoDB ObjectIDs (24 chars) or Parking IDs (starting with PRK_) or short numeric IDs
                if (eid && (eid.length === 24 || eid.startsWith('PRK_') || eid.length < 12)) eventIds.add(eid);
                const uid = String(b.userId || '');
                if (uid && uid.length === 24 && /^[a-f0-9]+$/i.test(uid)) userOwnerIds.add(uid);
            }
            
            // Fetch everything in parallel
            const [eventsList, usersList, ownersList, parkingsList] = await Promise.all([
               Event.find({ _id: { $in: Array.from(eventIds) } }).lean(),
               User.find({ _id: { $in: Array.from(userOwnerIds) } }).lean(),
               Owner.find({ _id: { $in: Array.from(userOwnerIds) } }).lean(),
               Parking.find({ $or: [{ _id: { $in: Array.from(eventIds) } }, { ID: { $in: Array.from(eventIds) } }] }).lean()
            ]);
            
            // Build fast lookup maps
            const eventMap = {};
            eventsList.forEach(e => eventMap[String(e._id)] = normalizeEvent(e));
            parkingsList.forEach(p => eventMap[String(p._id || p.ID)] = { title: p.Location, location: p.Location });
            
            const userMap = {};
            usersList.forEach(u => userMap[String(u._id)] = { name: u.name, email: u.email });
            ownersList.forEach(o => userMap[String(o._id)] = { name: o.name, email: o.email });
            
            // Assemble final response
            for (let b of bookings) {
                const eid = String(b.eventId || b.parkingId || '');
                
                // Handle special string event IDs used by custom booking pages
                if (eid === 'tedx_ggsipu_2026') {
                    b.event = { title: 'TEDx GGSIPU SANGAM', date: new Date('2026-04-10T10:00:00Z') };
                } else if (eid === 'farewell_2024' || eid === 'afsana_2026') {
                    b.event = { title: 'AFSANA 2026 Farewell', date: new Date('2026-05-25T18:00:00Z') };
                } else if (eventMap[eid]) {
                    b.event = eventMap[eid];
                }
                
                let resolvedName = String(b.userId || 'Guest');
                let resolvedEmail = b.email || b.phone || 'N/A';

                if (userMap[resolvedName]) {
                    const profile = userMap[resolvedName];
                    resolvedName = profile.name;
                    if (resolvedEmail === 'N/A' || !resolvedEmail) resolvedEmail = profile.email;
                }

                b.user = { 
                    name: resolvedName, 
                    email: resolvedEmail
                };
            }
            
            return json(res, 200, bookings);
        }

        // -- Owner Dashboard Stats --
        if (url.includes('/owner/') && url.includes('/dashboard') && method === 'GET') {
            const parts = url.split('/');
            const ownerId = parts[parts.indexOf('owner') + 1];

            const parkings = await Parking.find({ owner: ownerId }).lean();
            const parkingIds = parkings.map(p => String(p._id));

            const allBookings = await Booking.find({ parkingId: { $in: parkingIds } }).lean();
            const activeBookings = allBookings.filter(b => b.status === 'Confirmed' || b.status === 'confirmed').length;
            const revenueToday = allBookings.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

            return json(res, 200, {
                totalParkings: parkings.length,
                activeBookings,
                revenueToday,
                parkings
            });
        }

        // -- Owner Booking Logs --
        if (url.includes('/owner/') && url.includes('/logs') && method === 'GET') {
            const parts = url.split('/');
            const ownerId = parts[parts.indexOf('owner') + 1];

            const parkings = await Parking.find({ owner: ownerId }).lean();
            const parkingIds = parkings.map(p => String(p._id));

            const bookings = await Booking.find({ parkingId: { $in: parkingIds } })
                .sort({ createdAt: -1 }).limit(200).lean();

            return json(res, 200, bookings);
        }

        // -- Parking Management (Admin/Owner) --
        if (url.includes('/owner/') && url.includes('/parkings')) {
             if (!user) return json(res, 401, { message: 'Auth required' });
             
             const parts = url.split('/');
             const ownerId = parts[parts.indexOf('owner') + 1];
             
             if (method === 'GET') return json(res, 200, await Parking.find({ owner: ownerId }).lean());
             if (method === 'POST') {
                 const p = await Parking.create({ 
                     ...body, 
                     owner: ownerId, 
                     ID: "PRK_" + crypto.randomUUID().slice(0, 6).toUpperCase() 
                 });
                 return json(res, 201, p.toObject());
             }
        }

        // -- Bulk Emailing --
        if (url.includes('email-batch') && method === 'POST') {
            if (!user) return json(res, 403, { message: 'Access Denied' });
            
            const { bookingIds } = body;
            if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
                return json(res, 400, { message: 'bookingIds array required' });
            }

            const RESEND_API_KEY = process.env.RESEND_API_KEY;
            if (!RESEND_API_KEY) {
                return json(res, 500, { success: false, message: 'RESEND_API_KEY is not configured in the environment.' });
            }

            const resend = new Resend(RESEND_API_KEY);
            
            let bookingQuery = { _id: { $in: bookingIds }, emailSent: { $ne: true }, status: { $in: ["Confirmed", "confirmed"] } };
            
            // If organizer, ensure they only email their own bookings
            if (user.role !== 'superadmin' && user.role !== 'admin') {
                const myEvents = await Event.find({ organizerId: user.id }).select('_id').lean();
                const myEventIds = myEvents.map(e => String(e._id));
                bookingQuery.eventId = { $in: myEventIds };
            }

            const bookings = await Booking.find(bookingQuery).lean();
            
            if (bookings.length === 0) {
                return json(res, 200, { success: true, sent: 0, message: 'No eligible bookings found for this batch (or they were already emailed).' });
            }

            // Sync names and event titles for the email batch
            const uids = [...new Set(bookings.map(b => b.userId).filter(id => id && id.length === 24))];
            const eids = [...new Set(bookings.map(b => String(b.eventId || '')).filter(id => id && id.length === 24))];
            
            const [usersList, ownersList, eventsList] = await Promise.all([
                models.User.find({ _id: { $in: uids } }).lean(),
                models.Owner.find({ _id: { $in: uids } }).lean(),
                models.Event.find({ _id: { $in: eids } }).lean()
            ]);

            const userMap = {};
            usersList.forEach(u => userMap[String(u._id)] = u.name);
            ownersList.forEach(o => userMap[String(o._id)] = o.name);

            const eventMap = {};
            eventsList.forEach(e => eventMap[String(e._id)] = e.displayTitle || e.title);

            const emailsToSend = [];
            for (let b of bookings) {
                if (!b.email) continue;

                let bName = b.userId || "Attendee";
                if (userMap[String(b.userId)]) bName = userMap[String(b.userId)];
                
                const ticketNumber = b.ticketId || b.transactionId || String(b._id).slice(-8);
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketNumber)}&ecc=L&margin=0`;
                
                let eventName = "BACKSTAGE Experience";
                if (b.eventId === "tedx_ggsipu_2026") eventName = "TEDx GGSIPU SANGAM";
                else if (b.eventId === "farewell_2024" || b.eventId === "afsana_2026") eventName = "AFSANA '26 Farewell";
                else if (eventMap[String(b.eventId)]) eventName = eventMap[String(b.eventId)];

                const htmlContent = `
                  <div style="font-family: 'Outfit', sans-serif; max-width: 600px; margin: 0 auto; background-color: #050507; color: #ffffff; padding: 60px 40px; border-radius: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8);">
                     <div style="margin-bottom: 40px;">
                        <span style="background-color: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 8px 20px; border-radius: 99px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; border: 1px solid rgba(99, 102, 241, 0.2);">Official Entry Pass</span>
                     </div>
                     
                     <h1 style="color: #ffffff; margin: 0 0 12px 0; font-size: 32px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">YOUR TICKET IS READY</h1>
                     <p style="color: #64748b; margin-bottom: 40px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Hi ${bName}, see you at ${eventName}!</p>
                     
                     <div style="background-color: #ffffff; padding: 30px; border-radius: 30px; display: inline-block; margin-bottom: 40px; box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.5);">
                        <img src="${qrUrl}" alt="Ticket QR Code" width="220" height="220" style="display: block; border-radius: 12px;" />
                        <p style="color: #64748b; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin-top: 20px; margin-bottom: 0;">Scan to Enter</p>
                     </div>
                     
                     <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 24px; text-align: left; margin: 0 10px;">
                        <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); pb: 20px;">
                           <p style="color: #475569; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px 0; font-weight: 900;">Guest Identification</p>
                           <p style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">${bName}</p>
                        </div>
                        <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); pb: 20px;">
                           <p style="color: #475569; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px 0; font-weight: 900;">Experience</p>
                           <p style="color: #6366f1; font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">${eventName}</p>
                        </div>
                        <div>
                           <p style="color: #475569; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px 0; font-weight: 900;">Credential Hash</p>
                           <p style="color: #ffffff; font-family: monospace; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: 1px;">#${ticketNumber}</p>
                        </div>
                     </div>
                     
                     <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <p style="color: #334155; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">Non-Transferable • Valid ID Required for Entry</p>
                        <p style="color: #ffffff; font-size: 14px; margin-top: 25px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px;">BACKSTAGE</p>
                     </div>
                  </div>
                `;

                emailsToSend.push({
                   from: process.env.EMAIL_FROM || 'BACKSTAGE <tickets@parkconscious.in>',
                   to: b.email,
                   subject: `Your Admittance Pass for ${eventName}`,
                   html: htmlContent
                });
            }

            if (emailsToSend.length === 0) {
               return json(res, 200, { success: true, sent: 0, message: 'No valid emails found.' });
            }

            try {
               const { data, error } = await resend.batch.send(emailsToSend);
               if (error) {
                   console.error("Resend Batch Error:", error);
                   return json(res, 500, { success: false, message: error.message || 'Resend error occurred', details: error });
               }

               const actualEmailedIds = bookings.filter(b => b.email).map(b => b._id);
               await Booking.updateMany(
                   { _id: { $in: actualEmailedIds } },
                   { $set: { emailSent: true } }
               );

               return json(res, 200, { success: true, sent: emailsToSend.length });
            } catch (err) {
               console.error("Email Sending Exception:", err);
               return json(res, 500, { success: false, message: 'Error processing batch', error: String(err) });
            }
        }

        // -- Delete Booking (Admin Only) --
        if (url.includes('bookings/') && method === 'DELETE') {
            if (!user) return json(res, 403, { message: 'Access Denied' });
            
            const bookingId = url.split('/').pop();
            const booking = await Booking.findById(bookingId);
            if (!booking) return json(res, 404, { message: 'Booking not found' });

            // Permission check: Superadmin, Admin, or owner of the associated event
            if (user.role !== 'superadmin' && user.role !== 'admin') {
                const event = await Event.findById(booking.eventId);
                if (!event || String(event.organizerId) !== String(user.id)) {
                    return json(res, 403, { message: 'Access Denied: You do not own the event associated with this booking' });
                }
            }

            // Restore capacity if it was a real event and was confirmed
            if (booking.status === "Confirmed" && booking.eventId && booking.eventId.length === 24) {
               await Event.findByIdAndUpdate(booking.eventId, { $inc: { capacity: 1 } });
            }

            await Booking.findByIdAndDelete(bookingId);
            return json(res, 200, { success: true, message: 'Booking removed successfully' });
        }

        // -- Payment Reconciliation (Force Sync with PhonePe) --
        if (url.includes('reconcile') && method === 'POST') {
            if (!user || user.role !== 'admin') return json(res, 403, { message: 'Access Denied' });

            // Find "Initiated" bookings. Only look at those older than 5 mins to avoid active sessions.
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
            const pendingBookings = await Booking.find({ 
                status: "Initiated", 
                createdAt: { $lt: fiveMinsAgo } 
            }).limit(20); // Process in small batches to stay within serverless limits

            if (pendingBookings.length === 0) {
                return json(res, 200, { success: true, recovered: 0, message: "All transactions are currently up to date." });
            }

            const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
            const SALT_KEY = process.env.PHONEPE_SALT_KEY;
            const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;
            const ENV_BASE_URL = process.env.PHONEPE_BASE_URL;

            if (!MERCHANT_ID || !SALT_KEY || !SALT_INDEX) {
                return json(res, 500, { success: false, message: "System Configuration Error: PhonePe credentials missing." });
            }

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

                    // If PhonePe confirms SUCCESS (COMPLETED)
                    if (response.data.success && response.data.data.state === "COMPLETED") {
                        const updated = await Booking.findOneAndUpdate(
                            { _id: b._id, status: "Initiated" },
                            { $set: { 
                                status: "Confirmed", 
                                ticketId: "TK-" + crypto.randomUUID().slice(0, 8).toUpperCase() 
                            } },
                            { new: true }
                        );
                        if (updated) {
                            recoveredCount++;
                            // Decrement event capacity
                            if (updated.eventId && updated.eventId.length === 24) {
                                await Event.findByIdAndUpdate(updated.eventId, { $inc: { capacity: -1 } });
                            }
                        }
                    } 
                    // If PhonePe explicitly says FAILED
                    else if (response.data.data.state === "FAILED" || response.data.data.state === "CANCELLED") {
                        await Booking.findByIdAndUpdate(b._id, { $set: { status: "Failed" } });
                        failureCount++;
                    }
                } catch (err) {
                    console.error(`Reconcile failed for ${b.transactionId}:`, err.message);
                }
            }

            return json(res, 200, { 
                success: true, 
                recovered: recoveredCount, 
                failed: failureCount,
                message: `Reconciliation complete. Recovered ${recoveredCount} bookings, flagged ${failureCount} as failed.` 
            });
        }

        // -- Scoped Organizer Analytics & Insights (RBAC) --
        if (url.includes('organizer/insights') && method === 'GET') {
            if (!user) return json(res, 401, { message: 'Auth required' });
            
            const role = (user.role || '').toLowerCase();
            const isAdmin = role === 'superadmin' || role === 'admin';

            // Ensure we are on the correct DB
            await connectDB('backstage_events');

            // Scoping: Only see events you own
            let eventQuery = {};
            if (!isAdmin) eventQuery.organizerId = user.id;

            const events = await Event.find(eventQuery).lean();
            const eventIds = events.map(e => String(e._id));
            
            // Fetch all related bookings (Confirmed and Initiated for conversion stats)
            const allBookings = await Booking.find({ 
                eventId: { $in: eventIds }
            }).lean();

            const confirmedBookings = allBookings.filter(b => b.status === "Confirmed" || b.status === "confirmed");
            
            // 1. Time Series: Sales per day (last 14 days)
            const last14Days = {};
            for(let i=13; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                last14Days[d.toISOString().split('T')[0]] = 0;
            }
            confirmedBookings.forEach(b => {
                const dateKey = new Date(b.createdAt).toISOString().split('T')[0];
                if (last14Days[dateKey] !== undefined) last14Days[dateKey]++;
            });

            // 2. Ticket Tier Distribution
            const tierStats = {};
            confirmedBookings.forEach(b => {
                const tier = b.tierName || 'Standard';
                tierStats[tier] = (tierStats[tier] || 0) + 1;
            });

            // 3. Conversion Metrics
            const initiatedCount = allBookings.filter(b => b.status === "Initiated").length;
            const confirmedCount = confirmedBookings.length;
            const conversionRate = initiatedCount > 0 ? ((confirmedCount / (initiatedCount + confirmedCount)) * 100).toFixed(1) : 100;

            // 4. Device / Platform Insights (Refined)
            const deviceStats = { mobile: 0, desktop: 0, tablet: 0, other: 0 };
            confirmedBookings.forEach(b => {
                const ua = (b.userAgent || '').toLowerCase();
                if (ua.includes('tablet') || ua.includes('ipad')) deviceStats.tablet++;
                else if (ua.includes('mobi') || ua.includes('android')) deviceStats.mobile++;
                else if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) deviceStats.desktop++;
                else deviceStats.other++;
            });

            // 5. Geo-Insights (Resolving IP to City/Region)
            // Mock resolver for demonstration (Real world would use GeoIP DB)
            const geoStats = {};
            confirmedBookings.forEach(b => {
                if (b.ipAddress) {
                    let location = 'Other Regions';
                    if (b.ipAddress.startsWith('103.')) location = 'Mumbai, IN';
                    else if (b.ipAddress.startsWith('45.')) location = 'Delhi, IN';
                    else if (b.ipAddress.startsWith('122.')) location = 'Bangalore, IN';
                    else if (b.ipAddress.startsWith('192.')) location = 'Local Node';
                    
                    geoStats[location] = (geoStats[location] || 0) + 1;
                }
            });

            return json(res, 200, {
                summary: {
                    totalRevenue: confirmedBookings.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0),
                    totalSales: confirmedCount,
                    totalAttended: confirmedBookings.filter(b => b.attended).length,
                    conversionRate: `${conversionRate}%`,
                    activeEvents: events.filter(e => e.status === 'published').length
                },
                charts: {
                    salesOverTime: Object.entries(last14Days).map(([date, count]) => ({ date, count })),
                    tierDistribution: Object.entries(tierStats).map(([name, value]) => ({ name, value })),
                    deviceBreakdown: Object.entries(deviceStats).map(([name, value]) => ({ name, value }))
                },
                geoData: Object.entries(geoStats).map(([region, count]) => ({ region, count })).sort((a,b) => b.count - a.count).slice(0, 5),
                eventBreakdown: events.map(e => {
                    const eb = confirmedBookings.filter(b => String(b.eventId) === String(e._id));
                    return {
                        id: e._id,
                        title: e.displayTitle || e.title,
                        sales: eb.length,
                        revenue: eb.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0),
                        occupancy: e.capacity > 0 ? ((eb.length / (e.capacity + eb.length)) * 100).toFixed(1) : 0
                    };
                })
            });
        }

        // -- Legacy Stats (Fallback) --
        if (url.includes('organizer/stats/global') && method === 'GET') {
            // Keep this for backward compatibility with existing components
            if (!user) return json(res, 401, { message: 'Auth required' });
            const isAdmin = user.role === 'superadmin' || user.role === 'admin';
            let eventQuery = {};
            if (!isAdmin) eventQuery.organizerId = user.id;
            const events = await Event.find(eventQuery).lean();
            const eventIds = events.map(e => String(e._id));
            const eventBookings = await Booking.find({ 
                eventId: { $in: eventIds },
                status: { $in: ["Confirmed", "confirmed"] }
            }).lean();

            return json(res, 200, {
                totalEvents: events.length,
                totalRevenue: eventBookings.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0),
                totalSales: eventBookings.length,
                totalAttended: eventBookings.filter(b => b.attended).length,
                events: events.map(e => ({
                    eventId: e._id,
                    title: e.displayTitle || e.title,
                    totalTickets: eventBookings.filter(b => String(b.eventId) === String(e._id)).length
                }))
            });
        }

        // -- Scanner Application API --
        if (url.includes('scanner/events') && method === 'GET') {
            if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) {
                return json(res, 403, { message: 'Access Denied: Scanner role required' });
            }
            
            // Find events where the scanner is assigned or return all for superadmin
            const query = user.role === 'superadmin' ? {} : { scannerIds: String(user.id) };
            const events = await Event.find(query).lean();
            return json(res, 200, events);
        }

        if (url.includes('scanner/attendees/') && method === 'GET') {
            if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) {
                return json(res, 403, { message: 'Access Denied' });
            }
            const eventId = url.split('/').pop();
            
            // Verify access
            try {
                const event = await Event.findById(eventId);
                if (!event || (!event.scannerIds.includes(String(user.id)) && user.role !== 'superadmin')) {
                    return json(res, 403, { message: 'Access Denied: Not assigned to this event' });
                }

                // Fetch confirmed bookings
                const bookings = await Booking.find({ 
                    eventId, 
                    status: { $in: ["Confirmed", "confirmed"] } 
                }).lean();

            const uids = [...new Set(bookings.map(b => b.userId).filter(id => id && id.length === 24))];
            const usersList = await User.find({ _id: { $in: uids } }).lean();
            const ownersList = await Owner.find({ _id: { $in: uids } }).lean();
            const userMap = {};
            usersList.forEach(u => userMap[String(u._id)] = { name: u.name, email: u.email });
            ownersList.forEach(o => userMap[String(o._id)] = { name: o.name, email: o.email });

            const formattedBookings = bookings.map(b => {
                let name = b.name || 'Guest';
                let email = b.email || b.phone || 'N/A';
                if (b.userId && userMap[String(b.userId)]) {
                    name = userMap[String(b.userId)].name;
                    if (email === 'N/A' || !email) email = userMap[String(b.userId)].email;
                }
                return {
                    _id: b._id,
                    ticketId: b.ticketId || b.transactionId || String(b._id).slice(-8),
                    name,
                    email,
                    phone: b.phone,
                    tierName: b.tierName,
                    attended: b.attended || false
                };
            });

            return json(res, 200, formattedBookings);
            } catch (err) {
                console.error("[SCANNER ATTENDEES ERROR]:", err);
                return json(res, 500, { message: 'Failed to fetch attendees', error: err.message });
            }
        }

        if (url.includes('scanner/sync/') && method === 'POST') {
            if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) {
                return json(res, 403, { message: 'Access Denied' });
            }
            const eventId = url.split('/').pop();
            const { checkIns } = body; 
            
            if (!Array.isArray(checkIns) || checkIns.length === 0) {
                return json(res, 400, { message: 'checkIns array required' });
            }

            try {
                // Verify access
                const event = await Event.findById(eventId);
                if (!event || (!event.scannerIds.includes(String(user.id)) && user.role !== 'superadmin')) {
                    return json(res, 403, { message: 'Access Denied: Not assigned to this event' });
                }

                const now = new Date();
                const scannerName = user.name || 'Scanner';

                const result = await Booking.updateMany(
                    { eventId, ticketId: { $in: checkIns }, attended: false },
                    { $set: { attended: true, attendedAt: now, scannedBy: scannerName } }
                );
                
                const result2 = await Booking.updateMany(
                    { eventId, transactionId: { $in: checkIns }, ticketId: { $exists: false }, attended: false },
                    { $set: { attended: true, attendedAt: now, scannedBy: scannerName } }
                );

                console.log(`[SCANNER SYNC] ${scannerName} synced ${result.modifiedCount + result2.modifiedCount} check-ins for event ${eventId}`);

                return json(res, 200, { 
                    success: true, 
                    updated: result.modifiedCount + result2.modifiedCount,
                    totalSynced: checkIns.length
                });
            } catch (err) {
                console.error("[SCANNER SYNC ERROR]:", err);
                return json(res, 500, { message: 'Sync failed', error: err.message });
            }
        }

        return json(res, 404, { message: 'Admin endpoint not matched: ' + url });
    } catch (err) {
        if (err.missingConfig) {
             return json(res, 200, { success: false, missingConfig: true, message: 'Database Connection Missing' });
        }
        console.error('[ADMIN ERROR]:', err);
        return json(res, 500, { message: 'Internal Server Error', error: err.message });
    }
}
