// tests/arenaData.test.js
import { describe, expect, it } from 'vitest';
import { CRATES, DROP_WINDOW_MS, STANDINGS } from '../src/arena/arenaData.js';

describe('arena sample data', () => {
  it('has 4 crates and 4 squads with exactly the fields of the contract', () => {
    expect(CRATES).toHaveLength(4);
    expect(STANDINGS).toHaveLength(4);
    for (const crate of CRATES) expect(Object.keys(crate)).toEqual(['id', 'title', 'priceVnd', 'remainingStock', 'dropEpochMs']);
    for (const squad of STANDINGS) {
      expect(Object.keys(squad)).toEqual(['squadId', 'squadName', 'wwcdCount', 'placementPts', 'killPts']);
    }
    expect(STANDINGS.map((s) => s.squadId)).toEqual(['te', 'ces', 'roy', 'agg']);
    expect(STANDINGS.map((s) => s.squadName)).toEqual(['The Expendables', 'Cerberus Esports', 'Roy Esports', 'AGG']);
  });

  it('gives every item a fixed, unique id', () => {
    expect(new Set(CRATES.map((c) => c.id)).size).toBe(4);
    expect(new Set(STANDINGS.map((s) => s.squadId)).size).toBe(4);
    expect(CRATES.map((c) => c.id)).toEqual(['gcoin-crate-2500', 'pvs-gold-crate', 'pvs-vip-pass', 'pvs-standard-ticket']);
  });

  it('keeps prices, stock and scores as integers', () => {
    const numbers = [...CRATES.flatMap((c) => [c.priceVnd, c.remainingStock]), ...STANDINGS.flatMap((s) => [s.wwcdCount, s.placementPts, s.killPts])];
    expect(numbers.every(Number.isInteger)).toBe(true);
  });

  it('has one crate above a million dong and one crate with a stock of 1, and the latter is open', () => {
    expect(CRATES.filter((c) => c.priceVnd > 1_000_000).map((c) => c.id)).toEqual(['pvs-vip-pass']);
    const last = CRATES.filter((c) => c.remainingStock === 1);
    expect(last.map((c) => c.id)).toEqual(['gcoin-crate-2500']);
    expect(last[0].dropEpochMs).toBeLessThan(Date.now());
  });

  it('counts the drop times from the moment the module loaded', () => {
    const now = Date.now();
    const secondsFromNow = Object.fromEntries(CRATES.map((c) => [c.id, (c.dropEpochMs - now) / 1000]));
    expect(secondsFromNow['gcoin-crate-2500']).toBeCloseTo(-60, -1);
    expect(secondsFromNow['pvs-gold-crate']).toBeGreaterThan(0);
    expect(secondsFromNow['pvs-gold-crate']).toBeLessThanOrEqual(20.5);
    expect(secondsFromNow['pvs-vip-pass']).toBeGreaterThan(590);
    expect(secondsFromNow['pvs-vip-pass']).toBeLessThanOrEqual(600.5);
    expect(-secondsFromNow['pvs-standard-ticket'] * 1000).toBeGreaterThan(DROP_WINDOW_MS);
  });

  it('is frozen all the way down: nothing can be changed after export', () => {
    expect(Object.isFrozen(CRATES) && Object.isFrozen(STANDINGS)).toBe(true);
    expect(CRATES.every(Object.isFrozen) && STANDINGS.every(Object.isFrozen)).toBe(true);
    expect(() => CRATES.push({})).toThrow(TypeError);
    expect(() => {
      CRATES[0].remainingStock = 0;
    }).toThrow(TypeError);
    expect(() => {
      delete CRATES[0].id;
    }).toThrow(TypeError);
    expect(() => STANDINGS.sort()).toThrow(TypeError);
    expect(() => STANDINGS.reverse()).toThrow(TypeError);
    expect(() => {
      STANDINGS[0].killPts = 1;
    }).toThrow(TypeError);
  });

  it('gives the four sort keys four different orders (so each can be told apart)', async () => {
    const { SORT_KEYS, selectStandings } = await import('../src/arena/leaderboard.js');
    const orders = SORT_KEYS.map((key) => selectStandings(STANDINGS, { sortBy: key }).map((s) => s.squadId).join());
    expect(new Set(orders).size).toBe(4);
  });
});
