/**
 * api/lib/cleanupReservations.js
 * 
 * Background job to clean up expired ticket reservations.
 * Serverless-optimized: Runs cleanup every 60s if needed (prevents memory leaks).
 */
import { releaseExpiredReservations } from './ticketing.js';
import './env.js';

const CLEANUP_INTERVAL_MS = 60000; // 1 minute
let lastCleanupTime = 0;

/**
 * Cleanup expired reservations if enough time has passed.
 * Designed for serverless where we can't run persistent intervals.
 */
export async function cleanupExpiredReservationsIfNeeded() {
  const now = Date.now();
  
  // Only run cleanup every 60 seconds max to avoid database spam
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTime = now;

  try {
    const expiredCount = await releaseExpiredReservations();
    if (expiredCount > 0) {
      console.log(`[CLEANUP]: Released ${expiredCount} expired reservation(s)`);
    }
  } catch (error) {
    console.error('[CLEANUP_ERROR]:', error.message);
  }
}
