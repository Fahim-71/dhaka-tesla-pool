import { describe, expect, it } from 'vitest';
import {
  REQUEST_TRANSITIONS,
  RIDE_TRANSITIONS,
  assertRideTransition,
  canTransition,
  passengerStatus,
} from '../src/domain/lifecycle.js';

describe('ride state machine', () => {
  it('allows the happy path ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED', () => {
    expect(canTransition(RIDE_TRANSITIONS, 'ACCEPTED', 'DRIVER_ARRIVED')).toBe(true);
    expect(canTransition(RIDE_TRANSITIONS, 'DRIVER_ARRIVED', 'STARTED')).toBe(true);
    expect(canTransition(RIDE_TRANSITIONS, 'STARTED', 'COMPLETED')).toBe(true);
  });

  it.each([
    ['ACCEPTED', 'STARTED'], // can't start before arriving at the pickup
    ['ACCEPTED', 'COMPLETED'], // can't complete a ride that never started
    ['DRIVER_ARRIVED', 'COMPLETED'],
    ['STARTED', 'CANCELLED'], // can't cancel with passengers in the car
    ['STARTED', 'STARTED'], // can't start twice
    ['COMPLETED', 'STARTED'], // finished is final
    ['CANCELLED', 'ACCEPTED'], // cancelled is final
  ])('rejects %s -> %s', (from, to) => {
    expect(canTransition(RIDE_TRANSITIONS, from, to)).toBe(false);
    expect(() => assertRideTransition(from, to)).toThrow(expect.objectContaining({ status: 409, code: 'INVALID_TRANSITION' }));
  });

  it('has no way out of COMPLETED or CANCELLED', () => {
    expect(RIDE_TRANSITIONS.COMPLETED).toEqual([]);
    expect(RIDE_TRANSITIONS.CANCELLED).toEqual([]);
    expect(REQUEST_TRANSITIONS.COMPLETED).toEqual([]);
    expect(REQUEST_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('request state machine', () => {
  it('lets a matched request go back to waiting (driver cancelled) but not a completed one', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'MATCHED', 'REQUESTED')).toBe(true);
    expect(canTransition(REQUEST_TRANSITIONS, 'COMPLETED', 'REQUESTED')).toBe(false);
    expect(canTransition(REQUEST_TRANSITIONS, 'REQUESTED', 'COMPLETED')).toBe(false);
  });
});

describe('passengerStatus - what Nusrat sees', () => {
  it.each([
    ['REQUESTED', undefined, 'WAITING'],
    ['MATCHED', 'ACCEPTED', 'MATCHED'],
    ['MATCHED', 'DRIVER_ARRIVED', 'DRIVER_ARRIVED'],
    ['MATCHED', 'STARTED', 'IN_PROGRESS'],
    ['COMPLETED', 'COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'STARTED', 'CANCELLED'], // she left; the ride went on without her
  ])('request %s + ride %s -> %s', (request, ride, expected) => {
    expect(passengerStatus(request, ride)).toBe(expected);
  });
});
