/**
 * api/lib/queue.js
 * 
 * Purpose: Vercel-optimized BullMQ Queue management.
 * Leverages the shared global Redis connection to prevent connection flooding.
 */
import { Queue } from 'bullmq';
import { getRedis } from './redis.js';

// Global singleton for the Queue instance
if (!global._queues) {
    global._queues = { ticketQueue: null };
}

/**
 * Lazy getter for the Ticket Queue
 */
export function getTicketQueue() {
    if (global._queues.ticketQueue) return global._queues.ticketQueue;
    
    const connection = getRedis();
    if (!connection) return null;

    try {
        global._queues.ticketQueue = new Queue('TicketEmails', { 
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: true,
                removeOnFail: { count: 100 }
            }
        });

        global._queues.ticketQueue.on('error', (err) => {
            console.error('[QUEUE_ERROR]:', err.message);
        });

        return global._queues.ticketQueue;
    } catch (err) {
        console.error('[QUEUE_INIT_FAILED]:', err.message);
        return null;
    }
}

// Backward compatibility exports
export const redisConnection = getRedis();
export const ticketQueue = getTicketQueue();
