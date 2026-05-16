/**
 * apps/events/src/config.js
 *
 * Purpose: Environment-specific configuration and constant values.
 * Exports the base API URL and necessary OAuth client IDs used across the app.
 */
const isDev = process.env.NODE_ENV === 'development';
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "missing_client_id_placeholder";
