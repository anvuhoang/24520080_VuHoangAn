import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FlashSaleEngine, SaleEndedError, SaleNotStartedError, SalePhase } from '../js/flash-sale-engine.js';
import { OutOfStockError, ReservationExpiredError, VersionConflictError } from '../js/inventory-fsm.js';

const PRODUCTS = [
  { sku: 'PHONE', name: 'Smartphone 5G', priceMinor: 4_990_000, stock: 10, limitPerBuyer: 1 },
  { sku: 'BUDS', name: 'Wireless earbuds', priceMinor: 590_000, stock: 20 },
];

/**
 * A fake world. The server clock and the (skewable) client clock are separate. One set of fake
 * timers serves the engine, the FSM and the countdown, and a hand-driven frame loop stands in
 * for requestAnimationFrame. Nothing here reads real time.
 */
function world({ start = 10_000_000, startsIn = 10_000, lasts = 60_000, skew = 0, products = PRODUCTS, ...options } = {}) {
  let server = start;
  let skewMs = skew;
  let nextId = 1;
  const timers = new Map();
  let pendingFrame = null;
  let framesRequested = 0;
  const events = [];
  const errors = [];

  const engine = new FlashSaleEngine({
    products,
    saleStartsAt: start + startsIn,
    saleEndsAt: start + startsIn + lasts,
    serverClock: () => server,
    clientClock: () => server + skewMs,
    setTimer: (callback, delay) => {
      const id = nextId++;
      timers.set(id, { callback, firesAt: server + delay, delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    requestFrame: (callback) => {
      framesRequested++;
      pendingFrame = { id: nextId++, callback };
      return pendingFrame.id;
    },
    cancelFrame: (id) => {
      if (pendingFrame?.id === id) pendingFrame = null;
    },
    visibility: null,
    onError: (error) => errors.push(error),
    ...options,
  });
  engine.subscribe((event) => {
    // The tick's countdown object is reused, so keep a copy.
    events.push(event.type === 'tick' ? { ...event, countdown: { ...event.countdown } } : event);
  });

  const fireDue = () => {
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.firesAt <= server).sort((a, b) => a[1].firesAt - b[1].firesAt)[0];
      if (!due) return;
      timers.delete(due[0]);
      due[1].callback();
    }
  };
  const w = {
    engine,
    events,
    errors,
    timers,
    startsAt: start + startsIn,
    endsAt: start + startsIn + lasts,
    get server() {
      return server;
    },
    set skew(value) {
      skewMs = value;
    },
    get hasPendingFrame() {
      return pendingFrame !== null;
    },
    get framesRequested() {
      return framesRequested;
    },
    /** Moves time forward without firing anything, as a frozen tab would. */
    jump(ms) {
      server += ms;
    },
    fireDue,
    /** A small event loop: advances in steps, firing timers and the frame loop as a browser would. */
    run(ms, step = 16) {
      const end = server + ms;
      while (server < end) {
        server = Math.min(end, server + step);
        fireDue();
        const frame = pendingFrame;
        pendingFrame = null;
        frame?.callback(server);
      }
    },
    of(type) {
      return events.filter((e) => e.type === type);
    },
  };
  return w;
}

let keys = 0;
const buy = (engine, over = {}) => engine.reserve({ sku: 'BUDS', buyerId: 'b1', quantity: 1, idempotencyKey: `k${++keys}`, ...over });

describe('construction', () => {
  const base = { products: PRODUCTS, saleStartsAt: 1000, saleEndsAt: 2000, serverClock: () => 0 };

  test('rejects missing products and an inverted schedule', () => {
    assert.throws(() => new FlashSaleEngine({ ...base, products: [] }), RangeError);
    assert.throws(() => new FlashSaleEngine({ ...base, saleEndsAt: 1000 }), RangeError);
    assert.throws(() => new FlashSaleEngine({ ...base, saleStartsAt: Number.NaN }), RangeError);
  });

  test('rejects bad products', () => {
    assert.throws(() => new FlashSaleEngine({ ...base, products: [PRODUCTS[0], PRODUCTS[0]] }), RangeError);
    assert.throws(() => new FlashSaleEngine({ ...base, products: [{ ...PRODUCTS[0], priceMinor: 1.5 }] }), RangeError);
    assert.throws(() => new FlashSaleEngine({ ...base, products: [{ ...PRODUCTS[0], priceMinor: -1 }] }), RangeError);
    assert.throws(() => new FlashSaleEngine({ ...base, products: [{ ...PRODUCTS[0], name: '' }] }), TypeError);
    assert.throws(() => new FlashSaleEngine({ ...base, products: [{ ...PRODUCTS[0], sku: '' }] }), TypeError);
  });
});

describe('sale phase from the server clock', () => {
  test('changes exactly at the start and at the end', () => {
    const w = world({ startsIn: 1000, lasts: 5000 });
    assert.equal(w.engine.phase, SalePhase.UPCOMING);
    w.jump(999);
    assert.equal(w.engine.phase, SalePhase.UPCOMING);
    w.jump(1);
    assert.equal(w.engine.phase, SalePhase.LIVE);
    w.jump(4999);
    assert.equal(w.engine.phase, SalePhase.LIVE);
    w.jump(1);
    assert.equal(w.engine.phase, SalePhase.ENDED);
  });

  test('start announces the current phase once, and starting twice adds nothing', () => {
    const w = world();
    w.engine.start();
    w.engine.start();
    const phases = w.of('phase');
    assert.equal(phases.length, 1);
    assert.deepEqual({ phase: phases[0].phase, previous: phases[0].previous }, { phase: 'UPCOMING', previous: null });
  });

  test('the phase timer announces each change once, in order', () => {
    const w = world({ startsIn: 1000, lasts: 2000 });
    w.engine.start();
    w.run(4000);
    assert.deepEqual(w.of('phase').map((e) => e.phase), ['UPCOMING', 'LIVE', 'ENDED']);
    assert.deepEqual(w.of('phase').map((e) => e.previous), [null, 'UPCOMING', 'LIVE']);
  });

  test('the phase timer alone announces every boundary when no frame ever runs', () => {
    // The countdown also notices a boundary, so this test removes it: no frame callback is ever invoked.
    const w = world({ startsIn: 1000, lasts: 2000 });
    w.engine.start();
    for (let step = 0; step < 4; step++) {
      w.jump(1000);
      w.fireDue();
    }
    assert.deepEqual(w.of('phase').map((e) => e.phase), ['UPCOMING', 'LIVE', 'ENDED']);
  });

  test('the server boundary is announced on time even when the client clock runs slow', () => {
    // A slow client clock delays the countdown, so only the server-side phase timer can announce the boundary.
    const w = world({ startsIn: 10_000, skew: -3000 });
    w.engine.start();
    const [id, phaseTimer] = [...w.timers.entries()].find(([, t]) => t.delay === 10_000);

    // The timer fires a millisecond early, as timers sometimes do. It must not announce anything,
    // and it must arm itself again for the remainder.
    w.jump(9999);
    w.timers.delete(id);
    phaseTimer.callback();
    assert.equal(w.of('phase').length, 1, 'only the initial UPCOMING announcement');

    w.jump(1);
    w.fireDue();
    assert.deepEqual(w.of('phase').map((e) => e.phase), ['UPCOMING', 'LIVE']);
    assert.equal(w.of('countdown-zero').length, 0, 'the slow client countdown has not finished, yet the sale is open');
  });

  test('a frozen tab cannot hold the sale shut: the next operation syncs the phase', () => {
    const w = world({ startsIn: 1000 });
    w.engine.start();
    w.jump(5000); // no timer fired, no frame ran
    assert.equal(w.of('phase').length, 1);

    const result = buy(w.engine);

    assert.equal(result.ok, true);
    assert.deepEqual(w.of('phase').map((e) => e.phase), ['UPCOMING', 'LIVE']);
    w.fireDue(); // the stale phase timer fires late and must not announce a second time
    assert.equal(w.of('phase').filter((e) => e.phase === 'LIVE').length, 1);
  });

  test('starting during the sale, or after it, begins in that phase', () => {
    const live = world({ startsIn: -1000 });
    live.engine.start();
    assert.equal(live.of('phase')[0].phase, 'LIVE');
    assert.ok(live.hasPendingFrame, 'the countdown runs to the end of the sale');

    const ended = world({ startsIn: -10_000, lasts: 1000 });
    ended.engine.start();
    assert.equal(ended.of('phase')[0].phase, 'ENDED');
    assert.equal(ended.hasPendingFrame, false);
    assert.equal(ended.timers.size, 0);
  });
});

describe('purchase gating', () => {
  test('before the start a hold is refused with the time left, and stock is untouched', () => {
    const w = world({ startsIn: 10_000 });
    const before = w.engine.getSnapshot('BUDS');

    const result = buy(w.engine);

    assert.ok(!result.ok && result.error instanceof SaleNotStartedError);
    assert.equal(result.error.retryAfterMs, 10_000);
    assert.equal(result.error.startsAt, w.startsAt);
    assert.deepEqual(w.engine.getSnapshot('BUDS'), before);
  });

  test('during the sale a hold is accepted', () => {
    const w = world({ startsIn: 0 });
    const result = buy(w.engine);
    assert.equal(result.ok, true);
    assert.equal(result.reservation.state, 'HELD');
  });

  test('after the end a new hold is refused', () => {
    const w = world({ startsIn: 0, lasts: 1000 });
    w.jump(1000);
    const result = buy(w.engine);
    assert.ok(!result.ok && result.error instanceof SaleEndedError);
  });

  test('a hold taken during the sale can still be paid for after the sale closes', () => {
    const w = world({ startsIn: 0, lasts: 5000, holdTtlMs: 60_000 });
    const hold = buy(w.engine);
    w.jump(10_000); // the sale is over, the hold is not

    assert.ok(!buy(w.engine, { buyerId: 'late' }).ok);
    const paid = w.engine.confirm(hold.reservation.id);
    assert.equal(paid.ok, true);
    assert.equal(paid.order.totalMinor, 590_000);
  });

  test('stock errors come through unchanged', () => {
    const w = world({ startsIn: 0 });
    for (let i = 0; i < 10; i++) buy(w.engine, { sku: 'PHONE', buyerId: `p${i}` });
    const result = buy(w.engine, { sku: 'PHONE', buyerId: 'extra' });
    assert.ok(!result.ok && result.error instanceof OutOfStockError);
  });

  test('the optimistic version check still applies', () => {
    const w = world({ startsIn: 0 });
    const seen = w.engine.getSnapshot('BUDS').version;
    buy(w.engine, { buyerId: 'rival' });
    const result = buy(w.engine, { expectedVersion: seen });
    assert.ok(!result.ok && result.error instanceof VersionConflictError);
  });
});

describe('countdown coordination', () => {
  test('counts down to the start, then to the end, then stops', () => {
    const w = world({ startsIn: 1000, lasts: 1000 });
    w.engine.start();
    w.run(3000);

    const ticks = w.of('tick');
    assert.ok(ticks.some((t) => t.phase === 'UPCOMING'));
    assert.ok(ticks.some((t) => t.phase === 'LIVE'));
    for (const tick of ticks) {
      const target = tick.phase === 'UPCOMING' ? w.startsAt : w.endsAt;
      // The last tick of a phase is clamped to zero even if its frame landed after the target.
      assert.equal(tick.countdown.remainingMs, Math.max(0, target - tick.countdown.sampledAt), `tick in ${tick.phase}`);
    }
    assert.equal(w.hasPendingFrame, false, 'no frame loop once the sale is over');
    assert.equal(w.engine.phase, 'ENDED');
  });

  test('each phase ends with a zero tick', () => {
    const w = world({ startsIn: 500, lasts: 500 });
    w.engine.start();
    w.run(2000);
    const zeros = w.of('tick').filter((t) => t.countdown.remainingMs === 0);
    assert.deepEqual(zeros.map((t) => t.phase).slice(0, 2).sort(), ['LIVE', 'UPCOMING']);
  });

  test('never drifts: a long gap with no frames is corrected by the next one', () => {
    const w = world({ startsIn: 600_000 });
    w.engine.start();
    w.jump(300_000);
    w.run(16);
    const last = w.of('tick').at(-1);
    assert.equal(last.countdown.remainingMs, 300_000 - 16);
  });

  test('a one-second resolution emits only when the displayed second changes', () => {
    const w = world({ startsIn: 3500, countdownResolutionMs: 1000 });
    w.engine.start();
    w.run(3600);
    const seconds = w.of('tick').filter((t) => t.phase === 'UPCOMING').map((t) => Math.ceil(t.countdown.remainingMs / 1000));
    assert.deepEqual(seconds, [4, 3, 2, 1, 0]);
  });
});

describe('client clock error', () => {
  test('a fast client clock zeroes the countdown early, but the server keeps the sale closed', () => {
    const w = world({ startsIn: 10_000, skew: 3000 });
    w.engine.start();

    w.run(7100); // the client believes the sale has opened

    const zero = w.of('countdown-zero');
    assert.equal(zero.length, 1);
    assert.equal(zero[0].phase, 'UPCOMING', 'the server says it has not opened');
    const refused = buy(w.engine);
    assert.ok(!refused.ok && refused.error instanceof SaleNotStartedError);
    assert.equal(refused.error.retryAfterMs, 2900);
  });

  test('calibrating resumes the countdown with the true remaining time', () => {
    const w = world({ startsIn: 10_000, skew: 3000 });
    w.engine.start();
    w.run(7100);
    assert.equal(w.hasPendingFrame, false, 'the early countdown finished');

    // One request and response: the server clock is 3 s behind the client.
    const sentAt = w.server + 3000;
    const receivedAt = sentAt + 100;
    const offset = w.engine.calibrateClient(w.server + 50, sentAt, receivedAt);
    assert.equal(offset, -3000);
    assert.equal(w.engine.clientOffsetMs, -3000);

    const resumed = w.of('tick').at(-1);
    assert.equal(resumed.countdown.remainingMs, w.startsAt - w.server);
    assert.ok(w.hasPendingFrame, 'the countdown is running again');

    w.run(3000);
    assert.equal(w.engine.phase, 'LIVE');
    assert.equal(buy(w.engine).ok, true);
  });

  test('the offset set before start is used by the first countdown', () => {
    const w = world({ startsIn: 10_000, skew: 5000 });
    w.engine.calibrateClient(w.server, w.server + 5000, w.server + 5000);
    assert.equal(w.engine.clientOffsetMs, -5000);
    w.engine.start();
    assert.equal(w.of('tick')[0].countdown.remainingMs, 10_000);
  });

  test('rejects a response that arrived before the request was sent', () => {
    const w = world();
    assert.throws(() => w.engine.calibrateClient(0, 100, 50), RangeError);
  });

  test('holds expire on the server clock, whatever the client clock says', () => {
    const w = world({ startsIn: 0, skew: 5000, holdTtlMs: 2000 });
    const hold = buy(w.engine);
    assert.equal(hold.reservation.expiresAt, w.server + 2000);
  });
});

describe('reservations and orders', () => {
  test('an expired hold leaves the active list and returns its stock, with no timer needed', () => {
    const w = world({ startsIn: 0, holdTtlMs: 1000 });
    buy(w.engine, { sku: 'PHONE' });
    assert.equal(w.engine.getState().active.length, 1);

    w.jump(1000); // timers never fired

    const state = w.engine.getState();
    assert.equal(state.active.length, 0);
    assert.equal(state.totals.activeHolds, 0);
    assert.equal(state.recent.at(-1).state, 'EXPIRED');
    assert.equal(state.products[0].stock.available, 10);
  });

  test('the active list shows the live countdown of every hold, soonest first', () => {
    const w = world({ startsIn: 0, holdTtlMs: 5000 });
    buy(w.engine, { buyerId: 'a' });
    w.jump(1000);
    buy(w.engine, { buyerId: 'b' });
    w.jump(500);

    const active = w.engine.getState().active;
    assert.deepEqual(active.map((r) => r.buyerId), ['a', 'b']);
    assert.deepEqual(active.map((r) => r.remainingMs), [3500, 4500]);
  });

  test('checkout extends a hold and the active list shows it', () => {
    const w = world({ startsIn: 0, holdTtlMs: 1000, checkoutWindowMs: 9000 });
    const hold = buy(w.engine);
    w.engine.beginCheckout(hold.reservation.id);
    const [row] = w.engine.getState().active;
    assert.equal(row.state, 'CHECKOUT');
    assert.equal(row.expiresAt, w.server + 9000);
  });

  test('a confirmed hold becomes one order with an integer total, and totals add up', () => {
    const w = world({ startsIn: 0 });
    const hold = buy(w.engine, { sku: 'PHONE' });
    const done = w.engine.confirm(hold.reservation.id);
    assert.equal(done.ok, true);
    assert.equal(done.order.totalMinor, 4_990_000);
    assert.equal(done.order.id, `ord-${hold.reservation.id}`);

    const again = w.engine.confirm(hold.reservation.id);
    assert.equal(again.replayed, true);
    assert.equal(again.order.id, done.order.id);

    const state = w.engine.getState();
    assert.equal(state.orders.length, 1);
    assert.equal(state.totals.revenueMinor, 4_990_000);
    assert.equal(state.totals.unitsSold, 1);
    assert.equal(state.active.length, 0);
  });

  test('an order total is the price times the quantity, and revenue adds the totals', () => {
    const w = world({ startsIn: 0 });
    const hold = buy(w.engine, { quantity: 3 });
    const done = w.engine.confirm(hold.reservation.id);
    assert.equal(done.order.quantity, 3);
    assert.equal(done.order.totalMinor, 3 * 590_000);

    const phone = w.engine.confirm(buy(w.engine, { sku: 'PHONE', buyerId: 'p', quantity: 1 }).reservation.id);
    const state = w.engine.getState();
    assert.equal(state.totals.revenueMinor, 3 * 590_000 + 4_990_000);
    assert.equal(state.totals.unitsSold, 4);
    assert.equal(phone.order.totalMinor, 4_990_000);
  });

  test('a late payment is refused and no order exists', () => {
    const w = world({ startsIn: 0, holdTtlMs: 1000 });
    const hold = buy(w.engine);
    w.jump(1000);
    const late = w.engine.confirm(hold.reservation.id);
    assert.ok(!late.ok && late.error instanceof ReservationExpiredError);
    assert.equal(w.engine.getState().orders.length, 0);
  });

  test('cancel returns the stock', () => {
    const w = world({ startsIn: 0 });
    const hold = buy(w.engine, { sku: 'PHONE' });
    w.engine.cancel(hold.reservation.id);
    assert.equal(w.engine.getSnapshot('PHONE').available, 10);
  });

  test('product flags tell held-by-others from sold out', () => {
    const w = world({ startsIn: 0, products: [{ sku: 'ONE', name: 'One', priceMinor: 100, stock: 2 }] });
    const a = buy(w.engine, { sku: 'ONE', buyerId: 'a' });
    const b = buy(w.engine, { sku: 'ONE', buyerId: 'b' });
    let [p] = w.engine.getState().products;
    assert.deepEqual({ soldOut: p.soldOut, heldByOthers: p.heldByOthers }, { soldOut: false, heldByOthers: true });

    w.engine.confirm(a.reservation.id);
    w.engine.confirm(b.reservation.id);
    [p] = w.engine.getState().products;
    assert.deepEqual({ soldOut: p.soldOut, heldByOthers: p.heldByOthers }, { soldOut: true, heldByOthers: false });
  });

  test('the display lists are capped, while the totals are not', () => {
    const w = world({ startsIn: 0, recentLimit: 3, orderLimit: 2 });
    for (let i = 0; i < 5; i++) w.engine.confirm(buy(w.engine, { buyerId: `b${i}` }).reservation.id);
    for (let i = 5; i < 12; i++) w.engine.cancel(buy(w.engine, { buyerId: `b${i}` }).reservation.id);

    const state = w.engine.getState();
    assert.equal(state.recent.length, 3);
    assert.equal(state.orders.length, 2);
    assert.equal(state.totals.orders, 5);
    assert.equal(state.totals.revenueMinor, 5 * 590_000);
  });
});

describe('events', () => {
  test('stock and reservation events follow each change', () => {
    const w = world({ startsIn: 0 });
    const hold = buy(w.engine);
    w.engine.confirm(hold.reservation.id);

    assert.deepEqual(w.of('stock').map((e) => e.snapshot.version), [2, 3]);
    assert.deepEqual(w.of('reservation').map((e) => e.reservation.state), ['HELD', 'CONFIRMED']);
    assert.equal(w.of('order').length, 1);
    assert.equal(w.of('stock').at(-1).snapshot.sold, 1);
  });

  test('a failed call or a replay emits nothing', () => {
    const w = world({ startsIn: 10_000 });
    buy(w.engine);
    assert.equal(w.of('stock').length, 0);
  });

  test('unsubscribe stops delivery', () => {
    const w = world({ startsIn: 0 });
    const seen = [];
    const off = w.engine.subscribe((e) => seen.push(e.type));
    buy(w.engine);
    off();
    const count = seen.length;
    buy(w.engine, { buyerId: 'b2' });
    assert.equal(seen.length, count);
  });

  test('a throwing listener is reported and does not affect the others or the engine', () => {
    const w = world({ startsIn: 0 });
    const seen = [];
    w.engine.subscribe(() => {
      throw new Error('render failed');
    });
    w.engine.subscribe((e) => seen.push(e.type));

    const result = buy(w.engine);

    assert.equal(result.ok, true);
    assert.ok(seen.includes('stock'));
    assert.ok(w.errors.length > 0);
    assert.equal(w.errors[0].message, 'render failed');
    assert.deepEqual(w.engine.checkInvariants(), []);
  });
});

describe('lifecycle', () => {
  test('dispose cancels the frame loop and every timer, and rejects further use', () => {
    const w = world({ startsIn: 0, holdTtlMs: 5000 });
    w.engine.start();
    buy(w.engine);
    assert.ok(w.hasPendingFrame);
    assert.ok(w.timers.size > 0);

    w.engine.dispose();
    w.engine.dispose();

    assert.equal(w.hasPendingFrame, false);
    assert.equal(w.timers.size, 0);
    assert.throws(() => buy(w.engine), /disposed/);
    assert.throws(() => w.engine.getState(), /disposed/);
    assert.throws(() => w.engine.subscribe(() => {}), /disposed/);
  });

  test('a stale frame or timer after dispose does nothing', () => {
    const w = world({ startsIn: 1000 });
    w.engine.start();
    w.engine.dispose();
    const before = w.events.length;
    w.jump(5000);
    w.fireDue();
    w.run(100);
    assert.equal(w.events.length, before);
  });
});

describe('consistency under random load', () => {
  test('the read model always agrees with the FSM, across the whole schedule, for many seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = (seed * 2654435761) >>> 0;
      const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
      const w = world({ startsIn: 2000, lasts: 8000, holdTtlMs: 1500, checkoutWindowMs: 2500, products: [{ sku: 'A', name: 'A', priceMinor: 100, stock: 6 }, { sku: 'B', name: 'B', priceMinor: 250, stock: 4, limitPerBuyer: 2 }] });
      w.engine.start();
      const ids = [];

      for (let step = 0; step < 150; step++) {
        const roll = rand();
        const id = ids[Math.floor(rand() * ids.length)] ?? 'none';
        if (roll < 0.35) {
          const r = w.engine.reserve({ sku: rand() < 0.5 ? 'A' : 'B', buyerId: `b${Math.floor(rand() * 6)}`, quantity: 1, idempotencyKey: `${seed}-${step}` });
          if (r.ok) ids.push(r.reservation.id);
        } else if (roll < 0.5) w.engine.confirm(id);
        else if (roll < 0.6) w.engine.cancel(id);
        else if (roll < 0.7) w.engine.beginCheckout(id);
        else w.run(Math.floor(rand() * 600), 40);

        assert.deepEqual(w.engine.checkInvariants(), [], `seed ${seed} step ${step}`);
        const state = w.engine.getState();
        const reserved = state.products.reduce((sum, p) => sum + p.stock.reserved, 0);
        const sold = state.products.reduce((sum, p) => sum + p.stock.sold, 0);
        assert.equal(state.active.reduce((sum, r) => sum + r.quantity, 0), reserved, `seed ${seed} step ${step}: active units`);
        assert.equal(state.totals.unitsSold, sold, `seed ${seed} step ${step}: sold units`);
      }
    }
  });
});
