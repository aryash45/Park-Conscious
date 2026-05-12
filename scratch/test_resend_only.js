import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY || !process.env.TEST_EMAIL) {
    console.error('❌ ERROR: Missing RESEND_API_KEY or TEST_EMAIL environment variables.');
    process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const TEST_EMAIL = process.env.TEST_EMAIL;

async function testResend() {
    console.log(`\n📧 TESTING RESEND API CONNECTION...`);
    try {
        const { data, error } = await resend.emails.send({
            from: 'no-reply@otp.parkconscious.in',
            to: TEST_EMAIL,
            subject: 'Resend Custom Domain Test',
            html: '<h1>Domain Verified!</h1><p>This proves your custom domain <b>otp.parkconscious.in</b> is working with Resend.</p>'
        });

        if (error) {
            console.error('❌ RESEND ERROR:', error);
        } else {
            console.log('✅ RESEND SUCCESS! ID:', data.id);
            console.log('Check your inbox (and spam folder) for the test mail.');
        }
    } catch (err) {
        console.error('❌ CRITICAL ERROR:', err);
    }
}

testResend();
