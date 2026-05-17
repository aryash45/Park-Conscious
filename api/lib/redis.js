/**
 * api/lib/redis.js
 * 
 * Purpose: Vercel-optimized Redis connection management and caching.
 * Uses a global singleton pattern to reuse connections across serverless invocations.
 */
import Redis from 'ioredis';
import './env.js'; // Ensure env is loaded

const REDIS_URL = process.env.REDIS_URL;

// Global singleton for serverless connection reuse
if (!global._redis) {
    global._redis = { conn: null, promise: null };
}

/**
 * Lazy getter for the Redis instance
 */
export function getRedis() {
    if (global._redis.conn) return global._redis.conn;
    // Fast fail if explicitly disabled (e.g., due to quota exhaustion)
    if (process.env.USE_REDIS === 'false') {
        console.warn('[REDIS_BYPASS]: Redis is disabled via USE_REDIS=false. Falling back to in-memory/DB.');
        return null;
    }
    if (!REDIS_URL) return null;

    try {
        // new Redis does not connect immediately if lazyConnect is true
        global._redis.conn = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null, // Required for compatibility with BullMQ shared connections
            connectTimeout: 5000,
            lazyConnect: true,
            retryStrategy(times) {
                if (times > 3) return null; // Kill connection attempt after 3 failures
                return Math.min(times * 100, 2000);
            },
            ...(REDIS_URL.startsWith('rediss://') ? { 
                tls: { rejectUnauthorized: false } 
            } : {})
        });

        global._redis.conn.on('error', (err) => {
            console.error('[REDIS_ERROR]:', err.message);
        });

        return global._redis.conn;
    } catch (err) {
        console.error('[REDIS_INIT_FAILED]:', err.message);
        return null;
    }
}

/**
 * Caching Utilities (Fail-Safe)
 */
export async function getCache(key) {
    const redis = getRedis();
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        return null;
    }
}

export async function setCache(key, value, ttl = 300) {
    const redis = getRedis();
    if (!redis) return false;
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttl);
        return true;
    } catch (err) {
        return false;
    }
}

export async function delCache(key) {
    const redis = getRedis();
    if (!redis) return false;
    try {
        await redis.del(key);
        return true;
    } catch (err) {
        return false;
    }
}

export default getRedis();
