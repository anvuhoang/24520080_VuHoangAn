// server/tests/deckReference.test.js
// The Express handler of slide 27, copied as it is (with a plain array standing in for `db`), to show what it does.
// These tests describe defects of the DECK code; this project's server does not copy it.
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function slideApp() {
  const app = express();
  app.use(express.json());
  const db = [];
  app.post('/api/messages/:forum', async (req, res) => {
    if (!req.body.text || !req.body.author) return res.status(400).json({ error: 'Missing required fields' });
    const newMessage = { id: randomUUID(), ...req.body, timestamp: new Date() };
    db.push({ forum: req.params.forum, ...newMessage });
    res.status(201).json(newMessage);
  });
  return { app, db };
}

describe('slide 27: POST /api/messages/:forum', () => {
  it('lets the client choose the id, because `...req.body` comes after `id` (the time is safe: it comes after the spread)', async () => {
    const { app } = slideApp();
    const response = await request(app)
      .post('/api/messages/nasa')
      .send({ author: 'Mallory', text: 'hi', id: 'hacked', timestamp: '1999-01-01T00:00:00.000Z' });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('hacked'); // forged
    expect(response.body.timestamp).not.toBe('1999-01-01T00:00:00.000Z'); // not forged: the server's own value wins
  });

  it('stores any extra field the client sends', async () => {
    const { app, db } = slideApp();
    await request(app).post('/api/messages/nasa').send({ author: 'M', text: 'hi', role: 'admin', payload: 'x'.repeat(500) });
    expect(db[0].role).toBe('admin');
    expect(db[0].payload).toHaveLength(500);
  });

  it('accepts a message that is only spaces, a text of any length, and a forum that does not exist', async () => {
    const { app, db } = slideApp();
    expect((await request(app).post('/api/messages/nasa').send({ author: ' ', text: '   ' })).status).toBe(201);
    expect((await request(app).post('/api/messages/nasa').send({ author: 'A', text: 'x'.repeat(5000) })).status).toBe(201);
    expect((await request(app).post('/api/messages/does-not-exist').send({ author: 'A', text: 'hi' })).status).toBe(201);
    expect(db).toHaveLength(3);
  });

  it('this project\'s server refuses all four of those', async () => {
    const app = createApp({ clientOrigin: 'http://localhost:5173' });
    const forged = await request(app)
      .post('/api/messages/nasa')
      .send({ author: 'Mallory', text: 'hi', id: 'hacked', timestamp: '1999-01-01T00:00:00.000Z', role: 'admin' });
    expect(forged.body.id).not.toBe('hacked');
    expect(forged.body.role).toBeUndefined();
    expect((await request(app).post('/api/messages/nasa').send({ author: ' ', text: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/messages/nasa').send({ author: 'A', text: 'x'.repeat(5000) })).status).toBe(400);
    expect((await request(app).post('/api/messages/does-not-exist').send({ author: 'A', text: 'hi' })).status).toBe(404);
  });

  it('the three slides disagree on the address: /api/channels/:id/messages (16), /api/forums/:id/messages (26), /api/messages/:forum (27); only the last exists here', async () => {
    const app = createApp({ clientOrigin: 'http://localhost:5173' });
    expect((await request(app).get('/api/channels/nasa/messages')).status).toBe(404);
    expect((await request(app).get('/api/forums/nasa/messages')).status).toBe(404);
    expect((await request(app).get('/api/messages/nasa')).status).toBe(200);
  });
});
