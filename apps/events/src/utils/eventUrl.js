/**
 * Prefer human-readable slug URLs over MongoDB ObjectIds for public event links.
 */
export const getEventUrlId = (event) =>
  event?.slug || event?._id || event?.id;

export const getEventPath = (event) => {
  const id = getEventUrlId(event);
  if (!id) return '/';
  return `/event/${id}`;
};
