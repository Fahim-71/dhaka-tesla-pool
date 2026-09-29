// Small helpers used inside transactions by the ride services.
//
// LOCK ORDER - always lock the ride before any of its requests. Every code
// path follows this order, so two transactions can never each hold a lock the
// other one is waiting for (deadlock).

/** Row-lock a ride until the transaction ends. Other lockers wait. */
export async function lockRide(tx, rideId) {
  const rows = await tx.$queryRaw`SELECT id FROM rides WHERE id = ${rideId} FOR UPDATE`;
  return rows.length === 1;
}

/** Row-lock a ride request until the transaction ends. */
export async function lockRequest(tx, requestId) {
  const rows = await tx.$queryRaw`SELECT id FROM ride_requests WHERE id = ${requestId} FOR UPDATE`;
  return rows.length === 1;
}

/**
 * Append to the audit log. Written in the same transaction as the change it
 * describes, so the history can never disagree with the data.
 */
export function recordEvent(tx, { rideId, requestId, actorId, type, fromStatus, toStatus, details }) {
  return tx.rideEvent.create({
    data: { rideId, requestId, actorId, type, fromStatus, toStatus, details },
  });
}
