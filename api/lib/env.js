/**
 * api/lib/env.js
 * 
 * Purpose: Centralized environment variable loader and validator.
 * Ensures that variables like JWT_SECRET and MONGODB_URI are 
 * hydrated before they are accessed by other modules.
 */
import dotenv from 'dotenv';

let loaded = false;

export function loadEnv() {
    if (loaded) return;
    
    // Only load from .env files in local development
    if (process.env.NODE_ENV !== 'production') {
        dotenv.config();
        dotenv.config({ path: '.env.local', override: true });
    }
    
    loaded = true;
}

// Auto-run on import to ensure early hydration
loadEnv();

export const getSecret = (key, fallback = null) => {
    return process.env[key] || fallback;
};
