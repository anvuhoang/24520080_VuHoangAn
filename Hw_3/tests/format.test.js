// tests/format.test.js
import { describe, expect, it } from 'vitest';
import { formatCountdown, formatVnd } from '../src/arena/format.js';

const NBSP = ' '; // Intl puts a no-break space between the amount and the dong sign

describe('formatVnd', () => {
  it('uses the vi-VN format with the dong sign', () => {
    expect(formatVnd(1200000)).toBe(`1.200.000${NBSP}₫`);
    expect(formatVnd(199000)).toBe(`199.000${NBSP}₫`);
    expect(formatVnd(5000)).toBe(`5.000${NBSP}₫`);
    expect(formatVnd(0)).toBe(`0${NBSP}₫`);
  });

  it('puts a no-break space before the sign, so a price never splits across two lines', () => {
    expect(formatVnd(1200000)).not.toBe('1.200.000 ₫'); // a typed normal space is a different string
    expect(formatVnd(1200000)).toContain(NBSP);
  });

  it('rounds to whole dong', () => {
    expect(formatVnd(1234567.6)).toBe(`1.234.568${NBSP}₫`);
    expect(formatVnd(0.4)).toBe(`0${NBSP}₫`);
  });

  it('shows zero for negative, NaN, missing, infinite and non-number values', () => {
    for (const value of [-5, Number.NaN, undefined, null, Infinity, -Infinity, '5000', {}, []]) {
      expect(formatVnd(value)).toBe(`0${NBSP}₫`);
    }
  });

  it('copes with a very large amount', () => {
    expect(formatVnd(1e12)).toBe(`1.000.000.000.000${NBSP}₫`);
  });
});

describe('formatCountdown', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(61000)).toBe('00:01:01');
    expect(formatCountdown(3600000)).toBe('01:00:00');
    expect(formatCountdown(86399000)).toBe('23:59:59');
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('rounds up, so it never shows 00:00:00 while time remains', () => {
    for (const ms of [1, 2, 500, 999]) expect(formatCountdown(ms)).toBe('00:00:01');
    expect(formatCountdown(1000)).toBe('00:00:01');
    expect(formatCountdown(1001)).toBe('00:00:02');
    expect(formatCountdown(59999)).toBe('00:01:00');
    expect(formatCountdown(3599001)).toBe('01:00:00');
  });

  it('does not cap the hours at 99', () => {
    expect(formatCountdown(360000000)).toBe('100:00:00');
  });

  it('shows zero for negative, NaN, missing, infinite and non-number values', () => {
    for (const value of [-5, Number.NaN, undefined, null, Infinity, '5000']) {
      expect(formatCountdown(value)).toBe('00:00:00');
    }
  });

  it('never goes backwards as the time grows', () => {
    const texts = Array.from({ length: 5000 }, (_, i) => formatCountdown(i * 37));
    expect(texts.every((text, i) => i === 0 || text >= texts[i - 1])).toBe(true);
  });
});
