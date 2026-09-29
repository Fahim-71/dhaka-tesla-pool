// Seed data: the Dhaka areas and the story cast.
//
// Safe to run many times (it runs on every container start): everything is an
// upsert keyed on a natural unique value (area id, email, plate number), so a
// restart never duplicates people or wipes rides that already happened.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DHAKA_AREAS } from '../src/domain/areas.js';
import { calculateFare } from '../src/domain/fare.js';

const prisma = new PrismaClient();

// Demo password for every seeded account (listed in the README).
export const DEMO_PASSWORD = 'teslapool123';

export const CAST = {
  jashim: { name: 'Jashim', email: 'jashim@teslapool.test', phone: '+8801700000001', role: 'DRIVER' },
  nusrat: { name: 'Nusrat', email: 'nusrat@teslapool.test', phone: '+8801700000002', role: 'PASSENGER' },
  rafiq: { name: 'Rafiq', email: 'rafiq@teslapool.test', phone: '+8801700000003', role: 'PASSENGER' },
  shirin: { name: 'Shirin', email: 'shirin@teslapool.test', phone: '+8801700000004', role: 'PASSENGER' },
};

export const BULLET = { name: 'Bullet', plateNumber: 'DHAKA-METRO-THA-11-2024', capacity: 3 };

/**
 * @param options.demoHistory also add yesterday's completed pooled ride, so
 *        the history screens aren't empty in a demo. Tests turn this off.
 */
export async function seed(client = prisma, { demoHistory = false } = {}) {
  for (const area of DHAKA_AREAS) {
    await client.area.upsert({ where: { id: area.id }, update: area, create: area });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const [key, person] of Object.entries(CAST)) {
    users[key] = await client.user.upsert({
      where: { email: person.email },
      update: { name: person.name, phone: person.phone, role: person.role },
      create: { ...person, passwordHash },
    });
  }

  // Bullet starts offline in Banani. On re-seed only the fixed facts are
  // updated - never isOnline, so a restart doesn't knock Jashim offline.
  const bullet = await client.vehicle.upsert({
    where: { plateNumber: BULLET.plateNumber },
    update: { name: BULLET.name, capacity: BULLET.capacity, driverId: users.jashim.id },
    create: { ...BULLET, driverId: users.jashim.id, currentAreaId: 'banani' },
  });

  if (demoHistory && (await client.ride.count()) === 0) {
    await seedYesterdaysRide(client, users, bullet);
  }

  return users;
}

// Yesterday, 8:41 AM: Nusrat (-> Mohakhali) and Rafiq (-> Gulshan 1) shared
// Bullet from Banani. Built with the real fare function, so the numbers are
// exactly what the app would have charged: ৳80.25 and ৳78.00.
async function seedYesterdaysRide(client, users, bullet) {
  // Yesterday at hh:mm Dhaka time (UTC+6), whatever the server's time zone.
  const at = (hh, mm) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(hh - 6, mm, 0, 0);
    return d;
  };
  const trips = [
    { passenger: users.nusrat, destinationAreaId: 'mohakhali', distanceM: 1900, requestedAt: at(8, 41), matchedAt: at(8, 42) },
    { passenger: users.rafiq, destinationAreaId: 'gulshan-1', distanceM: 1800, requestedAt: at(8, 43), matchedAt: at(8, 43) },
  ];

  const ride = await client.ride.create({
    data: {
      vehicleId: bullet.id,
      pickupAreaId: 'banani',
      capacity: bullet.capacity,
      seatsBooked: 2,
      status: 'COMPLETED',
      createdAt: at(8, 42),
      arrivedAt: at(8, 47),
      startedAt: at(8, 49),
      completedAt: at(9, 6),
    },
  });

  const events = [
    { rideId: ride.id, actorId: users.jashim.id, type: 'RIDE_ACCEPTED', toStatus: 'ACCEPTED', createdAt: at(8, 42) },
  ];
  for (const [index, trip] of trips.entries()) {
    const fare = calculateFare({ distanceM: trip.distanceM, seats: 1, pooled: true });
    const request = await client.rideRequest.create({
      data: {
        passengerId: trip.passenger.id,
        rideId: ride.id,
        pickupAreaId: 'banani',
        destinationAreaId: trip.destinationAreaId,
        seats: 1,
        distanceM: trip.distanceM,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        ...fare,
        createdAt: trip.requestedAt,
        matchedAt: trip.matchedAt,
        completedAt: at(9, 6),
        paidAt: at(9, 6),
      },
    });
    events.push(
      {
        requestId: request.id,
        actorId: trip.passenger.id,
        type: 'REQUEST_CREATED',
        toStatus: 'REQUESTED',
        createdAt: trip.requestedAt,
      },
      {
        rideId: ride.id,
        requestId: request.id,
        actorId: index === 0 ? users.jashim.id : null,
        type: 'REQUEST_MATCHED',
        fromStatus: 'REQUESTED',
        toStatus: 'MATCHED',
        // Jashim accepted Nusrat; Rafiq was matched into the ride automatically.
        details: { via: index === 0 ? 'DRIVER_ACCEPTED' : 'AUTO_MATCH', seats: 1 },
        createdAt: trip.matchedAt,
      },
      {
        rideId: ride.id,
        requestId: request.id,
        type: 'FARE_LOCKED',
        details: { ...fare, pooled: true, passengersInRide: 2 },
        createdAt: at(8, 49),
      },
    );
  }
  const statusChange = (fromStatus, toStatus, createdAt) => ({
    rideId: ride.id,
    actorId: users.jashim.id,
    type: 'RIDE_STATUS_CHANGED',
    fromStatus,
    toStatus,
    createdAt,
  });
  events.push(
    statusChange('ACCEPTED', 'DRIVER_ARRIVED', at(8, 47)),
    statusChange('DRIVER_ARRIVED', 'STARTED', at(8, 49)),
    statusChange('STARTED', 'COMPLETED', at(9, 6)),
  );
  // Keep the timeline in time order.
  events.sort((a, b) => a.createdAt - b.createdAt);
  await client.rideEvent.createMany({ data: events });
}

// Run directly: `node prisma/seed.js`
const isRunDirectly = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isRunDirectly) {
  seed(prisma, { demoHistory: true })
    .then(() => console.log('Seed complete: areas, Jashim + Bullet, Nusrat, Rafiq, Shirin'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
