/**
 * Resolve display price from ticket tiers or legacy price fields.
 */
export const getEventMinPrice = (event) => {
  if (!event) return null;

  const tierPrices = (event.ticketTiers || [])
    .map((t) => Number(t.price))
    .filter((p) => !Number.isNaN(p) && p > 0);

  if (tierPrices.length > 0) {
    return Math.min(...tierPrices);
  }

  const legacyPrices = [event.price, event.regularPrice, event.vipPrice]
    .map((p) => Number(p))
    .filter((p) => !Number.isNaN(p) && p > 0);

  return legacyPrices.length > 0 ? Math.min(...legacyPrices) : null;
};

/** Human-readable price label, e.g. "₹999", "From ₹499", or "FREE" */
export const getEventPriceLabel = (event, { showFrom = true } = {}) => {
  const min = getEventMinPrice(event);
  if (min == null) return "FREE";

  const tierPrices = (event.ticketTiers || [])
    .map((t) => Number(t.price))
    .filter((p) => !Number.isNaN(p) && p > 0);

  const hasVariableTiers =
    tierPrices.length > 1 && new Set(tierPrices).size > 1;

  if (showFrom && hasVariableTiers) {
    return `From ₹${min}`;
  }

  return `₹${min}`;
};
