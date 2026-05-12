import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.RESEND_API_KEY || !process.env.TEST_EMAIL) {
    console.error('❌ ERROR: Missing RESEND_API_KEY or TEST_EMAIL environment variables.');
    process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: process.env.TEST_EMAIL,
            subject: 'Test Code',
            html: '<strong>123456</strong>'
        });
        console.log('Resend Success:', data);
        process.exit(0);
    } catch (err) {
        console.error('Resend Failed:', err);
        process.exit(1);
    }
}

test();
