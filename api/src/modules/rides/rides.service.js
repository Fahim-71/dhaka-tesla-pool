import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { calculateFare } from '../../domain/fare.js';
import { assertRideTransition } from '../../domain/lifecycle.js';
import { lockRide, recordEvent } from './db-helpers.js';
import { driverRideInclude, toDriverRideView, toEventView } from './views.js';

// The driver's buttons, and the ride status each one moves to.
export const RIDE_ACTIONS = {
  arrive: { to: 'DRIVER_ARRIVED', timestamp: 'arrivedAt' },
  start: { to: 'STARTED', timestamp: 'startedAt' },
  complete: { to: 'COMPLETED', timestamp: 'completedAt' },
  cancel: { to: 'CANCELLED', timestamp: 'cancelledAt' },
};

async function loadOwnRide(tx, driverId, rideId) {
  const ride = await tx.ride.findUnique({ where: { id: rideId }, include: { vehicle: true } });
  // Another driver's ride looks the same as a missing one.
  if (!ride || ride.vehicle.driverId !== driverId) throw notFound('Ride not found');
  return ride;
}

export async function getRideForDriver(driverId, rideId) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { ...driverRideInclude, events: { orderBy: { id: 'asc' } } },
  });
  if (!ride || ride.vehicle.driverId !== driverId) throw notFound('Ride not found');
  return { ...toDriverRideView(ride), events: ride.events.map(toEventView) };
}

/**
 * Move a ride one step through its lifecycle. The ride row is locked for the
 * whole transaction, so a double-tapped button, or a passenger cancelling at
 * the same moment, is handled one at a time against fresh data.
 */
export async function transitionRide(driverId, rideId, action) {
  const { to, timestamp } = RIDE_ACTIONS[action];

  await prisma.$transaction(async (tx) => {
    await lockRide(tx, rideId);
    const ride = await loadOwnRide(tx, driverId, rideId);
    assertRideTransition(ride.status, to);

    const members = await tx.rideRequest.findMany({ where: { rideId, status: 'MATCHED' } });
    const now = new Date();

    if (to === 'STARTED') {
      if (members.length === 0) throw conflict('EMPTY_RIDE', 'There is nobody in this ride to start it with');
      await lockFares(tx, members);
    }

    if (to === 'COMPLETED') {
      // Everyone is dropped off; cash / TeslaPay is settled at the end.
      await tx.rideRequest.updateMany({
        where: { rideId, status: 'MATCHED' },
        data: { status: 'COMPLETED', completedAt: now, paidAt: now },
      });
    }

    if (to === 'CANCELLED') {
      // Jashim can't make it. Nobody loses their booking: every passenger
      // goes back to the queue for another Tesla.
      for (const member of members) {
        await tx.rideRequest.update({
          where: { id: member.id },
          data: { status: 'REQUESTED', rideId: null, matchedAt: null },
        });
        await recordEvent(tx, {
          rideId,
          requestId: member.id,
          actorId: driverId,
          type: 'REQUEST_REQUEUED',
          fromStatus: 'MATCHED',
          toStatus: 'REQUESTED',
          details: { reason: 'DRIVER_CANCELLED' },
        });
      }
    }

    await tx.ride.update({
      where: { id: rideId },
      data: { status: to, [timestamp]: now, ...(to === 'CANCELLED' && { seatsBooked: 0 }) },
    });
    await recordEvent(tx, {
      rideId,
      actorId: driverId,
      type: to === 'CANCELLED' ? 'RIDE_CANCELLED' : 'RIDE_STATUS_CHANGED',
      fromStatus: ride.status,
      toStatus: to,
      details: to === 'CANCELLED' ? { reason: 'DRIVER_CANCELLED' } : undefined,
    });
  });

  return getRideForDriver(driverId, rideId);
}

/**
 * The Tesla is leaving, so pool membership is final: work out each
 * passenger's fare now. Shared = at least two different passengers.
 */
async function lockFares(tx, members) {
  const pooled = members.length >= 2;
  for (const member of members) {
    const fare = calculateFare({ distanceM: member.distanceM, seats: member.seats, pooled });
    await tx.rideRequest.update({ where: { id: member.id }, data: fare });
    await recordEvent(tx, {
      rideId: member.rideId,
      requestId: member.id,
      type: 'FARE_LOCKED',
      details: { ...fare, pooled, passengersInRide: members.length },
    });
  }
}
