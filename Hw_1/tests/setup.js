// tests/setup.js
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when the test globals are enabled; do it explicitly
afterEach(() => {
  cleanup();
});

// jsdom may not provide crypto.randomUUID; the app only runs in secure contexts where it exists
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let counter = 0;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `test-uuid-${counter++}`,
    configurable: true,
    writable: true,
  });
}
