/**
 * scratch/seed_mock_bookings.js
 * 
 * Purpose: Seed mock bookings with technical telemetry and custom form data
 * to demonstrate the "Powerful Dashboard" and "Dossier" features.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Booking, Event, Owner } from '../api/lib/models.js';

dotenv.config();

async function seed() {
    try {
        console.log('--- MOCK DATA SEEDER ---');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Get an event to attach to
        const event = await Event.findOne({});
        if (!event) {
            console.error('No events found. Please create an event in the admin panel first.');
            process.exit(1);
        }
        console.log(`Using Event: ${event.title} (${event._id})`);

        // 2. Get an owner/organizer
        const owner = await Owner.findOne({ role: { $in: ['admin', 'superadmin', 'organizer'] } });
        if (!owner) {
            console.error('No admin/organizer found.');
            process.exit(1);
        }
        console.log(`Assigning to Organizer: ${owner.name}`);

        // Ensure the event is assigned to this organizer for RBAC test
        await Event.findByIdAndUpdate(event._id, { organizerId: String(owner._id) });

        // 3. Create mock bookings
        const mockBookings = [
            {
                eventId: String(event._id),
                transactionId: 'TXN_' + Math.random().toString(36).substring(7).toUpperCase(),
                ticketId: 'TK-' + Math.random().toString(36).substring(7).toUpperCase(),
                name: 'Alice Founder',
                email: 'alice@startup.co',
                amount: '499',
                status: 'Confirmed',
                attended: true,
                ipAddress: '103.21.124.5',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                customData: {
                    registrationType: 'startup',
                    'startup-name': 'TechFlow AI',
                    'startup-sector': 'AI / ML',
                    'startup-stage': 'MVP Stage',
                    'pitch-deck': 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample_pitch.pdf'
                },
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                eventId: String(event._id),
                transactionId: 'TXN_' + Math.random().toString(36).substring(7).toUpperCase(),
                ticketId: 'TK-' + Math.random().toString(36).substring(7).toUpperCase(),
                name: 'Bob Jenkins',
                email: 'bob@gmail.com',
                amount: '0',
                status: 'Confirmed',
                attended: false,
                ipAddress: '45.112.32.11',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                customData: {
                    registrationType: 'attendee'
                },
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            },
            {
                eventId: String(event._id),
                transactionId: 'TXN_' + Math.random().toString(36).substring(7).toUpperCase(),
                ticketId: 'TK-' + Math.random().toString(36).substring(7).toUpperCase(),
                name: 'Charlie Root',
                email: 'charlie@dev.io',
                amount: '999',
                status: 'Confirmed',
                attended: true,
                ipAddress: '103.21.124.8',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
                customData: {
                    registrationType: 'startup',
                    'startup-name': 'GreenGrid',
                    'startup-sector': 'Climate / CleanTech'
                },
                createdAt: new Date()
            }
        ];

        await Booking.insertMany(mockBookings);
        console.log('SUCCESS: 3 Mock bookings seeded with technical telemetry.');
        
        process.exit(0);
    } catch (err) {
        console.error('SEED ERROR:', err);
        process.exit(1);
    }
}

seed();
