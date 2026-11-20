// server/tests/server.test.js — the API against a real MongoDB (mongodb-memory-server) through Mongoose 8.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Profile, Swipe } from '../src/models.js';
import { PROFILES_SEED } from '../src/profilesSeed.js';

const ORIGIN = 'http://localhost:5173';
let mongod;
let app;
let profiles; // in deck order, with ids

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Profile.init();
  await Swipe.init(); // builds the unique indexes before the first test
  app = createApp({ Profile, Swipe, clientOrigin: ORIGIN });
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Swipe.deleteMany({});
  await Profile.deleteMany({});
  await Profile.insertMany(PROFILES_SEED.map((p, order) => ({ ...p, order })));
  profiles = (await request(app).get('/api/profiles')).body;
});

const swipe = (index, action = 'LIKE') => request(app).post('/api/swipes').send({ profileId: profiles[index].id, action });

describe('GET /api/profiles', () => {
  it('returns the deck in order with plain fields (no _id, no __v)', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.name)).toEqual(PROFILES_SEED.map((p) => p.name));
    expect(Object.keys(res.body[0]).sort()).toEqual(['age', 'bio', 'id', 'name']);
  });
});

describe('POST /api/swipes', () => {
  it('records a swipe and answers 201 with the stored record', async () => {
    const res = await swipe(0, 'LIKE');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ profileId: profiles[0].id, action: 'LIKE' });
    expect(res.body.id).toMatch(/^[0-9a-f]{24}$/);
    expect(await Swipe.countDocuments()).toBe(1);
  });

  it('accepts all three actions', async () => {
    for (const [i, action] of ['PASS', 'LIKE', 'SUPER'].entries()) {
      expect((await swipe(i, action)).status).toBe(201);
    }
  });

  it('rejects an unknown action with 400 and says which field', async () => {
    const res = await swipe(0, 'LOVE');
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('action');
    expect(await Swipe.countDocuments()).toBe(0);
  });

  it.each([
    ['a missing profileId', { action: 'LIKE' }],
    ['a profileId that is not an id', { profileId: 'abc', action: 'LIKE' }],
    ['a profileId that is a number', { profileId: 12, action: 'LIKE' }],
    ['a profileId that is an operator object', { profileId: { $ne: null }, action: 'LIKE' }],
    ['an action that is an array', { profileId: '0'.repeat(24), action: ['LIKE'] }],
    ['an empty body', {}],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/swipes').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('answers 404 for a well-formed id that is not a profile', async () => {
    const res = await request(app).post('/api/swipes').send({ profileId: '0'.repeat(24), action: 'LIKE' });
    expect(res.status).toBe(404);
  });

  it('refuses a card that is not the next one (409) so the history stays a prefix of the deck', async () => {
    const res = await swipe(3);
    expect(res.status).toBe(409);
    expect(await Swipe.countDocuments()).toBe(0);
  });

  it('refuses the same card twice (409), as a repeated key or a double click would send it', async () => {
    expect((await swipe(0)).status).toBe(201);
    expect((await swipe(0)).status).toBe(409);
    expect(await Swipe.countDocuments()).toBe(1);
  });

  it('two requests for the same card at once record it once', async () => {
    const [a, b] = await Promise.all([swipe(0), swipe(0)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await Swipe.countDocuments()).toBe(1);
  });

  it('ignores fields the client has no right to set (id, createdAt, extra keys)', async () => {
    const forged = { _id: 'f'.repeat(24), id: 'x', createdAt: '2000-01-01T00:00:00.000Z', isAdmin: true, profileId: profiles[0].id, action: 'LIKE' };
    const res = await request(app).post('/api/swipes').send(forged);
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe('f'.repeat(24));
    expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThanOrEqual(new Date().getFullYear());
    const stored = await Swipe.findOne().lean();
    expect(stored).not.toHaveProperty('isAdmin');
  });

  it('answers 400 for a body that is not JSON and 413 for a body over 10 kb', async () => {
    const bad = await request(app).post('/api/swipes').set('Content-Type', 'application/json').send('{"profileId":');
    expect(bad.status).toBe(400);
    const big = await request(app).post('/api/swipes').send({ profileId: profiles[0].id, action: 'LIKE', pad: 'x'.repeat(20000) });
    expect(big.status).toBe(413);
  });
});

describe('the models themselves (a second line of defence behind the API checks)', () => {
  it('Swipe refuses an action that is not in the list, even when the API is bypassed', async () => {
    await expect(Swipe.create({ profileId: profiles[0].id, action: 'LOVE' })).rejects.toThrow(/validation failed/);
  });

  it('Swipe refuses a second record for the same profile (unique index)', async () => {
    await Swipe.create({ profileId: profiles[0].id, action: 'LIKE' });
    await expect(Swipe.create({ profileId: profiles[0].id, action: 'PASS' })).rejects.toMatchObject({ code: 11000 });
  });

  it('Profile refuses a minor, a missing name and an over-long bio', async () => {
    const ok = { name: 'Test', age: 30, bio: 'Hi', order: 99 };
    await expect(Profile.create({ ...ok, age: 17 })).rejects.toThrow(/validation failed/);
    await expect(Profile.create({ ...ok, name: '' })).rejects.toThrow(/validation failed/);
    await expect(Profile.create({ ...ok, bio: 'x'.repeat(281) })).rejects.toThrow(/validation failed/);
    await expect(Profile.create(ok)).resolves.toBeTruthy();
  });
});

describe('GET /api/swipes', () => {
  it('returns the history oldest first', async () => {
    await swipe(0, 'PASS');
    await swipe(1, 'LIKE');
    await swipe(2, 'SUPER');
    const res = await request(app).get('/api/swipes');
    expect(res.body.map((s) => s.action)).toEqual(['PASS', 'LIKE', 'SUPER']);
    expect(res.body.map((s) => s.profileId)).toEqual([profiles[0].id, profiles[1].id, profiles[2].id]);
  });
});

describe('DELETE /api/swipes/:id (LIFO undo)', () => {
  it('removes the latest swipe and then the one before it', async () => {
    const first = (await swipe(0)).body;
    const second = (await swipe(1)).body;
    expect((await request(app).delete(`/api/swipes/${second.id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/swipes/${first.id}`)).status).toBe(200);
    expect(await Swipe.countDocuments()).toBe(0);
  });

  it('refuses to remove a swipe that is not the latest (409) and keeps both', async () => {
    const first = (await swipe(0)).body;
    await swipe(1);
    const res = await request(app).delete(`/api/swipes/${first.id}`);
    expect(res.status).toBe(409);
    expect(await Swipe.countDocuments()).toBe(2);
  });

  it('frees the card again after an undo, so it can be swiped with another action', async () => {
    const first = (await swipe(0, 'LIKE')).body;
    await request(app).delete(`/api/swipes/${first.id}`);
    const again = await swipe(0, 'PASS');
    expect(again.status).toBe(201);
    expect(again.body.action).toBe('PASS');
  });

  it('answers 404 for an unknown id and 400 for a malformed one', async () => {
    await swipe(0);
    expect((await request(app).delete(`/api/swipes/${'0'.repeat(24)}`)).status).toBe(404);
    expect((await request(app).delete('/api/swipes/not-an-id')).status).toBe(400);
  });

  it('answers 404 when there is nothing to undo', async () => {
    expect((await request(app).delete(`/api/swipes/${'0'.repeat(24)}`)).status).toBe(404);
  });
});

describe('DELETE /api/swipes (start over)', () => {
  it('clears the history and answers 204', async () => {
    await swipe(0);
    await swipe(1);
    expect((await request(app).delete('/api/swipes')).status).toBe(204);
    expect(await Swipe.countDocuments()).toBe(0);
  });
});

describe('CORS, unknown routes and errors', () => {
  it('allows the configured origin, and only that one', async () => {
    const ok = await request(app).get('/api/profiles').set('Origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const other = await request(app).get('/api/profiles').set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).toBe(ORIGIN); // never echoes the caller, never '*'
    expect(other.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('answers the preflight for DELETE', async () => {
    const res = await request(app).options('/api/swipes/abc').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'DELETE');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });

  it('answers 404 with JSON for an unknown route', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('sends no stack trace and no database message when the database fails', async () => {
    const broken = createApp({
      Profile: { find: () => { throw new Error('connect ECONNREFUSED 10.0.0.5:27017 secret-host'); } },
      Swipe,
      clientOrigin: ORIGIN,
    });
    const res = await request(broken).get('/api/profiles');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|secret-host|\bat \w|node_modules/);
  });

  it('does not announce Express', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
