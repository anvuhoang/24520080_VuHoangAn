// server/tests/deckReference.test.js — the slide 29 and slide 32 code, copied as written, to show where it fails.
// Each assertion states what was measured (Mongoose 8.24, Express 5, MongoDB in memory). See AI_FAILURE_AUDIT.md.
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let mongod;
let RefSwipe;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // The slide does not show the model. This is the most natural one: a reference to a profile and a string action.
  RefSwipe = mongoose.model(
    'RefSwipe',
    new mongoose.Schema(
      { profileId: { type: mongoose.Schema.Types.ObjectId, required: true }, action: String },
      { timestamps: { createdAt: true, updatedAt: false } }
    )
  );
  await RefSwipe.init();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// --- slide 32, step 4, as written (express.json() is added in `withJson`, as a student would after the first failure) ---
function slideApp({ withJson }) {
  const app = express();
  if (withJson) app.use(express.json());
  app.post('/api/swipe', async (req, res) => {
    try {
      const record = await RefSwipe.create(req.body);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  return app;
}
// ----------------------------------------------------------------------------------------------------------------------

const PROFILE = '0'.repeat(24);

describe('slide 32 POST /api/swipe', () => {
  it('without express.json() the body is undefined and the client is told that profileId is missing', async () => {
    const res = await request(slideApp({ withJson: false })).post('/api/swipe').send({ profileId: PROFILE, action: 'LIKE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Path `profileId` is required');
  });

  it('lets the client choose the _id and the createdAt of the record (mass assignment)', async () => {
    const forged = { profileId: PROFILE, action: 'LIKE', _id: 'f'.repeat(24), createdAt: '2000-01-01T00:00:00.000Z' };
    const res = await request(slideApp({ withJson: true })).post('/api/swipe').send(forged);
    expect(res.status).toBe(201);
    expect(res.body._id).toBe('f'.repeat(24));
    expect(res.body.createdAt).toBe('2000-01-01T00:00:00.000Z');
  });

  it('accepts any text as the action', async () => {
    const res = await request(slideApp({ withJson: true })).post('/api/swipe').send({ profileId: '1'.repeat(24), action: 'ANYTHING AT ALL' });
    expect(res.status).toBe(201);
  });

  it('puts the model name and the driver error in the answer (err.message)', async () => {
    const res = await request(slideApp({ withJson: true })).post('/api/swipe').send({ profileId: 'abc', action: 'LIKE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('RefSwipe');
    expect(res.body.error).toContain('BSONError');
  });
});

describe('slide 29 #04 Mongoose 5 callback', () => {
  it('Query.exec(callback) is rejected by Mongoose 8, as a rejected promise (not a thrown error)', async () => {
    let returned;
    expect(() => {
      returned = RefSwipe.find().exec(() => {});
    }).not.toThrow();
    await expect(returned).rejects.toThrow('Query.prototype.exec() no longer accepts a callback');
  });
});

describe('slide 32 step 2 connection flags', () => {
  it('useNewUrlParser and useUnifiedTopology still connect, but the driver warns that they are deprecated', async () => {
    const warnings = [];
    const onWarning = (w) => warnings.push(w.message);
    process.on('warning', onWarning);
    const connection = await mongoose.createConnection(mongod.getUri(), { useNewUrlParser: true, useUnifiedTopology: true }).asPromise();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await connection.close();
    process.off('warning', onWarning);
    expect(warnings.some((m) => m.includes('useNewUrlParser is a deprecated option'))).toBe(true);
    expect(warnings.some((m) => m.includes('useUnifiedTopology is a deprecated option'))).toBe(true);
  });
});
