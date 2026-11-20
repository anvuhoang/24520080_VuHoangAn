// server/src/seed.js — `npm run seed` replaces the dossiers and clears the appeals. Each appeal window starts now.
import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { DOSSIERS_SEED, APPEAL_WINDOW_HOURS } from './dossiersSeed.js';
import { Appeal, Dossier } from './models.js';

const { mongoUri } = readConfig();
await mongoose.connect(mongoUri);
await Appeal.deleteMany({});
await Dossier.deleteMany({});
const HOUR = 60 * 60 * 1000;
await Dossier.insertMany(
  DOSSIERS_SEED.map((dossier) => ({ ...dossier, appealDeadline: new Date(Date.now() + APPEAL_WINDOW_HOURS[dossier.playerId] * HOUR) }))
);
process.stdout.write(`Seeded ${DOSSIERS_SEED.length} dossiers.\n`);
await mongoose.disconnect();
