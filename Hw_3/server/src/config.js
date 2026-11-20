// server/src/config.js — everything that comes from the environment, read in one place and checked at start-up.

export const DEV_CLIENT_ORIGIN = 'http://localhost:5173';

// Throws instead of guessing: a missing connection string must stop the server, never fall back to a built-in one,
// and in production a missing client origin must not silently become the developer's localhost.
export function readConfig(env = process.env) {
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and set it.');
  }
  if (env.NODE_ENV === 'production' && !env.CLIENT_ORIGIN) {
    throw new Error('CLIENT_ORIGIN is missing. In production it must name the one browser origin that may call the API.');
  }
  const port = Number(env.PORT) || 3003;
  return { mongoUri, port, clientOrigin: env.CLIENT_ORIGIN ?? DEV_CLIENT_ORIGIN };
}
