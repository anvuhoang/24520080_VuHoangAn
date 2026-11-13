// client/tests/setup.js
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

// jsdom has no <dialog>.showModal()/close(). This stand-in follows the parts the app depends on, as measured in
// Chrome 157: showModal() on a dialog that is already modal does nothing, close() on a closed dialog does nothing,
// and the `close` event is queued (a task), not fired synchronously. It does NOT trap focus or make the page
// inert; those are checked in real Chrome (see docs/AI_FAILURE_AUDIT.md).
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    if (this.hasAttribute('open')) return;
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
}
