import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  IdempotencyConflictError,
  InvalidTransitionError,
  InventoryFsm,
  LimitExceededError,
  OutOfStockError,
  ReservationExpiredError,
  ReservationEvent,
  ReservationState,
  TERMINAL_STATES,
  TRANSITIONS,
  UnknownReservationError,
  UnknownSkuError,
  VersionConflictError,
  checkInvariantState,
  isTerminal,
  nextState,
} from '../js/inventory-fsm.js';

/** A fake world: a clock the test moves and timers it fires by hand. Nothing reads real time. */
function world({ start = 1_000_000, ...options } = {}) {
  let clock = start;
  let nextTimerId = 1;
  const timers = new Map();
  const events = [];
  const errors = [];
  const fsm = new InventoryFsm({
    clock: () => clock,
    setTimer: (callback, delay) => {
      const id = nextTimerId++;
      timers.set(id, { callback, delay, firesAt: clock + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    onTransition: (entry) => events.push(entry),
    onError: (error) => errors.push(error),
    ...options,
  });
  return {
    fsm,
    events,
    errors,
    timers,
    get now() {
      return clock;
    },
    advance(ms) {
      clock += ms;
    },
    setNow(value) {
      clock = value;
    },
    /** Runs the earliest armed timer at its due time, or at `at` if given. */
    fireTimer(at) {
      const [id, timer] = [...timers.entries()].sort((a, b) => a[1].firesAt - b[1].firesAt)[0];
      timers.delete(id);
      clock = at ?? Math.max(clock, timer.firesAt);
      timer.callback();
    },
    get timer() {
      return [...timers.values()].sort((a, b) => a.firesAt - b.firesAt)[0];
    },
  };
}

let keyCounter = 0;
const key = () => `k-${++keyCounter}`;
const reserve = (fsm, over = {}) => fsm.reserve({ sku: 'S', buyerId: 'b1', quantity: 1, idempotencyKey: key(), ...over });

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

describe('transition table', () => {
  test('lists exactly the legal transitions', () => {
    assert.deepEqual(TRANSITIONS.HELD, { BEGIN_CHECKOUT: 'CHECKOUT', CONFIRM: 'CONFIRMED', RELEASE: 'RELEASED', EXPIRE: 'EXPIRED' });
    assert.deepEqual(TRANSITIONS.CHECKOUT, { CONFIRM: 'CONFIRMED', RELEASE: 'RELEASED', EXPIRE: 'EXPIRED' });
  });

  test('terminal states have no outgoing transition', () => {
    for (const state of TERMINAL_STATES) {
      assert.deepEqual(TRANSITIONS[state], {});
      for (const event of Object.values(ReservationEvent)) assert.equal(nextState(state, event), null);
      assert.equal(isTerminal(state), true);
    }
    assert.equal(isTerminal('HELD'), false);
    assert.equal(isTerminal('CHECKOUT'), false);
  });

  test('exactly seven of the twenty state and event pairs are legal', () => {
    let legal = 0;
    for (const state of Object.values(ReservationState)) {
      for (const event of Object.values(ReservationEvent)) if (nextState(state, event) !== null) legal++;
    }
    assert.equal(legal, 7);
  });

  test('unknown states and events lead nowhere, and the table cannot be edited', () => {
    assert.equal(nextState('NOPE', 'CONFIRM'), null);
    assert.equal(nextState('HELD', 'NOPE'), null);
    assert.equal(Object.isFrozen(TRANSITIONS), true);
    assert.equal(Object.isFrozen(TRANSITIONS.HELD), true);
  });
});

describe('stock registration and snapshots', () => {
  test('addSku returns a frozen snapshot at version 1', () => {
    const w = world();
    const snap = w.fsm.addSku({ sku: 'S', stock: 10, limitPerBuyer: 2 });
    assert.deepEqual(snap, { sku: 'S', initial: 10, available: 10, reserved: 0, sold: 0, version: 1, limitPerBuyer: 2 });
    assert.equal(Object.isFrozen(snap), true);
  });

  test('rejects duplicate SKUs and invalid stock', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 1 });
    assert.throws(() => w.fsm.addSku({ sku: 'S', stock: 1 }), RangeError);
    assert.throws(() => w.fsm.addSku({ sku: 'T', stock: -1 }), RangeError);
    assert.throws(() => w.fsm.addSku({ sku: 'T', stock: 1.5 }), RangeError);
    assert.throws(() => w.fsm.addSku({ sku: '', stock: 1 }), TypeError);
    assert.throws(() => w.fsm.addSku({ sku: 'T', stock: 1, limitPerBuyer: 0 }), RangeError);
  });

  test('an unknown SKU has no snapshot', () => {
    assert.equal(world().fsm.getSnapshot('nope'), null);
  });
});

describe('reserve', () => {
  test('holds stock, starts the countdown and bumps the version', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 10 });
    const result = reserve(w.fsm, { quantity: 2 });

    assert.equal(result.ok, true);
    assert.equal(result.replayed, false);
    assert.equal(result.reservation.state, 'HELD');
    assert.equal(result.reservation.expiresAt, w.now + 1000);
    assert.equal(result.reservation.remainingMs, 1000);
    assert.deepEqual(w.fsm.getSnapshot('S'), { sku: 'S', initial: 10, available: 8, reserved: 2, sold: 0, version: 2, limitPerBuyer: Infinity });
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('a failed reserve changes nothing: no counters, no version, no journal entry', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const before = w.fsm.getSnapshot('S');
    const journalBefore = w.fsm.getJournal().length;

    const result = reserve(w.fsm, { quantity: 2 });

    assert.equal(result.ok, false);
    assert.ok(result.error instanceof OutOfStockError);
    assert.equal(result.error.available, 1);
    assert.equal(result.error.requested, 2);
    assert.deepEqual(w.fsm.getSnapshot('S'), before);
    assert.equal(w.fsm.getJournal().length, journalBefore);
  });

  test('reports an unknown SKU as a typed result, not a throw', () => {
    const w = world();
    const result = reserve(w.fsm, { sku: 'ghost' });
    assert.ok(!result.ok && result.error instanceof UnknownSkuError);
  });

  test('enforces the per-buyer limit across holds and confirmed units', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 10, limitPerBuyer: 2 });
    const first = reserve(w.fsm, { quantity: 2 });
    const over = reserve(w.fsm, { quantity: 1 });
    assert.ok(!over.ok && over.error instanceof LimitExceededError);
    assert.equal(over.error.current, 2);

    w.fsm.confirm(first.reservation.id);
    const stillOver = reserve(w.fsm, { quantity: 1 });
    assert.ok(!stillOver.ok && stillOver.error instanceof LimitExceededError, 'owned units still count');

    const otherBuyer = reserve(w.fsm, { buyerId: 'b2', quantity: 2 });
    assert.equal(otherBuyer.ok, true);
  });

  test('a released hold frees the buyer limit', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 10, limitPerBuyer: 1 });
    const held = reserve(w.fsm);
    assert.equal(reserve(w.fsm).ok, false);
    w.fsm.release(held.reservation.id);
    assert.equal(reserve(w.fsm).ok, true);
  });

  test('throws for malformed requests, which are programming errors', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 10 });
    assert.throws(() => w.fsm.reserve({ sku: 'S', buyerId: 'b', quantity: 1 }), TypeError);
    assert.throws(() => w.fsm.reserve({ sku: 'S', buyerId: 'b', quantity: 1, idempotencyKey: '' }), TypeError);
    assert.throws(() => w.fsm.reserve({ sku: '', buyerId: 'b', quantity: 1, idempotencyKey: 'k' }), TypeError);
    assert.throws(() => reserve(w.fsm, { quantity: 0 }), RangeError);
    assert.throws(() => reserve(w.fsm, { quantity: 1.5 }), RangeError);
    assert.throws(() => reserve(w.fsm, { quantity: 6 }), RangeError, 'default maximum is 5');
    assert.throws(() => reserve(w.fsm, { expectedVersion: -1 }), RangeError);
  });

  test('honours a custom maximum quantity', () => {
    const w = world({ maxQuantityPerRequest: 2 });
    w.fsm.addSku({ sku: 'S', stock: 10 });
    assert.equal(reserve(w.fsm, { quantity: 2 }).ok, true);
    assert.throws(() => reserve(w.fsm, { quantity: 3 }), RangeError);
  });
});

describe('idempotency', () => {
  test('a repeated key returns the same reservation and takes stock once', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const k = key();
    const first = reserve(w.fsm, { idempotencyKey: k });
    const second = reserve(w.fsm, { idempotencyKey: k });

    assert.equal(second.ok, true);
    assert.equal(second.replayed, true);
    assert.equal(second.reservation.id, first.reservation.id);
    assert.equal(w.fsm.getSnapshot('S').available, 4);
  });

  test('the same key with a different payload is rejected and takes nothing', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const k = key();
    reserve(w.fsm, { idempotencyKey: k, quantity: 1 });
    const clash = reserve(w.fsm, { idempotencyKey: k, quantity: 2 });
    assert.ok(!clash.ok && clash.error instanceof IdempotencyConflictError);
    assert.equal(w.fsm.getSnapshot('S').available, 4);
  });

  test('one hundred concurrent identical requests produce one reservation', async () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const k = key();
    const results = await Promise.all(
      Array.from({ length: 100 }, async () => {
        await Promise.resolve();
        return reserve(w.fsm, { idempotencyKey: k });
      }),
    );
    assert.equal(new Set(results.map((r) => r.reservation.id)).size, 1);
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    assert.equal(w.fsm.getSnapshot('S').available, 4);
  });

  test('a replay after the hold expired returns the expired reservation, not a new hold', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const k = key();
    reserve(w.fsm, { idempotencyKey: k });
    w.advance(1000);
    const replay = reserve(w.fsm, { idempotencyKey: k });
    assert.equal(replay.replayed, true);
    assert.equal(replay.reservation.state, 'EXPIRED');
    assert.equal(w.fsm.getSnapshot('S').available, 5);
  });

  test('a failed attempt is not remembered, so the same key can succeed once stock returns', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const holder = reserve(w.fsm);
    const k = key();
    assert.equal(reserve(w.fsm, { buyerId: 'b2', idempotencyKey: k }).ok, false);
    w.fsm.release(holder.reservation.id);
    const retry = reserve(w.fsm, { buyerId: 'b2', idempotencyKey: k });
    assert.equal(retry.ok, true);
    assert.equal(retry.replayed, false);
  });

  test('a key is forgotten only when its finished reservation is evicted', () => {
    const w = world({ terminalRetention: 1 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const k1 = key();
    const a = reserve(w.fsm, { idempotencyKey: k1 });
    w.fsm.release(a.reservation.id);
    assert.equal(reserve(w.fsm, { idempotencyKey: k1 }).replayed, true, 'still retained');

    const b = reserve(w.fsm);
    w.fsm.release(b.reservation.id); // evicts the first finished reservation
    const again = reserve(w.fsm, { idempotencyKey: k1 });
    assert.equal(again.replayed, false, 'the evicted key is a new request');
    assert.equal(w.fsm.stats().idempotencyKeys <= 2, true);
  });
});

describe('optimistic locking', () => {
  test('a stale version is rejected with the fresh snapshot, and nothing changes', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const seen = w.fsm.getSnapshot('S');
    reserve(w.fsm, { buyerId: 'rival' });
    const before = w.fsm.getSnapshot('S');

    const result = reserve(w.fsm, { expectedVersion: seen.version });

    assert.ok(!result.ok && result.error instanceof VersionConflictError);
    assert.equal(result.error.expectedVersion, seen.version);
    assert.equal(result.error.actualVersion, before.version);
    assert.deepEqual(result.error.snapshot, before);
    assert.deepEqual(w.fsm.getSnapshot('S'), before);
  });

  test('retrying with the version from the conflict succeeds', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const seen = w.fsm.getSnapshot('S');
    reserve(w.fsm, { buyerId: 'rival' });
    const conflict = reserve(w.fsm, { expectedVersion: seen.version });
    const retry = reserve(w.fsm, { expectedVersion: conflict.error.snapshot.version });
    assert.equal(retry.ok, true);
  });

  test('the current version is accepted, and omitting it skips the check', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    assert.equal(reserve(w.fsm, { expectedVersion: w.fsm.getSnapshot('S').version }).ok, true);
    assert.equal(reserve(w.fsm, { buyerId: 'b2' }).ok, true);
  });

  test('every change to a SKU raises its version by one', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const versions = [w.fsm.getSnapshot('S').version];
    const hold = reserve(w.fsm);
    versions.push(w.fsm.getSnapshot('S').version);
    w.fsm.beginCheckout(hold.reservation.id);
    versions.push(w.fsm.getSnapshot('S').version);
    w.fsm.confirm(hold.reservation.id);
    versions.push(w.fsm.getSnapshot('S').version);
    assert.deepEqual(versions, [1, 2, 3, 4]);
  });

  test('a replay or a failed call does not raise the version', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const k = key();
    reserve(w.fsm, { idempotencyKey: k });
    const v = w.fsm.getSnapshot('S').version;
    reserve(w.fsm, { idempotencyKey: k });
    reserve(w.fsm, { buyerId: 'b2' }); // out of stock
    assert.equal(w.fsm.getSnapshot('S').version, v);
  });
});

describe('confirm, release and checkout', () => {
  test('confirm moves held units to sold and ends the countdown', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm, { quantity: 2 });
    const done = w.fsm.confirm(hold.reservation.id);

    assert.equal(done.ok, true);
    assert.equal(done.reservation.state, 'CONFIRMED');
    assert.equal(done.reservation.remainingMs, 0);
    const snap = w.fsm.getSnapshot('S');
    assert.equal(snap.reserved, 0);
    assert.equal(snap.sold, 2);
    assert.equal(snap.available, 3);
    assert.deepEqual(w.fsm.checkInvariants(), []);
    assert.equal(w.fsm.getCountdown(hold.reservation.id), null);
  });

  test('confirming twice is a replay and sells once', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.fsm.confirm(hold.reservation.id);
    const again = w.fsm.confirm(hold.reservation.id);
    assert.equal(again.ok, true);
    assert.equal(again.replayed, true);
    assert.equal(w.fsm.getSnapshot('S').sold, 1);
  });

  test('a finished reservation cannot be moved to another state', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const confirmed = reserve(w.fsm);
    w.fsm.confirm(confirmed.reservation.id);
    const released = reserve(w.fsm);
    w.fsm.release(released.reservation.id);

    for (const result of [
      w.fsm.release(confirmed.reservation.id),
      w.fsm.beginCheckout(confirmed.reservation.id),
      w.fsm.confirm(released.reservation.id),
      w.fsm.beginCheckout(released.reservation.id),
    ]) {
      assert.ok(!result.ok && result.error instanceof InvalidTransitionError);
    }
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('an unknown reservation id is a typed result', () => {
    const w = world();
    for (const call of ['confirm', 'release', 'beginCheckout']) {
      const result = w.fsm[call]('nope');
      assert.ok(!result.ok && result.error instanceof UnknownReservationError);
    }
    assert.equal(w.fsm.getReservation('nope'), null);
  });

  test('release returns the units and is idempotent', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm, { quantity: 3 });
    const done = w.fsm.release(hold.reservation.id);
    assert.equal(done.reservation.state, 'RELEASED');
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.equal(w.fsm.release(hold.reservation.id).replayed, true);
    assert.equal(w.fsm.getSnapshot('S').available, 5);
  });

  test('releasing a hold that already expired reports success without a second rollback', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.advance(1000);
    const result = w.fsm.release(hold.reservation.id);
    assert.equal(result.ok, true);
    assert.equal(result.replayed, true);
    assert.equal(result.reservation.state, 'EXPIRED');
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });
});

describe('expiry', () => {
  test('a hold is valid one millisecond before its deadline and expired at the deadline', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const early = reserve(w.fsm);
    const late = reserve(w.fsm, { buyerId: 'b2' });

    w.advance(999);
    assert.equal(w.fsm.confirm(early.reservation.id).ok, true);

    w.advance(1);
    const result = w.fsm.confirm(late.reservation.id);
    assert.ok(!result.ok && result.error instanceof ReservationExpiredError);
    assert.equal(w.fsm.getReservation(late.reservation.id).state, 'EXPIRED');
  });

  test('confirm after the deadline fails even though the timer has not fired', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const hold = reserve(w.fsm);
    w.advance(5000); // the timer was throttled and never ran
    assert.equal(w.timers.size, 1);

    const result = w.fsm.confirm(hold.reservation.id);

    assert.ok(!result.ok && result.error instanceof ReservationExpiredError);
    assert.equal(w.fsm.getSnapshot('S').sold, 0);
    assert.equal(w.fsm.getSnapshot('S').available, 1, 'rolled back on access');
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('a read applies pending expiry, so the state is never stale', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const hold = reserve(w.fsm);
    w.advance(1000);
    assert.equal(w.fsm.getReservation(hold.reservation.id).state, 'EXPIRED');
    assert.equal(w.fsm.getCountdown(hold.reservation.id), null);
  });

  test('the countdown reports the exact time left for a UI timer', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const hold = reserve(w.fsm);
    w.advance(250);
    assert.deepEqual(w.fsm.getCountdown(hold.reservation.id), { expiresAt: hold.reservation.expiresAt, remainingMs: 750 });
  });

  test('expiry returns the units exactly once, however many times it is triggered', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm, { quantity: 2 });
    w.advance(1000);
    for (let i = 0; i < 5; i++) {
      w.fsm.getReservation(hold.reservation.id);
      w.fsm.sweepExpired();
      w.fsm.confirm(hold.reservation.id);
    }
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.equal(w.events.filter((e) => e.type === 'EXPIRED').length, 1);
  });

  test('a reserve sweeps due holds first, so their stock is available to the next buyer', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const first = reserve(w.fsm, { buyerId: 'a' });
    w.advance(1000); // due, timer not run

    const second = reserve(w.fsm, { buyerId: 'b' });

    assert.equal(second.ok, true);
    assert.equal(w.fsm.getReservation(first.reservation.id).state, 'EXPIRED');
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('a payment that returns after expiry cannot confirm, and the unit is never sold twice', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const slow = reserve(w.fsm, { buyerId: 'slow' });
    w.advance(1000);
    const fast = reserve(w.fsm, { buyerId: 'fast' });
    assert.equal(w.fsm.confirm(fast.reservation.id).ok, true);

    const zombie = w.fsm.confirm(slow.reservation.id);

    assert.ok(!zombie.ok && zombie.error instanceof ReservationExpiredError);
    assert.equal(w.fsm.getSnapshot('S').sold, 1);
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });
});

describe('automatic rollback by timer', () => {
  test('arms one timer for the earliest deadline and rolls back when it fires', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm, { quantity: 2 });
    assert.equal(w.timers.size, 1);
    assert.equal(w.timer.delay, 1000);

    w.fireTimer();

    assert.equal(w.fsm.getReservation(hold.reservation.id).state, 'EXPIRED');
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.equal(w.timers.size, 0, 'nothing live, so no timer');
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('re-arms for the next deadline after one expires', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    reserve(w.fsm, { buyerId: 'a' });
    w.advance(400);
    reserve(w.fsm, { buyerId: 'b' });
    assert.equal(w.timers.size, 1, 'still one timer, for the earlier deadline');

    w.fireTimer();
    assert.equal(w.timers.size, 1);
    assert.equal(w.timer.delay, 400, 'now armed for the second deadline');

    w.fireTimer();
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.equal(w.timers.size, 0);
  });

  test('a timer that fires early expires nothing and re-arms for the remainder', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    const deadline = hold.reservation.expiresAt;

    w.fireTimer(deadline - 1);

    assert.equal(w.fsm.getReservation(hold.reservation.id).state, 'HELD');
    assert.equal(w.timer.delay, 1);
  });

  test('beginning checkout extends the deadline and the old deadline no longer fires', () => {
    const w = world({ holdTtlMs: 1000, checkoutWindowMs: 5000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.advance(900);
    w.fsm.beginCheckout(hold.reservation.id);

    assert.equal(w.timer.delay, 5000);
    w.fireTimer(hold.reservation.createdAt + 1000); // the old deadline, via a stale timer
    assert.equal(w.fsm.getReservation(hold.reservation.id).state, 'CHECKOUT');
  });

  test('without autoExpire no timer is armed, and sweepExpired does the rollback', () => {
    const w = world({ holdTtlMs: 1000, autoExpire: false });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    reserve(w.fsm);
    assert.equal(w.timers.size, 0);
    w.advance(1000);
    assert.equal(w.fsm.sweepExpired(), 1);
    assert.equal(w.fsm.getSnapshot('S').available, 5);
  });

  test('a sweep stops at its budget, and the timer re-arms at once for the rest', () => {
    const w = world({ holdTtlMs: 1000, sweepBudget: 4 });
    w.fsm.addSku({ sku: 'S', stock: 20 });
    for (let i = 0; i < 10; i++) reserve(w.fsm, { buyerId: `b${i}` });
    w.advance(1000);

    w.fireTimer();

    assert.equal(w.fsm.stats().live, 6);
    assert.equal(w.timer.delay, 0, 'due holds remain, so it re-arms without waiting');
    assert.equal(w.fsm.sweepExpired(4), 4);
    assert.equal(w.fsm.stats().live, 2);
  });

  test('dispose clears the timer and rejects further use', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    reserve(w.fsm);
    assert.equal(w.timers.size, 1);

    w.fsm.dispose();
    w.fsm.dispose();

    assert.equal(w.timers.size, 0);
    assert.throws(() => reserve(w.fsm), /disposed/);
    assert.throws(() => w.fsm.confirm('x'), /disposed/);
    assert.throws(() => w.fsm.getSnapshot('S'), /disposed/);
  });
});

describe('checkout window', () => {
  test('extends the deadline once, so a buyer paying near the deadline is not cut off', () => {
    const w = world({ holdTtlMs: 1000, checkoutWindowMs: 5000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.advance(900);
    const started = w.fsm.beginCheckout(hold.reservation.id);
    assert.equal(started.reservation.state, 'CHECKOUT');
    assert.equal(started.reservation.expiresAt, w.now + 5000);

    w.advance(2000); // past the original deadline
    assert.equal(w.fsm.confirm(hold.reservation.id).ok, true);
  });

  test('cannot be extended again, and a repeat is a replay', () => {
    const w = world({ holdTtlMs: 1000, checkoutWindowMs: 5000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    const first = w.fsm.beginCheckout(hold.reservation.id);
    w.advance(3000);
    const repeat = w.fsm.beginCheckout(hold.reservation.id);
    assert.equal(repeat.replayed, true);
    assert.equal(repeat.reservation.expiresAt, first.reservation.expiresAt);
  });

  test('never shortens the deadline', () => {
    const w = world({ holdTtlMs: 1000, checkoutWindowMs: 500 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    const started = w.fsm.beginCheckout(hold.reservation.id);
    assert.equal(started.reservation.expiresAt, hold.reservation.expiresAt);
  });

  test('a checkout that outlasts its window expires and rolls back', () => {
    const w = world({ holdTtlMs: 1000, checkoutWindowMs: 5000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.fsm.beginCheckout(hold.reservation.id);
    w.advance(5000);

    const late = w.fsm.confirm(hold.reservation.id);

    assert.ok(!late.ok && late.error instanceof ReservationExpiredError);
    assert.equal(w.fsm.getSnapshot('S').available, 5);
  });

  test('beginning checkout on an expired hold fails', () => {
    const w = world({ holdTtlMs: 1000 });
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm);
    w.advance(1000);
    const result = w.fsm.beginCheckout(hold.reservation.id);
    assert.ok(!result.ok && result.error instanceof ReservationExpiredError);
  });

  test('a failed payment can release the checkout and return the stock', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    const hold = reserve(w.fsm, { quantity: 2 });
    w.fsm.beginCheckout(hold.reservation.id);
    w.fsm.release(hold.reservation.id);
    assert.equal(w.fsm.getSnapshot('S').available, 5);
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });
});

describe('races and overselling', () => {
  test('optimistic buyers that read, wait and then reserve never oversell, across many seeds', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = world();
      w.fsm.addSku({ sku: 'S', stock: 5 });
      const rand = seededRandom(seed);
      const yieldSome = async () => {
        for (let n = Math.floor(rand() * 4); n > 0; n--) await Promise.resolve();
      };

      const outcomes = await Promise.all(
        Array.from({ length: 60 }, async (_, i) => {
          for (let attempt = 0; attempt < 200; attempt++) {
            const snap = w.fsm.getSnapshot('S'); // read
            await yieldSome(); // other buyers run here
            const result = w.fsm.reserve({ sku: 'S', buyerId: `b${i}`, quantity: 1, idempotencyKey: `s${seed}-b${i}`, expectedVersion: snap.version });
            if (result.ok) return w.fsm.confirm(result.reservation.id).ok ? 'sold' : 'lost';
            if (result.error instanceof OutOfStockError) return 'out';
            if (!(result.error instanceof VersionConflictError)) throw result.error;
          }
          return 'gave-up';
        }),
      );

      const sold = outcomes.filter((o) => o === 'sold').length;
      assert.equal(sold, 5, `seed ${seed}: exactly the stock was sold`);
      assert.equal(outcomes.filter((o) => o === 'gave-up').length, 0);
      assert.equal(w.fsm.getSnapshot('S').sold, 5);
      assert.deepEqual(w.fsm.checkInvariants(), [], `seed ${seed}`);
    }
  });

  test('a hundred buyers without a version check still sell exactly the stock', async () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 7 });
    const results = await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        await Promise.resolve();
        return reserve(w.fsm, { buyerId: `b${i}` });
      }),
    );
    assert.equal(results.filter((r) => r.ok).length, 7);
    assert.equal(results.filter((r) => !r.ok && r.error instanceof OutOfStockError).length, 93);
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('control: the same load does oversell when an await sits between the check and the write', async () => {
    // This is the defect the FSM's synchronous design rules out (catalogue entry C-1).
    // If this control ever stopped overselling, the race tests above would prove nothing.
    let available = 5;
    let sold = 0;
    const naiveReserve = async () => {
      if (available > 0) {
        await Promise.resolve(); // another buyer runs here
        available -= 1;
        sold += 1;
      }
    };
    await Promise.all(Array.from({ length: 60 }, naiveReserve));
    assert.ok(sold > 5, `the naive version sold ${sold} of 5`);
    assert.ok(available < 0, `and its stock went to ${available}`);
  });

  /** All orderings of several step lists that keep each list's own order. */
  function interleavings(lists) {
    if (lists.every((list) => list.length === 0)) return [[]];
    const out = [];
    lists.forEach((list, i) => {
      if (list.length === 0) return;
      const rest = lists.map((l, j) => (j === i ? l.slice(1) : l));
      for (const tail of interleavings(rest)) out.push([list[0], ...tail]);
    });
    return out;
  }

  test('every interleaving of three optimistic buyers for two units keeps the invariants', () => {
    const buyers = [0, 1, 2];
    const schedules = interleavings(buyers.map((b) => [{ b, step: 'read' }, { b, step: 'reserve' }]));
    assert.equal(schedules.length, 90);

    for (const schedule of schedules) {
      const w = world();
      w.fsm.addSku({ sku: 'S', stock: 2 });
      const seen = new Map();
      let reserved = 0;
      for (const { b, step } of schedule) {
        if (step === 'read') seen.set(b, w.fsm.getSnapshot('S').version);
        else {
          const result = w.fsm.reserve({ sku: 'S', buyerId: `b${b}`, idempotencyKey: `b${b}`, expectedVersion: seen.get(b) });
          if (result.ok) reserved++;
        }
        assert.deepEqual(w.fsm.checkInvariants(), [], JSON.stringify(schedule));
      }
      assert.ok(reserved >= 1 && reserved <= 2, `reserved ${reserved} in ${JSON.stringify(schedule)}`);
      assert.ok(w.fsm.getSnapshot('S').reserved <= 2);
    }
  });

  test('every interleaving of three plain buyers for two units reserves exactly two', () => {
    const schedules = interleavings([0, 1, 2].map((b) => [{ b, step: 'read' }, { b, step: 'reserve' }]));
    for (const schedule of schedules) {
      const w = world();
      w.fsm.addSku({ sku: 'S', stock: 2 });
      let reserved = 0;
      for (const { b, step } of schedule) {
        if (step === 'reserve' && w.fsm.reserve({ sku: 'S', buyerId: `b${b}`, idempotencyKey: `b${b}` }).ok) reserved++;
      }
      assert.equal(reserved, 2, JSON.stringify(schedule));
      assert.deepEqual(w.fsm.checkInvariants(), []);
    }
  });

  test('random operation sequences keep every invariant after every step', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = seededRandom(seed * 7919);
      const w = world({ holdTtlMs: 500, checkoutWindowMs: 800, terminalRetention: 25 });
      w.fsm.addSku({ sku: 'A', stock: 6, limitPerBuyer: 2 });
      w.fsm.addSku({ sku: 'B', stock: 3 });
      const ids = [];

      for (let step = 0; step < 200; step++) {
        const roll = rand();
        const pick = () => ids[Math.floor(rand() * ids.length)] ?? 'none';
        if (roll < 0.35) {
          const result = w.fsm.reserve({
            sku: rand() < 0.5 ? 'A' : 'B',
            buyerId: `b${Math.floor(rand() * 5)}`,
            quantity: 1 + Math.floor(rand() * 2),
            idempotencyKey: `${seed}-${step}`,
          });
          if (result.ok) ids.push(result.reservation.id);
        } else if (roll < 0.5) w.fsm.confirm(pick());
        else if (roll < 0.62) w.fsm.release(pick());
        else if (roll < 0.74) w.fsm.beginCheckout(pick());
        else if (roll < 0.9) w.advance(Math.floor(rand() * 300));
        else if (w.timers.size > 0) w.fireTimer();
        else w.fsm.sweepExpired();

        const violations = w.fsm.checkInvariants();
        assert.deepEqual(violations, [], `seed ${seed} step ${step}`);
      }
    }
  });

  test('public operations are synchronous, so no await can sit between a stock read and its write', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 2 });
    const hold = reserve(w.fsm);
    const calls = [
      reserve(w.fsm, { buyerId: 'x' }),
      w.fsm.beginCheckout(hold.reservation.id),
      w.fsm.confirm(hold.reservation.id),
      w.fsm.release(hold.reservation.id),
      w.fsm.getReservation(hold.reservation.id),
      w.fsm.getSnapshot('S'),
      w.fsm.sweepExpired(),
    ];
    for (const value of calls) assert.equal(typeof value?.then, 'undefined');
  });
});

describe('invariant checker', () => {
  const valid = () => ({
    skus: [{ sku: 'S', initial: 5, available: 3, reserved: 1, sold: 1, limitPerBuyer: 2 }],
    reservations: [
      { id: 'r1', sku: 'S', buyerId: 'b', quantity: 1, state: 'HELD' },
      { id: 'r2', sku: 'S', buyerId: 'c', quantity: 1, state: 'CONFIRMED' },
    ],
  });
  const ids = (state) => checkInvariantState(state).map((v) => v.invariant).sort();

  test('accepts a consistent state', () => {
    assert.deepEqual(checkInvariantState(valid()), []);
  });

  test('flags an oversell as I-1 and the broken sum as I-2', () => {
    const state = valid();
    state.skus[0].sold = 6;
    state.skus[0].available = 0;
    state.skus[0].reserved = 0;
    state.reservations = [];
    assert.ok(ids(state).includes('I-1'));
  });

  test('flags broken conservation as I-2', () => {
    const state = valid();
    state.skus[0].available = 4;
    assert.deepEqual(ids(state), ['I-2']);
  });

  test('flags a negative counter as I-3', () => {
    const state = valid();
    state.skus[0].available = -1;
    state.skus[0].reserved = 5;
    assert.ok(ids(state).includes('I-3'));
  });

  test('flags counters that disagree with the reservation records as I-4', () => {
    const wrongReserved = valid();
    wrongReserved.skus[0].reserved = 2;
    wrongReserved.skus[0].available = 2;
    assert.deepEqual(ids(wrongReserved), ['I-4']);

    const wrongSold = valid();
    wrongSold.skus[0].sold = 0;
    wrongSold.skus[0].available = 4;
    assert.deepEqual(ids(wrongSold), ['I-4']);
  });

  test('flags an unknown reservation state as I-4', () => {
    const state = valid();
    state.reservations[0].state = 'LIMBO';
    assert.ok(ids(state).includes('I-4'));
  });

  test('flags a buyer over the limit as I-7', () => {
    const state = valid();
    state.skus[0].limitPerBuyer = 1;
    state.reservations.push({ id: 'r3', sku: 'S', buyerId: 'b', quantity: 1, state: 'HELD' });
    state.skus[0].reserved = 2;
    state.skus[0].available = 2;
    assert.deepEqual(ids(state), ['I-7']);
  });

  test('exportState is a copy: editing it does not touch the store', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 3 });
    const state = w.fsm.exportState();
    state.skus[0].available = 999;
    assert.equal(w.fsm.getSnapshot('S').available, 3);
  });
});

describe('bounded memory', () => {
  test('finished reservations are capped at the retention limit, oldest first', () => {
    const w = world({ terminalRetention: 3 });
    w.fsm.addSku({ sku: 'S', stock: 20 });
    const first = reserve(w.fsm);
    w.fsm.release(first.reservation.id);
    for (let i = 0; i < 9; i++) w.fsm.release(reserve(w.fsm).reservation.id);

    const stats = w.fsm.stats();
    assert.ok(stats.finishedRetained <= 3);
    assert.equal(stats.live, 0);
    assert.equal(w.fsm.getReservation(first.reservation.id), null, 'oldest was evicted');
    assert.ok(stats.idempotencyKeys <= 3);
    assert.deepEqual(w.fsm.checkInvariants(), []);
  });

  test('live reservations can never exceed total stock', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 5 });
    for (let i = 0; i < 100; i++) reserve(w.fsm, { buyerId: `b${i}` });
    assert.equal(w.fsm.stats().live, 5);
  });

  test('stale expiry entries are discarded once nothing live remains', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 10 });
    const ids = Array.from({ length: 5 }, (_, i) => reserve(w.fsm, { buyerId: `b${i}` }).reservation.id);
    for (const id of ids) w.fsm.release(id);
    w.fsm.getSnapshot('S');
    w.fsm.sweepExpired();
    assert.equal(w.fsm.stats().heapEntries, 0);
    assert.equal(w.timers.size, 0);
  });

  test('the in-memory journal is capped, and the drop count is reported', () => {
    const w = world({ journalCapacity: 10 });
    w.fsm.addSku({ sku: 'S', stock: 100 });
    for (let i = 0; i < 60; i++) reserve(w.fsm, { buyerId: `b${i}` });

    const stats = w.fsm.stats();
    assert.ok(stats.journalEntries <= 10);
    assert.ok(stats.journalDropped > 0);
    assert.equal(w.fsm.getJournal().length, 10);
    assert.equal(w.events.length, 61, 'the hook still saw every entry');
  });
});

describe('journal and hooks', () => {
  test('every change produces one entry, in order, with counters after the change', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 3 });
    const hold = reserve(w.fsm, { quantity: 2 });
    w.fsm.beginCheckout(hold.reservation.id);
    w.fsm.confirm(hold.reservation.id);

    assert.deepEqual(w.events.map((e) => e.type), ['SKU_ADDED', 'RESERVED', 'BEGIN_CHECKOUT', 'CONFIRMED']);
    assert.deepEqual(w.events.map((e) => e.seq), [1, 2, 3, 4]);
    assert.deepEqual(w.events.at(-1).after, { available: 1, reserved: 0, sold: 2, version: 4 });
    assert.equal(w.events[2].from, 'HELD');
    assert.equal(w.events[2].to, 'CHECKOUT');
  });

  test('failed calls, replays and reads write nothing', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 1 });
    const k = key();
    const hold = reserve(w.fsm, { idempotencyKey: k });
    const count = w.events.length;
    reserve(w.fsm, { idempotencyKey: k });
    reserve(w.fsm, { buyerId: 'b2' });
    w.fsm.getReservation(hold.reservation.id);
    w.fsm.getSnapshot('S');
    w.fsm.confirm('nope');
    assert.equal(w.events.length, count);
  });

  test('the hook runs after the change, so reading the store inside it sees the new counters', () => {
    const seen = [];
    let fsm;
    const w = world({
      onTransition: (entry) => {
        if (entry.type === 'RESERVED') seen.push({ entry: entry.after, live: fsm.getSnapshot('S') });
      },
    });
    fsm = w.fsm;
    fsm.addSku({ sku: 'S', stock: 3 });
    reserve(fsm);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].live.available, seen[0].entry.available);
    assert.equal(seen[0].live.version, seen[0].entry.version);
  });

  test('a hook that throws is reported and does not affect the operation', () => {
    const errors = [];
    const w = world({
      onTransition: () => {
        throw new Error('ledger down');
      },
      onError: (error) => errors.push(error),
    });
    w.fsm.addSku({ sku: 'S', stock: 3 });
    const result = reserve(w.fsm);
    assert.equal(result.ok, true);
    assert.equal(w.fsm.getSnapshot('S').available, 2);
    assert.ok(errors.length >= 2);
    assert.equal(errors[0].message, 'ledger down');
  });

  test('a hook may call back into the store without breaking delivery order', () => {
    const order = [];
    let fsm;
    const w = world({
      onTransition: (entry) => {
        order.push(entry.type);
        if (entry.type === 'RESERVED') fsm.release(entry.reservationId);
      },
    });
    fsm = w.fsm;
    fsm.addSku({ sku: 'S', stock: 3 });
    reserve(fsm);
    assert.deepEqual(order, ['SKU_ADDED', 'RESERVED', 'RELEASED']);
    assert.equal(fsm.getSnapshot('S').available, 3);
    assert.deepEqual(fsm.checkInvariants(), []);
  });

  test('entries handed to the hook and to getJournal cannot be used to alter the store', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 3 });
    reserve(w.fsm);
    assert.equal(Object.isFrozen(w.events[0]), true);
    const journal = w.fsm.getJournal();
    journal.length = 0;
    assert.equal(w.fsm.getJournal().length, 2);
  });

  test('views are frozen copies', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 3 });
    const { reservation } = reserve(w.fsm);
    assert.equal(Object.isFrozen(reservation), true);
    assert.throws(() => {
      'use strict';
      reservation.state = 'CONFIRMED';
    }, TypeError);
    assert.equal(w.fsm.getReservation(reservation.id).state, 'HELD');
  });
});

describe('construction', () => {
  test('rejects non-positive or non-integer options', () => {
    for (const option of ['holdTtlMs', 'checkoutWindowMs', 'maxQuantityPerRequest', 'sweepBudget', 'terminalRetention', 'journalCapacity']) {
      for (const bad of [0, -1, 1.5, Number.NaN]) {
        assert.throws(() => new InventoryFsm({ [option]: bad }), RangeError, `${option}=${bad}`);
      }
    }
  });

  test('default ids are unique and sequential', () => {
    const w = world();
    w.fsm.addSku({ sku: 'S', stock: 3 });
    const a = reserve(w.fsm);
    const b = reserve(w.fsm, { buyerId: 'b2' });
    assert.notEqual(a.reservation.id, b.reservation.id);
  });

  test('a duplicate id from newId is refused, not silently overwritten', () => {
    const w = world({ newId: () => 'same' });
    w.fsm.addSku({ sku: 'S', stock: 3 });
    reserve(w.fsm);
    assert.throws(() => reserve(w.fsm, { buyerId: 'b2' }), /duplicate reservation id/);
    assert.equal(w.fsm.getSnapshot('S').available, 2, 'nothing was taken by the refused call');
  });
});
