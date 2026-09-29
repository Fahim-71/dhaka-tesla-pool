import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/errors.js';
import { tripDistanceMetres } from '../../domain/geo.js';
import { calculateFare } from '../../domain/fare.js';

export function listAreas() {
  return prisma.area.findMany({ orderBy: { name: 'asc' } });
}

/**
 * Load the pickup and destination areas and the distance between them.
 * Throws 400 for unknown or identical areas.
 * `db` can be a transaction client so this runs inside a transaction.
 */
export async function resolveTrip({ pickupAreaId, destinationAreaId }, db = prisma) {
  if (pickupAreaId === destinationAreaId) {
    throw badRequest('Pickup and destination must be different areas');
  }
  const areas = await db.area.findMany({ where: { id: { in: [pickupAreaId, destinationAreaId] } } });
  const pickup = areas.find((a) => a.id === pickupAreaId);
  const destination = areas.find((a) => a.id === destinationAreaId);
  if (!pickup || !destination) {
    throw badRequest('Unknown pickup or destination area');
  }
  return { pickup, destination, distanceM: tripDistanceMetres(pickup, destination) };
}

// What the passenger sees before booking: the solo price and the pooled price.
export async function estimateFare({ pickupAreaId, destinationAreaId, seats }) {
  const { pickup, destination, distanceM } = await resolveTrip({ pickupAreaId, destinationAreaId });
  return {
    pickup,
    destination,
    distanceM,
    seats,
    solo: calculateFare({ distanceM, seats, pooled: false }),
    pooled: calculateFare({ distanceM, seats, pooled: true }),
  };
}
