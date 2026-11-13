// @vitest-environment node
// tests/server.test.js
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { FORUMS, createMemoryStore } from '../server/store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGIN = 'http://localhost:5173';
const fresh = (options) => createApp({ clientOrigin: ORIGIN, ...options });

describe('GET /api/messages/:forum', () => {
  it('lists the messages of each known forum', async () => {
    const app = fresh();
    for (const forum of FORUMS) {
      const response = await request(app).get(`/api/messages/${forum}`);
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(Array.isArray(response.body)).toBe(true);
    }
    const nasa = (await request(app).get('/api/messages/nasa')).body;
    expect(nasa).toHaveLength(2);
    expect(Object.keys(nasa[0]).sort()).toEqual(['author', 'id', 'text', 'timestamp']);
    expect(nasa[0].id).toMatch(UUID);
    expect(new Date(nasa[0].timestamp).toISOString()).toBe(nasa[0].timestamp);
  });

  it('answers 404 with JSON for an unknown forum', async () => {
    const response = await request(fresh()).get('/api/messages/nowhere');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Unknown forum: nowhere' });
  });

  it('does not treat inherited object names as forums', async () => {
    for (const name of ['__proto__', 'constructor', 'toString']) {
      const response = await request(fresh()).get(`/api/messages/${name}`);
      expect(response.status).toBe(404);
    }
  });
});

describe('POST /api/messages/:forum', () => {
  it('creates a message with a server-made id and time and answers 201', async () => {
    const response = await request(fresh()).post('/api/messages/notNasa').send({ author: '  Ada ', text: ' Hello there ' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ author: 'Ada', text: 'Hello there' });
    expect(response.body.id).toMatch(UUID);
    expect(Math.abs(Date.now() - new Date(response.body.timestamp).getTime())).toBeLessThan(5000);
  });

  it('stores it, so the next GET returns it', async () => {
    const app = fresh();
    const created = (await request(app).post('/api/messages/notNasa').send({ author: 'Ada', text: 'First' })).body;
    const list = (await request(app).get('/api/messages/notNasa')).body;
    expect(list).toEqual([created]);
  });

  it('keeps forums apart', async () => {
    const app = fresh();
    await request(app).post('/api/messages/notNasa').send({ author: 'Ada', text: 'Only here' });
    expect((await request(app).get('/api/messages/nasa')).body).toHaveLength(2);
    expect((await request(app).get('/api/messages/notNasa')).body).toHaveLength(1);
  });

  it('never lets the client choose the id, the time or any other field', async () => {
    const response = await request(fresh())
      .post('/api/messages/notNasa')
      .send({ author: 'Ada', text: 'Hi', id: 'hacked', timestamp: '1999-01-01T00:00:00.000Z', role: 'admin' });
    expect(response.status).toBe(201);
    expect(response.body.id).toMatch(UUID);
    expect(response.body.timestamp).not.toBe('1999-01-01T00:00:00.000Z');
    expect(response.body.role).toBeUndefined();
    expect(Object.keys(response.body).sort()).toEqual(['author', 'id', 'text', 'timestamp']);
  });

  it('answers 400 "Missing required fields" with the details when a field is missing or empty', async () => {
    const app = fresh();
    for (const body of [{}, { author: 'Ada' }, { text: 'Hi' }, { author: '', text: '' }, { author: '  ', text: 'Hi' }]) {
      const response = await request(app).post('/api/messages/nasa').send(body);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
      expect(Object.keys(response.body.details).length).toBeGreaterThan(0);
    }
    expect((await request(app).get('/api/messages/nasa')).body).toHaveLength(2); // nothing was stored
  });

  it('answers 400 "Invalid message" for a text or an author that is too long or not a string', async () => {
    const app = fresh();
    const tooLong = await request(app).post('/api/messages/nasa').send({ author: 'Ada', text: 'x'.repeat(281) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ error: 'Invalid message', details: { text: 'Message must have at most 280 characters.' } });
    const notString = await request(app).post('/api/messages/nasa').send({ author: ['Ada'], text: { a: 1 } });
    expect(notString.status).toBe(400);
  });

  it('accepts the limits exactly (40 and 280 characters)', async () => {
    const response = await request(fresh()).post('/api/messages/notNasa').send({ author: 'a'.repeat(40), text: 'b'.repeat(280) });
    expect(response.status).toBe(201);
  });

  it('answers 400 for a body that is not valid JSON and 400 for no body at all', async () => {
    const bad = await request(fresh()).post('/api/messages/nasa').set('Content-Type', 'application/json').send('{"author": ');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'Invalid JSON body' });
    const none = await request(fresh()).post('/api/messages/nasa');
    expect(none.status).toBe(400);
    expect(none.body.error).toBe('Missing required fields');
  });

  it('answers 413 for a body above the limit', async () => {
    const response = await request(fresh()).post('/api/messages/nasa').send({ author: 'Ada', text: 'x'.repeat(20000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Payload too large' });
  });

  it('answers 404 for an unknown forum before it looks at the body', async () => {
    const response = await request(fresh()).post('/api/messages/nowhere').send({});
    expect(response.status).toBe(404);
  });
});

describe('the rest of the API surface', () => {
  it('answers 404 with JSON for an unknown API route and for a method that is not offered', async () => {
    const app = fresh();
    const missing = await request(app).get('/api/nothing');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Not found' });
    const method = await request(app).delete('/api/messages/nasa');
    expect(method.status).toBe(404);
  });

  it('does not announce what it is built with', async () => {
    const response = await request(fresh()).get('/api/messages/nasa');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows the configured origin and only that origin', async () => {
    const app = fresh();
    const allowed = await request(app).get('/api/messages/nasa').set('Origin', ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    const stranger = await request(app).get('/api/messages/nasa').set('Origin', 'http://evil.example');
    expect(stranger.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    expect(stranger.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('answers a preflight request from the configured origin', async () => {
    const response = await request(fresh())
      .options('/api/messages/nasa')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('takes the origin from the CLIENT_ORIGIN setting when it is not given', async () => {
    process.env.CLIENT_ORIGIN = 'http://localhost:4321';
    try {
      const app = createApp();
      const response = await request(app).get('/api/messages/nasa').set('Origin', 'http://localhost:4321');
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4321');
    } finally {
      delete process.env.CLIENT_ORIGIN;
    }
  });
});

describe('errors', () => {
  it('answers a plain 500 that does not leak the stack or the message of a failing store', async () => {
    const broken = {
      hasForum: async () => true,
      getMessages: async () => {
        throw new Error('secret connection string mongodb://user:pass@host');
      },
      addMessage: async () => {
        throw new Error('disk full: /var/secret/path');
      },
    };
    const app = fresh({ store: broken });
    const get = await request(app).get('/api/messages/nasa');
    expect(get.status).toBe(500);
    expect(get.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(get.body)).not.toMatch(/secret|mongodb|stack/i);
    const post = await request(app).post('/api/messages/nasa').send({ author: 'Ada', text: 'Hi' });
    expect(post.status).toBe(500);
    expect(JSON.stringify(post.body)).not.toMatch(/disk|secret|\/var/i);
  });
});

describe('createMemoryStore', () => {
  it('returns copies, so a caller cannot change the stored list', async () => {
    const store = createMemoryStore({ a: [{ author: 'x', text: 'y' }] });
    const list = await store.getMessages('a');
    list.push({ id: 'fake' });
    expect(await store.getMessages('a')).toHaveLength(1);
    expect(await store.getMessages('zzz')).toBeUndefined();
    expect(await store.hasForum('a')).toBe(true);
    expect(await store.hasForum('zzz')).toBe(false);
  });
});
