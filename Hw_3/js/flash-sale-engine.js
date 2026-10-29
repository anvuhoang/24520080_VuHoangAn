import { AntiDriftTimer } from './anti-drift-timer.js';
import { InventoryFsm, ReservationState, isTerminal } from './inventory-fsm.js';

export const SalePhase = Object.freeze({
  UPCOMING: 'UPCOMING',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
});

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export class SaleNotStartedError extends Error {
  /**
   * @param {number} startsAt Server time at which the sale opens.
   * @param {number} retryAfterMs Milliseconds until it opens, by the server clock.
   */
  constructor(startsAt, retryAfterMs) {
    super(`The sale opens at ${startsAt}; retry in ${retryAfterMs} ms`);
    this.name = 'SaleNotStartedError';
    this.startsAt = startsAt;
    this.retryAfterMs = retryAfterMs;
  }
}

export class SaleEndedError extends Error {
  /** @param {number} endsAt Server time at which the sale closed. */
  constructor(endsAt) {
    super(`The sale ended at ${endsAt}`);
    this.name = 'SaleEndedError';
    this.endsAt = endsAt;
  }
}

/**
 * @typedef {'UPCOMING' | 'LIVE' | 'ENDED'} SalePhaseName
 */

/**
 * @typedef {object} ProductDefinition
 * @property {string} sku Unique stock keeping unit.
 * @property {string} name Display name.
 * @property {number} priceMinor Price in the currency's smallest unit, as an integer. For VND this is the dong.
 * @property {number} stock Units offered in the sale.
 * @property {number} [limitPerBuyer] Most units one buyer may hold or own. Defaults to no limit.
 */

/**
 * @typedef {object} FlashSaleEngineOptions
 * @property {ProductDefinition[]} products At least one product.
 * @property {number} saleStartsAt Server epoch milliseconds at which the sale opens.
 * @property {number} saleEndsAt Server epoch milliseconds at which the sale closes. After `saleStartsAt`.
 * @property {() => number} [serverClock] Authoritative time. Defaults to the `Date.now` function.
 * @property {() => number} [clientClock] The device's time, used only by the countdown. Defaults to `serverClock`.
 * @property {number} [holdTtlMs=120000] Lifetime of a new hold.
 * @property {number} [checkoutWindowMs=300000] Deadline given to a hold that begins checkout.
 * @property {number} [maxQuantityPerRequest=5] Largest quantity in one reserve call.
 * @property {number} [countdownResolutionMs=1] Smallest displayed countdown step. 1 emits on every changed frame.
 * @property {number} [recentLimit=100] Finished reservations kept in the display copy.
 * @property {number} [orderLimit=100] Orders kept in the display copy. Totals are never truncated.
 * @property {() => string} [newId] Reservation ids. Defaults to the FSM's counter.
 * @property {(error: unknown) => void} [onError] Receives listener errors. Without it they are rethrown on a microtask.
 * @property {(callback: () => void) => number} [requestFrame] Defaults to `requestAnimationFrame`.
 * @property {(id: number) => void} [cancelFrame] Defaults to `cancelAnimationFrame`.
 * @property {(callback: () => void, delayMs: number) => unknown} [setTimer] Defaults to `setTimeout`.
 * @property {(id: unknown) => void} [clearTimer] Defaults to `clearTimeout`.
 * @property {{ hidden: boolean, addEventListener: Function, removeEventListener: Function } | null} [visibility]
 *   Document-like object for the countdown's `visibilitychange` handling.
 */

/**
 * @typedef {object} Order
 * @property {string} id
 * @property {string} reservationId
 * @property {string} sku
 * @property {string} buyerId
 * @property {number} quantity
 * @property {number} totalMinor `priceMinor * quantity`, an integer.
 * @property {number} confirmedAt Server time of the confirmation.
 */

/**
 * @typedef {import('./inventory-fsm.js').ReservationView} ReservationView
 * @typedef {import('./inventory-fsm.js').StockSnapshot} StockSnapshot
 * @typedef {import('./inventory-fsm.js').ReserveRequest} ReserveRequest
 * @typedef {import('./inventory-fsm.js').Result} Result
 * @typedef {import('./inventory-fsm.js').Violation} Violation
 * @typedef {import('./anti-drift-timer.js').Countdown} Countdown
 */

/**
 * @typedef {object} ProductState
 * @property {string} sku
 * @property {string} name
 * @property {number} priceMinor
 * @property {StockSnapshot} stock
 * @property {boolean} soldOut Nothing available and nothing held: the stock is gone.
 * @property {boolean} heldByOthers Nothing available, but held stock may return.
 */

/**
 * @typedef {object} EngineState
 * @property {SalePhaseName} phase
 * @property {number} startsAt
 * @property {number} endsAt
 * @property {number} serverNow
 * @property {ProductState[]} products
 * @property {Array<ReservationView & { remainingMs: number }>} active Live holds, soonest deadline first.
 * @property {ReservationView[]} recent Finished reservations, newest last.
 * @property {Order[]} orders Recent orders, newest last.
 * @property {{ revenueMinor: number, orders: number, unitsSold: number, activeHolds: number }} totals
 */

/**
 * A countdown that has reached its end, for the final tick of a phase.
 *
 * @param {number} sampledAt Offset-corrected client time of the tick.
 * @returns {Countdown}
 */
function zeroCountdown(sampledAt) {
  return { remainingMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, sampledAt, sinceLastSampleMs: 0 };
}

export class FlashSaleEngine {
  #serverClock;
  #clientClock;
  #fsm;
  #timer = null;
  #timerOptions;
  #countdownResolutionMs;
  #setTimer;
  #clearTimer;
  #onError;
  #startsAt;
  #endsAt;
  #recentLimit;
  #orderLimit;

  /** @type {Map<string, ProductDefinition>} */
  #products = new Map();
  /** @type {SalePhaseName} */
  #phase;
  #started = false;
  #disposed = false;
  #phaseTimerId = null;
  #clientOffsetMs = 0;
  #listeners = new Set();
  /** The phase and remaining time of the last countdown tick sent, to avoid a duplicate final zero. */
  #lastTickPhase = null;
  #lastTickRemainingMs = -1;

  // Display copy, built from the FSM journal.
  /** @type {Map<string, ReservationView>} */
  #active = new Map();
  /** @type {ReservationView[]} */
  #recent = [];
  #recentIds = new Set();
  /** @type {Order[]} */
  #orders = [];
  #ordersByReservation = new Map();
  #revenueMinor = 0;
  #ordersCount = 0;
  #unitsSold = 0;

  /** Bound once so the same function can be handed to the timer every time. */
  #handlePhaseTimer = () => {
    this.#phaseTimerId = null;
    if (this.#disposed) return;
    const before = this.#phase;
    this.#syncPhase();
    // A timer that fires a hair early leaves the phase unchanged. Arm again for the remainder.
    if (this.#phase === before) this.#armPhaseTimer();
  };

  /**
   * @param {FlashSaleEngineOptions} options
   */
  constructor(options) {
    const { products, saleStartsAt, saleEndsAt } = options;
    if (!Array.isArray(products) || products.length === 0) throw new RangeError('products must be a non-empty array');
    if (!Number.isFinite(saleStartsAt) || !Number.isFinite(saleEndsAt) || saleEndsAt <= saleStartsAt) {
      throw new RangeError('saleStartsAt and saleEndsAt must be finite and saleEndsAt must be after saleStartsAt');
    }
    for (const product of products) {
      if (typeof product.sku !== 'string' || product.sku.length === 0) throw new TypeError('each product needs a non-empty sku');
      if (this.#products.has(product.sku)) throw new RangeError(`duplicate product sku ${product.sku}`);
      if (typeof product.name !== 'string' || product.name.length === 0) throw new TypeError(`product ${product.sku} needs a name`);
      if (!Number.isSafeInteger(product.priceMinor) || product.priceMinor < 0) {
        throw new RangeError(`product ${product.sku}: priceMinor must be a non-negative integer`);
      }
      this.#products.set(product.sku, product);
    }

    // `Date.now` is passed as a reference, never called here.
    this.#serverClock = options.serverClock ?? Date.now;
    this.#clientClock = options.clientClock ?? this.#serverClock;
    this.#startsAt = saleStartsAt;
    this.#endsAt = saleEndsAt;
    this.#countdownResolutionMs = options.countdownResolutionMs ?? 1;
    this.#recentLimit = options.recentLimit ?? 100;
    this.#orderLimit = options.orderLimit ?? 100;
    this.#onError = options.onError;
    this.#setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimer = options.clearTimer ?? ((id) => clearTimeout(/** @type {any} */ (id)));
    this.#timerOptions = {
      requestFrame: options.requestFrame,
      cancelFrame: options.cancelFrame,
      setTimer: options.setTimer,
      clearTimer: options.clearTimer,
      visibility: options.visibility,
    };

    this.#fsm = new InventoryFsm({
      clock: this.#serverClock,
      newId: options.newId,
      holdTtlMs: options.holdTtlMs,
      checkoutWindowMs: options.checkoutWindowMs,
      maxQuantityPerRequest: options.maxQuantityPerRequest,
      terminalRetention: 20_000,
      journalCapacity: 2000,
      setTimer: options.setTimer,
      clearTimer: options.clearTimer,
      onTransition: (entry) => this.#onJournal(entry),
      onError: (error) => this.#reportError(error),
    });
    for (const product of products) {
      this.#fsm.addSku({ sku: product.sku, stock: product.stock, limitPerBuyer: product.limitPerBuyer });
    }

    this.#phase = this.#computePhase(this.#serverClock());
  }

  /** @returns {SalePhaseName} The phase by the server clock, right now. */
  get phase() {
    this.#syncPhase();
    return this.#phase;
  }

  /** @returns {number} Server time, in epoch milliseconds. */
  serverNow() {
    return this.#serverClock();
  }

  /**
   * Starts the schedule: announces the current phase, starts the countdown for it and arms the
   * timer for the next boundary. Does nothing if already started.
   */
  start() {
    this.#assertLive();
    if (this.#started) return;
    this.#started = true;
    this.#phase = this.#computePhase(this.#serverClock());
    this.#emit({ type: 'phase', phase: this.#phase, previous: null, at: this.#serverClock() });
    this.#retargetCountdown();
    this.#armPhaseTimer();
  }

  /**
   * Registers a listener for engine events.
   *
   * @param {(event: any) => void} listener
   * @returns {() => void} Call it to unsubscribe.
   */
  subscribe(listener) {
    this.#assertLive();
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Holds stock for a buyer. Accepted only while the sale is LIVE by the server clock.
   *
   * @param {ReserveRequest} request
   * @returns {Result} On failure `error` is `SaleNotStartedError`, `SaleEndedError`, or any error
   *   that `InventoryFsm.reserve` returns.
   */
  reserve(request) {
    this.#assertLive();
    this.#syncPhase();
    if (this.#phase === SalePhase.UPCOMING) {
      const now = this.#serverClock();
      return { ok: false, error: new SaleNotStartedError(this.#startsAt, Math.max(0, this.#startsAt - now)) };
    }
    if (this.#phase === SalePhase.ENDED) {
      return { ok: false, error: new SaleEndedError(this.#endsAt) };
    }
    return this.#fsm.reserve(request);
  }

  /**
   * Moves a hold into checkout. Allowed after the sale ends, while the hold is still live.
   * @param {string} reservationId
   * @returns {Result}
   */
  beginCheckout(reservationId) {
    this.#assertLive();
    this.#syncPhase();
    return this.#fsm.beginCheckout(reservationId);
  }

  /**
   * Final confirmation. On success the result also carries the order. Allowed after the
   * sale ends, while the hold is still live.
   *
   * @param {string} reservationId
   * @returns {Result & { order?: Order | null }}
   */
  confirm(reservationId) {
    this.#assertLive();
    this.#syncPhase();
    const result = this.#fsm.confirm(reservationId);
    if (!result.ok) return result;
    return { ...result, order: this.#ordersByReservation.get(reservationId) ?? null };
  }

  /**
   * Gives a hold back, for example after a failed payment.
   * @param {string} reservationId
   * @returns {Result}
   */
  cancel(reservationId) {
    this.#assertLive();
    this.#syncPhase();
    return this.#fsm.release(reservationId);
  }

  /**
   * @param {string} sku
   * @returns {StockSnapshot | null} Counters and the version to pass back as `expectedVersion`.
   */
  getSnapshot(sku) {
    this.#assertLive();
    return this.#fsm.getSnapshot(sku);
  }

  /**
   * Everything a dashboard needs, with expiry applied first so nothing is stale.
   * @returns {EngineState}
   */
  getState() {
    this.#assertLive();
    this.#syncPhase();
    this.#fsm.sweepExpired();
    const now = this.#serverClock();
    return {
      phase: this.#phase,
      startsAt: this.#startsAt,
      endsAt: this.#endsAt,
      serverNow: now,
      products: [...this.#products.values()].map((product) => {
        const stock = /** @type {StockSnapshot} */ (this.#fsm.getSnapshot(product.sku));
        return {
          sku: product.sku,
          name: product.name,
          priceMinor: product.priceMinor,
          stock,
          soldOut: stock.available === 0 && stock.reserved === 0,
          heldByOthers: stock.available === 0 && stock.reserved > 0,
        };
      }),
      active: [...this.#active.values()]
        .map((view) => ({ ...view, remainingMs: Math.max(0, view.expiresAt - now) }))
        .sort((a, b) => a.expiresAt - b.expiresAt),
      recent: [...this.#recent],
      orders: [...this.#orders],
      totals: {
        revenueMinor: this.#revenueMinor,
        orders: this.#ordersCount,
        unitsSold: this.#unitsSold,
        activeHolds: this.#active.size,
      },
    };
  }

  /**
   * Aligns the countdown with server time from one request and response. Sets the offset and,
   * if the countdown had already reached zero early, resumes it with the right remaining time.
   *
   * @param {number} serverTimeMs Server time from the response.
   * @param {number} sentAtMs Client clock when the request was sent.
   * @param {number} receivedAtMs Client clock when the response arrived.
   * @returns {number} The offset applied, in milliseconds.
   */
  calibrateClient(serverTimeMs, sentAtMs, receivedAtMs) {
    this.#assertLive();
    if (!(receivedAtMs >= sentAtMs)) throw new RangeError('receivedAtMs must not be earlier than sentAtMs');
    const offsetMs = serverTimeMs + (receivedAtMs - sentAtMs) / 2 - receivedAtMs;
    this.#clientOffsetMs = offsetMs;
    if (this.#timer) {
      this.#timer.setOffset(offsetMs);
      this.#retargetCountdown();
    }
    return offsetMs;
  }

  /** @returns {number} The client-clock offset currently applied to the countdown. */
  get clientOffsetMs() {
    return this.#clientOffsetMs;
  }

  /**
   * Restarts the display countdown from the current clocks. Use it after the device clock
   * changes, because a countdown that already reached zero stays there until it is pointed
   * at a target again. It does not change the sale phase.
   */
  refreshCountdown() {
    this.#assertLive();
    if (this.#started) this.#retargetCountdown();
  }

  /**
   * Recomputes the stock invariants from the reservation records.
   * @returns {Violation[]} Empty when every invariant holds.
   */
  checkInvariants() {
    this.#assertLive();
    return this.#fsm.checkInvariants();
  }

  /** Stops the countdown, the phase timer and the FSM, and drops all listeners. Safe to call twice. */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#phaseTimerId !== null) {
      this.#clearTimer(this.#phaseTimerId);
      this.#phaseTimerId = null;
    }
    this.#timer?.dispose();
    this.#timer = null;
    this.#fsm.dispose();
    this.#listeners.clear();
    this.#active.clear();
    this.#recent.length = 0;
    this.#recentIds.clear();
    this.#orders.length = 0;
    this.#ordersByReservation.clear();
  }

  // ---------------------------------------------------------------------------------------
  // Phase and countdown
  // ---------------------------------------------------------------------------------------

  /**
   * @param {number} now
   * @returns {SalePhaseName}
   */
  #computePhase(now) {
    if (now < this.#startsAt) return SalePhase.UPCOMING;
    if (now < this.#endsAt) return SalePhase.LIVE;
    return SalePhase.ENDED;
  }

  /** Brings the phase in line with the server clock, announces a change and retargets the countdown. */
  #syncPhase() {
    const now = this.#serverClock();
    const next = this.#computePhase(now);
    if (next === this.#phase) return;
    const previous = this.#phase;
    this.#phase = next;
    if (!this.#started) return;
    // The server boundary can arrive before the countdown's own final frame. Retargeting would
    // then skip the finished phase's last value, so give it its zero first, unless it already had one.
    if (this.#lastTickPhase === previous && this.#lastTickRemainingMs !== 0) {
      this.#lastTickRemainingMs = 0;
      this.#emit({ type: 'tick', phase: previous, countdown: zeroCountdown(this.#clientClock() + this.#clientOffsetMs) });
    }
    this.#emit({ type: 'phase', phase: next, previous, at: now });
    this.#retargetCountdown();
    this.#armPhaseTimer();
  }

  /** Arms one timer for the exact moment of the next phase boundary. */
  #armPhaseTimer() {
    if (!this.#started || this.#disposed) return;
    if (this.#phaseTimerId !== null) {
      this.#clearTimer(this.#phaseTimerId);
      this.#phaseTimerId = null;
    }
    const boundary = this.#phase === SalePhase.UPCOMING ? this.#startsAt : this.#phase === SalePhase.LIVE ? this.#endsAt : null;
    if (boundary === null) return;
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(1, boundary - this.#serverClock()));
    this.#phaseTimerId = this.#setTimer(this.#handlePhaseTimer, delay);
  }

  /** Points the countdown at the end of the current phase, or stops it when the sale is over. */
  #retargetCountdown() {
    const target = this.#phase === SalePhase.UPCOMING ? this.#startsAt : this.#phase === SalePhase.LIVE ? this.#endsAt : null;
    if (target === null) {
      this.#timer?.stop();
      return;
    }
    if (!this.#timer) {
      this.#timer = new AntiDriftTimer({
        targetTime: target,
        resolutionMs: this.#countdownResolutionMs,
        offsetMs: this.#clientOffsetMs,
        now: this.#clientClock,
        ...this.#timerOptions,
        onTick: (countdown) => {
          this.#lastTickPhase = this.#phase;
          this.#lastTickRemainingMs = countdown.remainingMs;
          this.#emit({ type: 'tick', phase: this.#phase, countdown });
        },
        onComplete: (info) => this.#onCountdownComplete(info),
      });
    } else {
      this.#timer.retarget(target);
    }
    this.#timer.start();
  }

  /** @param {{ lateByMs: number }} info */
  #onCountdownComplete(info) {
    // Ask the server clock what really happened. If the sale did not change phase, the client
    // clock was ahead: report it and wait for the phase timer instead of opening anything.
    this.#syncPhase();
    this.#emit({ type: 'countdown-zero', phase: this.#phase, lateByMs: info.lateByMs });
  }

  // ---------------------------------------------------------------------------------------
  // Read model and events
  // ---------------------------------------------------------------------------------------

  /** @param {import('./inventory-fsm.js').JournalEntry} entry */
  #onJournal(entry) {
    if (this.#disposed || entry.type === 'SKU_ADDED') return;
    const snapshot = this.#fsm.getSnapshot(entry.sku);
    this.#emit({ type: 'stock', sku: entry.sku, snapshot });
    if (entry.reservationId === undefined) return;

    const view =
      this.#fsm.getReservation(entry.reservationId) ??
      /** @type {ReservationView} */ ({
        id: entry.reservationId,
        sku: entry.sku,
        buyerId: entry.buyerId ?? '',
        quantity: entry.quantity ?? 0,
        state: entry.to ?? ReservationState.EXPIRED,
        createdAt: entry.at,
        expiresAt: entry.at,
        remainingMs: 0,
      });

    if (isTerminal(view.state)) {
      this.#active.delete(view.id);
      this.#pushRecent(view);
    } else {
      this.#active.set(view.id, view);
    }
    if (entry.to === ReservationState.CONFIRMED) this.#recordOrder(entry);
    this.#emit({ type: 'reservation', reservation: view });
  }

  /** @param {ReservationView} view */
  #pushRecent(view) {
    // A late journal entry can show a reservation that is already recorded. Record each once.
    if (this.#recentIds.has(view.id)) return;
    this.#recent.push(view);
    this.#recentIds.add(view.id);
    while (this.#recent.length > this.#recentLimit) {
      const dropped = /** @type {ReservationView} */ (this.#recent.shift());
      this.#recentIds.delete(dropped.id);
    }
  }

  /** @param {import('./inventory-fsm.js').JournalEntry} entry */
  #recordOrder(entry) {
    const reservationId = /** @type {string} */ (entry.reservationId);
    if (this.#ordersByReservation.has(reservationId)) return;
    const product = /** @type {ProductDefinition} */ (this.#products.get(entry.sku));
    const quantity = entry.quantity ?? 0;
    /** @type {Order} */
    const order = {
      id: `ord-${reservationId}`,
      reservationId,
      sku: entry.sku,
      buyerId: entry.buyerId ?? '',
      quantity,
      totalMinor: product.priceMinor * quantity,
      confirmedAt: entry.at,
    };
    this.#ordersByReservation.set(reservationId, order);
    this.#orders.push(order);
    while (this.#orders.length > this.#orderLimit) {
      const dropped = /** @type {Order} */ (this.#orders.shift());
      this.#ordersByReservation.delete(dropped.reservationId);
    }
    this.#revenueMinor += order.totalMinor;
    this.#ordersCount += 1;
    this.#unitsSold += quantity;
    this.#emit({ type: 'order', order });
  }

  /** @param {object} event */
  #emit(event) {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#reportError(error);
      }
    }
  }

  /** @param {unknown} error */
  #reportError(error) {
    if (this.#onError) this.#onError(error);
    else
      queueMicrotask(() => {
        throw error;
      });
  }

  #assertLive() {
    if (this.#disposed) throw new Error('FlashSaleEngine has been disposed');
  }
}
