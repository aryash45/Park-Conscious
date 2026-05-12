import mongoose from 'mongoose';
import * as models from '../api/lib/models.js';
import connectDB from '../api/lib/mongodb.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { VerificationCode } = models;

async function test() {
    try {
        await connectDB();
        console.log('DB Connected');
        
        const email = 'test@example.com';
        const code = '123456';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const res = await VerificationCode.findOneAndUpdate(
            { email },
            { code, expiresAt },
            { upsert: true, new: true }
        );
        console.log('Model Test Success:', res);
        
        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

test();
