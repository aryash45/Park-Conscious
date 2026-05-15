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
let cachedQueue = null;

export const getRedisConnection = () => {
    if (cachedRedis) return cachedRedis;
    if (!REDIS_URL) return null;

    try {
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
    } catch (err) {
        console.error('[REDIS_INIT_FAILED]:', err.message);
        return null;
    }
};

// Lazy-loaded queue to prevent blocking function startup
export const getTicketQueue = () => {
    if (cachedQueue) return cachedQueue;
    
    const connection = getRedisConnection();
    if (!connection) return null;

    try {
        cachedQueue = new Queue('TicketEmails', { 
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: true,
                removeOnFail: { count: 100 }
            }
        });

        cachedQueue.on('error', (err) => console.error('[QUEUE_ERROR]:', err.message));
        return cachedQueue;
    } catch (err) {
        console.error('[QUEUE_INIT_FAILED]:', err.message);
        return null;
    }
};

// Compatibility exports
export const redisConnection = getRedisConnection();
export const ticketQueue = getTicketQueue(); // This might still run once at top-level if imported, but safely
