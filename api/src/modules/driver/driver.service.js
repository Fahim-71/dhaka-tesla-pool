import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { ACTIVE_RIDE_STATUSES } from '../../domain/lifecycle.js';
import { lockRequest, recordEvent } from '../rides/db-helpers.js';
import { driverRideInclude, toDriverRideView } from '../rides/views.js';

const isUniqueViolation = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export async function getVehicle(driverId, db = prisma) {
  const vehicle = await db.vehicle.findUnique({ where: { driverId }, include: { currentArea: true } });
  if (!vehicle) throw notFound('No Tesla is registered to this driver');
  return vehicle;
}

function findActiveRide(vehicleId, db = prisma) {
  return db.ride.findFirst({
    where: { vehicleId, status: { in: ACTIVE_RIDE_STATUSES } },
    include: driverRideInclude,
  });
}

function toVehicleView(vehicle) {
  return {
    id: vehicle.id,
    name: vehicle.name,
    plateNumber: vehicle.plateNumber,
    capacity: vehicle.capacity,
    isOnline: vehicle.isOnline,
    currentArea: vehicle.currentArea && { id: vehicle.currentArea.id, name: vehicle.currentArea.name },
  };
}

// Everything Jashim's screen needs: his Tesla and the ride he is on (if any).
export async function getDashboard(driverId) {
  const vehicle = await getVehicle(driverId);
  const activeRide = await findActiveRide(vehicle.id);
  return { vehicle: toVehicleView(vehicle), activeRide: activeRide ? toDriverRideView(activeRide) : null };
}

/** Go online in an area, or go offline. Can't go offline mid-ride. */
export async function setAvailability(driverId, { online, areaId }) {
  const vehicle = await getVehicle(driverId);

  if (!online && (await findActiveRide(vehicle.id))) {
    throw conflict('ACTIVE_RIDE', 'Finish or cancel your current ride before going offline');
  }
  if (areaId && !(await prisma.area.findUnique({ where: { id: areaId } }))) {
    throw badRequest('Unknown area');
  }

  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { isOnline: online, ...(areaId && { currentAreaId: areaId }) },
  });
  return getDashboard(driverId);
}

/**
 * The requests Jashim can accept: waiting, picking up in the area he is in,
 * oldest first (they have waited longest). Empty while he is offline.
 * Passengers only see their own data; the driver sees name + trip so he
 * knows who to pick up.
 */
export async function listWaitingRequests(driverId) {
  const vehicle = await getVehicle(driverId);
  if (!vehicle.isOnline || !vehicle.currentAreaId) return [];

  const requests = await prisma.rideRequest.findMany({
    where: { status: 'REQUESTED', pickupAreaId: vehicle.currentAreaId, seats: { lte: vehicle.capacity } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: { passenger: true, pickupArea: true, destinationArea: true },
  });

  return requests.map((r) => ({
    id: r.id,
    passenger: { name: r.passenger.name },
    pickup: { id: r.pickupArea.id, name: r.pickupArea.name },
    destination: { id: r.destinationArea.id, name: r.destinationArea.name },
    seats: r.seats,
    distanceM: r.distanceM,
    estimatedFarePaisa: r.farePaisa,
    createdAt: r.createdAt,
  }));
}

/**
 * Jashim accepts a waiting request. This creates a new ride (pool) for Bullet
 * with the passenger in it.
 */
export async function acceptRequest(driverId, requestId) {
  try {
    await prisma.$transaction(async (tx) => {
      const vehicle = await getVehicle(driverId, tx);
      if (!vehicle.isOnline) {
        throw conflict('DRIVER_OFFLINE', 'Go online before accepting rides');
      }
      if (await findActiveRide(vehicle.id, tx)) {
        throw conflict('ACTIVE_RIDE', 'Finish or cancel your current ride first');
      }

      await lockRequest(tx, requestId);
      const request = await tx.rideRequest.findUnique({ where: { id: requestId } });
      if (!request) throw notFound('Ride request not found');
      if (request.status !== 'REQUESTED') {
        throw conflict('REQUEST_NOT_AVAILABLE', 'This request has already been taken or cancelled');
      }
      if (request.pickupAreaId !== vehicle.currentAreaId) {
        throw conflict('WRONG_AREA', 'This passenger is waiting in a different area');
      }
      if (request.seats > vehicle.capacity) {
        throw conflict('NOT_ENOUGH_SEATS', `${vehicle.name} only has ${vehicle.capacity} seats`);
      }

      const ride = await tx.ride.create({
        data: {
          vehicleId: vehicle.id,
          pickupAreaId: request.pickupAreaId,
          capacity: vehicle.capacity,
          seatsBooked: request.seats,
        },
      });
      await tx.rideRequest.update({
        where: { id: requestId },
        data: { status: 'MATCHED', rideId: ride.id, matchedAt: new Date() },
      });

      await recordEvent(tx, {
        rideId: ride.id,
        actorId: driverId,
        type: 'RIDE_ACCEPTED',
        toStatus: 'ACCEPTED',
        details: { vehicle: vehicle.name, capacity: vehicle.capacity },
      });
      await recordEvent(tx, {
        rideId: ride.id,
        requestId,
        actorId: driverId,
        type: 'REQUEST_MATCHED',
        fromStatus: 'REQUESTED',
        toStatus: 'MATCHED',
        details: { via: 'DRIVER_ACCEPTED', seats: request.seats },
      });
    });
  } catch (err) {
    // Two accepts at the same moment: the "one active ride per vehicle"
    // index lets only one through.
    if (isUniqueViolation(err)) {
      throw conflict('ACTIVE_RIDE', 'Finish or cancel your current ride first');
    }
    throw err;
  }
  return getDashboard(driverId);
}

// Past rides, newest first.
export async function listRideHistory(driverId) {
  const vehicle = await getVehicle(driverId);
  const rides = await prisma.ride.findMany({
    where: { vehicleId: vehicle.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: driverRideInclude,
  });
  return rides.map(toDriverRideView);
}
