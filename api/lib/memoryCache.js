/**
 * api/lib/memoryCache.js
 * 
 * Purpose: Zero-latency, in-memory caching for Vercel warm serverless containers.
 * This completely avoids network latency and quota limits (unlike Redis).
 * Useful for public endpoints like the main events feed.
 */

// Global memory cache to persist across warm invocations
if (!global._memoryCache) {
    global._memoryCache = new Map();
}

/**
 * Get an item from the memory cache
 * @param {string} key 
 * @returns {any|null} Parsed object or null if expired/missing
 */
export function getMemoryCache(key) {
    const item = global._memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
        global._memoryCache.delete(key);
        return null;
    }

    // Return a deeply cloned object to prevent accidental mutation of the cache
    try {
        return JSON.parse(item.data);
    } catch (e) {
        return item.data;
    }
}

/**
 * Set an item in the memory cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Time to live in seconds
 */
export function setMemoryCache(key, value, ttlSeconds = 60) {
    // Stringify to break any references (like Mongoose documents) and prevent memory leaks
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    
    global._memoryCache.set(key, {
        data: stringified,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}

/**
 * Delete an item from the memory cache
 * @param {string} key 
 */
export function delMemoryCache(key) {
    global._memoryCache.delete(key);
}

/**
 * Clear the entire memory cache
 */
export function clearMemoryCache() {
    global._memoryCache.clear();
}
