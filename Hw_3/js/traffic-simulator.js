import { SaleEndedError, SaleNotStartedError } from './flash-sale-engine.js';
import { LimitExceededError, OutOfStockError, VersionConflictError } from './inventory-fsm.js';

/**
 * @typedef {object} Region
 * @property {string} code Short code.
 * @property {string} name Display name.
 * @property {number} share Relative share of buyers.
 * @property {number} baseLatencyMs Fastest one-way latency.
 * @property {number} jitterMs Extra one-way latency, drawn uniformly up to this value.
 */

/** @type {readonly Region[]} */
export const REGIONS = Object.freeze([
  { code: 'VN', name: 'Vietnam', share: 30, baseLatencyMs: 40, jitterMs: 120 },
  { code: 'ID', name: 'Indonesia', share: 25, baseLatencyMs: 70, jitterMs: 240 },
  { code: 'TH', name: 'Thailand', share: 15, baseLatencyMs: 60, jitterMs: 180 },
  { code: 'PH', name: 'Philippines', share: 12, baseLatencyMs: 90, jitterMs: 320 },
  { code: 'MY', name: 'Malaysia', share: 10, baseLatencyMs: 50, jitterMs: 140 },
  { code: 'SG', name: 'Singapore', share: 8, baseLatencyMs: 25, jitterMs: 60 },
]);

/** @typedef {'spike' | 'ramp' | 'steady'} ProfileName */

export const PROFILE_INFO = Object.freeze([
  { id: 'spike', label: '11.11 midnight spike', description: 'Most buyers arrive within a second or two of opening, plus a pre-sale crowd.' },
  { id: 'ramp', label: 'Building ramp', description: 'Arrivals build up from just before opening to a peak 20 seconds later.' },
  { id: 'steady', label: 'Steady stream', description: 'Buyers arrive evenly over the first minute.' },
]);

/**
 * A seeded random source (mulberry32). Returns numbers in [0, 1).
 *
 * @param {number} seed
 * @returns {() => number}
 */
export function createSeededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * When a buyer arrives, relative to the sale opening, in milliseconds. Negative means before.
 *
 * @param {ProfileName} profile
 * @param {() => number} random
 * @param {boolean} earlyBird True for a buyer who shows up before the sale opens.
 * @returns {number}
 */
export function arrivalOffset(profile, random, earlyBird) {
  const exponential = (meanMs) => -Math.log(1 - random()) * meanMs;
  if (earlyBird) return -Math.min(2000, exponential(500));
  switch (profile) {
    case 'spike':
      return random() < 0.7 ? exponential(700) : random() * 30_000;
    case 'ramp':
      // The square root of a uniform draw makes arrivals denser toward the end of the window.
      return -1000 + Math.sqrt(random()) * 21_000;
    case 'steady':
      return random() * 60_000;
    default:
      throw new RangeError(`unknown profile ${String(profile)}`);
  }
}

/**
 * @typedef {object} SimulatorOptions
 * @property {import('./flash-sale-engine.js').FlashSaleEngine} engine
 * @property {() => number} clock Server time, in epoch milliseconds.
 * @property {() => number} random Seeded random source, for example `createSeededRandom(7)`.
 * @property {number} [buyers=5000] Virtual buyers, 1 to 100000.
 * @property {ProfileName} [profile='spike']
 * @property {readonly Region[]} [regions]
 * @property {number[]} [popularity] Relative demand per product, in the engine's product order. Defaults to a hot first product.
 * @property {number} [earlyBirdShare=0.25] Buyers who arrive before the sale opens.
 * @property {number} [optimisticShare=0.5] Buyers who send the stock version they read.
 * @property {number} [duplicateShare=0.05] Buyers who send the same request twice.
 * @property {number} [abandonShare=0.12] Buyers who take a hold and never continue.
 * @property {number} [paymentFailureShare=0.08] Buyers whose payment fails.
 * @property {number} [maxRetries=4] Retries after an early refusal or a version conflict.
 * @property {[number, number]} [thinkMs=[1000, 8000]] Time from a hold to checkout.
 * @property {[number, number]} [payMs=[2000, 6000]] Time from checkout to payment.
 */

/**
 * @typedef {object} RegionMetrics
 * @property {string} code
 * @property {string} name
 * @property {number} buyers
 * @property {number} reserved
 * @property {number} paid
 */

/**
 * @typedef {object} SimulatorMetrics
 * @property {number} buyers Buyers created.
 * @property {number} arrived Buyers who have arrived so far.
 * @property {number} attempts Reserve requests sent, including retries and duplicates.
 * @property {number} reserved Holds taken (a replay is not counted).
 * @property {number} duplicatesAbsorbed Repeated requests answered from the first, taking no stock.
 * @property {number} rejectedEarly Refused because the sale had not opened (the retry storm).
 * @property {number} rejectedLate Refused because the sale had ended.
 * @property {number} conflicts Optimistic-lock version conflicts.
 * @property {number} outOfStock Refused because the stock was gone or held.
 * @property {number} limitHits Refused by the per-buyer limit.
 * @property {number} gaveUp Buyers who ran out of retries.
 * @property {number} abandoned Holds never continued, left to expire.
 * @property {number} expiredBeforeCheckout Holds that expired before checkout began.
 * @property {number} paymentFailed Payments that failed; the hold was released.
 * @property {number} expiredDuringPayment Payments that arrived after the hold expired and were refused.
 * @property {number} paid Orders confirmed.
 * @property {number} errors Unexpected failures. Should stay 0.
 * @property {number} revenueMinor Revenue from confirmed orders, in minor units.
 * @property {{ p50: number, p95: number, samples: number }} latencyMs Round-trip latency of reserve requests.
 * @property {RegionMetrics[]} regions
 * @property {number} pending Events still scheduled.
 * @property {boolean} finished True once no events remain.
 */

/**
 * @typedef {object} Buyer
 * @property {string} id
 * @property {Region} region
 * @property {string} sku
 * @property {boolean} optimistic
 * @property {string} key
 * @property {number} retries
 * @property {string | null} reservationId
 */

/**
 * @typedef {object} SimEvent
 * @property {number} at Simulated time of the event.
 * @property {number} seq Insertion order, to break ties.
 * @property {'arrive' | 'reserve' | 'checkout' | 'pay'} kind
 * @property {Buyer} buyer
 * @property {number} [version] Stock version to send with a reserve request.
 * @property {number} [latency] One-way latency of this request.
 * @property {boolean} [duplicate] True for the second copy of a double click.
 */

const LATENCY_RESERVOIR = 4000;

export class TrafficSimulator {
  #engine;
  #clock;
  #random;
  #buyers;
  #profile;
  #regions;
  #popularity;
  #earlyBirdShare;
  #optimisticShare;
  #duplicateShare;
  #abandonShare;
  #paymentFailureShare;
  #maxRetries;
  #thinkMs;
  #payMs;

  /** @type {SimEvent[]} */
  #heap = [];
  #seq = 0;
  #started = false;
  /** @type {Map<string, RegionMetrics>} */
  #regionStats = new Map();
  #latencySamples = [];
  #latencySeen = 0;
  #counters = {
    buyers: 0,
    arrived: 0,
    attempts: 0,
    reserved: 0,
    duplicatesAbsorbed: 0,
    rejectedEarly: 0,
    rejectedLate: 0,
    conflicts: 0,
    outOfStock: 0,
    limitHits: 0,
    gaveUp: 0,
    abandoned: 0,
    expiredBeforeCheckout: 0,
    paymentFailed: 0,
    expiredDuringPayment: 0,
    paid: 0,
    errors: 0,
    revenueMinor: 0,
  };

  /**
   * @param {SimulatorOptions} options
   */
  constructor(options) {
    const buyers = options.buyers ?? 5000;
    if (!Number.isInteger(buyers) || buyers < 1 || buyers > 100_000) {
      throw new RangeError(`buyers must be an integer from 1 to 100000; received ${buyers}`);
    }
    const profile = options.profile ?? 'spike';
    if (!PROFILE_INFO.some((p) => p.id === profile)) throw new RangeError(`unknown profile ${String(profile)}`);
    for (const name of ['earlyBirdShare', 'optimisticShare', 'duplicateShare', 'abandonShare', 'paymentFailureShare']) {
      const value = options[name];
      if (value !== undefined && !(value >= 0 && value <= 1)) throw new RangeError(`${name} must be in [0, 1]; received ${value}`);
    }
    if (typeof options.clock !== 'function' || typeof options.random !== 'function') {
      throw new TypeError('clock and random must be functions');
    }

    this.#engine = options.engine;
    this.#clock = options.clock;
    this.#random = options.random;
    this.#buyers = buyers;
    this.#profile = profile;
    this.#regions = options.regions ?? REGIONS;
    this.#popularity = options.popularity;
    this.#earlyBirdShare = options.earlyBirdShare ?? 0.25;
    this.#optimisticShare = options.optimisticShare ?? 0.5;
    this.#duplicateShare = options.duplicateShare ?? 0.05;
    this.#abandonShare = options.abandonShare ?? 0.12;
    this.#paymentFailureShare = options.paymentFailureShare ?? 0.08;
    this.#maxRetries = options.maxRetries ?? 4;
    this.#thinkMs = options.thinkMs ?? [1000, 8000];
    this.#payMs = options.payMs ?? [2000, 6000];
  }

  /**
   * Creates the buyers and schedules their arrivals around the sale opening.
   *
   * @param {number} saleStartsAt Server time at which the sale opens.
   */
  start(saleStartsAt) {
    if (this.#started) throw new Error('TrafficSimulator has already started');
    this.#started = true;

    const skus = this.#engine.getState().products.map((p) => p.sku);
    const weights = skus.map((_, i) => this.#popularity?.[i] ?? (skus.length > 1 ? (i === 0 ? 3 : 1) : 1));
    const regionTotal = this.#regions.reduce((sum, r) => sum + r.share, 0);
    const regionProbabilities = this.#regions.map((r) => r.share / regionTotal);
    for (const region of this.#regions) {
      this.#regionStats.set(region.code, { code: region.code, name: region.name, buyers: 0, reserved: 0, paid: 0 });
    }

    this.#counters.buyers = this.#buyers;
    for (let i = 0; i < this.#buyers; i++) {
      const region = pickWeighted(this.#regions, regionProbabilities, this.#random);
      const sku = skus[pickIndex(weights, this.#random)];
      /** @type {Buyer} */
      const buyer = {
        id: `u${i}`,
        region,
        sku,
        optimistic: this.#random() < this.#optimisticShare,
        key: `u${i}-buy`,
        retries: 0,
        reservationId: null,
      };
      const earlyBird = this.#random() < this.#earlyBirdShare;
      this.#regionStats.get(region.code).buyers++;
      this.#push({ kind: 'arrive', at: saleStartsAt + arrivalOffset(this.#profile, this.#random, earlyBird), buyer });
    }
  }

  /**
   * Runs every event due at `now`, up to `budget`, so one call cannot freeze a page.
   *
   * @param {number} [now] Defaults to the clock.
   * @param {number} [budget=2000] Most events handled by this call.
   * @returns {number} Events handled.
   */
  step(now = this.#clock(), budget = 2000) {
    let handled = 0;
    while (handled < budget) {
      const top = this.#heap[0];
      if (top === undefined || top.at > now) break;
      this.#pop();
      this.#handle(top);
      handled++;
    }
    return handled;
  }

  /** @returns {number | null} Simulated time of the next event, or `null` when none remain. */
  nextDueAt() {
    return this.#heap.length === 0 ? null : this.#heap[0].at;
  }

  /** Drops every scheduled event. Holds already taken are left to the engine to expire. */
  stop() {
    this.#heap.length = 0;
  }

  /** @returns {SimulatorMetrics} A copy of the current metrics. */
  metrics() {
    const sorted = [...this.#latencySamples].sort((a, b) => a - b);
    const percentile = (p) => (sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
    return {
      ...this.#counters,
      latencyMs: { p50: percentile(0.5), p95: percentile(0.95), samples: this.#latencySeen },
      regions: [...this.#regionStats.values()].map((r) => ({ ...r })),
      pending: this.#heap.length,
      finished: this.#started && this.#heap.length === 0,
    };
  }

  // ---------------------------------------------------------------------------------------
  // Buyer behaviour
  // ---------------------------------------------------------------------------------------

  /** @param {SimEvent} event */
  #handle(event) {
    switch (event.kind) {
      case 'arrive':
        return this.#onArrive(event);
      case 'reserve':
        return this.#onReserve(event);
      case 'checkout':
        return this.#onCheckout(event);
      case 'pay':
        return this.#onPay(event);
    }
  }

  /** @param {SimEvent} event */
  #onArrive(event) {
    this.#counters.arrived++;
    this.#send(event.buyer, event.at, {});
    if (this.#random() < this.#duplicateShare) {
      // A double click: the same key again a moment later.
      this.#send(event.buyer, event.at + 5 + this.#random() * 35, { duplicate: true });
    }
  }

  /**
   * Sends a reserve request. An optimistic buyer sends the stock version it last saw.
   *
   * @param {Buyer} buyer
   * @param {number} at Time the request leaves the buyer.
   * @param {{ duplicate?: boolean, version?: number }} options `version` overrides the read, for a retry.
   */
  #send(buyer, at, { duplicate = false, version } = {}) {
    const latency = this.#latency(buyer.region);
    let sendVersion = version;
    if (sendVersion === undefined && buyer.optimistic) {
      sendVersion = this.#engine.getSnapshot(buyer.sku)?.version;
    }
    this.#push({ kind: 'reserve', at: at + latency, buyer, version: sendVersion, latency, duplicate });
  }

  /** @param {SimEvent} event */
  #onReserve(event) {
    const { buyer } = event;
    const c = this.#counters;
    c.attempts++;
    const result = this.#engine.reserve({
      sku: buyer.sku,
      buyerId: buyer.id,
      quantity: 1,
      idempotencyKey: buyer.key,
      expectedVersion: event.version,
    });
    this.#recordLatency((event.latency ?? 0) * 2);

    if (result.ok) {
      if (result.replayed) {
        c.duplicatesAbsorbed++;
        return;
      }
      c.reserved++;
      this.#regionStats.get(buyer.region.code).reserved++;
      buyer.reservationId = result.reservation.id;
      if (this.#random() < this.#abandonShare) {
        c.abandoned++;
        return;
      }
      this.#push({ kind: 'checkout', at: event.at + (event.latency ?? 0) + this.#between(this.#thinkMs), buyer });
      return;
    }

    const error = result.error;
    const canRetry = !event.duplicate && buyer.retries < this.#maxRetries;
    if (error instanceof SaleNotStartedError) {
      c.rejectedEarly++;
      if (canRetry) {
        buyer.retries++;
        // Jittered backoff that grows a little each time. The server's retry hint is ignored on purpose.
        const backoff = (100 + this.#random() * 400) * (1 + buyer.retries * 0.5);
        this.#send(buyer, event.at + (event.latency ?? 0) + backoff);
      } else if (!event.duplicate) {
        c.gaveUp++;
      }
    } else if (error instanceof VersionConflictError) {
      c.conflicts++;
      if (canRetry) {
        buyer.retries++;
        // The conflict response carries the fresh snapshot, so retry with its version.
        this.#send(buyer, event.at + (event.latency ?? 0) + 10 + this.#random() * 50, { version: error.snapshot.version });
      } else if (!event.duplicate) {
        c.gaveUp++;
      }
    } else if (error instanceof OutOfStockError) {
      c.outOfStock++;
    } else if (error instanceof LimitExceededError) {
      c.limitHits++;
    } else if (error instanceof SaleEndedError) {
      c.rejectedLate++;
    } else {
      c.errors++;
    }
  }

  /** @param {SimEvent} event */
  #onCheckout(event) {
    const { buyer } = event;
    const result = this.#engine.beginCheckout(/** @type {string} */ (buyer.reservationId));
    if (!result.ok) {
      this.#counters.expiredBeforeCheckout++;
      return;
    }
    const latency = this.#latency(buyer.region);
    this.#push({ kind: 'pay', at: event.at + latency + this.#between(this.#payMs), buyer });
  }

  /** @param {SimEvent} event */
  #onPay(event) {
    const { buyer } = event;
    const id = /** @type {string} */ (buyer.reservationId);
    const c = this.#counters;
    if (this.#random() < this.#paymentFailureShare) {
      this.#engine.cancel(id);
      c.paymentFailed++;
      return;
    }
    const result = this.#engine.confirm(id);
    if (result.ok) {
      c.paid++;
      this.#regionStats.get(buyer.region.code).paid++;
      c.revenueMinor += result.order?.totalMinor ?? 0;
    } else if (result.error.name === 'ReservationExpiredError') {
      c.expiredDuringPayment++;
    } else {
      c.errors++;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------

  /**
   * One-way latency for a region, with a slow tail.
   * @param {Region} region
   * @returns {number}
   */
  #latency(region) {
    let ms = region.baseLatencyMs + this.#random() * region.jitterMs;
    if (this.#random() < 0.03) ms *= 4;
    return Math.round(ms);
  }

  /**
   * @param {[number, number]} range
   * @returns {number}
   */
  #between([low, high]) {
    return low + this.#random() * (high - low);
  }

  /** @param {number} ms */
  #recordLatency(ms) {
    this.#latencySeen++;
    if (this.#latencySamples.length < LATENCY_RESERVOIR) {
      this.#latencySamples.push(ms);
      return;
    }
    // Reservoir sampling keeps a fair sample of an unbounded stream in bounded memory.
    const slot = Math.floor(this.#random() * this.#latencySeen);
    if (slot < LATENCY_RESERVOIR) this.#latencySamples[slot] = ms;
  }

  /** @param {Omit<SimEvent, 'seq'>} event */
  #push(event) {
    const entry = { ...event, seq: ++this.#seq };
    const heap = this.#heap;
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (before(heap[parent], heap[i])) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  #pop() {
    const heap = this.#heap;
    const last = /** @type {SimEvent} */ (heap.pop());
    if (heap.length === 0) return;
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && before(heap[left], heap[smallest])) smallest = left;
      if (right < heap.length && before(heap[right], heap[smallest])) smallest = right;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * @param {SimEvent} a
 * @param {SimEvent} b
 * @returns {boolean} True if `a` should be handled before `b`.
 */
function before(a, b) {
  return a.at < b.at || (a.at === b.at && a.seq < b.seq);
}

/**
 * @param {number[]} weights Non-negative weights.
 * @param {() => number} random
 * @returns {number} An index chosen in proportion to its weight.
 */
function pickIndex(weights, random) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/**
 * @template T
 * @param {readonly T[]} items
 * @param {number[]} probabilities Summing to 1.
 * @param {() => number} random
 * @returns {T}
 */
function pickWeighted(items, probabilities, random) {
  return items[pickIndex(probabilities, random)];
}
