/**
 * api/lib/redis.js
 * 
 * Purpose: Redis connection management and caching utilities.
 * Implements a fail-safe wrapper that allows the app to function 
 * even if Redis is unavailable or unconfigured.
 */
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
let redis = null;

if (REDIS_URL) {
    try {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            // Prevent the app from crashing if Redis connection fails
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                if (times > 3) {
                    console.warn(`[REDIS] Connection failed after ${times} attempts. Disabling cache for this instance.`);
                    return null; // Stop retrying
                }
                return delay;
            }
        });

        redis.on('error', (err) => {
            console.warn('[REDIS] Connection Error:', err.message);
        });

        redis.on('connect', () => {
            console.log('[REDIS] Connected successfully.');
        });
    } catch (e) {
        console.warn('[REDIS] Initialization failed:', e.message);
        redis = null;
    }
} else {
    console.warn('[REDIS] No REDIS_URL found. Caching is disabled.');
}

/**
 * Get a value from the cache
 * @param {string} key 
 */
export async function getCache(key) {
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('[REDIS] Get Error:', e.message);
        return null;
    }
}

/**
 * Set a value in the cache with a TTL (Time To Live)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttl Seconds (default 300 / 5 mins)
 */
export async function setCache(key, value, ttl = 300) {
    if (!redis) return false;
    try {
        const stringified = JSON.stringify(value);
        await redis.set(key, stringified, 'EX', ttl);
        return true;
    } catch (e) {
        console.error('[REDIS] Set Error:', e.message);
        return false;
    }
}

/**
 * Delete a value from the cache (Invalidation)
 * @param {string} key 
 */
export async function delCache(key) {
    if (!redis) return false;
    try {
        await redis.del(key);
        return true;
    } catch (e) {
        console.error('[REDIS] Del Error:', e.message);
        return false;
    }
}

export default redis;
