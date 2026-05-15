/**
 * api/admin/scanner.js
 * 
 * Purpose: Scanner Application API for event check-ins.
 */
import { json } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Booking, Event, User, Owner } = models;

export async function handleScanner(url, method, body, user, req, res) {
    // -- Scanner Application API --
    if (url.includes('scanner/events') && method === 'GET') {
        if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) {
            return json(res, 403, { message: 'Access Denied: Scanner role required' });
        }
        const query = user.role === 'superadmin' ? {} : { scannerIds: String(user.id) };
        const events = await Event.find(query).lean();
        return json(res, 200, events);
    }

    if (url.includes('scanner/attendees/') && method === 'GET') {
        if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) return json(res, 403, { message: 'Access Denied' });
        const eventId = url.split('/').pop();
        
        try {
            const event = await Event.findById(eventId);
            if (!event || (!event.scannerIds.includes(String(user.id)) && user.role !== 'superadmin')) {
                return json(res, 403, { message: 'Access Denied: Not assigned to this event' });
            }

            const bookings = await Booking.find({ eventId, status: { $in: ["Confirmed", "confirmed"] } }).lean();
            const uids = [...new Set(bookings.map(b => b.userId).filter(id => id && id.length === 24))];
            
            const [usersList, ownersList] = await Promise.all([
                User.find({ _id: { $in: uids } }).lean(),
                Owner.find({ _id: { $in: uids } }).lean()
            ]);

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
                    name, email, phone: b.phone, tierName: b.tierName, attended: b.attended || false
                };
            });

            return json(res, 200, formattedBookings);
        } catch (e) {
            return json(res, 500, { message: e.message });
        }
    }

    if (url.includes('scanner/sync/') && method === 'POST') {
        if (!user || (user.role !== 'scanner' && user.role !== 'superadmin')) return json(res, 403, { message: 'Access Denied' });
        const eventId = url.split('/').pop();
        const { checkIns } = body; 
        
        if (!Array.isArray(checkIns) || checkIns.length === 0) return json(res, 400, { message: 'checkIns array required' });

        try {
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

            return json(res, 200, { 
                success: true, 
                updated: result.modifiedCount + result2.modifiedCount,
                totalSynced: checkIns.length
            });
        } catch (err) {
            return json(res, 500, { message: 'Sync failed', error: err.message });
        }
    }

    return null;
}
