import { conflict } from '../lib/errors.js';

// Two state machines (see docs/domain.md, "Lifecycle"):
// the RIDE is the Tesla's shared trip, a REQUEST is one passenger's booking.
// Anything not listed here is an invalid transition.

export const RIDE_TRANSITIONS = Object.freeze({
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
});

export const REQUEST_TRANSITIONS = Object.freeze({
  REQUESTED: ['MATCHED', 'CANCELLED'],
  // MATCHED -> REQUESTED happens when the driver cancels: back in the queue.
  MATCHED: ['REQUESTED', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
});

// A ride that still occupies the Tesla.
export const ACTIVE_RIDE_STATUSES = ['ACCEPTED', 'DRIVER_ARRIVED', 'STARTED'];
// A ride that new passengers may still join / leave (the Tesla hasn't left).
export const OPEN_RIDE_STATUSES = ['ACCEPTED', 'DRIVER_ARRIVED'];
// A request that blocks the passenger from booking another one.
export const ACTIVE_REQUEST_STATUSES = ['REQUESTED', 'MATCHED'];

export function canTransition(transitions, from, to) {
  return transitions[from]?.includes(to) ?? false;
}

export function assertRideTransition(from, to) {
  if (!canTransition(RIDE_TRANSITIONS, from, to)) {
    throw conflict('INVALID_TRANSITION', `A ride that is ${label(from)} can't be moved to ${label(to)}`, {
      from,
      to,
      allowed: RIDE_TRANSITIONS[from] ?? [],
    });
  }
}

export function assertRequestTransition(from, to) {
  if (!canTransition(REQUEST_TRANSITIONS, from, to)) {
    throw conflict('INVALID_TRANSITION', `A request that is ${label(from)} can't be moved to ${label(to)}`, {
      from,
      to,
      allowed: REQUEST_TRANSITIONS[from] ?? [],
    });
  }
}

/**
 * The one status a passenger sees, combining their request and the shared ride:
 * WAITING -> MATCHED -> DRIVER_ARRIVED -> IN_PROGRESS -> COMPLETED | CANCELLED
 */
export function passengerStatus(requestStatus, rideStatus) {
  switch (requestStatus) {
    case 'REQUESTED':
      return 'WAITING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'MATCHED':
      if (rideStatus === 'DRIVER_ARRIVED') return 'DRIVER_ARRIVED';
      if (rideStatus === 'STARTED') return 'IN_PROGRESS';
      return 'MATCHED';
    default:
      throw new Error(`Unknown request status ${requestStatus}`);
  }
}

const label = (status) => status.toLowerCase().replace('_', ' ');
