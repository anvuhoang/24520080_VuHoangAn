/**
 * Anti-drift countdown timer for the Vietnam mega-sale scenario (11.11 midnight flash sale).
 *
 * Why this does not drift
 * -----------------------
 * A `setInterval` countdown subtracts a fixed step on every tick. Every late, coalesced or
 * skipped tick is lost for good, so the error only grows. This timer never accumulates.
 * Each sample computes `remaining = targetTime - now()` from an absolute target, so the
 * value is as accurate as the clock at the moment of the sample, however late the frame ran.
 *
 * Background tabs
 * ---------------
 * `requestAnimationFrame` pauses in a hidden tab. Nothing is lost, because the next sample
 * after the tab returns is computed from the absolute target. Two extra safeguards:
 *   1. A `visibilitychange` listener samples immediately when the tab becomes visible, so
 *      the display is correct before the next frame.
 *   2. One drift-corrected `setTimeout` is armed for the exact remaining time, so the
 *      completion callback still fires while the tab is hidden. Browsers may delay it;
 *      `lateByMs` on the completion event reports how late it actually was.
 *
 * Accuracy
 * --------
 * Samples are exact to the millisecond relative to the clock they read. The clock is
 * `Date.now()` by default, so accuracy against the real world is bounded by the device clock.
 * `calibrate()` removes a constant device-to-server offset (error up to half the round trip).
 * `Date.now()` is not monotonic: if the user changes the device clock, the countdown follows it.
 * Frames arrive at the display rate (about 16.7 ms at 60 Hz); values are exact at each frame.
 *
 * Ownership: the timer owns its frame request, its fallback timeout and its visibility
 * listener. `stop()`, completion and `dispose()` release all three.
 *
 * Time is injected (`now`, `requestFrame`, `setTimer`, ...) so the module runs in Node
 * and can be tested with a fake clock. The defaults use the browser globals.
 */

/** Vietnam uses a fixed UTC+7 offset with no daylight saving. */
export const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Largest delay `setTimeout` accepts. Longer waits are re-armed in steps. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Smallest delay when re-arming, so a timeout that fires a hair early cannot spin. */
const MIN_TIMEOUT_MS = 1;

/**
 * One countdown sample. The same object is reused for every tick to avoid allocating
 * at frame rate. Copy the fields you need if you keep them past the callback.
 *
 * @typedef {object} Countdown
 * @property {number} remainingMs Milliseconds left. An integer, never negative.
 * @property {number} days Whole days left.
 * @property {number} hours Hours within the day, 0 to 23.
 * @property {number} minutes Minutes within the hour, 0 to 59.
 * @property {number} seconds Seconds within the minute, 0 to 59.
 * @property {number} milliseconds Milliseconds within the second, 0 to 999.
 * @property {number} sampledAt Epoch milliseconds, offset-corrected, at which the clock was read.
 * @property {number} sinceLastSampleMs Milliseconds since the previous clock read. A large value
 *   means frames were skipped (hidden or throttled tab). 0 for the first sample.
 */

/**
 * Passed to `onComplete` exactly once.
 *
 * @typedef {object} CompletionInfo
 * @property {number} targetTime The target, in epoch milliseconds.
 * @property {number} completedAt Offset-corrected epoch milliseconds at which completion was noticed.
 * @property {number} lateByMs How long after the target completion was noticed. 0 or more.
 *   Near 0 in a visible tab; larger when the tab was hidden or the main thread was busy.
 */

/**
 * @typedef {object} TimerOptions
 * @property {number} targetTime Epoch milliseconds at which the countdown ends.
 * @property {(countdown: Countdown) => void} [onTick] Called when the displayed value changes.
 *   Receives a reused object.
 * @property {(info: CompletionInfo) => void} [onComplete] Called once when the target is reached.
 * @property {number} [resolutionMs=1] Smallest displayed step. 1 emits on every frame. 1000 emits
 *   only when the whole-second display changes, which avoids needless DOM writes.
 * @property {number} [offsetMs=0] Added to the clock before use. Positive when the device clock
 *   is behind the server. Usually set through `calibrate()`.
 * @property {boolean} [backgroundCompletion=true] Arm the fallback timeout so completion fires
 *   while the tab is hidden.
 * @property {() => number} [now] Clock in epoch milliseconds. Defaults to `Date.now`.
 * @property {(callback: () => void) => number} [requestFrame] Defaults to `requestAnimationFrame`.
 * @property {(id: number) => void} [cancelFrame] Defaults to `cancelAnimationFrame`.
 * @property {(callback: () => void, delayMs: number) => unknown} [setTimer] Defaults to `setTimeout`.
 * @property {(id: unknown) => void} [clearTimer] Defaults to `clearTimeout`.
 * @property {{ hidden: boolean, addEventListener: Function, removeEventListener: Function } | null} [visibility]
 *   Document-like object for `visibilitychange`. Defaults to `document` when present.
 */

/**
 * Splits a duration into days, hours, minutes, seconds and milliseconds.
 *
 * @param {number} ms Non-negative duration in milliseconds.
 * @param {{ days?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number }} [out]
 *   Object to fill. Pass the same object repeatedly to avoid allocation.
 * @returns {{ days: number, hours: number, minutes: number, seconds: number, milliseconds: number }}
 */
export function splitDuration(ms, out = {}) {
  const total = Math.max(0, Math.floor(ms));
  out.days = Math.floor(total / MS_PER_DAY);
  out.hours = Math.floor((total % MS_PER_DAY) / MS_PER_HOUR);
  out.minutes = Math.floor((total % MS_PER_HOUR) / MS_PER_MINUTE);
  out.seconds = Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND);
  out.milliseconds = total % MS_PER_SECOND;
  return /** @type {any} */ (out);
}

/**
 * Formats a duration as `[Nd ]HH:MM:SS[.mmm]`.
 *
 * @param {number} ms Duration in milliseconds.
 * @param {{ milliseconds?: boolean }} [options] Include the `.mmm` part. Default true.
 * @returns {string}
 */
export function formatCountdown(ms, { milliseconds = true } = {}) {
  const t = splitDuration(ms);
  const two = (n) => String(n).padStart(2, '0');
  const clock = `${two(t.hours)}:${two(t.minutes)}:${two(t.seconds)}`;
  const fraction = milliseconds ? `.${String(t.milliseconds).padStart(3, '0')}` : '';
  return `${t.days > 0 ? `${t.days}d ` : ''}${clock}${fraction}`;
}

/**
 * Converts a Vietnam local date and time (UTC+7) to epoch milliseconds.
 *
 * @param {object} parts
 * @param {number} parts.year
 * @param {number} parts.month 1 to 12.
 * @param {number} parts.day 1 to 31.
 * @param {number} [parts.hour=0]
 * @param {number} [parts.minute=0]
 * @param {number} [parts.second=0]
 * @param {number} [parts.millisecond=0]
 * @returns {number} Epoch milliseconds.
 */
export function vietnamLocalToEpoch({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }) {
  const fields = { year, month, day, hour, minute, second, millisecond };
  for (const [name, value] of Object.entries(fields)) {
    if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer; received ${value}`);
  }
  if (month < 1 || month > 12) throw new RangeError(`month must be 1 to 12; received ${month}`);
  if (day < 1 || day > 31) throw new RangeError(`day must be 1 to 31; received ${day}`);
  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - VIETNAM_UTC_OFFSET_MINUTES * MS_PER_MINUTE;
}

/**
 * The next 11.11 midnight (00:00:00.000 Vietnam time) strictly after `fromMs`.
 * Pass another month and day for other mega-sale dates (for example 12.12).
 *
 * @param {number} fromMs Epoch milliseconds to search from.
 * @param {{ month?: number, day?: number }} [date] Defaults to 11 November.
 * @returns {number} Epoch milliseconds of the next sale start.
 */
export function nextMegaSaleStart(fromMs, { month = 11, day = 11 } = {}) {
  // Read the year as Vietnam sees it, not as UTC does.
  const vietnamYear = new Date(fromMs + VIETNAM_UTC_OFFSET_MINUTES * MS_PER_MINUTE).getUTCFullYear();
  const thisYear = vietnamLocalToEpoch({ year: vietnamYear, month, day });
  return thisYear > fromMs ? thisYear : vietnamLocalToEpoch({ year: vietnamYear + 1, month, day });
}

/** @returns {number} */
function defaultRequestFrame(callback) {
  if (typeof requestAnimationFrame !== 'function') {
    throw new Error('requestAnimationFrame is not available; pass requestFrame in the options');
  }
  return requestAnimationFrame(callback);
}

function defaultCancelFrame(id) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
}

export class AntiDriftTimer {
  #targetTime;
  #offsetMs;
  #resolutionMs;
  #backgroundCompletion;
  #now;
  #requestFrame;
  #cancelFrame;
  #setTimer;
  #clearTimer;
  #visibility;
  #onTick;
  #onComplete;

  #frameId = null;
  #timeoutId = null;
  #running = false;
  #completed = false;
  #disposed = false;
  #listening = false;
  #lastBucket = Number.NaN;
  #lastReadAt = null;
  /** Reused for every tick. */
  #snapshot = {
    remainingMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    sampledAt: 0,
    sinceLastSampleMs: 0,
  };

  /** Bound once. A stored reference lets the same function be removed later. */
  #handleFrame = () => {
    this.#frameId = null;
    if (!this.#running) return;
    // Schedule first, so a throwing callback cannot end the loop.
    this.#scheduleFrame();
    this.#sample(false);
  };

  #handleTimeout = () => {
    this.#timeoutId = null;
    if (!this.#running) return;
    this.#sample(false);
    if (this.#running) this.#armTimeout();
  };

  #handleVisibility = () => {
    if (!this.#running || this.#visibility?.hidden) return;
    // The tab is visible again. Show the right value now, without waiting for a frame.
    this.#sample(true);
    if (this.#running) this.#armTimeout();
  };

  /**
   * @param {TimerOptions} options
   */
  constructor(options) {
    assertTarget(options.targetTime);
    const resolutionMs = options.resolutionMs ?? 1;
    if (!(resolutionMs >= 1)) throw new RangeError(`resolutionMs must be >= 1; received ${resolutionMs}`);
    const offsetMs = options.offsetMs ?? 0;
    if (!Number.isFinite(offsetMs)) throw new RangeError(`offsetMs must be finite; received ${offsetMs}`);

    this.#targetTime = options.targetTime;
    this.#offsetMs = offsetMs;
    this.#resolutionMs = resolutionMs;
    this.#backgroundCompletion = options.backgroundCompletion ?? true;
    this.#onTick = options.onTick;
    this.#onComplete = options.onComplete;
    // `Date.now` is passed as a reference, never called here. Tests inject a fake clock.
    this.#now = options.now ?? Date.now;
    this.#requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.#cancelFrame = options.cancelFrame ?? defaultCancelFrame;
    this.#setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimer = options.clearTimer ?? ((id) => clearTimeout(/** @type {any} */ (id)));
    this.#visibility =
      options.visibility !== undefined ? options.visibility : typeof document !== 'undefined' ? document : null;
  }

  /** @returns {boolean} True while the countdown is running. */
  get running() {
    return this.#running;
  }

  /** @returns {boolean} True once the target has been reached. */
  get completed() {
    return this.#completed;
  }

  /** @returns {number} The target, in epoch milliseconds. */
  get targetTime() {
    return this.#targetTime;
  }

  /** @returns {number} The offset currently added to the clock. */
  get offsetMs() {
    return this.#offsetMs;
  }

  /**
   * Milliseconds left right now. Reads the clock; does not emit a tick.
   * @returns {number}
   */
  get remainingMs() {
    return Math.max(0, this.#targetTime - (this.#now() + this.#offsetMs));
  }

  /**
   * Starts the countdown. The first sample is taken at once, so the display is correct
   * without waiting for the first frame. If the target has already passed, the final tick
   * and `onComplete` fire before `start()` returns. Does nothing if already running or complete.
   */
  start() {
    this.#assertNotDisposed();
    if (this.#running || this.#completed) return;
    this.#running = true;
    this.#lastBucket = Number.NaN;
    this.#lastReadAt = null;
    this.#listen();
    this.#sample(true);
    if (!this.#running) return;
    this.#scheduleFrame();
    this.#armTimeout();
  }

  /** Pauses the display updates and releases the frame, timeout and listener. `start()` resumes. */
  stop() {
    this.#running = false;
    this.#release();
  }

  /**
   * Replaces the target. Clears the completed state, so a finished timer can count to a new
   * moment (for example from sale start to sale end).
   * @param {number} targetTime Epoch milliseconds.
   */
  retarget(targetTime) {
    this.#assertNotDisposed();
    assertTarget(targetTime);
    this.#targetTime = targetTime;
    this.#completed = false;
    this.#lastBucket = Number.NaN;
    if (this.#running) {
      this.#sample(true);
      if (this.#running) this.#armTimeout();
    }
  }

  /**
   * Sets the clock offset directly.
   * @param {number} offsetMs Positive when the device clock is behind the server.
   */
  setOffset(offsetMs) {
    this.#assertNotDisposed();
    if (!Number.isFinite(offsetMs)) throw new RangeError(`offsetMs must be finite; received ${offsetMs}`);
    this.#offsetMs = offsetMs;
    if (this.#running) {
      this.#sample(true);
      if (this.#running) this.#armTimeout();
    }
  }

  /**
   * Aligns the timer with server time using one request and response.
   * Assumes the server stamped its time halfway through the round trip, so the error is at
   * most half the round trip. Take several samples and keep the one with the shortest trip
   * for the best result.
   *
   * @param {number} serverTimeMs Server time from the response, in epoch milliseconds.
   * @param {number} sentAtMs Client clock when the request was sent.
   * @param {number} receivedAtMs Client clock when the response arrived.
   * @returns {number} The offset that was applied, in milliseconds.
   */
  calibrate(serverTimeMs, sentAtMs, receivedAtMs) {
    if (!(receivedAtMs >= sentAtMs)) throw new RangeError('receivedAtMs must not be earlier than sentAtMs');
    const roundTrip = receivedAtMs - sentAtMs;
    const offsetMs = serverTimeMs + roundTrip / 2 - receivedAtMs;
    this.setOffset(offsetMs);
    return offsetMs;
  }

  /** Stops the timer and makes it unusable. Safe to call more than once. */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#running = false;
    this.#release();
    this.#onTick = undefined;
    this.#onComplete = undefined;
    this.#visibility = null;
  }

  #assertNotDisposed() {
    if (this.#disposed) throw new Error('AntiDriftTimer has been disposed');
  }

  /**
   * Reads the clock and emits a tick if the displayed value changed, or if `force` is set.
   * Completes the timer when the target is reached.
   * @param {boolean} force
   */
  #sample(force) {
    const sampledAt = this.#now() + this.#offsetMs;
    const remainingMs = Math.max(0, this.#targetTime - sampledAt);
    const sinceLast = this.#lastReadAt === null ? 0 : sampledAt - this.#lastReadAt;
    this.#lastReadAt = sampledAt;

    if (remainingMs === 0) {
      this.#emit(0, sampledAt, sinceLast);
      this.#finish(sampledAt);
      return;
    }
    // Rounding up means a coarse display changes exactly when it should: "3" shows
    // from 3000 ms down to 2001 ms, and "2" starts at 2000 ms.
    const bucket = Math.ceil(remainingMs / this.#resolutionMs);
    if (force || bucket !== this.#lastBucket) {
      this.#lastBucket = bucket;
      this.#emit(remainingMs, sampledAt, sinceLast);
    }
  }

  /**
   * @param {number} remainingMs
   * @param {number} sampledAt
   * @param {number} sinceLast
   */
  #emit(remainingMs, sampledAt, sinceLast) {
    if (!this.#onTick) return;
    const snapshot = this.#snapshot;
    splitDuration(remainingMs, snapshot);
    snapshot.remainingMs = remainingMs;
    snapshot.sampledAt = sampledAt;
    snapshot.sinceLastSampleMs = sinceLast;
    this.#onTick(snapshot);
  }

  /** @param {number} sampledAt */
  #finish(sampledAt) {
    this.#completed = true;
    this.#running = false;
    this.#release();
    this.#onComplete?.({
      targetTime: this.#targetTime,
      completedAt: sampledAt,
      lateByMs: Math.max(0, sampledAt - this.#targetTime),
    });
  }

  #scheduleFrame() {
    this.#frameId = this.#requestFrame(this.#handleFrame);
  }

  /**
   * Arms one timeout for the exact remaining time. It is a single wait computed from the
   * absolute target, not a chain of fixed steps, so it cannot accumulate error.
   */
  #armTimeout() {
    if (!this.#backgroundCompletion) return;
    if (this.#timeoutId !== null) this.#clearTimer(this.#timeoutId);
    const remaining = this.#targetTime - (this.#now() + this.#offsetMs);
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, remaining));
    this.#timeoutId = this.#setTimer(this.#handleTimeout, delay);
  }

  #listen() {
    if (this.#listening || !this.#visibility) return;
    this.#visibility.addEventListener('visibilitychange', this.#handleVisibility);
    this.#listening = true;
  }

  /** Releases the frame request, the timeout and the listener. */
  #release() {
    if (this.#frameId !== null) {
      this.#cancelFrame(this.#frameId);
      this.#frameId = null;
    }
    if (this.#timeoutId !== null) {
      this.#clearTimer(this.#timeoutId);
      this.#timeoutId = null;
    }
    if (this.#listening && this.#visibility) {
      this.#visibility.removeEventListener('visibilitychange', this.#handleVisibility);
      this.#listening = false;
    }
  }
}

/** @param {unknown} targetTime */
function assertTarget(targetTime) {
  if (typeof targetTime !== 'number' || !Number.isFinite(targetTime)) {
    throw new RangeError(`targetTime must be a finite number of epoch milliseconds; received ${targetTime}`);
  }
}
