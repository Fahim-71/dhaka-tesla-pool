// Shape database rows into API responses.
// Privacy rule: a passenger sees their own booking and how many people share
// the ride - never the other passengers' names, destinations or fares.
// The driver sees everyone in their own ride.
import { calculateFare } from '../../domain/fare.js';
import { passengerStatus } from '../../domain/lifecycle.js';

const area = (a) => a && { id: a.id, name: a.name };

const FARE_LOCKED_RIDE_STATUSES = ['STARTED', 'COMPLETED'];

function fareOf(request) {
  return {
    baseFarePaisa: request.baseFarePaisa,
    distanceChargePaisa: request.distanceChargePaisa,
    poolDiscountPaisa: request.poolDiscountPaisa,
    farePaisa: request.farePaisa,
  };
}

// Prisma `include` needed by toPassengerView.
export const passengerRequestInclude = {
  pickupArea: true,
  destinationArea: true,
  ride: {
    include: {
      vehicle: { include: { driver: true } },
      _count: { select: { requests: { where: { status: { in: ['MATCHED', 'COMPLETED'] } } } } },
    },
  },
};

export function toPassengerView(request) {
  const { ride } = request;
  // A request cancelled after matching keeps its ride_id for history,
  // but the passenger is no longer part of that ride.
  const inRide = Boolean(ride) && request.status !== 'CANCELLED';
  return {
    id: request.id,
    status: request.status,
    displayStatus: passengerStatus(request.status, ride?.status),
    pickup: area(request.pickupArea),
    destination: area(request.destinationArea),
    seats: request.seats,
    distanceM: request.distanceM,
    paymentMethod: request.paymentMethod,
    fare: {
      ...fareOf(request),
      // Final once the ride has started; before that it is the solo price.
      isFinal: request.status === 'COMPLETED' || (inRide && FARE_LOCKED_RIDE_STATUSES.includes(ride.status)),
    },
    quote: {
      solo: calculateFare({ distanceM: request.distanceM, seats: request.seats, pooled: false }).farePaisa,
      pooled: calculateFare({ distanceM: request.distanceM, seats: request.seats, pooled: true }).farePaisa,
    },
    ride: inRide
      ? {
          id: ride.id,
          status: ride.status,
          vehicle: { name: ride.vehicle.name, plateNumber: ride.vehicle.plateNumber },
          driver: { name: ride.vehicle.driver.name, phone: ride.vehicle.driver.phone },
          capacity: ride.capacity,
          seatsBooked: ride.seatsBooked,
          passengerCount: ride._count.requests,
        }
      : null,
    cancelReason: request.cancelReason,
    createdAt: request.createdAt,
    matchedAt: request.matchedAt,
    completedAt: request.completedAt,
    cancelledAt: request.cancelledAt,
    paidAt: request.paidAt,
  };
}

// Prisma `include` needed by toDriverRideView.
export const driverRideInclude = {
  pickupArea: true,
  vehicle: true,
  requests: {
    where: { status: { in: ['MATCHED', 'COMPLETED'] } },
    orderBy: { matchedAt: 'asc' },
    include: { passenger: true, destinationArea: true },
  },
};

export function toDriverRideView(ride) {
  const members = ride.requests.map((r) => ({
    requestId: r.id,
    status: r.status,
    passenger: { id: r.passenger.id, name: r.passenger.name, phone: r.passenger.phone },
    destination: area(r.destinationArea),
    seats: r.seats,
    distanceM: r.distanceM,
    paymentMethod: r.paymentMethod,
    fare: fareOf(r),
    matchedAt: r.matchedAt,
  }));
  return {
    id: ride.id,
    status: ride.status,
    pickup: area(ride.pickupArea),
    vehicle: { id: ride.vehicle.id, name: ride.vehicle.name, plateNumber: ride.vehicle.plateNumber },
    capacity: ride.capacity,
    seatsBooked: ride.seatsBooked,
    seatsFree: ride.capacity - ride.seatsBooked,
    members,
    isPooled: members.length >= 2,
    totalFarePaisa: members.reduce((sum, m) => sum + m.fare.farePaisa, 0),
    fareIsFinal: FARE_LOCKED_RIDE_STATUSES.includes(ride.status),
    createdAt: ride.createdAt,
    arrivedAt: ride.arrivedAt,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
    cancelledAt: ride.cancelledAt,
  };
}

export function toEventView(event) {
  return {
    id: Number(event.id),
    type: event.type,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    details: event.details,
    createdAt: event.createdAt,
  };
}
