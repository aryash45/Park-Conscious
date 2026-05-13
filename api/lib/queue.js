/**
 * api/lib/queue.js
 * 
 * Purpose: BullMQ Queue configuration and shared Redis connection.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

// Connection options optimized for BullMQ and Upstash
export const redisConnection = REDIS_URL ? new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    staleIdentifier: 'bullmq',
    // Upstash specific: sometimes requires family: 6 or tls
    ...(REDIS_URL.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {})
}) : null;

if (redisConnection) {
    redisConnection.on('error', (err) => {
        console.error('[BULLMQ_REDIS_ERROR]:', err.message);
    });
}

// Define our specific queues with safety check
export const ticketQueue = redisConnection ? new Queue('TicketEmails', { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 1000, // Keep failed jobs for a while for debugging
    }
}) : null;

// Safe wrapper for queue initialization to prevent production crashes if Redis fails
if (ticketQueue) {
    ticketQueue.on('error', (err) => {
        console.error('[BULLMQ_QUEUE_ERROR]:', err.message);
    });
}

console.log(`[QUEUE_INIT]: TicketQueue ${ticketQueue ? 'READY' : 'DISABLED (No REDIS_URL)'}`);
