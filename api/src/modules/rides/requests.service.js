import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { calculateFare } from '../../domain/fare.js';
import { ACTIVE_REQUEST_STATUSES, OPEN_RIDE_STATUSES, assertRequestTransition } from '../../domain/lifecycle.js';
import { resolveTrip } from '../areas/areas.service.js';
import { lockRequest, lockRide, recordEvent } from './db-helpers.js';
import { passengerRequestInclude, toEventView, toPassengerView } from './views.js';
import { autoMatch } from './pool.service.js';

const isUniqueViolation = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * Nusrat asks for a ride. The request is created as REQUESTED with the solo
 * fare as its estimate, then - in the same transaction - we try to place it in
 * an open pool (Rafiq joining Nusrat in Bullet). If nothing fits, it waits in
 * the driver feed.
 */
export async function createRequest(passengerId, { pickupAreaId, destinationAreaId, seats, paymentMethod }) {
  try {
    const requestId = await prisma.$transaction(async (tx) => {
      const { distanceM } = await resolveTrip({ pickupAreaId, destinationAreaId }, tx);
      const request = await tx.rideRequest.create({
        data: {
          passengerId,
          pickupAreaId,
          destinationAreaId,
          seats,
          paymentMethod,
          distanceM,
          ...calculateFare({ distanceM, seats, pooled: false }),
        },
      });
      await recordEvent(tx, {
        requestId: request.id,
        actorId: passengerId,
        type: 'REQUEST_CREATED',
        toStatus: 'REQUESTED',
        details: { pickupAreaId, destinationAreaId, seats, distanceM },
      });
      await autoMatch(tx, request);
      return request.id;
    });
    return getRequestForPassenger(passengerId, requestId);
  } catch (err) {
    // The partial unique index allows one active request per passenger.
    // This also makes a double-clicked "Request" button harmless.
    if (isUniqueViolation(err)) {
      throw conflict('ACTIVE_REQUEST_EXISTS', 'You already have an active ride request');
    }
    throw err;
  }
}

export async function getRequestForPassenger(passengerId, requestId) {
  const request = await prisma.rideRequest.findUnique({
    where: { id: requestId },
    include: passengerRequestInclude,
  });
  // Someone else's request looks exactly like a missing one (404, not 403),
  // so ids can't be probed to discover other people's rides.
  if (!request || request.passengerId !== passengerId) {
    throw notFound('Ride request not found');
  }
  return { ...toPassengerView(request), events: (await passengerEvents(request)).map(toEventView) };
}

/**
 * The passenger's timeline: events about their own request, plus the ride's
 * status changes (arrived, started, completed) while they were in it.
 * Never events about the other passengers' requests.
 */
function passengerEvents(request) {
  const rideStatusEvents = request.rideId
    ? [
        {
          rideId: request.rideId,
          requestId: null,
          type: { in: ['RIDE_STATUS_CHANGED', 'RIDE_CANCELLED'] },
          ...(request.cancelledAt && { createdAt: { lte: request.cancelledAt } }),
        },
      ]
    : [];
  return prisma.rideEvent.findMany({
    where: { OR: [{ requestId: request.id }, ...rideStatusEvents] },
    orderBy: { id: 'asc' },
  });
}

export async function getActiveRequest(passengerId) {
  const request = await prisma.rideRequest.findFirst({
    where: { passengerId, status: { in: ACTIVE_REQUEST_STATUSES } },
    include: passengerRequestInclude,
  });
  return request ? toPassengerView(request) : null;
}

export async function listRequests(passengerId) {
  const requests = await prisma.rideRequest.findMany({
    where: { passengerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: passengerRequestInclude,
  });
  return requests.map(toPassengerView);
}

/**
 * Passenger cancels. Allowed while waiting, or while matched but before the
 * Tesla leaves. Releases the seats; if nobody is left, the ride is cancelled.
 */
export async function cancelRequest(passengerId, requestId) {
  await prisma.$transaction(async (tx) => {
    // Read first (no lock) only to find out which ride to lock.
    const peek = await tx.rideRequest.findUnique({ where: { id: requestId } });
    if (!peek || peek.passengerId !== passengerId) throw notFound('Ride request not found');

    // Lock order: ride, then request (see db-helpers.js).
    if (peek.rideId) await lockRide(tx, peek.rideId);
    await lockRequest(tx, requestId);

    const request = await tx.rideRequest.findUnique({ where: { id: requestId }, include: { ride: true } });
    if (request.rideId !== peek.rideId) {
      // The driver moved it between our read and our lock. Very rare.
      throw conflict('REQUEST_CHANGED', 'This ride just changed, please try again');
    }

    assertRequestTransition(request.status, 'CANCELLED');

    const ride = request.status === 'MATCHED' ? request.ride : null;
    if (ride && !OPEN_RIDE_STATUSES.includes(ride.status)) {
      throw conflict('CANNOT_CANCEL', 'The ride has already started and can no longer be cancelled');
    }

    await tx.rideRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'PASSENGER_CANCELLED' },
    });
    await recordEvent(tx, {
      rideId: ride?.id,
      requestId,
      actorId: passengerId,
      type: 'REQUEST_CANCELLED',
      fromStatus: request.status,
      toStatus: 'CANCELLED',
      details: ride ? { seatsReleased: request.seats } : undefined,
    });

    if (ride) {
      const updated = await tx.ride.update({
        where: { id: ride.id },
        data: { seatsBooked: { decrement: request.seats } },
      });
      // Last passenger left - free Jashim instead of keeping an empty ride.
      if (updated.seatsBooked === 0) {
        await tx.ride.update({ where: { id: ride.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
        await recordEvent(tx, {
          rideId: ride.id,
          type: 'RIDE_CANCELLED',
          fromStatus: ride.status,
          toStatus: 'CANCELLED',
          details: { reason: 'ALL_PASSENGERS_CANCELLED' },
        });
      }
    }
  });

  return getRequestForPassenger(passengerId, requestId);
}
