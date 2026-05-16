export const normalizeApiUrl = (rawUrl) => {
  return (rawUrl || "").trim()
    .replace(/^https?:\/\/(?:www\.)?(?:admin\.)?(?:events\.)?parkconscious\.in/i, '') // Strip production host case-insensitively, preserve localhost
    .replace(/([^:]\/)\/+/g, '$1') // Collapse repeated slashes, preserving ://
    .replace(/\/$/, '') // Strip trailing slash
    .replace(/^\/?api$/, ''); // Normalize /api to empty to prevent /api/api
};
