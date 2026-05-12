import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { sendTicketEmail } from '../api/lib/email.js';

const TEST_EMAIL = process.env.TEST_EMAIL;
if (!TEST_EMAIL) {
    console.error('❌ ERROR: TEST_EMAIL environment variable is missing in .env.local');
    process.exit(1);
}

async function testMSG91QR() {
    console.log(`\n🚀 TESTING MSG91 QR TICKET TEMPLATE FOR ${TEST_EMAIL}...\n`);

    const ticketRes = await sendTicketEmail(
        TEST_EMAIL, 
        'Piyush Kumar',
        'Backstage QR Test', 
        'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TEST-MSG91-QR',
        'msg91' // Force MSG91
    );

    console.log(`Result: ${ticketRes.success ? '✅ SUCCESS' : '❌ FAILED'} via ${ticketRes.provider}`);
    if (ticketRes.id) console.log(`Request ID: ${ticketRes.id}`);
    
    console.log('\n🏁 TEST COMPLETE. CHECK YOUR WHATSAPP/EMAIL!\n');
}

testMSG91QR().catch(console.error);
