import * as models from './models.js';

const RESERVATION_WINDOW_MS = 15 * 60 * 1000;

const CONFIRMED_STATUSES = ['Confirmed', 'confirmed'];

const coerceNonNegativeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
};

const getTierIndex = (event, tierName) => {
  if (!event || !Array.isArray(event.ticketTiers)) return -1;
  return event.ticketTiers.findIndex((tier) => tier?.name === tierName);
};

export const getReservationExpiry = () => new Date(Date.now() + RESERVATION_WINDOW_MS);

export const isReservationExpired = (booking, now = new Date()) => {
  if (!booking?.reservationExpiresAt) return false;
  return new Date(booking.reservationExpiresAt).getTime() <= now.getTime();
};

export const buildEscalationState = ({ basePrice, remainingCapacity, soldCount, escalationThreshold, escalatedPrice, escalationAlertLimit }) => {
  const normalizedBasePrice = coerceNonNegativeNumber(basePrice);
  const normalizedRemaining = coerceNonNegativeNumber(remainingCapacity);
  const normalizedSoldCount = coerceNonNegativeNumber(soldCount);
  const normalizedThreshold = coerceNonNegativeNumber(escalationThreshold);
  const normalizedEscalatedPrice = coerceNonNegativeNumber(escalatedPrice);
  const normalizedAlertLimit = coerceNonNegativeNumber(escalationAlertLimit);
  const escalationEnabled = normalizedThreshold > 0 && normalizedEscalatedPrice > normalizedBasePrice;
  const discountedRemaining = escalationEnabled
    ? Math.min(normalizedRemaining, Math.max(normalizedThreshold - normalizedSoldCount, 0))
    : normalizedRemaining;
  const isEscalated = escalationEnabled && discountedRemaining === 0;
  const effectivePrice = isEscalated ? normalizedEscalatedPrice : normalizedBasePrice;
  const showUrgency = escalationEnabled && discountedRemaining > 0 && discountedRemaining <= normalizedAlertLimit;

  return {
    basePrice: normalizedBasePrice,
    remainingCapacity: normalizedRemaining,
    soldCount: normalizedSoldCount,
    escalationThreshold: normalizedThreshold,
    escalatedPrice: normalizedEscalatedPrice,
    escalationAlertLimit: normalizedAlertLimit,
    escalationEnabled,
    discountedRemaining,
    isEscalated,
    effectivePrice,
    showUrgency
  };
};

export const getCheckoutSnapshot = (event, tierName = null) => {
  const tierIndex = getTierIndex(event, tierName);
  const tier = tierIndex >= 0 ? event.ticketTiers[tierIndex] : null;
  const state = buildEscalationState({
    basePrice: tier ? tier.price : event?.price,
    remainingCapacity: tier ? tier.capacity : event?.capacity,
    soldCount: tier ? tier.soldCount : event?.soldCount,
    escalationThreshold: tier ? tier.escalationThreshold : event?.escalationThreshold,
    escalatedPrice: tier ? tier.escalatedPrice : event?.escalatedPrice,
    escalationAlertLimit: tier ? tier.escalationAlertLimit : event?.escalationAlertLimit
  });

  return {
    tier,
    tierIndex,
    tierName: tier?.name || tierName || null,
    ...state
  };
};

export const enrichEventWithPricing = (event) => {
  if (!event) return event;

  const enriched = typeof event.toObject === 'function' ? event.toObject() : JSON.parse(JSON.stringify(event));
  const globalPricing = buildEscalationState({
    basePrice: enriched.price,
    remainingCapacity: enriched.capacity,
    soldCount: enriched.soldCount,
    escalationThreshold: enriched.escalationThreshold,
    escalatedPrice: enriched.escalatedPrice,
    escalationAlertLimit: enriched.escalationAlertLimit
  });

  enriched.pricing = globalPricing;
  enriched.ticketTiers = Array.isArray(enriched.ticketTiers)
    ? enriched.ticketTiers.map((tier) => ({
        ...tier,
        pricing: buildEscalationState({
          basePrice: tier.price,
          remainingCapacity: tier.capacity,
          soldCount: tier.soldCount,
          escalationThreshold: tier.escalationThreshold,
          escalatedPrice: tier.escalatedPrice,
          escalationAlertLimit: tier.escalationAlertLimit
        })
      }))
    : [];

  return enriched;
};

const inventoryDeltaPayload = (eventId, tierName, { capacityDelta, soldCountDelta }) => {
  const inc = { capacity: capacityDelta, soldCount: soldCountDelta };
  const query = { _id: eventId };

  if (tierName) {
    query.ticketTiers = {
      $elemMatch: {
        name: tierName
      }
    };
    inc['ticketTiers.$.capacity'] = capacityDelta;
    inc['ticketTiers.$.soldCount'] = soldCountDelta;
  }

  return { query, inc };
};

export const releaseInventoryUnits = async (eventId, tierName = null, options = {}) => {
  const { allowLegacyFallback = false } = options;
  const { query, inc } = inventoryDeltaPayload(eventId, tierName, {
    capacityDelta: 1,
    soldCountDelta: -1
  });
  query.soldCount = { $gt: 0 };

  if (tierName) {
    query.ticketTiers.$elemMatch.soldCount = { $gt: 0 };
  }

  const updatedEvent = await models.Event.findOneAndUpdate(query, { $inc: inc }, { new: true });
  if (updatedEvent || !allowLegacyFallback) return !!updatedEvent;

  const legacyQuery = { _id: eventId };
  const legacyInc = { capacity: 1 };

  if (tierName) {
    legacyQuery['ticketTiers.name'] = tierName;
    legacyInc['ticketTiers.$.capacity'] = 1;
  }

  const legacyUpdatedEvent = await models.Event.findOneAndUpdate(
    legacyQuery,
    { $inc: legacyInc },
    { new: true }
  );

  return !!legacyUpdatedEvent;
};

// Step 1: Acquire exclusive claim rights (does NOT yet clear inventory fields,
// keeping the booking retryable if the subsequent releaseInventoryUnits call fails).
const acquireInventoryReleaseClaim = async (bookingId, extraQuery = {}) => {
  if (!bookingId) return null;

  // Use a sentinel field to mark that a release is in-flight while leaving
  // inventoryReleasedAt null so callers can detect an incomplete release and retry.
  return models.Booking.findOneAndUpdate(
    {
      _id: bookingId,
      inventoryReserved: true,
      inventoryReleasedAt: null,
      ...extraQuery
    },
    {
      $set: { status: 'Initiated' } // keep Initiated so a retry re-enters this path
    },
    { new: false }
  ).lean();
};

// Step 2: After releaseInventoryUnits succeeds, finalize the booking record.
const finalizeInventoryRelease = async (bookingId, finalStatus) => {
  if (!bookingId) return null;

  return models.Booking.findOneAndUpdate(
    { _id: bookingId, inventoryReleasedAt: null },
    {
      $set: {
        status: finalStatus,
        inventoryReserved: false,
        inventoryReleasedAt: new Date()
      }
    },
    { new: false }
  ).lean();
};

const restoreReleasedInventory = async (booking, finalStatus = 'Expired', extraQuery = {}) => {
  if (!booking?._id || !booking?.eventId) return false;

  // Acquire the release lock; returns the pre-update doc or null if already claimed.
  const claimedBooking = await acquireInventoryReleaseClaim(booking._id, {
    status: 'Initiated',
    ...extraQuery
  });

  if (!claimedBooking) return false;

  // Release inventory units first — if this fails the booking stays retryable.
  await releaseInventoryUnits(claimedBooking.eventId, claimedBooking.tierName, { allowLegacyFallback: true });

  // Only now mark the booking as fully released.
  await finalizeInventoryRelease(claimedBooking._id, finalStatus);
  return true;
};

const markConfirmedBookingReleased = async (bookingId) => {
  if (!bookingId) return null;

  return models.Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: { $in: CONFIRMED_STATUSES },
      inventoryReleasedAt: null
    },
    {
      $set: {
        inventoryReserved: false,
        inventoryReleasedAt: new Date()
      }
    },
    { new: false }
  ).lean();
};

export const releaseExpiredReservations = async (eventId = null) => {
  const query = {
    status: 'Initiated',
    inventoryReserved: true,
    inventoryReleasedAt: null,
    reservationExpiresAt: { $lte: new Date() }
  };

  if (eventId) query.eventId = String(eventId);

  const expiredBookings = await models.Booking.find(query)
    .select('_id eventId tierName inventoryReserved inventoryReleasedAt reservationExpiresAt')
    .lean();

  for (const booking of expiredBookings) {
    await restoreReleasedInventory(booking, 'Expired', {
      reservationExpiresAt: { $lte: new Date() }
    });
  }

  return expiredBookings.length;
};

export const reserveInventory = async (eventId, tierName = null) => {
  await releaseExpiredReservations(eventId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const event = await models.Event.findById(eventId).lean();
    if (!event) {
      return { ok: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' };
    }

    const snapshot = getCheckoutSnapshot(event, tierName);
    if (snapshot.tierName && !snapshot.tier) {
      return { ok: false, code: 'TIER_NOT_FOUND', message: 'Selected ticket tier is no longer available.' };
    }

    if (snapshot.remainingCapacity <= 0 || coerceNonNegativeNumber(event.capacity) <= 0) {
      return { ok: false, code: 'SOLD_OUT', message: 'This ticket tier is sold out.' };
    }

    const query = {
      _id: eventId,
      capacity: { $gt: 0 }
    };
    const update = {
      $inc: {
        capacity: -1,
        soldCount: 1
      }
    };

    if (snapshot.tierName) {
      query.ticketTiers = {
        $elemMatch: {
          name: snapshot.tierName,
          capacity: { $gt: 0 },
          soldCount: snapshot.soldCount
        }
      };
      update.$inc['ticketTiers.$.capacity'] = -1;
      update.$inc['ticketTiers.$.soldCount'] = 1;
    } else {
      query.soldCount = snapshot.soldCount;
    }

    const reservedEvent = await models.Event.findOneAndUpdate(query, update, { new: true }).lean();
    if (reservedEvent) {
      return {
        ok: true,
        reservationExpiresAt: getReservationExpiry(),
        pricing: snapshot
      };
    }
  }

  return {
    ok: false,
    code: 'RESERVATION_CONFLICT',
    message: 'Ticket pricing changed while you were checking out. Please try again.'
  };
};

export const releaseReservationByBooking = async (booking, finalStatus = 'Expired') => {
  if (!booking?._id || booking.status === 'Confirmed') return false;
  return restoreReleasedInventory(booking, finalStatus);
};

export const restoreInventoryForConfirmedBooking = async (booking) => {
  if (!booking?._id || !booking?.eventId) return false;

  const claimedBooking = await markConfirmedBookingReleased(booking._id);
  if (!claimedBooking) return false;

  await releaseInventoryUnits(claimedBooking.eventId, claimedBooking.tierName, { allowLegacyFallback: true });
  return true;
};

export const consumeInventoryForLegacyBooking = async (booking) => {
  if (!booking?.eventId || booking.inventoryReserved || booking.inventoryReleasedAt) return true;

  const { query, inc } = inventoryDeltaPayload(booking.eventId, booking.tierName, {
    capacityDelta: -1,
    soldCountDelta: 1
  });
  query.capacity = { $gt: 0 };

  if (booking.tierName) {
    query.ticketTiers.$elemMatch.capacity = { $gt: 0 };
  }

  const updatedEvent = await models.Event.findOneAndUpdate(query, { $inc: inc }, { new: true });
  return !!updatedEvent;
};
