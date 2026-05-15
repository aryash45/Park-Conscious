/**
 * api/lib/worker.js
 * 
 * Purpose: BullMQ Worker to process background jobs.
 */
import { Worker } from 'bullmq';
import { redisConnection } from './queue.js';
import connectDB from './mongodb.js';

const { Booking, Event, User, Owner } = models;

// HTML Escaper helper
const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export async function initWorker() {
    // 0. Connect to Database (Required for worker to run queries)
    await connectDB();

    if (!redisConnection) {
        console.warn('[WORKER]: Redis connection not available. Worker disabled.');
        return null;
    }

    const worker = new Worker('TicketEmails', async (job) => {
        const { bookingId } = job.data;
        console.log(`[WORKER]: Processing ticket for Booking ${bookingId}...`);

        // 1. Fetch Booking
        const booking = await Booking.findById(bookingId).lean();
        if (!booking || !booking.email) {
            console.warn(`[WORKER]: Skipping invalid booking ${bookingId}`);
            return;
        }

        // 2. Fetch Context (User, Event)
        const [user, event] = await Promise.all([
            User.findById(booking.userId).lean() || Owner.findById(booking.userId).lean(),
            Event.findById(booking.eventId).lean()
        ]);

        const userName = user?.name || "Attendee";
        const eventName = event?.displayTitle || event?.title || "BACKSTAGE Experience";
        const ticketNumber = booking.ticketId || booking.transactionId || String(booking._id).slice(-8);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketNumber)}&ecc=L&margin=0`;

        // 3. Send Email via Resend
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'BACKSTAGE <tickets@parkconscious.in>',
            to: booking.email,
            subject: `Your Admittance Pass for ${eventName}`,
            html: `
                <div style="font-family: 'Outfit', sans-serif; max-width: 600px; margin: 0 auto; background-color: #050507; color: #ffffff; padding: 60px 40px; border-radius: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                    <h1 style="color: #ffffff; margin: 0 0 12px 0; font-size: 32px; font-weight: 900; text-transform: uppercase;">YOUR TICKET IS READY</h1>
                    <p style="color: #64748b; margin-bottom: 40px;">Hi ${esc(userName)}, see you at ${esc(eventName)}!</p>
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 30px; display: inline-block; margin-bottom: 40px;">
                        <img src="${qrUrl}" alt="QR" width="220" height="220" style="display: block; border-radius: 12px;" />
                    </div>
                    <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 24px; text-align: left;">
                        <p style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0;">${esc(userName)}</p>
                        <p style="color: #6366f1; font-size: 18px; font-weight: 800; margin: 0;">${esc(eventName)}</p>
                        <p style="color: #ffffff; font-family: monospace; font-size: 20px; font-weight: 900; margin: 0;">#${esc(ticketNumber)}</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error(`[WORKER_EMAIL_FAIL]: ${error.message}`);
            throw new Error(error.message); // Trigger BullMQ retry
        }

        // 4. Update Status
        await Booking.findByIdAndUpdate(bookingId, { $set: { emailSent: true } });
        console.log(`[WORKER]: Ticket sent successfully for ${bookingId}`);

    }, { 
        connection: redisConnection,
        concurrency: 5, // Process 5 emails at a time
        limiter: {
            max: 10,
            duration: 1000 // Max 10 emails per second
        }
    });

    worker.on('failed', (job, err) => {
        console.error(`[WORKER_JOB_FAILED]: Job ${job.id} failed with ${err.message}`);
    });

    console.log('[WORKER_INIT]: Ticket Worker ACTIVE');
    return worker;
}
