// server/src/app.js — the Express app. Models are passed in so the tests can use a real in-memory MongoDB.
import cors from 'cors';
import express from 'express';
import { DEV_CLIENT_ORIGIN } from './config.js';
import { ACTIONS } from './models.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const toProfile = (doc) => ({ id: String(doc._id), name: doc.name, age: doc.age, bio: doc.bio });
const toSwipe = (doc) => ({ id: String(doc._id), profileId: String(doc.profileId), action: doc.action, createdAt: doc.createdAt });

const latestSwipe = (Swipe) => Swipe.findOne().sort({ createdAt: -1, _id: -1 }).lean().exec();

export function createApp({ Profile, Swipe, clientOrigin = DEV_CLIENT_ORIGIN }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: clientOrigin })); // one explicit origin, never '*'
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/profiles', async (_req, res) => {
    const profiles = await Profile.find().sort({ order: 1 }).lean().exec();
    res.json(profiles.map(toProfile));
  });

  app.get('/api/swipes', async (_req, res) => {
    const swipes = await Swipe.find().sort({ createdAt: 1, _id: 1 }).lean().exec();
    res.json(swipes.map(toSwipe));
  });

  app.post('/api/swipes', async (req, res) => {
    // Only these two fields are read; anything else in the body (an id, a timestamp, "$set") is ignored.
    const { profileId, action } = req.body ?? {};
    const details = {};
    if (typeof profileId !== 'string' || !OBJECT_ID.test(profileId)) details.profileId = 'profileId must be a 24-character hex id.';
    if (!ACTIONS.includes(action)) details.action = `action must be one of ${ACTIONS.join(', ')}.`;
    if (Object.keys(details).length > 0) return res.status(400).json({ error: 'Invalid swipe.', details });

    const profile = await Profile.findById(profileId).lean().exec();
    if (!profile) return res.status(404).json({ error: 'Unknown profile.' });

    // The deck is a stack: only the next card can be swiped, so the history is always a prefix of the deck.
    const swiped = await Swipe.countDocuments();
    const next = await Profile.findOne().sort({ order: 1 }).skip(swiped).lean().exec();
    if (!next || String(next._id) !== profileId) {
      return res.status(409).json({ error: 'That is not the next card in the deck.' });
    }

    try {
      const created = await Swipe.create({ profileId, action });
      res.status(201).json(toSwipe(created.toObject()));
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'That card was already swiped.' });
      throw error;
    }
  });

  // LIFO undo: only the most recent swipe can be removed.
  app.delete('/api/swipes/:id', async (req, res) => {
    const { id } = req.params;
    if (!OBJECT_ID.test(id)) return res.status(400).json({ error: 'Invalid swipe id.' });
    const last = await latestSwipe(Swipe);
    if (!last || !(await Swipe.exists({ _id: id }))) return res.status(404).json({ error: 'Unknown swipe.' });
    if (String(last._id) !== id) return res.status(409).json({ error: 'Only the latest swipe can be undone.' });
    await Swipe.deleteOne({ _id: id });
    res.json({ id });
  });

  app.delete('/api/swipes', async (_req, res) => {
    await Swipe.deleteMany({});
    res.status(204).end();
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

  // One error handler; it never sends a stack trace or a database message.
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body is not valid JSON.' });
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
