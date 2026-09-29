import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TRIPS, accept, api, goOnline, prisma, requestRide, resetDatabase, rideAction, tokenFor } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Nusrat requests, Jashim (online in Banani) accepts. Returns the ids.
async function nusratInBullet() {
  await goOnline('banani');
  const { body } = await requestRide('nusrat', TRIPS.nusrat);
  const accepted = await accept(body.request.id);
  expect(accepted.status).toBe(200);
  return { requestId: body.request.id, rideId: accepted.body.activeRide.id };
}

async function nusratView(requestId) {
  const res = await api().get(`/api/ride-requests/${requestId}`).set('Authorization', await tokenFor('nusrat'));
  return res.body.request;
}

describe('driver availability', () => {
  it('Jashim goes online in Banani', async () => {
    const dashboard = await goOnline('banani');
    expect(dashboard.vehicle).toMatchObject({ name: 'Bullet', capacity: 3, isOnline: true, currentArea: { id: 'banani' } });
    expect(dashboard.activeRide).toBeNull();
  });

  it('sees waiting requests in his area only, and none while offline', async () => {
    const jashim = await tokenFor('jashim');
    await requestRide('nusrat', TRIPS.nusrat);
    await requestRide('shirin', { pickupAreaId: 'dhanmondi', destinationAreaId: 'farmgate', seats: 1 });

    expect((await api().get('/api/driver/requests').set('Authorization', jashim)).body.requests).toEqual([]);

    await goOnline('banani');
    const feed = (await api().get('/api/driver/requests').set('Authorization', jashim)).body.requests;
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ passenger: { name: 'Nusrat' }, destination: { id: 'mohakhali' } });
  });

  it('cannot accept while offline', async () => {
    const { body } = await requestRide('nusrat', TRIPS.nusrat);
    const res = await accept(body.request.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DRIVER_OFFLINE');
  });

  it('cannot go offline in the middle of a ride', async () => {
    await nusratInBullet();
    const res = await api()
      .patch('/api/driver/availability')
      .set('Authorization', await tokenFor('jashim'))
      .send({ online: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_RIDE');
  });

  it('driver endpoints are for drivers only', async () => {
    const res = await api().get('/api/driver/me').set('Authorization', await tokenFor('nusrat'));
    expect(res.status).toBe(403);
  });
});

describe('accepting a request', () => {
  it('creates a ride for Bullet with Nusrat in it', async () => {
    const { requestId, rideId } = await nusratInBullet();

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    expect(ride).toMatchObject({ status: 'ACCEPTED', capacity: 3, seatsBooked: 1 });
    expect(await nusratView(requestId)).toMatchObject({
      status: 'MATCHED',
      displayStatus: 'MATCHED',
      ride: { vehicle: { name: 'Bullet' }, driver: { name: 'Jashim' }, passengerCount: 1 },
    });
  });

  it('cannot take a request that was already cancelled', async () => {
    await goOnline('banani');
    const { body } = await requestRide('nusrat', TRIPS.nusrat);
    await api().post(`/api/ride-requests/${body.request.id}/cancel`).set('Authorization', await tokenFor('nusrat'));

    const res = await accept(body.request.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REQUEST_NOT_AVAILABLE');
  });

  it('cannot take a request from another area', async () => {
    await goOnline('dhanmondi');
    const { body } = await requestRide('nusrat', TRIPS.nusrat);
    expect((await accept(body.request.id)).body.error.code).toBe('WRONG_AREA');
  });
});

describe('ride lifecycle', () => {
  it('ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED, and Nusrat sees each step', async () => {
    const { requestId, rideId } = await nusratInBullet();

    expect((await rideAction(rideId, 'arrive')).body.ride.status).toBe('DRIVER_ARRIVED');
    expect((await nusratView(requestId)).displayStatus).toBe('DRIVER_ARRIVED');

    expect((await rideAction(rideId, 'start')).body.ride.status).toBe('STARTED');
    const inProgress = await nusratView(requestId);
    expect(inProgress.displayStatus).toBe('IN_PROGRESS');
    // Alone in Bullet: no pool discount. 5,000 + 1,900 x 3 = 10,700.
    expect(inProgress.fare).toMatchObject({ farePaisa: 10700, poolDiscountPaisa: 0, isFinal: true });

    expect((await rideAction(rideId, 'complete')).body.ride.status).toBe('COMPLETED');
    const done = await nusratView(requestId);
    expect(done).toMatchObject({ status: 'COMPLETED', displayStatus: 'COMPLETED' });
    expect(done.paidAt).not.toBeNull();

    const ride = (await api().get(`/api/rides/${rideId}`).set('Authorization', await tokenFor('jashim'))).body.ride;
    expect(ride.events.map((e) => e.toStatus ?? e.type)).toEqual([
      'ACCEPTED',
      'MATCHED',
      'DRIVER_ARRIVED',
      'FARE_LOCKED',
      'STARTED',
      'COMPLETED',
    ]);
  });

  it.each([
    ['start', 'before arriving'],
    ['complete', 'before starting'],
  ])('rejects %s %s', async (action) => {
    const { rideId } = await nusratInBullet();
    const res = await rideAction(rideId, action);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('rejects starting twice and anything after completion', async () => {
    const { rideId } = await nusratInBullet();
    await rideAction(rideId, 'arrive');
    await rideAction(rideId, 'start');

    expect((await rideAction(rideId, 'start')).status).toBe(409);
    expect((await rideAction(rideId, 'cancel')).status).toBe(409); // passengers are in the car

    await rideAction(rideId, 'complete');
    expect((await rideAction(rideId, 'arrive')).status).toBe(409);
    expect((await prisma.ride.findUnique({ where: { id: rideId } })).status).toBe('COMPLETED');
  });

  it('a passenger cannot drive the ride', async () => {
    const { rideId } = await nusratInBullet();
    expect((await rideAction(rideId, 'arrive', 'nusrat')).status).toBe(403);
  });
});

describe('cancellation rules', () => {
  it('Nusrat cancels after matching: seat released, empty ride cancelled, Jashim is free', async () => {
    const { requestId, rideId } = await nusratInBullet();

    const res = await api().post(`/api/ride-requests/${requestId}/cancel`).set('Authorization', await tokenFor('nusrat'));

    expect(res.status).toBe(200);
    expect(await prisma.ride.findUnique({ where: { id: rideId } })).toMatchObject({ status: 'CANCELLED', seatsBooked: 0 });
    const dashboard = (await api().get('/api/driver/me').set('Authorization', await tokenFor('jashim'))).body;
    expect(dashboard.activeRide).toBeNull();
  });

  it('Nusrat cannot cancel once the ride has started', async () => {
    const { requestId, rideId } = await nusratInBullet();
    await rideAction(rideId, 'arrive');
    await rideAction(rideId, 'start');

    const res = await api().post(`/api/ride-requests/${requestId}/cancel`).set('Authorization', await tokenFor('nusrat'));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_CANCEL');
  });

  it('Jashim cancels before pickup: Nusrat goes back to waiting, not lost', async () => {
    const { requestId, rideId } = await nusratInBullet();

    expect((await rideAction(rideId, 'cancel')).status).toBe(200);

    const view = await nusratView(requestId);
    expect(view).toMatchObject({ status: 'REQUESTED', displayStatus: 'WAITING', ride: null });
    expect(view.events.map((e) => e.type)).toContain('REQUEST_REQUEUED');
    // ...and she is back in the feed for the next Tesla.
    const feed = (await api().get('/api/driver/requests').set('Authorization', await tokenFor('jashim'))).body.requests;
    expect(feed.map((r) => r.id)).toEqual([requestId]);
  });
});
