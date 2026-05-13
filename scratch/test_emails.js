import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { sendOTPEmail, sendTicketEmail } from '../api/lib/email.js';

const TEST_EMAIL = 'kumarpiyush2k6@gmail.com';

async function runTests() {
    console.log(`\n🚀 STARTING EMAIL ROUTING TESTS FOR ${TEST_EMAIL}...\n`);

    // 1. Test OTP (Preferred: MSG91)
    console.log('[1/2] Sending OTP (Preference: MSG91)...');
    const otpRes = await sendOTPEmail(TEST_EMAIL, '123456');
    console.log(`Result: ${otpRes.success ? '✅ SUCCESS' : '❌ FAILED'} via ${otpRes.provider}\n`);

    // 2. Test Ticket (Preferred: Resend)
    console.log('[2/2] Sending QR Ticket (Preference: Resend)...');
    const ticketRes = await sendTicketEmail(
        TEST_EMAIL, 
        'Piyush Kumar',
        'Backstage Grand Launch', 
        'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TICKET-BKS-001'
    );
    console.log(`Result: ${ticketRes.success ? '✅ SUCCESS' : '❌ FAILED'} via ${ticketRes.provider}\n`);

    console.log('🏁 TESTS COMPLETE. CHECK YOUR INBOX!\n');
}

runTests().catch(console.error);
