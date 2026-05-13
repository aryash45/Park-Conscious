/**
 * api/admin.js
 * 
 * Purpose: Entry point for Administrative API logic.
 * Delegated to functional sub-modules for better maintainability and performance.
 */
import connectDB from './lib/mongodb.js';
import { json, setCors, getBody, verifyUser, logSystemError } from './lib/utils.js';

// Import sub-handlers
import { handleSystem } from './admin/system.js';
import { handleUsers } from './admin/users.js';
import { handleEvents } from './admin/events.js';
import { handleBookings } from './admin/bookings.js';
import { handleAnalytics } from './admin/analytics.js';
import { handleParking } from './admin/parking.js';
import { handleScanner } from './admin/scanner.js';

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

        // Delegate to sub-handlers. Each returns a response or null if not matched.
        let result = await handleSystem(url, method, body, user, req, res);
        if (result) return result;

        result = await handleEvents(url, method, body, user, res);
        if (result) return result;

        result = await handleUsers(url, method, body, user, res);
        if (result) return result;

        result = await handleBookings(url, method, body, user, res);
        if (result) return result;

        result = await handleAnalytics(url, method, body, user, res);
        if (result) return result;

        result = await handleParking(url, method, body, user, res);
        if (result) return result;

        result = await handleScanner(url, method, body, user, res);
        if (result) return result;

        return json(res, 404, { message: 'Admin endpoint not matched: ' + url });
    } catch (err) {
        if (err.missingConfig) {
             return json(res, 200, { success: false, missingConfig: true, message: 'Database Connection Missing' });
        }
        await logSystemError('admin_router', 'router_fatal', err.message, err.stack, { url });
        console.error('[ADMIN ROUTER ERROR]:', err);
        return json(res, 500, { message: 'Internal Server Error', error: err.message });
    }
}
