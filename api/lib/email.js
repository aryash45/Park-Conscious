import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import axios from 'axios';

// Providers
let resendClient;
let smtpClient;

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
        smtpClient = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT === 465,
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
            }
        });
        
        console.log(`[EMAIL] Sent via MSG91: ${response.data?.request_id}`);
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
                        console.log(`[EMAIL] Sent via Resend: ${data.id}`);
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
export const sendTicketEmail = async (to, userName, eventName, qrCodeUrl) => {
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #050507; color: white; padding: 40px; border-radius: 20px;">
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 20px; color: white;">BACK<span style="color: #6366f1;">STAGE</span></h1>
            <p style="color: #94a3b8; font-size: 16px;">Hi ${userName}, your ticket for <b>${eventName}</b> is confirmed.</p>
            <div style="text-align: center; margin: 30px 0; background: white; padding: 20px; border-radius: 15px;">
                <img src="${qrCodeUrl}" alt="QR Ticket" style="width: 200px; height: 200px;">
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center;">Scan this at the entry gate.</p>
        </div>
    `;
    return sendEmail({ 
        to, 
        subject: `Your Ticket: ${eventName}`, 
        html, 
        preferredProvider: 'resend',
        template_id: 'qr_ticket', 
        variables: {
            user_name: userName,
            event_name: eventName,
            qr_code_url: qrCodeUrl
        }
    });
};
