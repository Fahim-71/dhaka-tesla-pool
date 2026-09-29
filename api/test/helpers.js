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
