/**
 * api/admin/system.js
 * 
 * Purpose: System diagnostics, error logging, and status auditing.
 */
import mongoose from 'mongoose';
import { json } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Booking, Event, User, Owner, SystemLog } = models;

export async function handleSystem(url, method, body, user, req, res) {
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
    
    // -- Unified Error Reporting with Deduplication --
    if (url.includes('logs') && method === 'POST') {
        // Lightweight abuse protection
        const clientToken = req.headers['x-log-token'];
        if (!clientToken && process.env.NODE_ENV === 'production') {
            return json(res, 401, { message: 'Unauthorized Log Source' });
        }

        const { source, type, message, stack, url: errorUrl, metadata } = body;
        if (!source || !message) return json(res, 400, { message: 'Missing source or message' });
        
        const crypto = await import('crypto');
        const hash = crypto.default.createHash('md5').update(`${source}:${message}`).digest('hex');

        const log = await SystemLog.findOneAndUpdate(
            { hash, resolved: false },
            {
                $inc: { count: 1 },
                $set: {
                    source,
                    type: type || 'frontend_crash',
                    message,
                    stack,
                    url: errorUrl,
                    metadata: metadata || {},
                    lastSeenAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        
        return json(res, 201, { success: true, logId: log._id, count: log.count });
    }

    // -- System Status Audit (Admin Only or Cron) --
    if (url.includes('system-status') && method === 'GET') {
        const cronSecret = process.env.CRON_SECRET;
        const isCron = cronSecret && req.headers['x-cron-secret'] === cronSecret;
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

    return null; // Not handled
}
