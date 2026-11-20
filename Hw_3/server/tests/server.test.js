// server/tests/server.test.js — the API against a real MongoDB (mongodb-memory-server) through Mongoose 8, with a clock the test controls.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APPEAL_WINDOW_HOURS, DOSSIERS_SEED } from '../src/dossiersSeed.js';
import { Appeal, Dossier } from '../src/models.js';

const ORIGIN = 'http://localhost:5173';
const HOUR = 3600 * 1000;
const START = Date.UTC(2026, 10, 20, 12, 0, 0);
let mongod;
let app;
let clock;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Dossier.init();
  await Appeal.init(); // builds the unique indexes before the first test
  app = createApp({ Dossier, Appeal, clientOrigin: ORIGIN, now: () => clock });
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  clock = START;
  await Appeal.deleteMany({});
  await Dossier.deleteMany({});
  await Dossier.insertMany(DOSSIERS_SEED.map((d) => ({ ...d, appealDeadline: new Date(START + APPEAL_WINDOW_HOURS[d.playerId] * HOUR) })));
});

const valid = (extra = {}) => ({
  appellantName: 'Himass',
  email: 'himass@example.com',
  category: 'false-positive',
  statement: 'The detection flagged my normal key presses. I have the match recording and can share it with the tribunal on request.',
  evidenceUrl: 'https://example.com/replay/42',
  confirm: true,
  ...extra,
});
const file = (playerId = 'himass', body = valid()) => request(app).post(`/api/appeals/${playerId}`).send(body);

describe('GET /api/clock', () => {
  it('answers with the server time as an ISO string, and says it must not be cached', async () => {
    const res = await request(app).get('/api/clock');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ now: new Date(START).toISOString() });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('follows the clock it was given', async () => {
    clock = START + 5000;
    expect((await request(app).get('/api/clock')).body.now).toBe(new Date(START + 5000).toISOString());
  });
});

describe('dossiers', () => {
  it('lists both dossiers with the deadline as an absolute ISO instant and plain fields', async () => {
    const res = await request(app).get('/api/dossiers');
    expect(res.status).toBe(200);
    expect(res.body.map((d) => d.playerId).sort()).toEqual(['himass', 'tanvuu']);
    const himass = res.body.find((d) => d.playerId === 'himass');
    expect(himass.appealDeadline).toBe(new Date(START + 72 * HOUR).toISOString());
    expect(Object.keys(himass).sort()).toEqual(['appealDeadline', 'infractions', 'matchesPlayed', 'name', 'playerId', 'reportsReceived', 'team']);
    expect(Object.keys(himass.infractions[0]).sort()).toEqual(['id', 'penaltyMinutes', 'rule', 'severity']);
    expect(JSON.stringify(res.body)).not.toContain('"_id"');
  });

  it('returns one dossier by player id', async () => {
    const res = await request(app).get('/api/dossiers/tanvuu');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TanVuu');
    expect(res.body.infractions).toHaveLength(3);
  });

  it('answers 404 for an unknown player and 400 for an id that is not a slug', async () => {
    expect((await request(app).get('/api/dossiers/nobody')).status).toBe(404);
    for (const bad of ['Himass', 'a_b', 'x'.repeat(31), '%24ne', 'a%20b']) {
      expect((await request(app).get(`/api/dossiers/${bad}`)).status, bad).toBe(400);
    }
  });
});

describe('POST /api/appeals/:playerId', () => {
  it('files an appeal and answers 201 with a receipt only', async () => {
    const res = await file();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ playerId: 'himass', category: 'false-positive', status: 'received' });
    expect(Object.keys(res.body).sort()).toEqual(['category', 'createdAt', 'id', 'playerId', 'status']);
    expect(JSON.stringify(res.body)).not.toMatch(/himass@example|detection flagged/);
    expect(await Appeal.countDocuments()).toBe(1);
  });

  it('stores the values trimmed and the email in lower case', async () => {
    await file('himass', valid({ appellantName: '  Himass  ', email: '  HIMASS@Example.COM ', statement: `  ${valid().statement}  ` }));
    const stored = await Appeal.findOne().lean();
    expect(stored.appellantName).toBe('Himass');
    expect(stored.email).toBe('himass@example.com');
    expect(stored.statement).toBe(valid().statement);
  });

  it('accepts an appeal without evidence', async () => {
    expect((await file('himass', valid({ evidenceUrl: '' }))).status).toBe(201);
  });

  it.each([
    ['a name that is too short', { appellantName: 'H' }, 'appellantName'],
    ['an email without a domain', { email: 'himass@' }, 'email'],
    ['no category', { category: '' }, 'category'],
    ['a category that is not in the list', { category: 'because-i-say-so' }, 'category'],
    ['a statement that is too short', { statement: 'Too short.' }, 'statement'],
    ['a statement over 1000 characters', { statement: 'x'.repeat(1001) }, 'statement'],
    ['"Other" with a statement of 60 characters (the cross-field rule)', { category: 'other', statement: 'y'.repeat(60) }, 'statement'],
    ['evidence that is not https', { evidenceUrl: 'http://example.com/a' }, 'evidenceUrl'],
    ['evidence that is a javascript: link', { evidenceUrl: 'javascript:alert(1)' }, 'evidenceUrl'],
    ['evidence with a password in it', { evidenceUrl: 'https://user:pw@example.com/' }, 'evidenceUrl'],
    ['no confirmation', { confirm: false }, 'confirm'],
    ['a confirmation that is the text "true"', { confirm: 'true' }, 'confirm'],
  ])('rejects %s with 400 and names the field', async (_label, change, field) => {
    const res = await file('himass', valid(change));
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(field);
    expect(await Appeal.countDocuments()).toBe(0);
  });

  it('accepts "Other" with 100 characters', async () => {
    expect((await file('himass', valid({ category: 'other', statement: 'z'.repeat(100) }))).status).toBe(201);
  });

  it.each([
    ['a name that is an operator object', { appellantName: { $ne: null } }],
    ['an email that is an array', { email: ['a@b.co'] }],
    ['a statement that is a number', { statement: 12345 }],
  ])('rejects %s with 400', async (_label, change) => {
    expect((await file('himass', valid(change))).status).toBe(400);
  });

  it('ignores fields the client has no right to set (the player id, the time, an id, extra keys)', async () => {
    const res = await file('himass', valid({ playerId: 'tanvuu', createdAt: '2000-01-01T00:00:00.000Z', _id: 'f'.repeat(24), status: 'accepted', isAdmin: true }));
    expect(res.status).toBe(201);
    const stored = await Appeal.findOne().lean();
    expect(stored.playerId).toBe('himass');
    expect(stored.createdAt.getFullYear()).toBeGreaterThanOrEqual(new Date().getFullYear());
    expect(String(stored._id)).not.toBe('f'.repeat(24));
    expect(stored).not.toHaveProperty('isAdmin');
    expect(stored).not.toHaveProperty('status');
  });

  it('answers 404 for an unknown player and 400 for a bad id', async () => {
    expect((await file('nobody')).status).toBe(404);
    expect((await file('Bad_Id')).status).toBe(400);
    expect(await Appeal.countDocuments()).toBe(0);
  });

  it('answers 400 for a body that is not JSON and 413 for a body over 10 kb', async () => {
    const bad = await request(app).post('/api/appeals/himass').set('Content-Type', 'application/json').send('{"appellantName":');
    expect(bad.status).toBe(400);
    const big = await file('himass', valid({ statement: 'x'.repeat(20000) }));
    expect(big.status).toBe(413);
  });
});

describe('the appeal window is the server clock, not the browser timer', () => {
  it('accepts an appeal one second before the deadline', async () => {
    clock = START + 72 * HOUR - 1000;
    expect((await file()).status).toBe(201);
  });

  it('refuses at the deadline itself and after it (403), and stores nothing', async () => {
    clock = START + 72 * HOUR;
    const at = await file();
    expect(at.status).toBe(403);
    expect(at.body.error).toBe('The appeal window is closed.');
    clock = START + 73 * HOUR;
    expect((await file()).status).toBe(403);
    expect(await Appeal.countDocuments()).toBe(0);
  });

  it('judges each player by their own deadline', async () => {
    clock = START + 50 * HOUR; // TanVuu has 48 h, Himass 72 h
    expect((await file('tanvuu')).status).toBe(403);
    expect((await file('himass')).status).toBe(201);
  });

  it('says "closed" before it says "invalid": a late appeal is not asked to be corrected', async () => {
    clock = START + 100 * HOUR;
    expect((await file('himass', {})).status).toBe(403);
  });
});

describe('one appeal per player', () => {
  it('refuses a second appeal for the same player with 409', async () => {
    expect((await file()).status).toBe(201);
    const again = await file();
    expect(again.status).toBe(409);
    expect(await Appeal.countDocuments()).toBe(1);
  });

  it('two requests at once file it once', async () => {
    const [a, b] = await Promise.all([file(), file()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await Appeal.countDocuments()).toBe(1);
  });

  it('the other player can still appeal', async () => {
    await file('himass');
    expect((await file('tanvuu')).status).toBe(201);
  });
});

describe('GET /api/appeals/:playerId', () => {
  it('answers 200 with null when nothing was filed (not a 404), then the receipt after it was', async () => {
    const none = await request(app).get('/api/appeals/himass');
    expect(none.status).toBe(200);
    expect(none.text).toBe('null');
    await file();
    const res = await request(app).get('/api/appeals/himass');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ playerId: 'himass', status: 'received' });
    expect(JSON.stringify(res.body)).not.toMatch(/himass@example|detection flagged|Himass"/);
  });

  it('answers 400 for a bad id and 404 for a player that does not exist', async () => {
    expect((await request(app).get('/api/appeals/Bad_Id')).status).toBe(400);
    expect((await request(app).get('/api/appeals/nobody')).status).toBe(404);
  });
});

describe('the models themselves (a second line of defence behind the API checks)', () => {
  it('Appeal refuses a category that is not in the list, even when the API is bypassed', async () => {
    await expect(Appeal.create({ playerId: 'x', appellantName: 'Xx', email: 'x@y.co', category: 'nope', statement: 's' })).rejects.toThrow(/validation failed/);
  });

  it('Appeal refuses a second record for the same player (unique index)', async () => {
    const doc = { playerId: 'x', appellantName: 'Xx', email: 'x@y.co', category: 'other', statement: 's' };
    await Appeal.create(doc);
    await expect(Appeal.create(doc)).rejects.toMatchObject({ code: 11000 });
  });

  it('Dossier refuses a player id that is not a slug and a severity outside 1 to 5', async () => {
    const ok = { playerId: 'ok-1', name: 'Ok', team: 'T', matchesPlayed: 1, reportsReceived: 0, appealDeadline: new Date(START) };
    await expect(Dossier.create({ ...ok, playerId: 'Not Ok' })).rejects.toThrow(/validation failed/);
    await expect(Dossier.create({ ...ok, infractions: [{ rule: 'r', severity: 6, penaltyMinutes: 1 }] })).rejects.toThrow(/validation failed/);
    await expect(Dossier.create(ok)).resolves.toBeTruthy();
  });
});

describe('CORS, unknown routes and errors', () => {
  it('allows the configured origin, and only that one', async () => {
    const ok = await request(app).get('/api/clock').set('Origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const other = await request(app).get('/api/clock').set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(other.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('answers 404 with JSON for an unknown route', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('sends no stack trace and no database message when the database fails', async () => {
    const broken = createApp({
      Dossier: { find: () => { throw new Error('connect ECONNREFUSED 10.0.0.5:27017 secret-host'); } },
      Appeal,
      clientOrigin: ORIGIN,
    });
    const res = await request(broken).get('/api/dossiers');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|secret-host|\bat \w|node_modules/);
  });

  it('does not announce Express', async () => {
    expect((await request(app).get('/api/clock')).headers['x-powered-by']).toBeUndefined();
  });
});
