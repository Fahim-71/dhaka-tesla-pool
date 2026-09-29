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

export async function seed(client = prisma) {
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
  await client.vehicle.upsert({
    where: { plateNumber: BULLET.plateNumber },
    update: { name: BULLET.name, capacity: BULLET.capacity, driverId: users.jashim.id },
    create: { ...BULLET, driverId: users.jashim.id, currentAreaId: 'banani' },
  });

  return users;
}

// Run directly: `node prisma/seed.js`
const isRunDirectly = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isRunDirectly) {
  seed()
    .then(() => console.log('Seed complete: areas, Jashim + Bullet, Nusrat, Rafiq, Shirin'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
