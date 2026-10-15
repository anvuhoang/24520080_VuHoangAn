/**
 * HW3: Resilient Landing Page - Engine Core
 * Slice 1: Drift-Free UTC Countdown Engine
 * -----------------------------------------------------------------------------
 * Resilience Characteristics:
 * 1. Target Invariance: Strict UTC ISO 8601 timestamp ending in 'Z'.
 * 2. Drift Immunity: Recalculates remaining time from (target - Date.now()) on
 *    every tick; never decrements a tick-counter state.
 * 3. Completion Clamping: Clamps at zero when target is reached or passed.
 * 4. Resource Hygiene: Immediately clears setInterval on completion or teardown.
 * -----------------------------------------------------------------------------
 * Note: Form logic intentionally untouched for Slice 1.
 */

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
 *
 * @param {Object} options
 * @param {string} [options.target=DEFAULT_TARGET_UTC] - UTC ISO 8601 timestamp ending in 'Z'
 * @param {Object} [options.elements] - Bound DOM elements
 * @param {HTMLElement} [options.elements.daysEl]
 * @param {HTMLElement} [options.elements.hoursEl]
 * @param {HTMLElement} [options.elements.minutesEl]
 * @param {HTMLElement} [options.elements.secondsEl]
 * @param {Function} [options.onTick] - Callback executed on each evaluation
 * @param {Function} [options.onComplete] - Callback executed when clamped at zero
 * @param {number} [options.tickInterval=1000] - Interval tick rate in ms
 * @param {Function} [options.nowFn=Date.now] - Current time provider
 * @returns {{ start: Function, stop: Function, isRunning: Function, getRemaining: Function, tick: Function }}
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

// Browser bootstrap
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const countdownWrapper = document.getElementById('countdown');
    const targetUtc = countdownWrapper?.dataset?.target || DEFAULT_TARGET_UTC;

    const elements = {
      daysEl: document.getElementById('days-val'),
      hoursEl: document.getElementById('hours-val'),
      minutesEl: document.getElementById('minutes-val'),
      secondsEl: document.getElementById('seconds-val')
    };

    const countdown = createCountdown({
      target: targetUtc,
      elements,
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

    // Prevent memory leaks on page unload / navigation
    window.addEventListener('beforeunload', () => {
      countdown.stop();
    });
  });
}

// CommonJS / Node.js export for automated tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_TARGET_UTC,
    isValidUtcIsoString,
    calculateRemainingTime,
    formatTimeUnit,
    createCountdown
  };
}
