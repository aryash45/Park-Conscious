/**
 * api/lib/redis.js
 * 
 * Purpose: Redis connection management and caching utilities.
 * Implements a fail-safe wrapper that allows the app to function 
 * even if Redis is unavailable or unconfigured.
 */
import Redis from 'ioredis';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const REDIS_URL = process.env.REDIS_URL;
let redis = null;

function getRedisInstance() {
    if (redis) return redis;
    if (!REDIS_URL) return null;

    try {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            lazyConnect: true, // Only connect when used
            retryStrategy(times) {
                if (times > 3) return null; // Stop retrying after 3 times
                return Math.min(times * 100, 2000);
            },
            ...(REDIS_URL.startsWith('rediss://') ? { 
                tls: { rejectUnauthorized: false } 
            } : {})
        });

        redis.on('error', (err) => {
            console.warn('[REDIS] Connection Error:', err.message);
        });

        return redis;
    } catch (e) {
        console.warn('[REDIS] Initialization failed:', e.message);
        return null;
    }
}

export async function getCache(key) {
    const instance = getRedisInstance();
    if (!instance) return null;
    try {
        const data = await instance.get(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

export async function setCache(key, value, ttl = 300) {
    const instance = getRedisInstance();
    if (!instance) return false;
    try {
        await instance.set(key, JSON.stringify(value), 'EX', ttl);
        return true;
    } catch (e) {
        return false;
    }
}

export async function delCache(key) {
    const instance = getRedisInstance();
    if (!instance) return false;
    try {
        await instance.del(key);
        return true;
    } catch (e) {
        return false;
    }
}

export default getRedisInstance();
