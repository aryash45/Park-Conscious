/**
 * api/admin/analytics.js
 * 
 * Purpose: Dashboards, organizer insights, and performance metrics.
 */
import { json } from '../lib/utils.js';
import * as models from '../lib/models.js';

const { Booking, Event, User, Owner } = models;

export async function handleAnalytics(url, method, body, user, req, res) {
    // -- Scoped Organizer Analytics & Insights (RBAC) --
    if (url.includes('organizer/insights') && method === 'GET') {
        if (!user) return json(res, 401, { message: 'Auth required' });
        
        const role = (user.role || '').toLowerCase();
        const isAdmin = role === 'superadmin' || role === 'admin';

        let eventQuery = {};
        if (!isAdmin) eventQuery.organizerId = user.id;

        const events = await Event.find(eventQuery).lean();
        const eventIds = events.map(e => String(e._id));
        const allBookings = await Booking.find({ eventId: { $in: eventIds } }).lean();
        const confirmedBookings = allBookings.filter(b => b.status === "Confirmed" || b.status === "confirmed");
        
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

        const tierStats = {};
        confirmedBookings.forEach(b => {
            const tier = b.tierName || 'Standard';
            tierStats[tier] = (tierStats[tier] || 0) + 1;
        });

        const initiatedCount = allBookings.filter(b => b.status === "Initiated").length;
        const confirmedCount = confirmedBookings.length;
        const conversionRate = initiatedCount > 0 ? ((confirmedCount / (initiatedCount + confirmedCount)) * 100).toFixed(1) : 100;

        const deviceStats = { mobile: 0, desktop: 0, tablet: 0, other: 0 };
        confirmedBookings.forEach(b => {
            const ua = (b.userAgent || '').toLowerCase();
            if (ua.includes('tablet') || ua.includes('ipad')) deviceStats.tablet++;
            else if (ua.includes('mobi') || ua.includes('android')) deviceStats.mobile++;
            else if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) deviceStats.desktop++;
            else deviceStats.other++;
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
        if (!user) return json(res, 401, { message: 'Auth required' });
        const isAdmin = user.role === 'superadmin' || user.role === 'admin';
        let eventQuery = {};
        if (!isAdmin) eventQuery.organizerId = user.id;
        const events = await Event.find(eventQuery).lean();
        const eventIds = events.map(e => String(e._id));
        const eventBookings = await Booking.find({ eventId: { $in: eventIds }, status: { $in: ["Confirmed", "confirmed"] } }).lean();

        return json(res, 200, {
            totalEvents: events.length,
            totalRevenue: eventBookings.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0),
            totalSales: eventBookings.length,
            totalAttended: eventBookings.filter(b => b.attended).length,
            events: events.map(e => {
                const bookings = eventBookings.filter(b => String(b.eventId) === String(e._id));
                return {
                    eventId: e._id,
                    title: e.displayTitle || e.title,
                    totalTickets: bookings.length,
                    attended: bookings.filter(b => b.attended).length,
                    revenue: bookings.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0),
                    capacity: e.capacity,
                    status: e.status
                };
            })
        });
    }

    // -- Global Admin Stats (SuperAdmin/Admin Only) --
    if (url.includes('admin/stats') && method === 'GET') {
        const isAdmin = user && (user.role === 'superadmin' || user.role === 'admin');
        if (!isAdmin) return json(res, 403, { message: 'Access Denied' });

        const [recentBookings, events, users, owners] = await Promise.all([
            Booking.find({ status: { $in: ["Confirmed", "confirmed"] } }).sort({ createdAt: -1 }).limit(100).lean(),
            Event.find({}).lean(),
            User.countDocuments(),
            Owner.countDocuments()
        ]);

        // True Aggregation for Total Revenue & Sales (Not limited to 100)
        const stats = await Booking.aggregate([
            { $match: { status: { $in: ["Confirmed", "confirmed"] } } },
            { 
                $group: { 
                    _id: null, 
                    totalRevenue: { $sum: { $toDouble: "$amount" } },
                    totalSales: { $sum: 1 }
                } 
            }
        ]);

        const { totalRevenue = 0, totalSales = 0 } = stats[0] || {};
        const activeEventsCount = (events || []).filter(e => e.status === 'published' || e.status === 'active').length;

        return json(res, 200, {
            totalRevenue,
            totalSales,
            totalUsers: users + owners,
            activeEvents: activeEventsCount,
            recentBookings: recentBookings.slice(0, 10),
            events: events // Include events for the dashboard filters
        });
    }

    return null;
}
