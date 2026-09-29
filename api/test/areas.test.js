import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, prisma, resetDatabase } from './helpers.js';

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /api/areas', () => {
  it('lists the predefined Dhaka areas', async () => {
    const res = await api().get('/api/areas');

    expect(res.status).toBe(200);
    expect(res.body.areas.map((a) => a.id)).toEqual(expect.arrayContaining(['banani', 'mohakhali', 'gulshan-1']));
  });
});

describe('GET /api/fares/estimate', () => {
  it("quotes Nusrat's trip solo and pooled", async () => {
    const res = await api().get('/api/fares/estimate').query({ pickupAreaId: 'banani', destinationAreaId: 'mohakhali' });

    expect(res.status).toBe(200);
    expect(res.body.estimate).toMatchObject({
      distanceM: 1900,
      seats: 1,
      solo: { farePaisa: 10700 },
      pooled: { farePaisa: 8025 },
    });
  });

  it('rejects unknown and identical areas', async () => {
    const unknown = await api().get('/api/fares/estimate').query({ pickupAreaId: 'banani', destinationAreaId: 'narnia' });
    const same = await api().get('/api/fares/estimate').query({ pickupAreaId: 'banani', destinationAreaId: 'banani' });

    expect(unknown.status).toBe(400);
    expect(same.status).toBe(400);
  });

  it('rejects more seats than Bullet has', async () => {
    const res = await api()
      .get('/api/fares/estimate')
      .query({ pickupAreaId: 'banani', destinationAreaId: 'mohakhali', seats: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
