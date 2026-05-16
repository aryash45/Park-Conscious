/**
 * api/admin.js
 * 
 * Purpose: Multi-purpose Administrative API handler. 
 * Routes requests to dedicated sub-modules for scalability.
 */
import './lib/env.js';
import connectDB from './lib/mongodb.js';
import { json, setupCors, getBody, verifyUser } from './lib/utils.js';

import { handleEvents } from './admin/events.js';
import { handleUsers } from './admin/users.js';
import { handleBookings } from './admin/bookings.js';
import { handleAnalytics } from './admin/analytics.js';
import { handleSystem } from './admin/system.js';
import { handleScanner } from './admin/scanner.js';
import { handleParking } from './admin/parking.js';

export default async function handler(req, res) {
    if (setupCors(req, res)) return;

    const fullUrl = req.url || '/';
    const url = fullUrl.split('?')[0].replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const method = req.method || 'GET';
    const body = await getBody(req);
    const user = verifyUser(req);

    try {
        await connectDB();
        
        // -- Route to split modules --
        const adminModules = [
            handleEvents,
            handleUsers,
            handleBookings,
            handleAnalytics,
            handleSystem,
            handleScanner,
            handleParking
        ];

        for (const moduleHandler of adminModules) {
            // Signature: (url, method, body, user, req, res)
            const result = await moduleHandler(url, method, body, user, req, res);
            if (result !== null) return; 
        }

        return json(res, 404, { message: 'Admin endpoint not matched: ' + url });
    } catch (err) {
        console.error('[ADMIN_FATAL_ERROR]:', err);
        return json(res, 500, { message: 'Internal Server Error', error: err.message });
    }
}
