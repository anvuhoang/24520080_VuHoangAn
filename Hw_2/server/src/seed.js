// server/src/seed.js — `npm run seed` fills the profiles collection (it replaces what is there; swipes are cleared too).
import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { Profile, Swipe } from './models.js';
import { PROFILES_SEED } from './profilesSeed.js';

const { mongoUri } = readConfig();
await mongoose.connect(mongoUri);
await Swipe.deleteMany({});
await Profile.deleteMany({});
await Profile.insertMany(PROFILES_SEED.map((profile, order) => ({ ...profile, order })));
process.stdout.write(`Seeded ${PROFILES_SEED.length} profiles.\n`);
await mongoose.disconnect();
