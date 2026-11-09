// tests/claimReducer.test.js
import { describe, expect, it } from 'vitest';
import { CRATES } from '../src/arena/arenaData.js';
import { CLAIM_ACTIONS as A, claimReducer, createInitialClaimState } from '../src/arena/claimReducer.js';

const deepFreeze = (value) => {
  Object.values(value).forEach((v) => typeof v === 'object' && v && deepFreeze(v));
  return Object.freeze(value);
};
const crates = [
  { id: 'a', remainingStock: 1 },
  { id: 'b', remainingStock: 3 },
  { id: 'z', remainingStock: 0 },
  { id: 'c', remainingStock: 50 },
];
// A frozen state: any mutation inside the reducer would throw
const fresh = () => deepFreeze(createInitialClaimState(crates));
const run = (state, ...actions) => actions.reduce(claimReducer, state);

describe('createInitialClaimState', () => {
  it('builds the stock from the crates, with nothing in flight and an idle notice', () => {
    expect(fresh()).toEqual({ stock: { a: 1, b: 3, z: 0, c: 50 }, inFlight: {}, notice: { kind: 'idle' } });
    expect(createInitialClaimState(CRATES).stock).toEqual({ 'gcoin-crate-2500': 1, 'pvs-gold-crate': 30, 'pvs-vip-pass': 20, 'pvs-standard-ticket': 80 });
  });

  it('works with no argument, never starts below zero and does not change the crates', () => {
    expect(createInitialClaimState()).toEqual({ stock: {}, inFlight: {}, notice: { kind: 'idle' } });
    expect(createInitialClaimState([{ id: 'n', remainingStock: -4 }]).stock).toEqual({ n: 0 });
    expect(CRATES[0].remainingStock).toBe(1);
    expect(createInitialClaimState(crates).stock).not.toBe(createInitialClaimState(crates).stock);
  });
});

describe('claimReducer success path', () => {
  it('takes a unit at once (optimistic) and locks the crate', () => {
    const state = run(fresh(), { type: A.START, crateId: 'b', claimId: 'c1' });
    expect(state.stock.b).toBe(2);
    expect(state.inFlight).toEqual({ b: 'c1' });
  });

  it('ignores a second claim for a crate that is already in flight (the same object comes back)', () => {
    const started = run(fresh(), { type: A.START, crateId: 'b', claimId: 'c1' });
    expect(claimReducer(started, { type: A.START, crateId: 'b', claimId: 'c2' })).toBe(started);
  });

  it('ignores an answer for an old claim (another claimId)', () => {
    const started = run(fresh(), { type: A.START, crateId: 'b', claimId: 'c1' });
    expect(claimReducer(started, { type: A.OK, crateId: 'b', claimId: 'c2', remainingStock: 0 })).toBe(started);
    expect(claimReducer(started, { type: A.CONFLICT, crateId: 'b', claimId: 'c2' })).toBe(started);
    expect(claimReducer(started, { type: A.FAILED, crateId: 'b', claimId: 'c2' })).toBe(started);
  });

  it('on OK takes the server number, releases the lock and sets the notice', () => {
    const state = run(fresh(), { type: A.START, crateId: 'b', claimId: 'c1' }, { type: A.OK, crateId: 'b', claimId: 'c1', remainingStock: 2 });
    expect(state.stock.b).toBe(2);
    expect(state.inFlight).toEqual({});
    expect(state.notice).toEqual({ kind: 'ok', crateId: 'b' });
  });

  it('lets a crate be claimed again after its claim finished, and ignores the late answer of the old one', () => {
    const state = run(
      fresh(),
      { type: A.START, crateId: 'b', claimId: 'n1' },
      { type: A.OK, crateId: 'b', claimId: 'n1', remainingStock: 2 },
      { type: A.START, crateId: 'b', claimId: 'n2' }
    );
    expect(state.stock.b).toBe(1);
    const late = claimReducer(state, { type: A.OK, crateId: 'b', claimId: 'n1', remainingStock: 9 });
    expect(late).toBe(state);
    expect(run(state, { type: A.OK, crateId: 'b', claimId: 'n2', remainingStock: 1 }).inFlight).toEqual({});
  });

  it('takes the server number as it is, but never below zero and never a non-integer', () => {
    const started = run(fresh(), { type: A.START, crateId: 'b', claimId: 'o1' });
    const stockAfter = (remainingStock) => claimReducer(started, { type: A.OK, crateId: 'b', claimId: 'o1', remainingStock }).stock.b;
    expect([-5, Number.NaN, undefined, 1.5, '2', 0, 7].map(stockAfter)).toEqual([0, 2, 2, 2, 2, 0, 7]);
  });
});

describe('claimReducer 409 and errors', () => {
  it('on a 409 the unit is given back and the server\'s truth (nothing left) replaces it', () => {
    const state = run(fresh(), { type: A.START, crateId: 'b', claimId: 'm1' }, { type: A.CONFLICT, crateId: 'b', claimId: 'm1' });
    expect(state.stock.b).toBe(0);
    expect(state.inFlight).toEqual({});
    expect(state.notice).toEqual({ kind: 'conflict', crateId: 'b' });
  });

  it('after a 409 the crate is sold out: a new claim is ignored', () => {
    const closed = run(fresh(), { type: A.START, crateId: 'a', claimId: 'k1' }, { type: A.CONFLICT, crateId: 'a', claimId: 'k1' });
    expect(claimReducer(closed, { type: A.START, crateId: 'a', claimId: 'k3' })).toBe(closed);
  });

  it('on another failure the unit comes back and the notice says error', () => {
    const state = run(fresh(), { type: A.START, crateId: 'b', claimId: 'f1' }, { type: A.FAILED, crateId: 'b', claimId: 'f1' });
    expect(state.stock.b).toBe(3);
    expect(state.inFlight).toEqual({});
    expect(state.notice).toEqual({ kind: 'error', crateId: 'b' });
  });

  it('keeps two crates in flight apart', () => {
    const state = run(
      fresh(),
      { type: A.START, crateId: 'a', claimId: 'p1' },
      { type: A.START, crateId: 'b', claimId: 'p2' },
      { type: A.FAILED, crateId: 'a', claimId: 'p1' }
    );
    expect(state.stock).toMatchObject({ a: 1, b: 2 });
    expect(state.inFlight).toEqual({ b: 'p2' });
    expect(run(state, { type: A.OK, crateId: 'b', claimId: 'p2', remainingStock: 2 }).inFlight).toEqual({});
  });
});

describe('claimReducer ignored input', () => {
  it('ignores a claim on a crate with no stock and on an unknown crate', () => {
    const state = fresh();
    expect(claimReducer(state, { type: A.START, crateId: 'z', claimId: 'x' })).toBe(state);
    expect(claimReducer(state, { type: A.START, crateId: 'nope', claimId: 'x' })).toBe(state);
  });

  it('ignores answers when nothing is in flight', () => {
    const state = fresh();
    for (const type of [A.OK, A.CONFLICT, A.FAILED]) {
      expect(claimReducer(state, { type, crateId: 'b', claimId: 'x', remainingStock: 1 })).toBe(state);
    }
  });

  it('ignores an unknown type, a missing action and the names that objects inherit', () => {
    const state = fresh();
    for (const action of [{ type: 'BOGUS', crateId: 'b' }, undefined, null, {}, { type: A.START }]) {
      expect(claimReducer(state, action)).toBe(state);
    }
    for (const crateId of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      expect(claimReducer(state, { type: A.START, crateId, claimId: 'p' })).toBe(state);
      expect(claimReducer(state, { type: A.CONFLICT, crateId, claimId: 'p' })).toBe(state);
    }
  });

  it('exports the four action names, frozen', () => {
    expect(Object.values(A)).toEqual(['CLAIM_START', 'CLAIM_OK', 'CLAIM_CONFLICT', 'CLAIM_FAILED']);
    expect(Object.isFrozen(A)).toBe(true);
  });
});

describe('claimReducer invariants (800,000 random actions)', () => {
  it('never makes the stock negative or fractional, never locks an empty or unknown crate, follows start = -1 and failure = +1', () => {
    let seed = 99;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const ids = ['a', 'b', 'z', 'c', 'q'];
    const types = Object.values(A);
    let bad = 0;
    let violations = 0;
    let changed = 0;
    let counter = 0;

    for (let run = 0; run < 20000; run += 1) {
      let state = createInitialClaimState(crates);
      for (let step = 0; step < 40; step += 1) {
        const crateId = ids[Math.floor(random() * 5)];
        const type = types[Math.floor(random() * 4)];
        const claimId = random() < 0.8 && state.inFlight[crateId] ? state.inFlight[crateId] : `id${counter++}`;
        const before = state;
        state = claimReducer(state, { type, crateId, claimId, remainingStock: Math.floor(random() * 5) });
        if (state !== before) changed += 1;
        const values = Object.values(state.stock);
        if (!values.every((v) => Number.isInteger(v) && v >= 0) || !Object.keys(state.inFlight).every((id) => id in state.stock) || 'z' in state.inFlight) bad += 1;
        if (type === A.FAILED && state !== before && state.stock[crateId] !== before.stock[crateId] + 1) violations += 1;
        if (type === A.START && state !== before && state.stock[crateId] !== before.stock[crateId] - 1) violations += 1;
      }
    }
    expect(bad).toBe(0);
    expect(violations).toBe(0);
    expect(changed).toBeGreaterThan(100_000); // the run really exercised the reducer
  });
});
