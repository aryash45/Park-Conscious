/**
 * api/lib/email.js
 * 
 * Purpose: Centralized email dispatch logic.
 * Supports both direct (Vercel-compatible) and queued (BullMQ) sending.
 */
import { Resend } from 'resend';
import * as models from './models.js';
import { getTicketQueue } from './queue.js';
import './env.js';

const { Booking, Event, User, Owner } = models;
const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/**
 * The core logic to send a ticket email.
 */
export async function sendTicketEmail(bookingId) {
    try {
        const booking = await Booking.findById(bookingId).lean();
        if (!booking || !booking.email) return false;

        // Fetch Context
        const userId = String(booking.userId || '');
        const isValidId = userId.length === 24 && /^[a-fA-F0-9]{24}$/.test(userId);
        
        let user = null;
        if (isValidId) {
            user = await User.findById(userId).lean() || await Owner.findById(userId).lean();
        }

        const event = await Event.findById(booking.eventId).lean();
        
        const userName = user?.name || (!isValidId && userId ? userId : "Attendee");
        const eventName = event?.displayTitle || event?.title || "BACKSTAGE Experience";
        const ticketNumber = booking.ticketId || booking.transactionId || String(booking._id).slice(-8);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketNumber)}&ecc=L&margin=0`;

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

        if (error) throw new Error(error.message);

        await Booking.findByIdAndUpdate(bookingId, { $set: { emailSent: true } });
        return true;
    } catch (err) {
        console.error('[EMAIL_ERROR]:', err.message);
        return false;
    }
}

/**
 * Smart dispatcher: Queues if possible, otherwise sends directly.
 */
export async function dispatchTicketEmail(bookingId) {
    const queue = getTicketQueue();
    const useQueue = process.env.USE_QUEUE === 'true';

    if (queue && useQueue) {
        console.log(`[DISPATCH]: Queuing ticket email for ${bookingId}`);
        await queue.add('sendTicket', { bookingId });
    } else {
        console.log(`[DISPATCH]: Sending ticket email directly for ${bookingId}`);
        // Fire and forget for Vercel
        sendTicketEmail(bookingId).catch(err => console.error('[DIRECT_SEND_FAIL]:', err));
    }
}
