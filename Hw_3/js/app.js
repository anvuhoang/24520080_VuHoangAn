/**
 * HW3: Resilient Landing Page - Engine Core
 * -----------------------------------------------------------------------------
 * Slice 1: Drift-Free UTC Countdown Engine
 * Slice 2: Signup Form State Machine (idle, submitting, success, error)
 * -----------------------------------------------------------------------------
 * Resilience Characteristics:
 * 1. Target Invariance: Strict UTC ISO 8601 timestamp ending in 'Z'.
 * 2. Drift Immunity: Recalculates remaining time from (target - Date.now()).
 * 3. Completion Clamping: Clamps at zero when target is reached or passed.
 * 4. Resource Hygiene: Immediate cleanup of timers & event listeners.
 * 5. Deterministic State Machine: Explicit transitions prevent double-submits.
 * 6. Defensive Validation: Verifies input before initiating async network I/O.
 */

/* ==========================================================================
   SLICE 1: DRIFT-FREE COUNTDOWN ENGINE
   ========================================================================== */

const DEFAULT_TARGET_UTC = '2026-11-01T00:00:00Z';

/**
 * Validates that a string is a UTC ISO 8601 representation ending in 'Z'.
 * @param {string} timestamp
 * @returns {boolean}
 */
function isValidUtcIsoString(timestamp) {
  if (typeof timestamp !== 'string' || !timestamp.endsWith('Z')) {
    return false;
  }
  const parsed = Date.parse(timestamp);
  return !Number.isNaN(parsed);
}

/**
 * Calculates remaining time until target UTC ISO 8601 timestamp.
 * Drift-free: directly evaluates (target - now).
 * Clamps all values to zero when target has elapsed.
 *
 * @param {string|number} target - Target UTC ISO 8601 string ending in 'Z' or epoch ms
 * @param {number} [now=Date.now()] - Current epoch ms (injectable for determinism)
 * @returns {{ days: number, hours: number, minutes: number, seconds: number, totalMs: number, isComplete: boolean }}
 */
function calculateRemainingTime(target, now = Date.now()) {
  let targetMs;

  if (typeof target === 'string') {
    if (!target.endsWith('Z')) {
      throw new Error(`Target timestamp must be a UTC ISO 8601 string ending in 'Z'. Received: "${target}"`);
    }
    targetMs = Date.parse(target);
    if (Number.isNaN(targetMs)) {
      throw new Error(`Invalid UTC timestamp: "${target}"`);
    }
  } else if (typeof target === 'number' && !Number.isNaN(target)) {
    targetMs = target;
  } else {
    throw new Error('Target must be a UTC ISO 8601 string ending in "Z" or a valid numeric timestamp.');
  }

  const remainingMs = targetMs - now;

  if (remainingMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isComplete: true
    };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: remainingMs,
    isComplete: false
  };
}

/**
 * Pads numeric unit with leading zero for consistent 2-digit display.
 * @param {number} unit
 * @returns {string}
 */
function formatTimeUnit(unit) {
  return String(Math.max(0, unit)).padStart(2, '0');
}

/**
 * Creates and manages a countdown timer controller with interval cleanup.
 */
function createCountdown(options = {}) {
  const {
    target = DEFAULT_TARGET_UTC,
    elements = {},
    onTick,
    onComplete,
    tickInterval = 1000,
    nowFn = Date.now
  } = options;

  let intervalId = null;
  let running = false;

  function render(time) {
    if (elements.daysEl) elements.daysEl.textContent = formatTimeUnit(time.days);
    if (elements.hoursEl) elements.hoursEl.textContent = formatTimeUnit(time.hours);
    if (elements.minutesEl) elements.minutesEl.textContent = formatTimeUnit(time.minutes);
    if (elements.secondsEl) elements.secondsEl.textContent = formatTimeUnit(time.seconds);
  }

  function tick() {
    const time = calculateRemainingTime(target, nowFn());
    render(time);

    if (typeof onTick === 'function') {
      onTick(time);
    }

    if (time.isComplete) {
      stop();
      if (typeof onComplete === 'function') {
        onComplete(time);
      }
    }

    return time;
  }

  function start() {
    if (running) return;
    running = true;

    // Immediate initial tick avoids 1-second blank or stale initial state
    const initialTime = tick();

    if (!initialTime.isComplete) {
      intervalId = setInterval(tick, tickInterval);
    }
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
  }

  return {
    start,
    stop,
    isRunning: () => running,
    getRemaining: () => calculateRemainingTime(target, nowFn()),
    tick
  };
}

/* ==========================================================================
   SLICE 2: SIGNUP FORM STATE MACHINE
   ========================================================================== */

/**
 * Explicit finite states for signup form.
 */
const FORM_STATES = Object.freeze({
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error'
});

/**
 * Deterministic state transition table.
 * Guards against illegal jumps and duplicate submissions.
 */
const VALID_TRANSITIONS = Object.freeze({
  [FORM_STATES.IDLE]: Object.freeze([FORM_STATES.SUBMITTING, FORM_STATES.ERROR]),
  [FORM_STATES.SUBMITTING]: Object.freeze([FORM_STATES.SUCCESS, FORM_STATES.ERROR]),
  [FORM_STATES.SUCCESS]: Object.freeze([FORM_STATES.IDLE]),
  [FORM_STATES.ERROR]: Object.freeze([FORM_STATES.SUBMITTING, FORM_STATES.IDLE])
});

/**
 * Normalizes user email input:
 * 1. Strips ASCII control characters (0x00-0x1F, 0x7F) and null bytes.
 * 2. Trims leading and trailing whitespace.
 * 3. Converts to lowercase for deterministic storage.
 *
 * @param {string} input
 * @returns {string}
 */
function normalizeEmail(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Validates and normalizes input prior to network submission.
 * Enforces strict XSS payload rejection, RFC length limits, and syntax checks.
 *
 * @param {string} email
 * @returns {{ isValid: boolean, sanitized?: string, normalized?: string, error?: string }}
 */
function validateEmail(email) {
  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email address must be a string.' };
  }

  const trimmed = email.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }

  // Strict rejection of XSS characters & injection payloads
  if (/[<>"'`\\;\x00-\x1F\x7F]/.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address. Special characters (<, >, ", \', `, \\, ;) are not permitted.'
    };
  }

  const normalized = normalizeEmail(email);

  // RFC 5321 length constraint (254 characters maximum)
  if (normalized.length > 254) {
    return {
      isValid: false,
      error: 'Email address exceeds maximum allowed length of 254 characters.'
    };
  }

  // Standard safe RFC email syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g., engineer@domain.com).'
    };
  }

  return {
    isValid: true,
    sanitized: normalized,
    normalized
  };
}

/**
 * Default asynchronous mock submission handler.
 * @param {string} email
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function defaultAsyncSubmit(email) {
  // Simulates network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (email.toLowerCase().includes('fail') || email.toLowerCase().includes('reject')) {
    throw new Error('Cluster rejected request. Upstream authorization service unavailable.');
  }

  return {
    success: true,
    message: 'Access requested! Verification link dispatched to your inbox.'
  };
}

/**
 * Updates UI DOM elements to reflect the current state machine state.
 * @param {string} state - Current FORM_STATES value
 * @param {Object} context - State context { error, message, email }
 * @param {Object} elements - Bound DOM elements
 */
function renderFormUi(state, context = {}, elements = {}) {
  const { input, inputWrapper, submitBtn, btnText, errorBox, errorMsg, successBox, successMsg } = elements;

  switch (state) {
    case FORM_STATES.IDLE:
      if (input) {
        input.disabled = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute?.('aria-disabled');
        submitBtn.removeAttribute?.('aria-busy');
      }
      if (btnText) {
        btnText.textContent = 'Request Key';
      }
      if (errorBox) {
        errorBox.classList.add('hidden');
      }
      if (successBox) {
        successBox.classList.add('hidden');
      }
      if (inputWrapper) {
        inputWrapper.classList.remove('has-error');
      }
      break;

    case FORM_STATES.SUBMITTING:
      if (input) {
        input.disabled = true;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute?.('aria-disabled', 'true');
        submitBtn.setAttribute?.('aria-busy', 'true');
      }
      if (btnText) {
        btnText.textContent = 'Verifying...';
      }
      if (errorBox) {
        errorBox.classList.add('hidden');
      }
      if (successBox) {
        successBox.classList.add('hidden');
      }
      if (inputWrapper) {
        inputWrapper.classList.remove('has-error');
      }
      break;

    case FORM_STATES.SUCCESS:
      if (input) {
        input.disabled = true;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute?.('aria-disabled', 'true');
        submitBtn.removeAttribute?.('aria-busy');
      }
      if (btnText) {
        btnText.textContent = 'Key Dispatched';
      }
      if (errorBox) {
        errorBox.classList.add('hidden');
      }
      if (successBox) {
        successBox.classList.remove('hidden');
        if (successMsg && context.message) {
          successMsg.textContent = context.message;
        }
      }
      if (inputWrapper) {
        inputWrapper.classList.remove('has-error');
      }
      break;

    case FORM_STATES.ERROR:
      if (input) {
        input.disabled = false;
        input.focus?.();
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute?.('aria-disabled');
        submitBtn.removeAttribute?.('aria-busy');
      }
      if (btnText) {
        btnText.textContent = 'Try Again';
      }
      if (errorBox) {
        errorBox.classList.remove('hidden');
        if (errorMsg && context.error) {
          errorMsg.textContent = context.error;
        }
      }
      if (successBox) {
        successBox.classList.add('hidden');
      }
      if (inputWrapper) {
        inputWrapper.classList.add('has-error');
      }
      break;

    default:
      break;
  }
}

/**
 * Creates an instance of the Signup Form State Machine.
 *
 * @param {Object} options
 * @param {Object} [options.elements] - Bound DOM elements
 * @param {Function} [options.asyncSubmit=defaultAsyncSubmit] - Async submit handler returning Promise
 * @param {Function} [options.onStateChange] - Listener for state changes
 * @returns {Object} State machine controller
 */
function createSignupStateMachine(options = {}) {
  const {
    elements = {},
    asyncSubmit = defaultAsyncSubmit,
    onStateChange
  } = options;

  let state = FORM_STATES.IDLE;
  let inFlight = false;
  let context = {
    error: null,
    message: null,
    email: ''
  };

  /**
   * Performs an explicit state transition with rule verification.
   * @param {string} nextState
   * @param {Object} [newContextPayload={}]
   * @returns {boolean} Whether transition succeeded
   */
  function transition(nextState, newContextPayload = {}) {
    const allowed = VALID_TRANSITIONS[state];

    if (!allowed || !allowed.includes(nextState)) {
      console.warn(`[StateMachine] Illegal transition rejected: "${state}" -> "${nextState}"`);
      return false;
    }

    const prevState = state;
    state = nextState;
    context = { ...context, ...newContextPayload };

    renderFormUi(state, context, elements);

    if (typeof onStateChange === 'function') {
      onStateChange(state, prevState, context);
    }

    return true;
  }

  /**
   * Handles user submission attempts.
   * Synchronously guards against concurrent requests and double submissions.
   *
   * @param {string} rawEmail
   * @returns {Promise<boolean>}
   */
  async function submit(rawEmail) {
    // Immediate synchronous lock against concurrent/double submission
    if (inFlight || state === FORM_STATES.SUBMITTING) {
      return false;
    }

    inFlight = true;

    try {
      // Step 1: Pre-flight client validation
      const validation = validateEmail(rawEmail);
      if (!validation.isValid) {
        transition(FORM_STATES.ERROR, {
          error: validation.error,
          email: rawEmail
        });
        return false;
      }

      // Step 2: Transition to SUBMITTING state
      const transitioned = transition(FORM_STATES.SUBMITTING, {
        email: validation.sanitized,
        error: null,
        message: null
      });

      if (!transitioned) {
        return false;
      }

      // Step 3: Handle async dispatch and failure resilience
      try {
        const response = await asyncSubmit(validation.sanitized);
        transition(FORM_STATES.SUCCESS, {
          message: response?.message || 'Access granted. Verification sent.'
        });
        return true;
      } catch (err) {
        const failureMessage = err && err.message
          ? err.message
          : 'Network turbulence detected. Please try again.';
        transition(FORM_STATES.ERROR, {
          error: failureMessage
        });
        return false;
      }
    } finally {
      inFlight = false;
    }
  }

  /**
   * Resets form state back to IDLE.
   */
  function reset() {
    if (inFlight || state === FORM_STATES.SUBMITTING) {
      return false;
    }
    return transition(FORM_STATES.IDLE, {
      error: null,
      message: null,
      email: ''
    });
  }

  // Initial UI sync
  renderFormUi(state, context, elements);

  return {
    getState: () => state,
    getContext: () => ({ ...context }),
    isSubmitting: () => inFlight || state === FORM_STATES.SUBMITTING,
    transition,
    submit,
    reset
  };
}

/**
 * Initializes DOM event listeners idempotently with duplicate prevention.
 * Uses AbortController and attaches cleanup handle to the form element.
 *
 * @param {HTMLFormElement} form
 * @param {Object} [options]
 * @returns {Object} State machine controller instance
 */
function initSignupForm(form, options = {}) {
  if (!form) return null;

  // Clean up any previously attached state machine / listeners to prevent duplicates
  if (form._stateMachine && typeof form._stateMachine.destroy === 'function') {
    form._stateMachine.destroy();
  }

  const abortController = new AbortController();
  const { signal } = abortController;

  const elements = {
    form,
    input: form.querySelector('#user-email'),
    inputWrapper: form.querySelector('.input-affix-wrapper'),
    submitBtn: form.querySelector('#submit-btn'),
    btnText: form.querySelector('#submit-btn span'),
    errorBox: form.querySelector('#form-error'),
    errorMsg: form.querySelector('#form-error-msg'),
    successBox: form.querySelector('#form-success'),
    successMsg: form.querySelector('#form-success-msg')
  };

  const machine = createSignupStateMachine({
    elements,
    asyncSubmit: options.asyncSubmit || defaultAsyncSubmit,
    onStateChange: options.onStateChange
  });

  // Submit handler with rapid-submission guard
  form.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      if (machine.isSubmitting() || (elements.submitBtn && elements.submitBtn.disabled)) {
        return;
      }
      const emailValue = elements.input ? elements.input.value : '';
      machine.submit(emailValue);
    },
    { signal }
  );

  // Direct submit button click guard
  if (elements.submitBtn && typeof elements.submitBtn.addEventListener === 'function') {
    elements.submitBtn.addEventListener(
      'click',
      (e) => {
        if (machine.isSubmitting() || elements.submitBtn.disabled) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
        }
      },
      { signal }
    );
  }

  // Clear error state on input change to enhance responsiveness
  if (elements.input && typeof elements.input.addEventListener === 'function') {
    elements.input.addEventListener(
      'input',
      () => {
        if (machine.getState() === FORM_STATES.ERROR) {
          machine.reset();
        }
      },
      { signal }
    );
  }

  const controller = {
    ...machine,
    destroy: () => {
      abortController.abort();
      if (form._stateMachine === controller) {
        delete form._stateMachine;
      }
    }
  };

  form._stateMachine = controller;
  return controller;
}

/* ==========================================================================
   BROWSER BOOTSTRAP
   ========================================================================== */

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Countdown Initialization
    const countdownWrapper = document.getElementById('countdown');
    const targetUtc = countdownWrapper?.dataset?.target || DEFAULT_TARGET_UTC;

    const countdownElements = {
      daysEl: document.getElementById('days-val'),
      hoursEl: document.getElementById('hours-val'),
      minutesEl: document.getElementById('minutes-val'),
      secondsEl: document.getElementById('seconds-val')
    };

    const countdown = createCountdown({
      target: targetUtc,
      elements: countdownElements,
      onComplete: () => {
        const badge = document.querySelector('.countdown-badge');
        if (badge) {
          badge.textContent = 'DEPLOYED';
          badge.style.color = 'var(--accent-emerald)';
          badge.style.background = 'rgba(16, 185, 129, 0.15)';
        }
      }
    });

    countdown.start();

    // 2. Signup Form State Machine Initialization
    const waitlistForm = document.getElementById('waitlist-form');
    if (waitlistForm) {
      initSignupForm(waitlistForm);
    }

    // Teardown on page unload to prevent leaks
    window.addEventListener('beforeunload', () => {
      countdown.stop();
      if (waitlistForm?._stateMachine) {
        waitlistForm._stateMachine.destroy();
      }
    });
  });
}

/* ==========================================================================
   MODULE EXPORTS (Node.js & Automated Tests)
   ========================================================================== */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Slice 1: Countdown
    DEFAULT_TARGET_UTC,
    isValidUtcIsoString,
    calculateRemainingTime,
    formatTimeUnit,
    createCountdown,

    // Slice 2 & 3: Signup State Machine & Security
    FORM_STATES,
    VALID_TRANSITIONS,
    normalizeEmail,
    validateEmail,
    defaultAsyncSubmit,
    renderFormUi,
    createSignupStateMachine,
    initSignupForm
  };
}
