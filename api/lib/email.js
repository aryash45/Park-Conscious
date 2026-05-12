import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import axios from 'axios';

// Providers
let resendClient;
let smtpClient;

/**
 * Basic HTML escaping to prevent injection
 */
const escapeHtml = (text) => {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Initialize Resend if API key is present
 */
const getResend = () => {
    if (resendClient) return resendClient;
    if (process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
        return resendClient;
    }
    return null;
};

/**
 * Initialize SMTP (Gmail/Outlook/etc) if credentials are present
 */
const getSMTP = () => {
    if (smtpClient) return smtpClient;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const port = parseInt(process.env.SMTP_PORT) || 587;
        smtpClient = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        return smtpClient;
    }
    return null;
};

/**
 * MSG91 Email Provider
 */
const sendViaMSG91 = async ({ to, subject, html, fromName, variables, template_id }) => {
    if (!process.env.MSG91_AUTH_KEY) return null;
    
    try {
        const domain = process.env.MSG91_DOMAIN || 'otp.parkconscious.in';
        const fromEmail = process.env.MSG91_FROM_EMAIL || `no-reply@${domain}`;

        const payload = {
            recipients: [
                {
                    to: [{ email: to, name: to.split('@')[0] }],
                    variables: variables || {}
                }
            ],
            from: { 
                name: fromName, 
                email: fromEmail 
            },
            domain: domain,
        };

        // If a template ID is provided, use it
        const finalTemplateId = template_id || process.env.MSG91_TEMPLATE_ID;
        if (finalTemplateId) {
            payload.template_id = finalTemplateId;
        } else {
            payload.subject = subject;
            payload.body = {
                type: 'text/html',
                data: html
            };
        }

        const response = await axios.post('https://control.msg91.com/api/v5/email/send', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'authkey': process.env.MSG91_AUTH_KEY
            },
            timeout: parseInt(process.env.MSG91_TIMEOUT) || 8000
        });
        
        return { success: true, provider: 'msg91', id: response.data?.request_id };
    } catch (err) {
        console.error('[EMAIL] MSG91 Failure:', err.response?.data || err.message);
        return null;
    }
};

/**
 * Core Send Function
 */
export const sendEmail = async ({ to, subject, html, fromName = 'Backstage', preferredProvider = 'resend', variables, template_id }) => {
    const domain = process.env.MSG91_DOMAIN || 'otp.parkconscious.in';
    const fromAddress = process.env.EMAIL_FROM || `no-reply@${domain}`;
    const fullFrom = `${fromName} <${fromAddress}>`;

    // Define the provider sequence based on preference
    let sequence = [];
    if (preferredProvider === 'msg91') {
        sequence = ['msg91', 'resend', 'smtp'];
    } else {
        sequence = ['resend', 'msg91', 'smtp'];
    }

    for (const provider of sequence) {
        // 1. Try Resend
        if (provider === 'resend') {
            const resend = getResend();
            if (resend) {
                try {
                    const { data, error } = await resend.emails.send({
                        from: fullFrom,
                        to,
                        subject,
                        html,
                    });
                    if (!error) {
                        return { success: true, provider: 'resend', id: data.id };
                    }
                } catch (err) {
                    console.error('[EMAIL] Resend Crash:', err);
                }
            }
        }

        // 2. Try MSG91
        if (provider === 'msg91') {
            const msg91Result = await sendViaMSG91({ to, subject, html, fromName, variables, template_id });
            if (msg91Result && msg91Result.success) return msg91Result;
        }

        // 3. Try SMTP
        if (provider === 'smtp') {
            const smtp = getSMTP();
            if (smtp) {
                try {
                    const info = await smtp.sendMail({
                        from: fullFrom,
                        to,
                        subject,
                        html,
                    });
                    return { success: true, provider: 'smtp', id: info.messageId };
                } catch (err) {
                    console.error('[EMAIL] SMTP Failure:', err);
                }
            }
        }
    }

    return { success: false, provider: 'none', message: 'All email providers failed.' };
};

/**
 * Helper for OTP Emails (MSG91 Preferred)
 */
export const sendOTPEmail = async (to, code) => {
    return sendEmail({ 
        to, 
        subject: `${code} is your code`, 
        html: `Your code is ${code}`, // Fallback for other providers
        preferredProvider: 'msg91',
        template_id: 'global_otp',
        variables: {
            otp: code,
            company_name: 'Backstage'
        }
    });
};

/**
 * Helper for Ticket Emails (Resend Preferred)
 */
export const sendTicketEmail = async (to, userName, eventName, qrCodeUrl, preferredProvider = 'resend') => {
    const ticketHash = `#TK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Escape all user-controlled data to prevent injection
    const safeUserName = escapeHtml(userName);
    const safeEventName = escapeHtml(eventName);
    const safeTicketHash = escapeHtml(ticketHash);
    
    // Validate QR URL to ensure it's a legitimate URL before embedding
    let safeQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?data=INVALID';
    try {
        const urlObj = new URL(qrCodeUrl);
        if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
            safeQrUrl = qrCodeUrl;
        }
    } catch (e) {
        console.warn('[EMAIL] Invalid QR URL provided:', qrCodeUrl);
    }

    const html = `
        <div style="background-color: #000000; padding: 40px 20px; font-family: 'Inter', 'Helvetica', sans-serif;">
            <div style="max-width: 450px; margin: 0 auto; background-color: #050507; border: 1px solid rgba(255,255,255,0.05); border-radius: 40px; overflow: hidden; color: white; text-align: center; padding: 60px 40px;">
                <!-- Header Pill -->
                <div style="display: inline-block; padding: 6px 16px; background-color: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); rounded-radius: 100px; border-radius: 100px; margin-bottom: 40px;">
                    <span style="font-size: 8px; font-weight: 900; color: #818cf8; text-transform: uppercase; letter-spacing: 0.3em;">Official Entry Pass</span>
                </div>

                <!-- Title Section -->
                <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; margin: 0 0 10px 0; color: white;">Your Ticket is Ready</h1>
                <p style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 40px;">
                    Hi ${safeUserName}, see you at ${safeEventName}!
                </p>

                <!-- QR Container -->
                <div style="background-color: white; padding: 30px; border-radius: 30px; display: inline-block; margin-bottom: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                    <img src="${safeQrUrl}" alt="QR Ticket" style="width: 220px; height: 220px; display: block;">
                    <p style="font-size: 8px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 0.3em; margin: 15px 0 0 0;">Scan to Enter</p>
                </div>

                <!-- Info Section -->
                <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px; text-align: left; margin-bottom: 40px;">
                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 7px; font-weight: 900; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 8px 0;">Guest Identification</p>
                        <p style="font-size: 14px; font-weight: 800; color: white; text-transform: uppercase; margin: 0;">${safeUserName}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 7px; font-weight: 900; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 8px 0;">Experience</p>
                        <p style="font-size: 14px; font-weight: 800; color: #6366f1; text-transform: uppercase; margin: 0;">${safeEventName}</p>
                    </div>
                    <div>
                        <p style="font-size: 7px; font-weight: 900; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 8px 0;">Credential Hash</p>
                        <p style="font-size: 14px; font-weight: 800; color: white; text-transform: uppercase; margin: 0; font-family: monospace;">${safeTicketHash}</p>
                    </div>
                </div>

                <!-- Footer -->
                <p style="font-size: 7px; font-weight: 800; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 30px;">
                    Non-Transferable &bull; Valid ID Required for Entry
                </p>
                <div style="font-size: 10px; font-weight: 900; color: white; text-transform: uppercase; letter-spacing: 0.5em; opacity: 0.8;">
                    Backstage
                </div>
            </div>
        </div>
    `;
    return sendEmail({ 
        to, 
        subject: `Your Admittance Pass for ${safeEventName}`, 
        html, 
        preferredProvider,
        template_id: 'ticket_2', 
        variables: {
            user_name: safeUserName,
            event_name: safeEventName,
            qr_code_url: safeQrUrl,
            ticket_hash: safeTicketHash
        }
    });
};
