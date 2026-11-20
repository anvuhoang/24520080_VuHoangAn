// server/src/index.js — start-up: read the settings, connect, listen, shut down cleanly.
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { Profile, Swipe } from './models.js';

const { mongoUri, port, clientOrigin } = readConfig();

await mongoose.connect(mongoUri); // Mongoose 8: no useNewUrlParser, no useUnifiedTopology, no callback
const server = createApp({ Profile, Swipe, clientOrigin }).listen(port, () => {
  process.stdout.write(`Deck API listening on port ${port}\n`);
});

async function shutdown() {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
