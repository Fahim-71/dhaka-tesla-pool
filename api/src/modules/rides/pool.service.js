// Putting a waiting request into a ride (pool). This is the one place seats
// are claimed, whether the passenger was matched automatically or the driver
// picked them from the feed.
import { checkPoolFit } from '../../domain/matching.js';
import { OPEN_RIDE_STATUSES } from '../../domain/lifecycle.js';
import { lockRequest, lockRide, recordEvent } from './db-helpers.js';

/**
 * Try to add `requestId` to `rideId`. MUST run inside a transaction.
 *
 * The concurrency problem: Bullet has 1 seat left and Nusrat and Shirin both
 * ask for it at the same instant. Each call first takes a row lock on the
 * ride (SELECT ... FOR UPDATE). The second caller waits until the first
 * commits, then reads the NEW seats_booked and is refused. Nobody decides
 * based on a stale "1 seat left". The CHECK (seats_booked <= capacity)
 * constraint is the safety net if this code is ever bypassed.
 *
 * @returns { ok: true } or { ok: false, reason }
 */
export async function addRequestToRide(tx, { rideId, requestId, actorId, via }) {
  // Lock order: ride first, then request.
  await lockRide(tx, rideId);
  await lockRequest(tx, requestId);

  const ride = await tx.ride.findUnique({
    where: { id: rideId },
    include: { requests: { where: { status: 'MATCHED' }, include: { destinationArea: true } } },
  });
  const request = await tx.rideRequest.findUnique({ where: { id: requestId }, include: { destinationArea: true } });

  if (!request || request.status !== 'REQUESTED') return { ok: false, reason: 'REQUEST_NOT_AVAILABLE' };

  const fit = checkPoolFit({
    ride,
    members: ride.requests.map((r) => r.destinationArea),
    request: { pickupAreaId: request.pickupAreaId, seats: request.seats, destination: request.destinationArea },
  });
  if (!fit.ok) return fit;

  await tx.ride.update({ where: { id: rideId }, data: { seatsBooked: { increment: request.seats } } });
  await tx.rideRequest.update({
    where: { id: requestId },
    data: { status: 'MATCHED', rideId, matchedAt: new Date() },
  });
  await recordEvent(tx, {
    rideId,
    requestId,
    actorId,
    type: 'REQUEST_MATCHED',
    fromStatus: 'REQUESTED',
    toStatus: 'MATCHED',
    details: { via, seats: request.seats, seatsBookedAfter: ride.seatsBooked + request.seats, capacity: ride.capacity },
  });
  return { ok: true };
}

/**
 * Automatic matching, run when a passenger books: try each open ride from
 * the same pickup area, oldest first, until one has room.
 * Ascending id order also means every transaction locks rides in the same
 * order, so two of them can't deadlock.
 *
 * @returns the ride id joined, or null (the request keeps waiting).
 */
export async function autoMatch(tx, request) {
  const candidates = await tx.ride.findMany({
    where: { status: { in: OPEN_RIDE_STATUSES }, pickupAreaId: request.pickupAreaId },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  for (const { id } of candidates) {
    const result = await addRequestToRide(tx, {
      rideId: id,
      requestId: request.id,
      actorId: null, // done by the system
      via: 'AUTO_MATCH',
    });
    if (result.ok) return id;
  }
  return null;
}
