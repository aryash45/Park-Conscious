/**
 * api/admin/events.js
 * 
 * Purpose: Handling inquiries, event requests, and administrative event oversight.
 */
import { json } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Contact, EventRequest } = models;

export async function handleEvents(url, method, body, user, res) {
    // -- Inquiries Management (SuperAdmin Only) --
    if (url.includes('inquiries')) {
        if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
            return json(res, 403, { message: 'Access Denied: Administrative privileges required' });
        }

        if (method === 'GET') {
            const [contacts, requests] = await Promise.all([
                Contact.find({}).sort({ createdAt: -1 }).limit(100).lean(),
                EventRequest.find({}).sort({ createdAt: -1 }).limit(100).lean()
            ]);
            return json(res, 200, { contacts, requests });
        }

        if (url.includes('request/') && method === 'PATCH') {
            const requestId = url.split('/').pop();
            const { status } = body;
            if (!['pending', 'approved', 'rejected'].includes(status)) return json(res, 400, { message: 'Invalid status' });
            const updated = await EventRequest.findByIdAndUpdate(requestId, { status }, { new: true });
            return json(res, 200, { success: true, request: updated });
        }

        if (url.includes('contact/') && method === 'DELETE') {
            const contactId = url.split('/').pop();
            await Contact.findByIdAndDelete(contactId);
            return json(res, 200, { success: true, message: 'Message removed' });
        }
    }

    // -- Global Event Management --
    if (url.includes('events/admin/all') && method === 'GET') {
        if (!user) return json(res, 401, { message: 'Auth required' });
        
        const role = (user.role || '').toLowerCase();
        let query = {};
        if (role !== 'superadmin' && role !== 'admin') {
            query.organizerId = user.id;
        }

        const events = await models.Event.find(query).sort({ createdAt: -1 }).lean();
        return json(res, 200, events);
    }

    return null;
}
