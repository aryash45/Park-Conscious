/**
 * Prefer human-readable slug URLs over MongoDB ObjectIds for public event links.
 */
export const getEventUrlId = (event) =>
  event?.slug || event?._id || event?.id;

export const getEventPath = (event) =>
  `/event/${getEventUrlId(event)}`;
