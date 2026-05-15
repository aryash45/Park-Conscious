/**
 * api/lib/queue.js
 * 
 * Purpose: BullMQ Queue configuration and shared Redis connection.
 */
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
    dotenv.config({ path: '.env.local', override: true });
}

const REDIS_URL = process.env.REDIS_URL;

let cachedRedis = null;

export const getRedisConnection = () => {
    if (cachedRedis) return cachedRedis;
    if (!REDIS_URL) return null;

    cachedRedis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        enableReadyCheck: false,
        ...(REDIS_URL.startsWith('rediss://') ? { 
            tls: { rejectUnauthorized: false } 
        } : {})
    });

    cachedRedis.on('error', (err) => {
        console.error('[REDIS_ERROR]:', err.message);
    });

    return cachedRedis;
};

// Export the connection instance directly for worker usage
export const redisConnection = getRedisConnection();

export const ticketQueue = redisConnection ? new Queue('TicketEmails', { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: { count: 100 }
    }
}) : null;

if (ticketQueue) {
    ticketQueue.on('error', (err) => console.error('[QUEUE_ERROR]:', err.message));
}
