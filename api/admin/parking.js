/**
 * api/admin/parking.js
 * 
 * Purpose: Parking spot management and owner-scoped parking logs.
 */
import crypto from 'crypto';
import { json } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Booking, Parking } = models;

export async function handleParking(url, method, body, user, res) {
    // -- Owner Dashboard Stats (Parking Focused) --
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

    // -- Owner Booking Logs (Parking Focused) --
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

    return null;
}
