const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  FORM_STATES,
  VALID_TRANSITIONS,
  validateEmail,
  createSignupStateMachine,
  initSignupForm
} = require('../js/app.js');

describe('Signup Form State Machine (HW3 Slice 2)', () => {
  describe('1. Pre-Submission Input Validation', () => {
    it('validates correct email and trims surrounding whitespace', () => {
      const result = validateEmail('  engineer@aetheria.io  ');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.sanitized, 'engineer@aetheria.io');
    });

    it('rejects empty, blank, or non-string inputs', () => {
      assert.strictEqual(validateEmail('').isValid, false);
      assert.strictEqual(validateEmail('   ').isValid, false);
      assert.strictEqual(validateEmail(null).isValid, false);
      assert.strictEqual(validateEmail(undefined).isValid, false);
    });

    it('rejects malformed email formats without domain or at-sign', () => {
      assert.strictEqual(validateEmail('plainaddress').isValid, false);
      assert.strictEqual(validateEmail('missingdomain@').isValid, false);
      assert.strictEqual(validateEmail('@missinguser.com').isValid, false);
      assert.strictEqual(validateEmail('spaces in@domain.com').isValid, false);
    });
  });

  describe('2. State Machine Transitions', () => {
    it('initializes in IDLE state', () => {
      const machine = createSignupStateMachine();
      assert.strictEqual(machine.getState(), FORM_STATES.IDLE);
    });

    it('transitions from IDLE to ERROR when invalid input is submitted without calling asyncSubmit', async () => {
      let asyncCalled = false;
      const machine = createSignupStateMachine({
        asyncSubmit: async () => {
          asyncCalled = true;
          return { success: true };
        }
      });

      const outcome = await machine.submit('invalid-email');

      assert.strictEqual(outcome, false);
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);
      assert.strictEqual(asyncCalled, false);
      assert.match(machine.getContext().error, /valid email/i);
    });

    it('transitions IDLE -> SUBMITTING -> SUCCESS on successful submission', async () => {
      const stateHistory = [];
      const machine = createSignupStateMachine({
        asyncSubmit: async (email) => {
          return { success: true, message: `Access granted for ${email}` };
        },
        onStateChange: (newState) => {
          stateHistory.push(newState);
        }
      });

      const outcome = await machine.submit('valid@aetheria.io');

      assert.strictEqual(outcome, true);
      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
      assert.deepStrictEqual(stateHistory, [FORM_STATES.SUBMITTING, FORM_STATES.SUCCESS]);
      assert.strictEqual(machine.getContext().message, 'Access granted for valid@aetheria.io');
    });

    it('transitions IDLE -> SUBMITTING -> ERROR on async submission failure', async () => {
      const stateHistory = [];
      const machine = createSignupStateMachine({
        asyncSubmit: async () => {
          throw new Error('503 Service Unavailable: Cluster overloaded');
        },
        onStateChange: (newState) => {
          stateHistory.push(newState);
        }
      });

      const outcome = await machine.submit('engineer@aetheria.io');

      assert.strictEqual(outcome, false);
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);
      assert.deepStrictEqual(stateHistory, [FORM_STATES.SUBMITTING, FORM_STATES.ERROR]);
      assert.strictEqual(machine.getContext().error, '503 Service Unavailable: Cluster overloaded');
    });

    it('rejects concurrent double-submission while in SUBMITTING state', async () => {
      let resolveSubmit;
      const slowAsync = () => new Promise((resolve) => { resolveSubmit = resolve; });

      const machine = createSignupStateMachine({
        asyncSubmit: slowAsync
      });

      // Launch first submission
      const firstPromise = machine.submit('first@aetheria.io');
      assert.strictEqual(machine.getState(), FORM_STATES.SUBMITTING);

      // Attempt second submission while still in SUBMITTING
      const secondOutcome = await machine.submit('second@aetheria.io');
      assert.strictEqual(secondOutcome, false);
      assert.strictEqual(machine.getState(), FORM_STATES.SUBMITTING);

      // Complete first submission
      resolveSubmit({ success: true, message: 'Done' });
      const firstOutcome = await firstPromise;

      assert.strictEqual(firstOutcome, true);
      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
    });

    it('allows retry submission from ERROR state (ERROR -> SUBMITTING -> SUCCESS)', async () => {
      let attempt = 0;
      const machine = createSignupStateMachine({
        asyncSubmit: async () => {
          attempt++;
          if (attempt === 1) throw new Error('Temporary glitch');
          return { success: true, message: 'Recovered' };
        }
      });

      // First attempt fails
      await machine.submit('user@domain.com');
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);

      // Second attempt succeeds
      const retryOutcome = await machine.submit('user@domain.com');
      assert.strictEqual(retryOutcome, true);
      assert.strictEqual(machine.getState(), FORM_STATES.SUCCESS);
    });

    it('resets from ERROR to IDLE cleanly', async () => {
      const machine = createSignupStateMachine();
      await machine.submit('bad-input');
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);

      const resetOutcome = machine.reset();
      assert.strictEqual(resetOutcome, true);
      assert.strictEqual(machine.getState(), FORM_STATES.IDLE);
      assert.strictEqual(machine.getContext().error, null);
    });

    it('rejects illegal direct transition jumps', () => {
      const machine = createSignupStateMachine();
      assert.strictEqual(machine.getState(), FORM_STATES.IDLE);

      // IDLE cannot jump directly to SUCCESS
      const invalidJump = machine.transition(FORM_STATES.SUCCESS);
      assert.strictEqual(invalidJump, false);
      assert.strictEqual(machine.getState(), FORM_STATES.IDLE);
    });
  });

  describe('3. UI State Synchronization', () => {
    function createMockElements() {
      return {
        input: { disabled: false, focusCalled: false, focus() { this.focusCalled = true; } },
        inputWrapper: {
          classes: new Set(),
          classList: {
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            classes: new Set()
          }
        },
        submitBtn: { disabled: false },
        btnText: { textContent: 'Request Key' },
        errorBox: {
          hidden: true,
          classList: {
            add(c) { if (c === 'hidden') this.hidden = true; },
            remove(c) { if (c === 'hidden') this.hidden = false; },
            hidden: true
          }
        },
        errorMsg: { textContent: '' },
        successBox: {
          hidden: true,
          classList: {
            add(c) { if (c === 'hidden') this.hidden = true; },
            remove(c) { if (c === 'hidden') this.hidden = false; },
            hidden: true
          }
        },
        successMsg: { textContent: '' }
      };
    }

    it('updates elements appropriately during SUBMITTING state', async () => {
      const mockElements = createMockElements();
      let resolveAsync;
      const machine = createSignupStateMachine({
        elements: mockElements,
        asyncSubmit: () => new Promise((res) => { resolveAsync = res; })
      });

      const promise = machine.submit('test@aetheria.io');

      assert.strictEqual(mockElements.input.disabled, true);
      assert.strictEqual(mockElements.submitBtn.disabled, true);
      assert.strictEqual(mockElements.btnText.textContent, 'Verifying...');
      assert.strictEqual(mockElements.errorBox.classList.hidden, true);
      assert.strictEqual(mockElements.successBox.classList.hidden, true);

      resolveAsync({ success: true, message: 'All set' });
      await promise;

      assert.strictEqual(mockElements.btnText.textContent, 'Key Dispatched');
      assert.strictEqual(mockElements.successBox.classList.hidden, false);
      assert.strictEqual(mockElements.successMsg.textContent, 'All set');
    });

    it('updates elements appropriately during ERROR state', async () => {
      const mockElements = createMockElements();
      const machine = createSignupStateMachine({
        elements: mockElements
      });

      await machine.submit('bad-email');

      assert.strictEqual(mockElements.input.disabled, false);
      assert.strictEqual(mockElements.submitBtn.disabled, false);
      assert.strictEqual(mockElements.btnText.textContent, 'Try Again');
      assert.strictEqual(mockElements.errorBox.classList.hidden, false);
      assert.match(mockElements.errorMsg.textContent, /valid email/i);
    });
  });

  describe('4. Event Listener Hygiene & Duplicate Prevention', () => {
    it('cleans up previous listeners when initSignupForm is invoked repeatedly', () => {
      let listenerCount = 0;
      const mockForm = {
        addEventListener(event, handler) {
          listenerCount++;
        },
        querySelector(selector) {
          return null;
        }
      };

      const instance1 = initSignupForm(mockForm);
      assert.ok(mockForm._stateMachine);

      // Calling init again replaces previous instance and prevents duplicate active listeners
      const instance2 = initSignupForm(mockForm);
      assert.strictEqual(mockForm._stateMachine, instance2);

      // Clean destruction
      instance2.destroy();
      assert.strictEqual(mockForm._stateMachine, undefined);
    });
  });
});
