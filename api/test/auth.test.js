import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, CAST, DEMO_PASSWORD, prisma, resetDatabase, tokenFor } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/register', () => {
  it('creates a passenger account and returns a token', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Tania', email: 'Tania@Example.com', phone: '01711234567', password: 'longenough' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Tania', email: 'tania@example.com', role: 'PASSENGER' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('never lets someone sign up as a driver', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Fake Driver', email: 'fake@example.com', password: 'longenough', role: 'DRIVER' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('PASSENGER');
  });

  it('rejects an email that is already used', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Nusrat Again', email: CAST.nusrat.email, password: 'longenough' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('explains which fields are invalid', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'N', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  it('logs Jashim in as a driver', async () => {
    const res = await api().post('/api/auth/login').send({ email: CAST.jashim.email, password: DEMO_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Jashim', role: 'DRIVER' });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await api().post('/api/auth/login').send({ email: CAST.nusrat.email, password: 'nope-nope' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', await tokenFor('rafiq'));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Rafiq', role: 'PASSENGER' });
  });

  it('rejects missing and tampered tokens', async () => {
    const token = await tokenFor('rafiq');

    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', `${token}x`)).status).toBe(401);
  });
});
