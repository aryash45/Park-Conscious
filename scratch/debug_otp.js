import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { sendOTPEmail } from '../api/lib/email.js';

async function debugOTP() {
    const testEmail = process.env.TEST_EMAIL || 'your-email@example.com';
    console.log(`\n🚀 DIAGNOSING OTP DELIVERY FOR: ${testEmail}`);
    console.log(`-------------------------------------------`);
    console.log(`📡 MSG91 Domain: ${process.env.MSG91_DOMAIN}`);
    console.log(`🔑 MSG91 Auth Key: ${process.env.MSG91_AUTH_KEY ? 'Present (Hidden)' : 'MISSING'}`);
    console.log(`📑 MSG91 Template ID: global_otp (Hardcoded in helper)`);
    console.log(`-------------------------------------------\n`);

    try {
        const result = await sendOTPEmail(testEmail, '123456');
        
        if (result.success) {
            console.log(`✅ SUCCESS! Sent via: ${result.provider.toUpperCase()}`);
            console.log(`📦 Request ID: ${result.id}`);
        } else {
            console.log(`❌ FAILED! All providers failed.`);
            console.log(`📝 Reason: ${result.message}`);
        }
    } catch (err) {
        console.error(`💥 CRITICAL CRASH:`, err);
    }
    
    console.log(`\n🏁 DIAGNOSTIC COMPLETE.\n`);
}

debugOTP();
