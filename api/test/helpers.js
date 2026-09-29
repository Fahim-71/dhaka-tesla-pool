import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { CAST, DEMO_PASSWORD, seed } from '../prisma/seed.js';

export const app = createApp();
export const api = () => request(app);

// Empty every table and re-seed the story cast, so each test starts from the
// same known state: Jashim offline with Bullet (3 seats) in Banani,
// Nusrat / Rafiq / Shirin with no rides.
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE ride_events, ride_requests, rides, vehicles, users, areas RESTART IDENTITY CASCADE',
  );
  await seed(prisma);
}

// Log in as a cast member ('jashim' | 'nusrat' | 'rafiq' | 'shirin') and
// return the Authorization header value.
export async function tokenFor(who) {
  const res = await api().post('/api/auth/login').send({ email: CAST[who].email, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${who}: ${res.status}`);
  return `Bearer ${res.body.token}`;
}

export { prisma, CAST, DEMO_PASSWORD };

// Story helpers, so tests read like the brief.
export async function goOnline(areaId = 'banani') {
  const res = await api()
    .patch('/api/driver/availability')
    .set('Authorization', await tokenFor('jashim'))
    .send({ online: true, areaId });
  if (res.status !== 200) throw new Error(`Jashim could not go online: ${res.status}`);
  return res.body;
}

export async function requestRide(who, trip) {
  return api().post('/api/ride-requests').set('Authorization', await tokenFor(who)).send(trip);
}

export async function accept(requestId) {
  return api().post(`/api/driver/requests/${requestId}/accept`).set('Authorization', await tokenFor('jashim'));
}

export async function rideAction(rideId, action, who = 'jashim') {
  return api().post(`/api/rides/${rideId}/${action}`).set('Authorization', await tokenFor(who));
}

export const TRIPS = {
  nusrat: { pickupAreaId: 'banani', destinationAreaId: 'mohakhali', seats: 1 },
  rafiq: { pickupAreaId: 'banani', destinationAreaId: 'gulshan-1', seats: 1 },
};
