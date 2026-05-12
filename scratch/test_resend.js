import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', // Use resend's testing domain
            to: 'kumarpiyush2k6@gmail.com',
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
