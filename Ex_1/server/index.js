// server/index.js
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const app = createApp();

const server = app.listen(port, () => {
  process.stdout.write(`Forum API listening on http://localhost:${port}\n`);
});

// Close cleanly on Ctrl+C
process.on('SIGINT', () => server.close(() => process.exit(0)));
