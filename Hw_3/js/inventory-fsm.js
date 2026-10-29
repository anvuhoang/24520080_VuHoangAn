/**
 * @typedef {'HELD' | 'CHECKOUT' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'} ReservationStateName
 * @typedef {'BEGIN_CHECKOUT' | 'CONFIRM' | 'RELEASE' | 'EXPIRE'} ReservationEventName
 */

/**
 * Read-only view of a reservation. A copy: changing it changes nothing in the store.
 *
 * @typedef {object} ReservationView
 * @property {string} id Reservation identifier.
 * @property {string} sku Stock keeping unit held.
 * @property {string} buyerId Opaque buyer identifier.
 * @property {number} quantity Units held.
 * @property {ReservationStateName} state Current state.
 * @property {number} createdAt Clock time of the reservation, in epoch milliseconds.
 * @property {number} expiresAt Clock time at which the hold expires.
 * @property {number} remainingMs Milliseconds until expiry. 0 once the reservation is terminal.
 */

/**
 * Read-only view of one SKU's counters. A copy.
 *
 * @typedef {object} StockSnapshot
 * @property {string} sku
 * @property {number} initial Units registered.
 * @property {number} available Units that can still be reserved.
 * @property {number} reserved Units held by HELD and CHECKOUT reservations.
 * @property {number} sold Units in CONFIRMED reservations.
 * @property {number} version Increases on every change to this SKU. Used for optimistic locking.
 * @property {number} limitPerBuyer Most units one buyer may hold or own.
 */

/**
 * @typedef {object} ReserveRequest
 * @property {string} sku SKU to reserve.
 * @property {string} buyerId Opaque buyer identifier.
 * @property {number} [quantity=1] Units wanted, 1 to `maxQuantityPerRequest`.
 * @property {string} idempotencyKey Required. The same key and payload returns the same reservation.
 * @property {number} [expectedVersion] SKU version the caller last read. The call fails with
 *   `VersionConflictError` if the SKU has changed since.
 */

/**
 * Successful outcome.
 *
 * @typedef {object} OkResult
 * @property {true} ok
 * @property {ReservationView} reservation State after the call.
 * @property {boolean} replayed True when the call changed nothing because the goal was already reached.
 */

/**
 * Failed outcome. A failed call changes nothing.
 *
 * @typedef {object} FailResult
 * @property {false} ok
 * @property {Error} error One of the typed errors exported by this module.
 */

/** @typedef {OkResult | FailResult} Result */

/**
 * One journal entry, written in the same atomic section as the change it records.
 *
 * @typedef {object} JournalEntry
 * @property {number} seq Position in the journal, starting at 1. Never reused.
 * @property {number} at Clock time of the change.
 * @property {'SKU_ADDED' | 'RESERVED' | 'BEGIN_CHECKOUT' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'} type
 * @property {string} sku
 * @property {string} [reservationId]
 * @property {string} [buyerId]
 * @property {number} [quantity]
 * @property {ReservationStateName} [from]
 * @property {ReservationStateName} [to]
 * @property {{ available: number, reserved: number, sold: number, version: number }} after Counters after the change.
 */

/**
 * @typedef {object} InventoryFsmOptions
 * @property {() => number} [clock] Epoch milliseconds. Defaults to the `Date.now` function.
 * @property {() => string} [newId] Unique reservation ids. Defaults to a counter (`res-1`, `res-2`, ...).
 * @property {number} [holdTtlMs=120000] Lifetime of a new hold.
 * @property {number} [checkoutWindowMs=300000] Deadline given to a hold that begins checkout.
 * @property {number} [maxQuantityPerRequest=5] Largest `quantity` in one reserve call.
 * @property {boolean} [autoExpire=true] Arm a timer that expires holds. If false, call `sweepExpired()`.
 * @property {number} [sweepBudget=1000] Most holds expired per sweep or timer firing.
 * @property {number} [terminalRetention=50000] Finished reservations kept for replay and lookup.
 * @property {number} [journalCapacity=10000] Journal entries kept in memory.
 * @property {(callback: () => void, delayMs: number) => unknown} [setTimer] Defaults to `setTimeout`.
 * @property {(id: unknown) => void} [clearTimer] Defaults to `clearTimeout`.
 * @property {(entry: JournalEntry) => void} [onTransition] Called for each journal entry after the
 *   change completes and the state is consistent. Use it to persist the ledger.
 * @property {(error: unknown) => void} [onError] Called if `onTransition` throws. Without it the error
 *   is rethrown on a microtask so it is not lost. A hook error never affects the operation.
 */

/**
 * A violation found by the invariant checker.
 *
 * @typedef {object} Violation
 * @property {string} invariant Invariant identifier from TASK_DECOMPOSITION.md, for example `I-1`.
 * @property {string} [sku]
 * @property {string} message
 */

/**
 * Plain state used by `checkInvariantState`. Produced by `exportState()`.
 *
 * @typedef {object} ExportedState
 * @property {Array<{ sku: string, initial: number, available: number, reserved: number, sold: number, limitPerBuyer: number }>} skus
 * @property {Array<{ id: string, sku: string, buyerId: string, quantity: number, state: string }>} reservations
 */

export const ReservationState = Object.freeze({
  HELD: 'HELD',
  CHECKOUT: 'CHECKOUT',
  CONFIRMED: 'CONFIRMED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
});

export const ReservationEvent = Object.freeze({
  BEGIN_CHECKOUT: 'BEGIN_CHECKOUT',
  CONFIRM: 'CONFIRM',
  RELEASE: 'RELEASE',
  EXPIRE: 'EXPIRE',
});

/**
 * The transition table: state, then event, then next state. An event that is missing for a
 * state is illegal. Creation (`reserve`) is the entry into HELD and is not an event.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const TRANSITIONS = Object.freeze({
  HELD: Object.freeze({ BEGIN_CHECKOUT: 'CHECKOUT', CONFIRM: 'CONFIRMED', RELEASE: 'RELEASED', EXPIRE: 'EXPIRED' }),
  CHECKOUT: Object.freeze({ CONFIRM: 'CONFIRMED', RELEASE: 'RELEASED', EXPIRE: 'EXPIRED' }),
  CONFIRMED: Object.freeze({}),
  RELEASED: Object.freeze({}),
  EXPIRED: Object.freeze({}),
});

export const TERMINAL_STATES = Object.freeze(['CONFIRMED', 'RELEASED', 'EXPIRED']);

/**
 * The state that `event` leads to from `state`, or `null` if the event is illegal there.
 *
 * @param {string} state
 * @param {string} event
 * @returns {string | null}
 */
export function nextState(state, event) {
  return TRANSITIONS[state]?.[event] ?? null;
}

/**
 * @param {string} state
 * @returns {boolean} True for CONFIRMED, RELEASED and EXPIRED.
 */
export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

export class OutOfStockError extends Error {
  /**
   * @param {string} sku
   * @param {number} requested
   * @param {number} available
   */
  constructor(sku, requested, available) {
    super(`Out of stock for ${sku}: requested ${requested}, available ${available}`);
    this.name = 'OutOfStockError';
    this.sku = sku;
    this.requested = requested;
    this.available = available;
  }
}

export class LimitExceededError extends Error {
  /**
   * @param {string} sku
   * @param {string} buyerId
   * @param {number} limit
   * @param {number} current Units the buyer already holds or owns.
   * @param {number} requested
   */
  constructor(sku, buyerId, limit, current, requested) {
    super(`Purchase limit for ${sku} is ${limit}; buyer holds or owns ${current} and asked for ${requested}`);
    this.name = 'LimitExceededError';
    this.sku = sku;
    this.buyerId = buyerId;
    this.limit = limit;
    this.current = current;
    this.requested = requested;
  }
}

export class VersionConflictError extends Error {
  /**
   * @param {string} sku
   * @param {number} expectedVersion
   * @param {StockSnapshot} snapshot Current counters, so the caller can retry without another read.
   */
  constructor(sku, expectedVersion, snapshot) {
    super(`Stock for ${sku} changed: expected version ${expectedVersion}, current version ${snapshot.version}`);
    this.name = 'VersionConflictError';
    this.sku = sku;
    this.expectedVersion = expectedVersion;
    this.actualVersion = snapshot.version;
    this.snapshot = snapshot;
  }
}

export class ReservationExpiredError extends Error {
  /**
   * @param {string} reservationId
   * @param {number} expiredAt
   */
  constructor(reservationId, expiredAt) {
    super(`Reservation ${reservationId} expired at ${expiredAt}`);
    this.name = 'ReservationExpiredError';
    this.reservationId = reservationId;
    this.expiredAt = expiredAt;
  }
}

export class InvalidTransitionError extends Error {
  /**
   * @param {string} reservationId
   * @param {string} from
   * @param {string} event
   */
  constructor(reservationId, from, event) {
    super(`Reservation ${reservationId} is ${from}; ${event} is not allowed`);
    this.name = 'InvalidTransitionError';
    this.reservationId = reservationId;
    this.from = from;
    this.event = event;
  }
}

export class UnknownSkuError extends Error {
  /** @param {string} sku */
  constructor(sku) {
    super(`Unknown SKU ${sku}`);
    this.name = 'UnknownSkuError';
    this.sku = sku;
  }
}

export class UnknownReservationError extends Error {
  /** @param {string} reservationId */
  constructor(reservationId) {
    super(`Unknown reservation ${reservationId}`);
    this.name = 'UnknownReservationError';
    this.reservationId = reservationId;
  }
}

export class IdempotencyConflictError extends Error {
  /** @param {string} idempotencyKey */
  constructor(idempotencyKey) {
    super(`Idempotency key ${idempotencyKey} was already used for a different request`);
    this.name = 'IdempotencyConflictError';
    this.idempotencyKey = idempotencyKey;
  }
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Checks the stock invariants on a plain state object. Pure: it reads nothing else, so it can
 * be tested against hand-built invalid states.
 *
 * Checked: I-1 (no oversell), I-2 (conservation), I-3 (non-negative), I-4 (valid states and
 * reservation totals agree with the counters) and I-7 (per-buyer limit).
 *
 * @param {ExportedState} state
 * @returns {Violation[]} Empty when every invariant holds.
 */
export function checkInvariantState(state) {
  /** @type {Violation[]} */
  const violations = [];
  const knownStates = new Set(Object.keys(TRANSITIONS));

  /** @type {Map<string, { active: number, confirmed: number }>} */
  const totals = new Map();
  /** @type {Map<string, number>} */
  const buyerUnits = new Map();

  for (const r of state.reservations) {
    if (!knownStates.has(r.state)) {
      violations.push({ invariant: 'I-4', sku: r.sku, message: `Reservation ${r.id} has unknown state ${r.state}` });
      continue;
    }
    const t = totals.get(r.sku) ?? { active: 0, confirmed: 0 };
    if (r.state === ReservationState.HELD || r.state === ReservationState.CHECKOUT) t.active += r.quantity;
    if (r.state === ReservationState.CONFIRMED) t.confirmed += r.quantity;
    totals.set(r.sku, t);
    if (r.state === ReservationState.HELD || r.state === ReservationState.CHECKOUT || r.state === ReservationState.CONFIRMED) {
      const key = `${r.buyerId}\u0000${r.sku}`;
      buyerUnits.set(key, (buyerUnits.get(key) ?? 0) + r.quantity);
    }
  }

  for (const s of state.skus) {
    for (const field of ['available', 'reserved', 'sold']) {
      if (s[field] < 0) violations.push({ invariant: 'I-3', sku: s.sku, message: `${field} is ${s[field]}` });
    }
    if (s.sold > s.initial) {
      violations.push({ invariant: 'I-1', sku: s.sku, message: `Sold ${s.sold} exceeds initial ${s.initial}` });
    }
    if (s.sold + s.reserved > s.initial) {
      violations.push({ invariant: 'I-1', sku: s.sku, message: `Sold plus reserved ${s.sold + s.reserved} exceeds initial ${s.initial}` });
    }
    if (s.initial !== s.available + s.reserved + s.sold) {
      violations.push({
        invariant: 'I-2',
        sku: s.sku,
        message: `initial ${s.initial} != available ${s.available} + reserved ${s.reserved} + sold ${s.sold}`,
      });
    }
    const t = totals.get(s.sku) ?? { active: 0, confirmed: 0 };
    if (s.reserved !== t.active) {
      violations.push({ invariant: 'I-4', sku: s.sku, message: `reserved ${s.reserved} != active reservations ${t.active}` });
    }
    // Finished reservations can be evicted, so retained confirmed units can only be a part of `sold`.
    if (s.sold < t.confirmed) {
      violations.push({ invariant: 'I-4', sku: s.sku, message: `sold ${s.sold} < confirmed reservations ${t.confirmed}` });
    }
  }

  const limits = new Map(state.skus.map((s) => [s.sku, s.limitPerBuyer]));
  for (const [key, units] of buyerUnits) {
    const [buyerId, sku] = key.split('\u0000');
    const limit = limits.get(sku);
    if (limit !== undefined && units > limit) {
      violations.push({ invariant: 'I-7', sku, message: `Buyer ${buyerId} holds or owns ${units}, limit ${limit}` });
    }
  }
  return violations;
}

/**
 * @typedef {object} Rec Internal mutable reservation record. Never returned to callers.
 * @property {string} id
 * @property {string} sku
 * @property {string} buyerId
 * @property {number} quantity
 * @property {ReservationStateName} state
 * @property {number} createdAt
 * @property {number} expiresAt
 * @property {number} expiryStamp Changes whenever `expiresAt` changes, so old heap entries are recognised as stale.
 * @property {string} idempotencyKey
 */

/**
 * @typedef {object} Stock Internal mutable SKU record. Never returned to callers.
 * @property {string} sku
 * @property {number} initial
 * @property {number} available
 * @property {number} reserved
 * @property {number} sold
 * @property {number} version
 * @property {number} limitPerBuyer
 */

export class InventoryFsm {
  #clock;
  #newId;
  #holdTtlMs;
  #checkoutWindowMs;
  #maxQuantity;
  #autoExpire;
  #sweepBudget;
  #terminalRetention;
  #journalCapacity;
  #setTimer;
  #clearTimer;
  #onTransition;
  #onError;

  /** @type {Map<string, Stock>} */
  #skus = new Map();
  /** @type {Map<string, Rec>} */
  #reservations = new Map();
  /** Idempotency key to reservation id. */
  #byKey = new Map();
  /** Finished reservation ids, oldest first (Map keeps insertion order). */
  #terminal = new Map();
  /** Units a buyer holds or owns, per buyer and SKU. */
  #buyerUnits = new Map();
  /** Min-heap of expiry deadlines. Entries may be stale; stale ones are skipped. */
  #heap = [];
  #heapSeq = 0;

  #seq = 0;
  #journal = [];
  #journalDropped = 0;
  #pending = [];
  #flushing = false;

  #timerId = null;
  #armedAt = null;
  #disposed = false;
  #idCounter = 0;

  /** Bound once so the same function can be handed to the timer every time. */
  #handleTimer = () => {
    this.#timerId = null;
    this.#armedAt = null;
    if (this.#disposed) return;
    this.#sweep(this.#clock(), this.#sweepBudget);
    this.#arm();
    this.#flush();
  };

  /**
   * @param {InventoryFsmOptions} [options]
   */
  constructor(options = {}) {
    const positiveInt = (name, value) => {
      if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be an integer >= 1; received ${value}`);
      return value;
    };
    // `Date.now` is passed as a reference, never called here. Tests inject a fake clock.
    this.#clock = options.clock ?? Date.now;
    this.#newId = options.newId ?? (() => `res-${++this.#idCounter}`);
    this.#holdTtlMs = positiveInt('holdTtlMs', options.holdTtlMs ?? 120_000);
    this.#checkoutWindowMs = positiveInt('checkoutWindowMs', options.checkoutWindowMs ?? 300_000);
    this.#maxQuantity = positiveInt('maxQuantityPerRequest', options.maxQuantityPerRequest ?? 5);
    this.#sweepBudget = positiveInt('sweepBudget', options.sweepBudget ?? 1000);
    this.#terminalRetention = positiveInt('terminalRetention', options.terminalRetention ?? 50_000);
    this.#journalCapacity = positiveInt('journalCapacity', options.journalCapacity ?? 10_000);
    this.#autoExpire = options.autoExpire ?? true;
    this.#setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimer = options.clearTimer ?? ((id) => clearTimeout(/** @type {any} */ (id)));
    this.#onTransition = options.onTransition;
    this.#onError = options.onError;
  }

  /**
   * Registers a SKU with its opening stock.
   *
   * @param {{ sku: string, stock: number, limitPerBuyer?: number }} definition
   *   `limitPerBuyer` defaults to no limit.
   * @returns {StockSnapshot}
   */
  addSku({ sku, stock, limitPerBuyer = Number.POSITIVE_INFINITY }) {
    this.#assertLive();
    assertText('sku', sku);
    if (!Number.isInteger(stock) || stock < 0) throw new RangeError(`stock must be an integer >= 0; received ${stock}`);
    if (limitPerBuyer !== Number.POSITIVE_INFINITY && (!Number.isInteger(limitPerBuyer) || limitPerBuyer < 1)) {
      throw new RangeError(`limitPerBuyer must be an integer >= 1 or Infinity; received ${limitPerBuyer}`);
    }
    if (this.#skus.has(sku)) throw new RangeError(`SKU ${sku} is already registered`);

    /** @type {Stock} */
    const record = { sku, initial: stock, available: stock, reserved: 0, sold: 0, version: 1, limitPerBuyer };
    this.#skus.set(sku, record);
    this.#record({ type: 'SKU_ADDED', sku }, record, this.#clock());
    this.#flush();
    return snapshotOf(record);
  }

  /**
   * Current counters for a SKU, including the version to pass back as `expectedVersion`.
   *
   * @param {string} sku
   * @returns {StockSnapshot | null} `null` for an unknown SKU.
   */
  getSnapshot(sku) {
    this.#assertLive();
    const stock = this.#skus.get(sku);
    return stock ? snapshotOf(stock) : null;
  }

  /**
   * Holds stock for a buyer. The check and the decrement are one synchronous section.
   *
   * @param {ReserveRequest} request
   * @returns {Result} On failure `error` is one of `UnknownSkuError`, `VersionConflictError`,
   *   `LimitExceededError`, `OutOfStockError` or `IdempotencyConflictError`. A failure changes nothing.
   *   A replay (`replayed: true`) returns the reservation in its *current* state, which may
   *   already be EXPIRED or RELEASED. Check `reservation.state`; to hold stock again, use a new key.
   * @throws {TypeError | RangeError} For a malformed request (a programming error, not a business outcome).
   */
  reserve(request) {
    this.#assertLive();
    const { sku, buyerId, idempotencyKey, expectedVersion } = request;
    const quantity = request.quantity ?? 1;
    assertText('sku', sku);
    assertText('buyerId', buyerId);
    assertText('idempotencyKey', idempotencyKey);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > this.#maxQuantity) {
      throw new RangeError(`quantity must be an integer from 1 to ${this.#maxQuantity}; received ${quantity}`);
    }
    if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
      throw new RangeError(`expectedVersion must be an integer >= 0; received ${expectedVersion}`);
    }

    const now = this.#clock();
    // Expire due holds first, so stock that should already be back is visible to this request.
    this.#sweep(now, this.#sweepBudget);

    const result = this.#reserveAtomic(sku, buyerId, quantity, idempotencyKey, expectedVersion, now);
    this.#arm();
    this.#flush();
    return result;
  }

  /**
   * HELD to CHECKOUT. Extends the deadline once, to at least `now + checkoutWindowMs`.
   * Repeating it on a reservation already in CHECKOUT changes nothing.
   *
   * @param {string} reservationId
   * @returns {Result}
   */
  beginCheckout(reservationId) {
    return this.#act(reservationId, (rec, now) => {
      if (rec.state === ReservationState.CHECKOUT) return this.#ok(rec, now, true);
      if (rec.state === ReservationState.HELD) {
        this.#transition(rec, ReservationEvent.BEGIN_CHECKOUT, now);
        return this.#ok(rec, now, false);
      }
      return this.#refuse(rec, ReservationEvent.BEGIN_CHECKOUT);
    });
  }

  /**
   * Final confirmation. Moves the held units to sold. Fails with `ReservationExpiredError` if
   * the deadline has passed, even if the timer has not fired yet. Repeating it on a
   * confirmed reservation changes nothing.
   *
   * @param {string} reservationId
   * @returns {Result}
   */
  confirm(reservationId) {
    return this.#act(reservationId, (rec, now) => {
      if (rec.state === ReservationState.CONFIRMED) return this.#ok(rec, now, true);
      if (rec.state === ReservationState.HELD || rec.state === ReservationState.CHECKOUT) {
        this.#transition(rec, ReservationEvent.CONFIRM, now);
        return this.#ok(rec, now, false);
      }
      return this.#refuse(rec, ReservationEvent.CONFIRM);
    });
  }

  /**
   * Gives the held units back. Repeating it, or releasing a reservation that already
   * expired, changes nothing and reports success because the stock is no longer held.
   * A confirmed reservation cannot be released.
   *
   * @param {string} reservationId
   * @returns {Result}
   */
  release(reservationId) {
    return this.#act(reservationId, (rec, now) => {
      if (rec.state === ReservationState.RELEASED || rec.state === ReservationState.EXPIRED) {
        return this.#ok(rec, now, true);
      }
      if (rec.state === ReservationState.HELD || rec.state === ReservationState.CHECKOUT) {
        this.#transition(rec, ReservationEvent.RELEASE, now);
        return this.#ok(rec, now, false);
      }
      return this.#refuse(rec, ReservationEvent.RELEASE);
    });
  }

  /**
   * Looks up a reservation. Applies its expiry first, so the state is never stale.
   *
   * @param {string} reservationId
   * @returns {ReservationView | null}
   */
  getReservation(reservationId) {
    this.#assertLive();
    const rec = this.#reservations.get(reservationId);
    if (!rec) return null;
    const now = this.#clock();
    this.#expireIfDue(rec, now);
    this.#arm();
    this.#flush();
    return viewOf(rec, now);
  }

  /**
   * The countdown for a live hold, for a UI timer. Pass `expiresAt` to an `AntiDriftTimer`.
   *
   * @param {string} reservationId
   * @returns {{ expiresAt: number, remainingMs: number } | null} `null` if unknown or no longer live.
   */
  getCountdown(reservationId) {
    const view = this.getReservation(reservationId);
    if (!view || isTerminal(view.state)) return null;
    return { expiresAt: view.expiresAt, remainingMs: view.remainingMs };
  }

  /**
   * Expires every hold whose deadline has passed, up to `budget`. Called by the timer; call it
   * yourself when `autoExpire` is false.
   *
   * @param {number} [budget] Defaults to the `sweepBudget` option.
   * @returns {number} Holds expired by this call.
   */
  sweepExpired(budget = this.#sweepBudget) {
    this.#assertLive();
    const done = this.#sweep(this.#clock(), budget);
    this.#arm();
    this.#flush();
    return done;
  }

  /**
   * Recomputes the invariants from the reservation records. Cheap enough to call after every
   * test scenario and at the end of every simulation.
   *
   * @returns {Violation[]} Empty when every invariant holds.
   */
  checkInvariants() {
    return checkInvariantState(this.exportState());
  }

  /**
   * A deep copy of the counters and reservations, safe to keep or serialise.
   *
   * @returns {ExportedState}
   */
  exportState() {
    return {
      skus: [...this.#skus.values()].map((s) => ({ ...s })),
      reservations: [...this.#reservations.values()].map((r) => ({
        id: r.id,
        sku: r.sku,
        buyerId: r.buyerId,
        quantity: r.quantity,
        state: r.state,
      })),
    };
  }

  /**
   * The most recent journal entries, oldest first. Older entries are dropped once the
   * journal exceeds `journalCapacity`; persist them through `onTransition` to keep them all.
   *
   * @returns {JournalEntry[]}
   */
  getJournal() {
    return this.#journal.slice(-this.#journalCapacity);
  }

  /**
   * Sizes of the internal collections, for bounded-memory checks.
   *
   * @returns {{ skus: number, live: number, finishedRetained: number, heapEntries: number,
   *   journalEntries: number, journalDropped: number, idempotencyKeys: number, timerArmed: boolean }}
   */
  stats() {
    return {
      skus: this.#skus.size,
      live: this.#reservations.size - this.#terminal.size,
      finishedRetained: this.#terminal.size,
      heapEntries: this.#heap.length,
      journalEntries: Math.min(this.#journal.length, this.#journalCapacity),
      journalDropped: this.#journalDropped,
      idempotencyKeys: this.#byKey.size,
      timerArmed: this.#timerId !== null,
    };
  }

  /** Stops the timer and makes the instance unusable. Safe to call more than once. */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#timerId !== null) {
      this.#clearTimer(this.#timerId);
      this.#timerId = null;
    }
    this.#armedAt = null;
    this.#heap.length = 0;
    this.#onTransition = undefined;
  }

  // ---------------------------------------------------------------------------------------
  // Atomic sections. Everything between a read and its dependent write is synchronous.
  // ---------------------------------------------------------------------------------------

  /**
   * @param {string} sku
   * @param {string} buyerId
   * @param {number} quantity
   * @param {string} idempotencyKey
   * @param {number | undefined} expectedVersion
   * @param {number} now
   * @returns {Result}
   */
  #reserveAtomic(sku, buyerId, quantity, idempotencyKey, expectedVersion, now) {
    const knownId = this.#byKey.get(idempotencyKey);
    if (knownId !== undefined) {
      const known = this.#reservations.get(knownId);
      if (known) {
        if (known.sku !== sku || known.buyerId !== buyerId || known.quantity !== quantity) {
          return fail(new IdempotencyConflictError(idempotencyKey));
        }
        this.#expireIfDue(known, now);
        return this.#ok(known, now, true);
      }
    }

    const stock = this.#skus.get(sku);
    if (!stock) return fail(new UnknownSkuError(sku));

    if (expectedVersion !== undefined && stock.version !== expectedVersion) {
      return fail(new VersionConflictError(sku, expectedVersion, snapshotOf(stock)));
    }

    const unitsKey = buyerKey(buyerId, sku);
    const current = this.#buyerUnits.get(unitsKey) ?? 0;
    if (current + quantity > stock.limitPerBuyer) {
      return fail(new LimitExceededError(sku, buyerId, stock.limitPerBuyer, current, quantity));
    }
    if (stock.available < quantity) {
      return fail(new OutOfStockError(sku, quantity, stock.available));
    }

    const id = this.#newId();
    if (this.#reservations.has(id)) throw new Error(`newId returned a duplicate reservation id: ${id}`);

    // Commit. No failure path remains below this line.
    /** @type {Rec} */
    const rec = {
      id,
      sku,
      buyerId,
      quantity,
      state: ReservationState.HELD,
      createdAt: now,
      expiresAt: now + this.#holdTtlMs,
      expiryStamp: 0,
      idempotencyKey,
    };
    stock.available -= quantity;
    stock.reserved += quantity;
    stock.version += 1;
    this.#buyerUnits.set(unitsKey, current + quantity);
    this.#reservations.set(id, rec);
    this.#byKey.set(idempotencyKey, id);
    this.#pushExpiry(rec);
    this.#record({ type: 'RESERVED', sku, reservationId: id, buyerId, quantity, to: rec.state }, stock, now);
    return this.#ok(rec, now, false);
  }

  /**
   * Runs one action on a reservation after applying its pending expiry.
   *
   * @param {string} reservationId
   * @param {(rec: Rec, now: number) => Result} action
   * @returns {Result}
   */
  #act(reservationId, action) {
    this.#assertLive();
    const rec = this.#reservations.get(reservationId);
    if (!rec) return fail(new UnknownReservationError(reservationId));
    const now = this.#clock();
    this.#expireIfDue(rec, now);
    const result = action(rec, now);
    this.#arm();
    this.#flush();
    return result;
  }

  /**
   * The single place a reservation changes state. Checks the table, updates the counters and
   * journals the change together, so the three can never disagree.
   *
   * @param {Rec} rec
   * @param {ReservationEventName} event
   * @param {number} now
   */
  #transition(rec, event, now) {
    const to = nextState(rec.state, event);
    if (to === null) throw new InvalidTransitionError(rec.id, rec.state, event);
    const stock = /** @type {Stock} */ (this.#skus.get(rec.sku));
    const from = rec.state;

    if (to === ReservationState.CHECKOUT) {
      rec.expiresAt = Math.max(rec.expiresAt, now + this.#checkoutWindowMs);
      this.#pushExpiry(rec);
    } else if (to === ReservationState.CONFIRMED) {
      stock.reserved -= rec.quantity;
      stock.sold += rec.quantity;
    } else {
      // RELEASED or EXPIRED: roll the hold back. This is the only place stock is returned.
      stock.reserved -= rec.quantity;
      stock.available += rec.quantity;
      this.#releaseBuyerUnits(rec);
    }
    rec.state = to;
    stock.version += 1;

    if (isTerminal(to)) {
      this.#terminal.set(rec.id, true);
      this.#evictFinished();
    }
    const type = to === ReservationState.CHECKOUT ? 'BEGIN_CHECKOUT' : to;
    this.#record({ type, sku: rec.sku, reservationId: rec.id, buyerId: rec.buyerId, quantity: rec.quantity, from, to }, stock, now);
  }

  /**
   * @param {Rec} rec
   * @param {number} now
   */
  #expireIfDue(rec, now) {
    if (isTerminal(rec.state)) return;
    if (now >= rec.expiresAt) this.#transition(rec, ReservationEvent.EXPIRE, now);
  }

  /**
   * Expires due holds, earliest first, up to `budget`.
   *
   * @param {number} now
   * @param {number} budget
   * @returns {number}
   */
  #sweep(now, budget) {
    let done = 0;
    while (done < budget) {
      const top = this.#peekLive();
      if (top === undefined || top.at > now) break;
      this.#popHeap();
      const rec = /** @type {Rec} */ (this.#reservations.get(top.id));
      this.#transition(rec, ReservationEvent.EXPIRE, now);
      done++;
    }
    return done;
  }

  /** @param {Rec} rec */
  #releaseBuyerUnits(rec) {
    const key = buyerKey(rec.buyerId, rec.sku);
    const left = (this.#buyerUnits.get(key) ?? 0) - rec.quantity;
    if (left > 0) this.#buyerUnits.set(key, left);
    else this.#buyerUnits.delete(key);
  }

  /** Drops the oldest finished reservations beyond the retention limit, with their idempotency keys. */
  #evictFinished() {
    while (this.#terminal.size > this.#terminalRetention) {
      const oldest = /** @type {string} */ (this.#terminal.keys().next().value);
      this.#terminal.delete(oldest);
      const rec = this.#reservations.get(oldest);
      this.#reservations.delete(oldest);
      if (rec && this.#byKey.get(rec.idempotencyKey) === oldest) this.#byKey.delete(rec.idempotencyKey);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Results, journal and hooks
  // ---------------------------------------------------------------------------------------

  /**
   * @param {Rec} rec
   * @param {number} now
   * @param {boolean} replayed
   * @returns {OkResult}
   */
  #ok(rec, now, replayed) {
    return { ok: true, reservation: viewOf(rec, now), replayed };
  }

  /**
   * An event that is not allowed in the reservation's current state.
   *
   * @param {Rec} rec
   * @param {ReservationEventName} event
   * @returns {FailResult}
   */
  #refuse(rec, event) {
    if (rec.state === ReservationState.EXPIRED) return fail(new ReservationExpiredError(rec.id, rec.expiresAt));
    return fail(new InvalidTransitionError(rec.id, rec.state, event));
  }

  /**
   * Appends a journal entry in the same atomic section as the change it records.
   *
   * @param {Omit<JournalEntry, 'seq' | 'at' | 'after'>} entry
   * @param {Stock} stock
   * @param {number} now
   */
  #record(entry, stock, now) {
    /** @type {JournalEntry} */
    const full = {
      seq: ++this.#seq,
      at: now,
      ...entry,
      after: { available: stock.available, reserved: stock.reserved, sold: stock.sold, version: stock.version },
    };
    this.#journal.push(full);
    if (this.#journal.length > this.#journalCapacity * 2) {
      this.#journalDropped += this.#journal.length - this.#journalCapacity;
      this.#journal = this.#journal.slice(-this.#journalCapacity);
    }
    this.#pending.push(full);
  }

  /**
   * Delivers journal entries to the hook once the state is consistent. A hook may call back
   * into the store; entries it causes are delivered by the same loop.
   */
  #flush() {
    if (this.#flushing) return;
    this.#flushing = true;
    try {
      while (this.#pending.length > 0) {
        const entry = /** @type {JournalEntry} */ (this.#pending.shift());
        const hook = this.#onTransition;
        if (!hook) continue;
        try {
          hook(Object.freeze({ ...entry, after: Object.freeze({ ...entry.after }) }));
        } catch (error) {
          if (this.#onError) this.#onError(error);
          else queueMicrotask(() => { throw error; });
        }
      }
    } finally {
      this.#flushing = false;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Expiry heap and timer
  // ---------------------------------------------------------------------------------------

  /** @param {Rec} rec */
  #pushExpiry(rec) {
    rec.expiryStamp += 1;
    const entry = { at: rec.expiresAt, id: rec.id, stamp: rec.expiryStamp, seq: ++this.#heapSeq };
    const heap = this.#heap;
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapBefore(heap[parent], heap[i])) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  #popHeap() {
    const heap = this.#heap;
    const last = /** @type {any} */ (heap.pop());
    if (heap.length === 0) return;
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && heapBefore(heap[left], heap[smallest])) smallest = left;
      if (right < heap.length && heapBefore(heap[right], heap[smallest])) smallest = right;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }

  /**
   * The earliest live deadline. Entries for finished, evicted or extended reservations are
   * stale and are discarded on the way.
   *
   * @returns {{ at: number, id: string, stamp: number, seq: number } | undefined}
   */
  #peekLive() {
    while (this.#heap.length > 0) {
      const top = this.#heap[0];
      const rec = this.#reservations.get(top.id);
      if (rec && !isTerminal(rec.state) && rec.expiryStamp === top.stamp) return top;
      this.#popHeap();
    }
    return undefined;
  }

  /** Arms one timer for the earliest live deadline, or clears it when nothing is live. */
  #arm() {
    if (!this.#autoExpire || this.#disposed) return;
    const top = this.#peekLive();
    if (top === undefined) {
      if (this.#timerId !== null) {
        this.#clearTimer(this.#timerId);
        this.#timerId = null;
        this.#armedAt = null;
      }
      return;
    }
    if (this.#timerId !== null && this.#armedAt === top.at) return;
    if (this.#timerId !== null) this.#clearTimer(this.#timerId);
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, top.at - this.#clock()));
    this.#armedAt = top.at;
    this.#timerId = this.#setTimer(this.#handleTimer, delay);
  }

  #assertLive() {
    if (this.#disposed) throw new Error('InventoryFsm has been disposed');
  }
}

/**
 * @param {{ at: number, seq: number }} a
 * @param {{ at: number, seq: number }} b
 * @returns {boolean} True if `a` should come out of the heap before `b`.
 */
function heapBefore(a, b) {
  return a.at < b.at || (a.at === b.at && a.seq < b.seq);
}

/**
 * @param {Error} error
 * @returns {FailResult}
 */
function fail(error) {
  return { ok: false, error };
}

/**
 * @param {string} buyerId
 * @param {string} sku
 * @returns {string}
 */
function buyerKey(buyerId, sku) {
  return `${buyerId}\u0000${sku}`;
}

/**
 * @param {Stock} stock
 * @returns {StockSnapshot}
 */
function snapshotOf(stock) {
  return Object.freeze({ ...stock });
}

/**
 * @param {Rec} rec
 * @param {number} now
 * @returns {ReservationView}
 */
function viewOf(rec, now) {
  return Object.freeze({
    id: rec.id,
    sku: rec.sku,
    buyerId: rec.buyerId,
    quantity: rec.quantity,
    state: rec.state,
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
    remainingMs: isTerminal(rec.state) ? 0 : Math.max(0, rec.expiresAt - now),
  });
}

/**
 * @param {string} name
 * @param {unknown} value
 */
function assertText(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string; received ${String(value)}`);
  }
}
