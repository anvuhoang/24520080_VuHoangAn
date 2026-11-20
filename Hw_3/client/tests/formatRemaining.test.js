// client/tests/formatRemaining.test.js — how a number of milliseconds is shown.
import { describe, expect, it } from 'vitest';
import { CRITICAL_MS, LEVEL_MESSAGES, URGENT_MS, breakdown, formatRemaining, isoDuration, levelOf } from '../src/sla/formatRemaining.js';

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe('breakdown', () => {
  it('splits into days, hours, minutes and seconds', () => {
    expect(breakdown(2 * D + 3 * H + 4 * M + 5 * S)).toEqual({ totalSeconds: 2 * 86400 + 3 * 3600 + 4 * 60 + 5, days: 2, hours: 3, minutes: 4, seconds: 5 });
  });
  it('rounds a part of a second UP, so zero means over', () => {
    expect(breakdown(1).totalSeconds).toBe(1);
    expect(breakdown(400).seconds).toBe(1);
    expect(breakdown(1000).seconds).toBe(1);
    expect(breakdown(1001).seconds).toBe(2);
  });
  it('is all zeros at zero, below zero, and for numbers that are not numbers', () => {
    const zero = { totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(breakdown(0)).toEqual(zero);
    expect(breakdown(-5000)).toEqual(zero);
    expect(breakdown(NaN)).toEqual(zero);
  });
  it('carries over at the borders', () => {
    expect(breakdown(59 * S)).toMatchObject({ minutes: 0, seconds: 59 });
    expect(breakdown(60 * S)).toMatchObject({ minutes: 1, seconds: 0 });
    expect(breakdown(24 * H)).toMatchObject({ days: 1, hours: 0 });
  });
});

describe('formatRemaining', () => {
  it.each([
    [0, '00:00:00'],
    [S, '00:00:01'],
    [59 * S, '00:00:59'],
    [61 * S, '00:01:01'],
    [H + 2 * M + 3 * S, '01:02:03'],
    [23 * H + 59 * M + 59 * S, '23:59:59'],
    [D, '1d 00:00:00'],
    [2 * D + 3 * H + 4 * M + 5 * S, '2d 03:04:05'],
    [-1, '00:00:00'],
  ])('%i ms is %s', (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});

describe('isoDuration', () => {
  it('writes an ISO 8601 duration for the <time> element', () => {
    expect(isoDuration(H + 2 * M + 3 * S)).toBe('P0DT1H2M3S');
    expect(isoDuration(2 * D + S)).toBe('P2DT0H0M1S');
    expect(isoDuration(0)).toBe('P0DT0H0M0S');
  });
});

describe('levelOf', () => {
  it('has the thresholds one hour and five minutes', () => {
    expect(URGENT_MS).toBe(H);
    expect(CRITICAL_MS).toBe(5 * M);
  });
  it.each([
    [2 * H, 'ok'],
    [H + 1, 'ok'],
    [H, 'urgent'],
    [5 * M + 1, 'urgent'],
    [5 * M, 'critical'],
    [1, 'critical'],
    [0, 'expired'],
    [-1, 'expired'],
  ])('%i ms is %s', (ms, level) => {
    expect(levelOf(ms)).toBe(level);
  });
  it('has a message for every level and none for "ok" (nothing is announced while there is time)', () => {
    expect(Object.keys(LEVEL_MESSAGES).sort()).toEqual(['critical', 'expired', 'ok', 'urgent']);
    expect(LEVEL_MESSAGES.ok).toBe('');
    expect(LEVEL_MESSAGES.expired).toMatch(/closed/);
  });
});
