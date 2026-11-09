// tests/dropPhase.test.js
import { describe, expect, it } from 'vitest';
import { CRATES, DROP_WINDOW_MS } from '../src/arena/arenaData.js';
import { DROP_PHASES, getDropPhase } from '../src/arena/dropPhase.js';

const DROP = 1_000_000;
const phase = (over) => getDropPhase({ dropEpochMs: DROP, remainingStock: 5, openWindowMs: 1000, nowMs: DROP, ...over });

describe('getDropPhase border moments', () => {
  it('is WARMUP one millisecond before the drop', () => {
    expect(phase({ nowMs: DROP - 1 })).toBe('WARMUP');
  });

  it('is AIRDROP_LIVE exactly at the drop and just after', () => {
    expect(phase({ nowMs: DROP })).toBe('AIRDROP_LIVE');
    expect(phase({ nowMs: DROP + 1 })).toBe('AIRDROP_LIVE');
  });

  it('stays AIRDROP_LIVE one millisecond before the end of the window and is EXPIRED exactly at the end', () => {
    expect(phase({ nowMs: DROP + 999 })).toBe('AIRDROP_LIVE');
    expect(phase({ nowMs: DROP + 1000 })).toBe('EXPIRED');
    expect(phase({ nowMs: DROP + 1001 })).toBe('EXPIRED');
  });

  it('only moves forward in time (WARMUP, LIVE, EXPIRED) and never back', () => {
    const order = ['WARMUP', 'AIRDROP_LIVE', 'EXPIRED'];
    const seen = Array.from({ length: 8 }, (_, i) => phase({ nowMs: DROP - 2 + i, openWindowMs: 3 })).map((p) => order.indexOf(p));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(3);
  });
});

describe('getDropPhase sold out', () => {
  it('is not looted before it has opened', () => {
    expect(phase({ nowMs: DROP - 1, remainingStock: 0 })).toBe('WARMUP');
  });

  it('is LOOTED_OUT from the drop on, also after the window has ended', () => {
    for (const offset of [0, 500, 999, 1000, 5000, 1e9]) {
      expect(phase({ nowMs: DROP + offset, remainingStock: 0 })).toBe('LOOTED_OUT');
    }
  });

  it('with one unit left it is still AIRDROP_LIVE', () => {
    expect(phase({ nowMs: DROP + 10, remainingStock: 1 })).toBe('AIRDROP_LIVE');
  });
});

describe('getDropPhase defaults and odd input', () => {
  it('uses the default window of the data module', () => {
    const base = { dropEpochMs: DROP, remainingStock: 1 };
    expect(getDropPhase({ ...base, nowMs: DROP + DROP_WINDOW_MS - 1 })).toBe('AIRDROP_LIVE');
    expect(getDropPhase({ ...base, nowMs: DROP + DROP_WINDOW_MS })).toBe('EXPIRED');
  });

  it('treats a missing, negative or invalid stock as sold out once opened', () => {
    for (const remainingStock of [-3, Number.NaN, undefined, null, '5']) {
      expect(phase({ nowMs: DROP + 5, remainingStock })).toBe('LOOTED_OUT');
    }
  });

  it('never opens a claim without a usable clock or drop time', () => {
    for (const bad of [Number.NaN, undefined, null, '1000005']) {
      expect(phase({ nowMs: bad })).toBe('WARMUP');
      expect(phase({ dropEpochMs: bad, nowMs: DROP })).toBe('WARMUP');
    }
    expect(getDropPhase()).toBe('WARMUP');
    expect(getDropPhase({})).toBe('WARMUP');
  });

  it('falls back to the default window for an invalid window', () => {
    for (const openWindowMs of [0, -1, Number.NaN]) {
      expect(phase({ nowMs: DROP + 10, openWindowMs })).toBe('AIRDROP_LIVE');
      expect(phase({ nowMs: DROP + DROP_WINDOW_MS, openWindowMs })).toBe('EXPIRED');
    }
  });

  it('is pure: the same input gives the same output and a frozen input works', () => {
    const input = Object.freeze({ nowMs: DROP + 5, dropEpochMs: DROP, remainingStock: 2, openWindowMs: 100 });
    const results = new Set(Array.from({ length: 1000 }, () => getDropPhase(input)));
    expect(results).toEqual(new Set(['AIRDROP_LIVE']));
  });

  it('exports the four phases, frozen', () => {
    expect(Object.values(DROP_PHASES)).toEqual(['WARMUP', 'AIRDROP_LIVE', 'LOOTED_OUT', 'EXPIRED']);
    expect(Object.isFrozen(DROP_PHASES)).toBe(true);
  });

  it('gives the four sample crates four different starting phases', () => {
    const now = Date.now();
    const phases = CRATES.map((c) => getDropPhase({ nowMs: now, dropEpochMs: c.dropEpochMs, remainingStock: c.remainingStock }));
    expect(phases).toEqual(['AIRDROP_LIVE', 'WARMUP', 'WARMUP', 'EXPIRED']);
  });
});
