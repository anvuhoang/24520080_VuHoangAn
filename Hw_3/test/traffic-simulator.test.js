import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FlashSaleEngine } from '../js/flash-sale-engine.js';
import { PROFILE_INFO, REGIONS, TrafficSimulator, arrivalOffset, createSeededRandom } from '../js/traffic-simulator.js';

const PRODUCTS = [
  { sku: 'PHONE', name: 'Smartphone 5G', priceMinor: 4_990_000, stock: 40, limitPerBuyer: 1 },
  { sku: 'BUDS', name: 'Wireless earbuds', priceMinor: 590_000, stock: 60 },
];

/** An engine on a fake server clock. No timer or frame ever fires; the engine syncs lazily. */
function setup({ seed = 1, startsIn = 5000, lasts = 120_000, holdTtlMs = 20_000, checkoutWindowMs = 30_000, products = PRODUCTS, ...simOptions } = {}) {
  let now = 50_000_000;
  const engine = new FlashSaleEngine({
    products,
    saleStartsAt: now + startsIn,
    saleEndsAt: now + startsIn + lasts,
    serverClock: () => now,
    holdTtlMs,
    checkoutWindowMs,
    setTimer: () => 0,
    clearTimer: () => {},
    requestFrame: () => 0,
    cancelFrame: () => {},
    visibility: null,
    onError: (error) => {
      throw error;
    },
  });
  const random = createSeededRandom(seed);
  const sim = new TrafficSimulator({ engine, clock: () => now, random, ...simOptions });
  sim.start(engine.getState().startsAt);
  return {
    engine,
    sim,
    get now() {
      return now;
    },
    setNow(value) {
      now = Math.max(now, value);
    },
    /** Plays every scheduled event in time order, checking the invariants as it goes. */
    drain({ checkEvery = 200 } = {}) {
      let events = 0;
      for (let next = sim.nextDueAt(); next !== null; next = sim.nextDueAt()) {
        now = Math.max(now, next);
        events += sim.step(now, 1);
        if (events % checkEvery === 0) assert.deepEqual(engine.checkInvariants(), [], `after ${events} events`);
      }
      return events;
    },
  };
}

describe('construction', () => {
  const engine = { getState: () => ({ products: [], startsAt: 0 }) };
  const base = { engine, clock: () => 0, random: () => 0.5 };

  test('rejects an unusable crowd size, profile or share', () => {
    for (const buyers of [0, -1, 1.5, 100_001]) assert.throws(() => new TrafficSimulator({ ...base, buyers }), RangeError);
    assert.throws(() => new TrafficSimulator({ ...base, profile: 'tsunami' }), RangeError);
    assert.throws(() => new TrafficSimulator({ ...base, abandonShare: 1.5 }), RangeError);
    assert.throws(() => new TrafficSimulator({ ...base, duplicateShare: -0.1 }), RangeError);
    assert.throws(() => new TrafficSimulator({ engine, clock: 1, random: () => 0 }), TypeError);
  });

  test('cannot start twice, and stepping before start does nothing', () => {
    const w = setup({ buyers: 5 });
    assert.throws(() => w.sim.start(0), /already started/);
    const fresh = new TrafficSimulator({ engine: w.engine, clock: () => 0, random: () => 0.5 });
    assert.equal(fresh.step(1e12), 0);
    assert.equal(fresh.nextDueAt(), null);
  });
});

describe('arrival profiles', () => {
  const sample = (profile, earlyBird = false, n = 20_000) => {
    const random = createSeededRandom(11);
    return Array.from({ length: n }, () => arrivalOffset(profile, random, earlyBird));
  };
  const share = (values, test) => values.filter(test).length / values.length;

  test('the spike puts most buyers in the first two seconds', () => {
    assert.ok(share(sample('spike'), (x) => x >= 0 && x < 2000) > 0.6);
  });

  test('a steady stream spreads buyers over the first minute', () => {
    const steady = sample('steady');
    assert.ok(share(steady, (x) => x < 2000) < 0.06);
    assert.ok(Math.max(...steady) < 60_000 && Math.min(...steady) >= 0);
  });

  test('a ramp builds toward its end', () => {
    const ramp = sample('ramp');
    // The window is -1 s to 20 s, and a square-root draw puts about 72% of buyers in its second half.
    assert.ok(share(ramp, (x) => x > 10_000) > 0.6);
    assert.ok(share(ramp, (x) => x > 10_000) > share(ramp, (x) => x <= 10_000));
    assert.ok(Math.min(...ramp) >= -1000);
  });

  test('early birds always arrive before the sale opens, never earlier than two seconds before', () => {
    const early = sample('spike', true);
    assert.ok(early.every((x) => x <= 0 && x >= -2000));
  });

  test('every offered profile is known', () => {
    const random = createSeededRandom(1);
    for (const { id } of PROFILE_INFO) assert.doesNotThrow(() => arrivalOffset(id, random, false));
    assert.throws(() => arrivalOffset('nope', random, false), RangeError);
  });
});

describe('seeded runs', () => {
  test('the same seed gives identical metrics, and a different seed gives different ones', () => {
    const run = (seed) => {
      const w = setup({ seed, buyers: 600 });
      w.drain();
      return JSON.stringify(w.sim.metrics());
    };
    assert.equal(run(5), run(5));
    assert.notEqual(run(5), run(6));
  });

  test('the random source is deterministic and uniform enough', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const values = Array.from({ length: 5000 }, () => a());
    assert.deepEqual(values.slice(0, 5), Array.from({ length: 5 }, () => b()));
    assert.ok(values.every((v) => v >= 0 && v < 1));
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    assert.ok(Math.abs(mean - 0.5) < 0.02);
  });
});

describe('a full flash sale', () => {
  test('never oversells, and every hold ends in exactly one outcome', () => {
    const w = setup({ seed: 3, buyers: 2500 });
    w.drain();
    w.setNow(w.now + 60_000); // let the last abandoned holds expire
    const state = w.engine.getState();
    const m = w.sim.metrics();

    assert.deepEqual(w.engine.checkInvariants(), []);
    assert.equal(m.errors, 0);
    assert.equal(m.finished, true);
    assert.equal(state.active.length, 0, 'every hold was resolved or rolled back');
    for (const p of state.products) {
      assert.ok(p.stock.sold <= p.stock.initial, `${p.sku} sold ${p.stock.sold} of ${p.stock.initial}`);
      assert.equal(p.stock.available + p.stock.sold, p.stock.initial, `${p.sku}: nothing left held or lost`);
    }
    // Each hold that was taken ends in exactly one of five outcomes.
    assert.equal(m.reserved, m.paid + m.paymentFailed + m.abandoned + m.expiredBeforeCheckout + m.expiredDuringPayment);
    assert.equal(m.paid, state.totals.orders);
    assert.equal(m.revenueMinor, state.totals.revenueMinor);
    assert.equal(state.totals.unitsSold, state.products.reduce((sum, p) => sum + p.stock.sold, 0));
    assert.ok(m.paid > 0 && m.outOfStock > 0, 'demand exceeded supply, as in a real flash sale');
  });

  test('the pre-sale crowd is refused, retries with backoff and some of it gets through', () => {
    const w = setup({ seed: 8, buyers: 1500, earlyBirdShare: 0.6 });
    w.drain();
    const m = w.sim.metrics();
    assert.ok(m.rejectedEarly > 0, 'early requests were refused');
    assert.ok(m.attempts > m.arrived, 'retries added to the load');
    assert.ok(m.reserved > 0);
  });

  test('double clicks are absorbed by the idempotency key and take no extra stock', () => {
    const w = setup({ seed: 4, buyers: 800, duplicateShare: 0.6, abandonShare: 0, paymentFailureShare: 0 });
    w.drain();
    const m = w.sim.metrics();
    assert.ok(m.duplicatesAbsorbed > 0);
    assert.ok(m.reserved <= m.buyers, 'at most one hold per buyer');
    assert.deepEqual(w.engine.checkInvariants(), []);
  });

  test('optimistic buyers hit version conflicts and retry with the fresh version', () => {
    const w = setup({ seed: 6, buyers: 1200, optimisticShare: 1, earlyBirdShare: 0 });
    w.drain();
    assert.ok(w.sim.metrics().conflicts > 0);
  });

  test('without optimistic locking there are no conflicts', () => {
    const w = setup({ seed: 6, buyers: 1200, optimisticShare: 0 });
    w.drain();
    assert.equal(w.sim.metrics().conflicts, 0);
  });

  test('abandoned carts expire and give their stock back', () => {
    const w = setup({ seed: 9, buyers: 400, abandonShare: 1, earlyBirdShare: 0 });
    w.drain();
    const m = w.sim.metrics();
    assert.ok(m.abandoned > 0);
    assert.equal(m.paid, 0);
    w.setNow(w.now + 60_000);
    const state = w.engine.getState();
    assert.equal(state.active.length, 0);
    assert.ok(state.products.every((p) => p.stock.available === p.stock.initial));
  });

  test('payments that fail release their hold', () => {
    const w = setup({ seed: 10, buyers: 400, paymentFailureShare: 1, abandonShare: 0, earlyBirdShare: 0 });
    w.drain();
    const m = w.sim.metrics();
    assert.ok(m.paymentFailed > 0);
    assert.equal(m.paid, 0);
    assert.ok(w.engine.getState().products.every((p) => p.stock.available === p.stock.initial));
  });

  test('a payment that arrives after the hold expired is refused, never sold', () => {
    // Holds and the checkout window last 1 s, but buyers take 2 to 6 s to pay.
    const w = setup({ seed: 12, buyers: 600, holdTtlMs: 1000, checkoutWindowMs: 1000, thinkMs: [100, 200], payMs: [2000, 6000], abandonShare: 0, paymentFailureShare: 0, earlyBirdShare: 0 });
    w.drain();
    const m = w.sim.metrics();
    assert.ok(m.expiredDuringPayment > 0, 'late payments were turned away');
    assert.equal(m.paid, 0, 'and none of them sold');
    assert.equal(m.errors, 0);
    assert.deepEqual(w.engine.checkInvariants(), []);
  });

  test('the buyer mix follows the regional shares', () => {
    const w = setup({ seed: 2, buyers: 6000 });
    const m = w.sim.metrics();
    for (const region of REGIONS) {
      const share = m.regions.find((r) => r.code === region.code).buyers / 6000;
      const expected = region.share / 100;
      assert.ok(Math.abs(share - expected) < 0.03, `${region.code}: ${share} vs ${expected}`);
    }
  });

  test('latency is reported as percentiles, and the slow tail shows', () => {
    const w = setup({ seed: 2, buyers: 2000 });
    w.drain();
    const { latencyMs } = w.sim.metrics();
    assert.ok(latencyMs.samples > 0);
    assert.ok(latencyMs.p50 > 0 && latencyMs.p95 >= latencyMs.p50);
  });
});

describe('stepping', () => {
  test('a step handles at most its budget, and the rest stays scheduled', () => {
    const w = setup({ buyers: 500 });
    const far = w.engine.getState().startsAt + 1e9;
    assert.equal(w.sim.step(far, 10), 10);
    assert.ok(w.sim.metrics().pending > 0);
    assert.ok(w.sim.nextDueAt() !== null);
  });

  test('events are handled in time order, and nothing future runs early', () => {
    const w = setup({ buyers: 300, earlyBirdShare: 0 });
    const startsAt = w.engine.getState().startsAt;
    assert.equal(w.sim.step(startsAt - 1, 1e6), 0, 'nothing is due before the sale opens (no early birds)');
    assert.ok(w.sim.nextDueAt() >= startsAt);
  });

  test('stop drops every scheduled event', () => {
    const w = setup({ buyers: 300 });
    w.sim.stop();
    assert.equal(w.sim.nextDueAt(), null);
    assert.equal(w.sim.metrics().finished, true);
  });
});
