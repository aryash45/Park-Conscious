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
let cachedRedis = null;

export const getRedisConnection = () => {
    if (cachedRedis) return cachedRedis;
    if (!REDIS_URL) return null;

    cachedRedis = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        staleIdentifier: 'bullmq',
    connectionName: `park-conscious-${process.env.VERCEL_ENV || 'dev'}`,
    ...(REDIS_URL.startsWith('rediss://') ? { 
        tls: { 
            rejectUnauthorized: process.env.NODE_ENV !== 'production' // Only allow self-signed in dev/preview
        } 
    } : {})
});

    cachedRedis.on('error', (err) => {
        console.error('[BULLMQ_REDIS_ERROR]:', err.message);
    });

    return cachedRedis;
};

export const redisConnection = getRedisConnection();

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
        removeOnFail: { count: 100 }, // Keep last 100 failed jobs for triage
    }
}) : null;

// Safe wrapper for queue initialization to prevent production crashes if Redis fails
if (ticketQueue) {
    ticketQueue.on('error', (err) => {
        console.error('[BULLMQ_QUEUE_ERROR]:', err.message);
    });
}

console.log(`[QUEUE_INIT]: TicketQueue ${ticketQueue ? 'READY' : 'DISABLED (No REDIS_URL)'}`);
