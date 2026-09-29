import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, prisma, resetDatabase, tokenFor } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const nusratTrip = { pickupAreaId: 'banani', destinationAreaId: 'mohakhali', seats: 1 };

async function request(who, trip = nusratTrip) {
  return api().post('/api/ride-requests').set('Authorization', await tokenFor(who)).send(trip);
}

describe('POST /api/ride-requests', () => {
  it('Nusrat requests Banani -> Mohakhali and is waiting, with the solo fare as estimate', async () => {
    const res = await request('nusrat');

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({
      status: 'REQUESTED',
      displayStatus: 'WAITING',
      pickup: { id: 'banani' },
      destination: { id: 'mohakhali' },
      distanceM: 1900,
      paymentMethod: 'CASH',
      fare: { farePaisa: 10700, isFinal: false },
      quote: { solo: 10700, pooled: 8025 },
      ride: null,
    });
    expect(res.body.request.events.map((e) => e.type)).toEqual(['REQUEST_CREATED']);
  });

  it('allows only one active request per passenger', async () => {
    await request('nusrat');
    const second = await request('nusrat', { pickupAreaId: 'banani', destinationAreaId: 'gulshan-1' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_REQUEST_EXISTS');
  });

  it('a double-click (two identical requests at once) creates only one request', async () => {
    const token = await tokenFor('nusrat');
    const [a, b] = await Promise.all([
      api().post('/api/ride-requests').set('Authorization', token).send(nusratTrip),
      api().post('/api/ride-requests').set('Authorization', token).send(nusratTrip),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.rideRequest.count()).toBe(1);
  });

  it('validates the trip', async () => {
    expect((await request('nusrat', { ...nusratTrip, seats: 4 })).status).toBe(400);
    expect((await request('nusrat', { ...nusratTrip, destinationAreaId: 'banani' })).status).toBe(400);
    expect((await request('nusrat', { ...nusratTrip, pickupAreaId: 'narnia' })).status).toBe(400);
  });

  it('is for passengers only', async () => {
    const res = await request('jashim');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/ride-requests/:id/cancel', () => {
  it('Nusrat can cancel while waiting, and then book again', async () => {
    const created = await request('nusrat');
    const token = await tokenFor('nusrat');

    const res = await api().post(`/api/ride-requests/${created.body.request.id}/cancel`).set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: 'CANCELLED', displayStatus: 'CANCELLED' });
    expect(res.body.request.events.map((e) => e.type)).toEqual(['REQUEST_CREATED', 'REQUEST_CANCELLED']);
    expect((await request('nusrat')).status).toBe(201);
  });

  it('cannot cancel twice', async () => {
    const created = await request('nusrat');
    const token = await tokenFor('nusrat');
    await api().post(`/api/ride-requests/${created.body.request.id}/cancel`).set('Authorization', token);

    const again = await api().post(`/api/ride-requests/${created.body.request.id}/cancel`).set('Authorization', token);

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe("users can't see or change another user's ride", () => {
  it("Rafiq cannot view or cancel Nusrat's request", async () => {
    const created = await request('nusrat');
    const id = created.body.request.id;
    const rafiq = await tokenFor('rafiq');

    const view = await api().get(`/api/ride-requests/${id}`).set('Authorization', rafiq);
    const cancel = await api().post(`/api/ride-requests/${id}/cancel`).set('Authorization', rafiq);

    expect(view.status).toBe(404);
    expect(cancel.status).toBe(404);
    const stored = await prisma.rideRequest.findUnique({ where: { id } });
    expect(stored.status).toBe('REQUESTED');
  });

  it("Rafiq's history does not include Nusrat's request", async () => {
    await request('nusrat');
    const res = await api().get('/api/ride-requests').set('Authorization', await tokenFor('rafiq'));

    expect(res.status).toBe(200);
    expect(res.body.requests).toEqual([]);
  });
});

describe('GET /api/ride-requests/active', () => {
  it('returns the current request, or null', async () => {
    const token = await tokenFor('shirin');
    expect((await api().get('/api/ride-requests/active').set('Authorization', token)).body.request).toBeNull();

    await request('shirin', { pickupAreaId: 'banani', destinationAreaId: 'gulshan-1', seats: 2 });
    const res = await api().get('/api/ride-requests/active').set('Authorization', token);

    expect(res.body.request).toMatchObject({ seats: 2, displayStatus: 'WAITING' });
  });
});
