/**
 * api/lib/worker.js
 * 
 * Purpose: BullMQ Worker that consumes the TicketEmails queue.
 */
import { Worker } from 'bullmq';
import { getRedis } from './redis.js';
import connectDB from './mongodb.js';
import { sendTicketEmail } from './email.js';
import './env.js';

export async function initWorker() {
    await connectDB();

    const connection = getRedis();
    if (!connection) {
        console.warn('[WORKER]: Redis connection not available. Worker disabled.');
        return null;
    }

    const worker = new Worker('TicketEmails', async (job) => {
        const { bookingId } = job.data;
        console.log(`[WORKER]: Processing ticket for booking ${bookingId}`);
        
        const success = await sendTicketEmail(bookingId);
        if (!success) {
            throw new Error(`Failed to send email for booking ${bookingId}`);
        }
    }, { 
        connection,
        concurrency: 5,
        limiter: {
            max: 10,
            duration: 1000
        }
    });

    worker.on('failed', (job, err) => {
        console.error(`[WORKER_JOB_FAILED]: Job ${job.id} failed: ${err.message}`);
    });

    console.log('[WORKER_INIT]: Ticket Worker ACTIVE');
    return worker;
}
