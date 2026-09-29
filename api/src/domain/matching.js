import { tripDistanceMetres } from './geo.js';
import { OPEN_RIDE_STATUSES } from './lifecycle.js';

// Drop-offs in one pool must all be within this distance of each other.
export const MAX_DESTINATION_SPREAD_M = 2000;

/**
 * Can this request join this pool? (docs/domain.md, "Matching rule")
 *
 *   1. same pickup area
 *   2. new destination within 2,000 m of every destination already in the pool
 *   3. enough free seats
 *   4. the pool hasn't started yet
 *
 * Pure function - no database - so it is easy to test and to explain.
 *
 * @param ride     { status, pickupAreaId, capacity, seatsBooked }
 * @param members  destinations of the passengers already in the ride: [{ lat, lng }]
 * @param request  { pickupAreaId, seats, destination: { lat, lng } }
 * @returns { ok: true } or { ok: false, reason }
 */
export function checkPoolFit({ ride, members, request }) {
  if (!OPEN_RIDE_STATUSES.includes(ride.status)) {
    return { ok: false, reason: 'RIDE_NOT_OPEN' };
  }
  if (ride.pickupAreaId !== request.pickupAreaId) {
    return { ok: false, reason: 'DIFFERENT_PICKUP' };
  }
  if (ride.seatsBooked + request.seats > ride.capacity) {
    return { ok: false, reason: 'NOT_ENOUGH_SEATS' };
  }
  const tooFar = members.some((dest) => tripDistanceMetres(dest, request.destination) > MAX_DESTINATION_SPREAD_M);
  if (tooFar) {
    return { ok: false, reason: 'DESTINATION_TOO_FAR' };
  }
  return { ok: true };
}

export const POOL_FIT_MESSAGES = {
  RIDE_NOT_OPEN: 'This ride has already left',
  DIFFERENT_PICKUP: 'This passenger is picking up somewhere else',
  NOT_ENOUGH_SEATS: 'Not enough free seats',
  DESTINATION_TOO_FAR: 'Their destination is too far from the others in this ride',
  REQUEST_NOT_AVAILABLE: 'This request has already been taken or cancelled',
};
