// server/src/app.js — the Express app. Models and the clock are passed in so the tests use a real in-memory MongoDB and a fixed time.
import cors from 'cors';
import express from 'express';
import { normalizeAppeal, validateAppeal } from '../../client/src/appeal/appealRules.js';
import { DEV_CLIENT_ORIGIN } from './config.js';

const PLAYER_ID = /^[a-z0-9-]{1,30}$/;

const toDossier = (doc) => ({
  playerId: doc.playerId,
  name: doc.name,
  team: doc.team,
  matchesPlayed: doc.matchesPlayed,
  reportsReceived: doc.reportsReceived,
  infractions: doc.infractions.map((i) => ({ id: String(i._id), rule: i.rule, severity: i.severity, penaltyMinutes: i.penaltyMinutes })),
  appealDeadline: new Date(doc.appealDeadline).toISOString(),
});

// A receipt, not the appeal: the API has no sign-in, so it never sends back a name, an email or the statement.
const toReceipt = (doc) => ({ id: String(doc._id), playerId: doc.playerId, category: doc.category, status: 'received', createdAt: new Date(doc.createdAt).toISOString() });

export function createApp({ Dossier, Appeal, clientOrigin = DEV_CLIENT_ORIGIN, now = () => Date.now() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: clientOrigin })); // one explicit origin, never '*'
  app.use(express.json({ limit: '10kb' }));

  // The one clock that counts. The browser measures its own offset from this answer.
  app.get('/api/clock', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ now: new Date(now()).toISOString() });
  });

  app.get('/api/dossiers', async (_req, res) => {
    const dossiers = await Dossier.find().sort({ name: 1 }).lean().exec();
    res.json(dossiers.map(toDossier));
  });

  app.get('/api/dossiers/:playerId', async (req, res) => {
    const { playerId } = req.params;
    if (!PLAYER_ID.test(playerId)) return res.status(400).json({ error: 'Invalid player id.' });
    const dossier = await Dossier.findOne({ playerId }).lean().exec();
    if (!dossier) return res.status(404).json({ error: 'Unknown player.' });
    res.json(toDossier(dossier));
  });

  app.get('/api/appeals/:playerId', async (req, res) => {
    const { playerId } = req.params;
    if (!PLAYER_ID.test(playerId)) return res.status(400).json({ error: 'Invalid player id.' });
    // "Has an appeal been filed?" is a question with a normal answer "no": 200 with null, so a page that asks it
    // on every visit does not put a 404 in the console of every visitor.
    if (!(await Dossier.exists({ playerId }))) return res.status(404).json({ error: 'Unknown player.' });
    const appeal = await Appeal.findOne({ playerId }).lean().exec();
    res.json(appeal ? toReceipt(appeal) : null);
  });

  app.post('/api/appeals/:playerId', async (req, res) => {
    const { playerId } = req.params;
    if (!PLAYER_ID.test(playerId)) return res.status(400).json({ error: 'Invalid player id.' });

    const dossier = await Dossier.findOne({ playerId }).lean().exec();
    if (!dossier) return res.status(404).json({ error: 'Unknown player.' });

    // The deadline is judged by the server's clock, whatever the browser's timer says.
    if (now() >= new Date(dossier.appealDeadline).getTime()) {
      return res.status(403).json({ error: 'The appeal window is closed.' });
    }

    const details = validateAppeal(req.body);
    if (Object.keys(details).length > 0) return res.status(400).json({ error: 'Invalid appeal.', details });

    // Only the known fields, trimmed; the player id comes from the path and nothing else in the body is read.
    const { appellantName, email, category, statement, evidenceUrl } = normalizeAppeal(req.body);
    try {
      const created = await Appeal.create({ playerId, appellantName, email, category, statement, evidenceUrl });
      res.status(201).json(toReceipt(created.toObject()));
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'An appeal has already been filed for this player.' });
      throw error;
    }
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
