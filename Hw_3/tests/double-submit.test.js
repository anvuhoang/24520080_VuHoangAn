const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FORM_STATES,
  createSignupStateMachine,
  initSignupForm
} = require('../js/app.js');

describe('Double-Submit Prevention & Rapid-Click Resilience (HW3 Slice 3A)', () => {
  function createMockDomElements() {
    return {
      input: { value: 'engineer@aetheria.io', disabled: false },
      inputWrapper: {
        classList: {
          add() {},
          remove() {}
        }
      },
      submitBtn: {
        disabled: false,
        attrs: {},
        setAttribute(k, v) { this.attrs[k] = String(v); },
        removeAttribute(k) { delete this.attrs[k]; },
        getAttribute(k) { return this.attrs[k] || null; }
      },
      btnText: { textContent: 'Request Key' },
      errorBox: {
        classList: {
          add() {},
          remove() {}
        }
      },
      errorMsg: { textContent: '' },
      successBox: {
        classList: {
          add() {},
          remove() {}
        }
      },
      successMsg: { textContent: '' }
    };
  }

  describe('1. In-Flight Rejection & Button Disabling', () => {
    it('disables submit button and sets aria attributes during request', async () => {
      const elements = createMockDomElements();
      let finishRequest;
      const delayedAsync = () => new Promise((resolve) => { finishRequest = resolve; });

      const machine = createSignupStateMachine({
        elements,
        asyncSubmit: delayedAsync
      });

      // Submit begins
      const submissionPromise = machine.submit('engineer@aetheria.io');

      // Assert in-flight state
      assert.strictEqual(machine.isSubmitting(), true);
      assert.strictEqual(machine.getState(), FORM_STATES.SUBMITTING);
      assert.strictEqual(elements.submitBtn.disabled, true);
      assert.strictEqual(elements.submitBtn.getAttribute('aria-busy'), 'true');
      assert.strictEqual(elements.submitBtn.getAttribute('aria-disabled'), 'true');

      // Finish request
      finishRequest({ success: true, message: 'Granted' });
      await submissionPromise;

      assert.strictEqual(machine.isSubmitting(), false);
      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
    });

    it('re-enables submit button after error occurs, allowing user to retry', async () => {
      const elements = createMockDomElements();
      let attempt = 0;
      const failingThenSucceeding = async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error('504 Gateway Timeout');
        }
        return { success: true, message: 'Key dispatched on retry' };
      };

      const machine = createSignupStateMachine({
        elements,
        asyncSubmit: failingThenSucceeding
      });

      // Attempt 1: Fails
      const firstOutcome = await machine.submit('engineer@aetheria.io');
      assert.strictEqual(firstOutcome, false);
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);

      // Verify re-enabled submit button after error
      assert.strictEqual(elements.submitBtn.disabled, false);
      assert.strictEqual(elements.submitBtn.getAttribute('aria-busy'), null);
      assert.strictEqual(elements.submitBtn.getAttribute('aria-disabled'), null);
      assert.strictEqual(elements.btnText.textContent, 'Try Again');

      // Attempt 2: Retry succeeds
      const retryOutcome = await machine.submit('engineer@aetheria.io');
      assert.strictEqual(retryOutcome, true);
      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
    });

    it('keeps submit button disabled on success to prevent duplicate keys', async () => {
      const elements = createMockDomElements();
      const machine = createSignupStateMachine({
        elements,
        asyncSubmit: async () => ({ success: true, message: 'Done' })
      });

      await machine.submit('engineer@aetheria.io');

      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
      assert.strictEqual(elements.submitBtn.disabled, true);
      assert.strictEqual(elements.submitBtn.getAttribute('aria-disabled'), 'true');

      // Re-enabled if form is reset
      machine.reset();
      assert.strictEqual(machine.getState(), FORM_STATES.IDLE);
      assert.strictEqual(elements.submitBtn.disabled, false);
    });
  });

  describe('2. Concurrent Request Suppression (Mutex Guard)', () => {
    it('dispatches exactly one network call when multiple submit() calls are launched in parallel', async () => {
      let callCount = 0;
      let completeCall;
      const slowAsync = async () => {
        callCount++;
        return new Promise((resolve) => { completeCall = resolve; });
      };

      const machine = createSignupStateMachine({
        asyncSubmit: slowAsync
      });

      // Launch 5 simultaneous parallel submissions
      const parallelPromises = [
        machine.submit('simultaneous@aetheria.io'),
        machine.submit('simultaneous@aetheria.io'),
        machine.submit('simultaneous@aetheria.io'),
        machine.submit('simultaneous@aetheria.io'),
        machine.submit('simultaneous@aetheria.io')
      ];

      // Settle the active request
      completeCall({ success: true, message: 'Done' });
      const results = await Promise.all(parallelPromises);

      // Exactly 1 call was dispatched to asyncSubmit
      assert.strictEqual(callCount, 1);

      // Exactly 1 returned true; the 4 concurrent attempts were synchronously rejected
      const successes = results.filter((res) => res === true);
      const rejections = results.filter((res) => res === false);
      assert.strictEqual(successes.length, 1);
      assert.strictEqual(rejections.length, 4);
    });
  });

  describe('3. Rapid-Click Event Simulation', () => {
    it('suppresses 20 rapid successive clicks while request is in flight', async () => {
      let networkDispatches = 0;
      let resolveAsync;
      const controlledAsync = () => {
        networkDispatches++;
        return new Promise((resolve) => { resolveAsync = resolve; });
      };

      const elements = createMockDomElements();
      const machine = createSignupStateMachine({
        elements,
        asyncSubmit: controlledAsync
      });

      // Trigger first click
      const firstClick = machine.submit('rapid@aetheria.io');

      // Simulate 19 rapid clicks while first click is pending
      const rapidClickOutcomes = [];
      for (let i = 0; i < 19; i++) {
        rapidClickOutcomes.push(machine.submit('rapid@aetheria.io'));
      }

      // Finish first click
      resolveAsync({ success: true });
      const firstResult = await firstClick;
      const rapidResults = await Promise.all(rapidClickOutcomes);

      assert.strictEqual(firstResult, true);
      assert.strictEqual(networkDispatches, 1, 'Only 1 network request should be dispatched');
      assert.strictEqual(rapidResults.every((res) => res === false), true);
    });

    it('DOM initSignupForm suppresses submit events when button is disabled or inFlight', async () => {
      let backendHits = 0;
      let resolveBackend;
      const asyncMock = () => {
        backendHits++;
        return new Promise((res) => { resolveBackend = res; });
      };

      const listeners = {};
      const mockInput = { value: 'clicker@domain.com' };
      const mockBtn = { disabled: false, attrs: {}, setAttribute() {}, removeAttribute() {} };

      const mockForm = {
        querySelector(selector) {
          if (selector === '#user-email') return mockInput;
          if (selector === '#submit-btn') return mockBtn;
          return null;
        },
        addEventListener(event, fn) {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
        dispatchEvent(event) {
          (listeners[event.type] || []).forEach((fn) => fn(event));
        }
      };

      initSignupForm(mockForm, { asyncSubmit: asyncMock });

      const createFakeEvent = () => ({
        type: 'submit',
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }
      });

      // Rapidly fire 10 submit events on the form
      const eventPromises = [];
      for (let i = 0; i < 10; i++) {
        const ev = createFakeEvent();
        mockForm.dispatchEvent(ev);
        assert.strictEqual(ev.defaultPrevented, true);
      }

      // Complete backend request
      resolveBackend({ success: true });
      await new Promise((r) => setImmediate(r));

      // Assert only 1 hit reached the backend
      assert.strictEqual(backendHits, 1);
    });
  });
});
