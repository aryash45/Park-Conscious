/**
 * api/admin/users.js
 * 
 * Purpose: User and Owner management, role assignments, and cascading deletions.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { json } from '../lib/utils.js';
import { syncIdentity } from '../lib/sync.js';
import * as models from '../lib/models.js';
import { delCache } from '../lib/redis.js';

const { Booking, Event, Owner, SystemLog } = models;

export async function handleUsers(url, method, body, user, req, res) {
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

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Cascading delete: Find and purge associated events and their bookings
            const myEvents = await Event.find({ organizerId: userId }).session(session).select('_id').lean();
            const myEventIds = myEvents.map(e => String(e._id));

            if (myEventIds.length > 0) {
                await Booking.deleteMany({ eventId: { $in: myEventIds } }, { session });
                await Event.deleteMany({ _id: { $in: myEventIds } }, { session });
            }

            await Owner.findByIdAndDelete(userId, { session });
            
            await session.commitTransaction();

            // Invalidate public lists as events may have been deleted
            await delCache('events:public');
            await delCache('events:featured');
            for (const eid of myEventIds) {
                await delCache(`event:${eid}`);
            }

            return json(res, 200, { success: true, message: 'User and all associated data removed successfully' });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    return null; // Not handled
}
