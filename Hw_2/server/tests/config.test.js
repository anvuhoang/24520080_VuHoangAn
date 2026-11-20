// server/tests/config.test.js — the start-up settings.
import { describe, expect, it } from 'vitest';
import { DEV_CLIENT_ORIGIN, readConfig } from '../src/config.js';

describe('readConfig', () => {
  it('refuses to start without MONGODB_URI', () => {
    expect(() => readConfig({})).toThrow(/MONGODB_URI is missing/);
    expect(() => readConfig({ MONGODB_URI: '' })).toThrow(/MONGODB_URI is missing/);
  });

  it('reads the connection string from the environment, never from a default', () => {
    expect(readConfig({ MONGODB_URI: 'mongodb://example.test/db' }).mongoUri).toBe('mongodb://example.test/db');
  });

  it('uses port 3002 and the developer origin when only the URI is set', () => {
    expect(readConfig({ MONGODB_URI: 'mongodb://x' })).toEqual({ mongoUri: 'mongodb://x', port: 3002, clientOrigin: DEV_CLIENT_ORIGIN });
  });

  it('takes PORT and CLIENT_ORIGIN from the environment', () => {
    const cfg = readConfig({ MONGODB_URI: 'mongodb://x', PORT: '4000', CLIENT_ORIGIN: 'https://deck.example' });
    expect(cfg.port).toBe(4000);
    expect(cfg.clientOrigin).toBe('https://deck.example');
  });

  it('falls back to 3002 for a port that is not a number', () => {
    expect(readConfig({ MONGODB_URI: 'mongodb://x', PORT: 'abc' }).port).toBe(3002);
  });

  it('in production, refuses to start without CLIENT_ORIGIN instead of using localhost', () => {
    expect(() => readConfig({ MONGODB_URI: 'mongodb://x', NODE_ENV: 'production' })).toThrow(/CLIENT_ORIGIN is missing/);
    expect(readConfig({ MONGODB_URI: 'mongodb://x', NODE_ENV: 'production', CLIENT_ORIGIN: 'https://deck.example' }).clientOrigin).toBe('https://deck.example');
  });

  it('never defaults the origin to "*"', () => {
    expect(readConfig({ MONGODB_URI: 'mongodb://x' }).clientOrigin).not.toBe('*');
  });
});
