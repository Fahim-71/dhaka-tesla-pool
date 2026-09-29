import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TRIPS, accept, api, goOnline, prisma, requestRide, resetDatabase, rideAction, tokenFor } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function viewOf(who, requestId) {
  const res = await api().get(`/api/ride-requests/${requestId}`).set('Authorization', await tokenFor(who));
  return res.body.request;
}

// 8:41 AM, Banani Road 11. Jashim is online; Nusrat books and he accepts.
async function nusratAccepted() {
  await goOnline('banani');
  const nusrat = (await requestRide('nusrat', TRIPS.nusrat)).body.request;
  const rideId = (await accept(nusrat.id)).body.activeRide.id;
  return { nusratId: nusrat.id, rideId };
}

describe('the Banani rush-hour story', () => {
  it('Rafiq is matched into Nusrat\'s Bullet automatically, and each pays their own pooled fare', async () => {
    const { nusratId, rideId } = await nusratAccepted();

    // Two minutes later, Rafiq books almost the same route.
    const rafiq = (await requestRide('rafiq', TRIPS.rafiq)).body.request;
    expect(rafiq).toMatchObject({ status: 'MATCHED', displayStatus: 'MATCHED', ride: { id: rideId, passengerCount: 2 } });

    await rideAction(rideId, 'arrive');
    const started = (await rideAction(rideId, 'start')).body.ride;

    // Jashim sees both passengers and every fare.
    expect(started.isPooled).toBe(true);
    expect(started.members.map((m) => [m.passenger.name, m.fare.farePaisa])).toEqual([
      ['Nusrat', 8025], // ৳80.25 = 10,700 - 25%
      ['Rafiq', 7800], //  ৳78.00 = 10,400 - 25%
    ]);
    expect(started.totalFarePaisa).toBe(15825);

    // Each passenger sees only their own fare and status.
    const nusratView = await viewOf('nusrat', nusratId);
    expect(nusratView.fare).toMatchObject({ farePaisa: 8025, poolDiscountPaisa: 2675, isFinal: true });
    expect(nusratView.displayStatus).toBe('IN_PROGRESS');
    expect(JSON.stringify(nusratView)).not.toContain('Rafiq');
    expect(JSON.stringify(nusratView)).not.toContain('7800');

    // Her timeline shows the ride's progress, but nothing about Rafiq's booking.
    expect(nusratView.events.map((e) => e.type)).toEqual([
      'REQUEST_CREATED',
      'REQUEST_MATCHED',
      'RIDE_STATUS_CHANGED', // driver arrived
      'FARE_LOCKED',
      'RIDE_STATUS_CHANGED', // started
    ]);

    const rafiqView = await viewOf('rafiq', rafiq.id);
    expect(rafiqView.fare).toMatchObject({ farePaisa: 7800, isFinal: true });
    expect(JSON.stringify(rafiqView)).not.toContain('Nusrat');
  });

  it('Shirin grabs the last seat thirty seconds later; a fourth passenger has to wait', async () => {
    const { rideId } = await nusratAccepted();
    await requestRide('rafiq', TRIPS.rafiq);

    const shirin = (await requestRide('shirin', { pickupAreaId: 'banani', destinationAreaId: 'gulshan-1', seats: 1 }))
      .body.request;
    expect(shirin.status).toBe('MATCHED');
    expect(await prisma.ride.findUnique({ where: { id: rideId } })).toMatchObject({ seatsBooked: 3, capacity: 3 });

    const tania = await api()
      .post('/api/auth/register')
      .send({ name: 'Tania', email: 'tania@example.com', password: 'longenough' });
    const late = await api()
      .post('/api/ride-requests')
      .set('Authorization', `Bearer ${tania.body.token}`)
      .send(TRIPS.rafiq);
    expect(late.body.request).toMatchObject({ status: 'REQUESTED', displayStatus: 'WAITING' });
  });

  it('a trip in a different direction does not join the pool', async () => {
    await nusratAccepted();
    const toUttara = (await requestRide('rafiq', { pickupAreaId: 'banani', destinationAreaId: 'uttara', seats: 1 })).body
      .request;
    expect(toUttara.status).toBe('REQUESTED');
  });

  it('a pool that has started is closed to new passengers', async () => {
    const { rideId } = await nusratAccepted();
    await rideAction(rideId, 'arrive');
    await rideAction(rideId, 'start');

    const rafiq = (await requestRide('rafiq', TRIPS.rafiq)).body.request;
    expect(rafiq.status).toBe('REQUESTED');
  });

  it('when one pooled passenger cancels, the other rides on and pays the solo fare', async () => {
    const { nusratId, rideId } = await nusratAccepted();
    const rafiq = (await requestRide('rafiq', TRIPS.rafiq)).body.request;

    await api().post(`/api/ride-requests/${nusratId}/cancel`).set('Authorization', await tokenFor('nusrat'));
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    expect(ride).toMatchObject({ status: 'ACCEPTED', seatsBooked: 1 });

    await rideAction(rideId, 'arrive');
    await rideAction(rideId, 'start');
    expect((await viewOf('rafiq', rafiq.id)).fare).toMatchObject({ farePaisa: 10400, poolDiscountPaisa: 0 });
  });
});

describe('the driver adds passengers from the feed', () => {
  it('Jashim adds a waiting passenger who fits his open ride', async () => {
    await goOnline('banani');
    // Both booked before any ride existed, so both are waiting.
    const nusrat = (await requestRide('nusrat', TRIPS.nusrat)).body.request;
    const rafiq = (await requestRide('rafiq', TRIPS.rafiq)).body.request;
    expect(rafiq.status).toBe('REQUESTED');

    await accept(nusrat.id);
    const feed = (await api().get('/api/driver/requests').set('Authorization', await tokenFor('jashim'))).body.requests;
    expect(feed[0]).toMatchObject({ id: rafiq.id, poolFit: { ok: true, joinsRide: true } });

    const res = await accept(rafiq.id);
    expect(res.status).toBe(200);
    expect(res.body.activeRide).toMatchObject({ seatsBooked: 2, isPooled: true });
  });

  it('refuses to add a passenger who does not fit', async () => {
    await goOnline('banani');
    const nusrat = (await requestRide('nusrat', TRIPS.nusrat)).body.request;
    const uttara = (await requestRide('rafiq', { pickupAreaId: 'banani', destinationAreaId: 'uttara', seats: 1 })).body
      .request;
    await accept(nusrat.id);

    const res = await accept(uttara.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'DOES_NOT_FIT_POOL', details: { reason: 'DESTINATION_TOO_FAR' } });
  });
});

describe("Bullet's capacity can never be exceeded", () => {
  it('the last seat: Nusrat and Shirin claim it at the same instant - exactly one gets it', async () => {
    // Rafiq has booked 2 of Bullet's 3 seats. One seat left.
    await goOnline('banani');
    const rafiq = (await requestRide('rafiq', { ...TRIPS.rafiq, seats: 2 })).body.request;
    const rideId = (await accept(rafiq.id)).body.activeRide.id;

    const [nusratToken, shirinToken] = await Promise.all([tokenFor('nusrat'), tokenFor('shirin')]);
    const [nusrat, shirin] = await Promise.all([
      api().post('/api/ride-requests').set('Authorization', nusratToken).send(TRIPS.nusrat),
      api().post('/api/ride-requests').set('Authorization', shirinToken).send(TRIPS.rafiq),
    ]);

    expect(nusrat.status).toBe(201);
    expect(shirin.status).toBe(201);
    const statuses = [nusrat.body.request.status, shirin.body.request.status].sort();
    expect(statuses).toEqual(['MATCHED', 'REQUESTED']); // one rides, one waits

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    expect(ride.seatsBooked).toBe(3);
    const seatsInRide = await prisma.rideRequest.aggregate({ where: { rideId, status: 'MATCHED' }, _sum: { seats: true } });
    expect(seatsInRide._sum.seats).toBe(3); // the counter agrees with the real passengers
  });

  it('holds under a crowd: 6 passengers race for 2 seats, repeated 5 times', async () => {
    for (let round = 0; round < 5; round += 1) {
      await resetDatabase();
      await goOnline('banani');
      const nusrat = (await requestRide('nusrat', TRIPS.nusrat)).body.request;
      const rideId = (await accept(nusrat.id)).body.activeRide.id;

      const tokens = await Promise.all(
        Array.from({ length: 6 }, async (_, i) => {
          const res = await api()
            .post('/api/auth/register')
            .send({ name: `Rider ${i}`, email: `rider${i}@example.com`, password: 'longenough' });
          return `Bearer ${res.body.token}`;
        }),
      );
      const results = await Promise.all(
        tokens.map((t) => api().post('/api/ride-requests').set('Authorization', t).send(TRIPS.rafiq)),
      );

      const matched = results.filter((r) => r.body.request?.status === 'MATCHED');
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(matched).toHaveLength(2);
      expect((await prisma.ride.findUnique({ where: { id: rideId } })).seatsBooked).toBe(3);
    }
  });

  it('the database itself refuses an overbooked ride, even if the API were bypassed', async () => {
    const { rideId } = await nusratAccepted();

    await expect(
      prisma.$executeRaw`UPDATE rides SET seats_booked = 4 WHERE id = ${rideId}`,
    ).rejects.toThrow(/rides_seats_booked_check/);
  });
});
