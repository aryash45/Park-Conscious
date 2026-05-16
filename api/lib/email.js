/**
 * api/lib/email.js
 * 
 * Purpose: Centralized, multi-provider email dispatcher.
 * Restores original OTP logic and integrates smart dual-mode ticket sending.
 */
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import axios from 'axios';
import * as models from './models.js';
import { getTicketQueue } from './queue.js';
import './env.js';

const { Booking, Event, User, Owner } = models;

// HTML Escaper
const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/**
 * Core Send Function (Restored Multi-Provider Logic)
 */
export const sendEmail = async ({ to, subject, html, fromName = 'Backstage', preferredProvider = 'resend', variables, template_id }) => {
    const domain = process.env.MSG91_DOMAIN || 'otp.parkconscious.in';
    const fromAddress = process.env.EMAIL_FROM || `no-reply@${domain}`;
    const fullFrom = `${fromName} <${fromAddress}>`;

    let sequence = (preferredProvider === 'msg91') ? ['msg91', 'resend', 'smtp'] : ['resend', 'msg91', 'smtp'];

    for (const provider of sequence) {
        try {
            // 1. Resend
            if (provider === 'resend' && process.env.RESEND_API_KEY) {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const { data, error } = await resend.emails.send({ from: fullFrom, to, subject, html });
                if (!error) return { success: true, provider: 'resend', id: data.id };
            }

            // 2. MSG91
            if (provider === 'msg91' && process.env.MSG91_AUTH_KEY) {
                const payload = {
                    recipients: [{ to: [{ email: to }], variables: variables || {} }],
                    from: { name: fromName, email: fromAddress },
                    domain: domain,
                };
                if (template_id || process.env.MSG91_TEMPLATE_ID) {
                    payload.template_id = template_id || process.env.MSG91_TEMPLATE_ID;
                } else {
                    payload.subject = subject;
                    payload.body = { type: 'text/html', data: html };
                }
                const response = await axios.post('https://control.msg91.com/api/v5/email/send', payload, {
                    headers: { 'authkey': process.env.MSG91_AUTH_KEY }
                });
                return { success: true, provider: 'msg91', id: response.data?.request_id };
            }

            // 3. SMTP
            if (provider === 'smtp' && process.env.SMTP_HOST) {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                });
                const info = await transporter.sendMail({ from: fullFrom, to, subject, html });
                return { success: true, provider: 'smtp', id: info.messageId };
            }
        } catch (err) {
            console.error(`[EMAIL] Provider ${provider} failed:`, err.message);
        }
    }
    return { success: false, message: 'All providers failed' };
};

/**
 * RESTORED: Helper for OTP Emails
 */
export const sendOTPEmail = async (to, code) => {
    return sendEmail({ 
        to, 
        subject: `${code} is your code`, 
        html: `Your code is ${code}`,
        preferredProvider: 'resend',
        template_id: process.env.MSG91_OTP_TEMPLATE_ID || 'global_otp',
        variables: { otp: code, company_name: 'Backstage' }
    });
};

/**
 * NEW: Smart Ticket Dispatcher (Processes data then calls sendEmail)
 */
export async function processTicketEmail(bookingId) {
    try {
        const booking = await Booking.findById(bookingId).lean();
        if (!booking || !booking.email) return false;

        const userId = String(booking.userId || '');
        const isValidId = userId.length === 24 && /^[a-fA-F0-9]{24}$/.test(userId);
        let user = isValidId ? (await User.findById(userId).lean() || await Owner.findById(userId).lean()) : null;
        const event = await Event.findById(booking.eventId).lean();
        
        const userName = user?.name || (!isValidId && userId ? userId : "Attendee");
        const eventName = event?.displayTitle || event?.title || "BACKSTAGE Experience";
        const ticketNumber = booking.ticketId || booking.transactionId || String(booking._id).slice(-8);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketNumber)}&ecc=L&margin=0`;

        const html = `
            <div style="background-color: #000000; padding: 40px 20px; font-family: 'Inter', sans-serif;">
                <div style="max-width: 450px; margin: 0 auto; background-color: #050507; border: 1px solid rgba(255,255,255,0.05); border-radius: 40px; overflow: hidden; color: white; text-align: center; padding: 60px 40px;">
                    <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0 0 10px 0;">Your Ticket</h1>
                    <p style="color: rgba(255,255,255,0.5); margin-bottom: 40px;">Hi ${esc(userName)}, see you at ${esc(eventName)}!</p>
                    <div style="background-color: white; padding: 30px; border-radius: 30px; display: inline-block; margin-bottom: 40px;">
                        <img src="${qrUrl}" width="220" height="220" />
                    </div>
                    <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px; text-align: left;">
                        <p style="font-size: 14px; font-weight: 800; color: #6366f1;">#${esc(ticketNumber)}</p>
                    </div>
                </div>
            </div>
        `;

        const result = await sendEmail({ 
            to: booking.email, 
            subject: `Your Admittance Pass for ${eventName}`, 
            html,
            variables: { user_name: userName, event_name: eventName, ticket_hash: ticketNumber, qr_code_url: qrUrl }
        });

        if (result.success) {
            await Booking.findByIdAndUpdate(bookingId, { $set: { emailSent: true } });
            return true;
        }
        return false;
    } catch (err) {
        console.error('[PROCESS_EMAIL_ERROR]:', err.message);
        return false;
    }
}

/**
 * Smart dispatcher hook
 */
export async function dispatchTicketEmail(bookingId) {
    const queue = getTicketQueue();
    const useQueue = process.env.USE_QUEUE === 'true';

    if (queue && useQueue) {
        await queue.add('sendTicket', { bookingId });
    } else {
        processTicketEmail(bookingId).catch(err => console.error('[DIRECT_SEND_FAIL]:', err));
    }
}
