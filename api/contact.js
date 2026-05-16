/**
 * api/contact.js
 * 
 * Purpose: API handler for the public contact form.
 * Receives name, email, and message, and saves them to the 'Contact' collection.
 */
import connectDB from './lib/mongodb.js';
import * as models from './lib/models.js';
import { json, setupCors, getBody } from './lib/utils.js';

const { Contact } = models;

export default async function handler(req, res) {
    if (setupCors(req, res)) return;

    if (req.method !== 'POST') {
        return json(res, 405, { message: 'Method Not Allowed' });
    }

    try {
        await connectDB();
        const body = await getBody(req);
        const { name, email, message } = body;

        if (!name || !email || !message) {
            return json(res, 400, { message: 'Required fields missing: name, email, message' });
        }

        const contact = await Contact.create({ 
            name, email, message 
        });

        console.log(`[CONTACT API] Success: Created record ${contact._id}`);
        return json(res, 201, { success: true, id: contact._id });
    } catch (err) {
        console.error('[CONTACT ERROR]:', err);
        return json(res, 500, { message: 'Internal Server Error', error: err.message });
    }
}
