// client/tests/computeMatrix.test.js — the disproportionality matrix (a pure function).
import { describe, expect, it } from 'vitest';
import { HARSHER_AT, LIGHTER_AT, computeMatrix, verdictOf } from '../src/dossier/computeMatrix.js';

const dossier = (playerId, infractions) => ({ playerId, name: playerId.toUpperCase(), infractions: infractions.map(([severity, penaltyMinutes], i) => ({ id: `${playerId}${i}`, rule: 'r', severity, penaltyMinutes })) });

const HIMASS = dossier('himass', [[4, 4320], [1, 60]]); // 5 points, 4380 min -> 876 per point
const TANVUU = dossier('tanvuu', [[4, 1440], [2, 240], [1, 30]]); // 7 points, 1710 min -> 244.2857 per point

describe('computeMatrix', () => {
  it('sums severity and penalty minutes and divides one by the other', () => {
    const { rows } = computeMatrix([HIMASS, TANVUU]);
    expect(rows[0]).toMatchObject({ playerId: 'himass', infractions: 2, severity: 5, minutes: 4380, rate: 876 });
    expect(rows[1]).toMatchObject({ playerId: 'tanvuu', infractions: 3, severity: 7, minutes: 1710 });
    expect(rows[1].rate).toBeCloseTo(244.2857, 3);
  });

  it('compares each rate with the mean of the rates', () => {
    const { mean, rows } = computeMatrix([HIMASS, TANVUU]);
    expect(mean).toBeCloseTo((876 + 244.2857) / 2, 3);
    expect(rows[0].index).toBeCloseTo(876 / mean, 6);
    expect(rows[1].index).toBeCloseTo(244.2857 / mean, 3);
    expect(rows[0].index + rows[1].index).toBeCloseTo(2, 6); // with two players the indexes always add up to 2
  });

  it('calls the case study as it is: Himass harsher, TanVuu lighter', () => {
    const { rows } = computeMatrix([HIMASS, TANVUU]);
    expect(rows.map((r) => r.verdict)).toEqual(['harsher', 'lighter']);
  });

  it('keeps the order of the dossiers and does not change them', () => {
    const input = [TANVUU, HIMASS];
    const copy = JSON.stringify(input);
    expect(computeMatrix(input).rows.map((r) => r.playerId)).toEqual(['tanvuu', 'himass']);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('is pure: the same input gives equal output', () => {
    expect(computeMatrix([HIMASS, TANVUU])).toEqual(computeMatrix([HIMASS, TANVUU]));
  });

  it('gives "no data" to a player with no severity, and leaves them out of the mean', () => {
    const empty = dossier('clean', []);
    const { mean, rows } = computeMatrix([HIMASS, empty]);
    expect(rows[1]).toMatchObject({ severity: 0, minutes: 0, rate: null, index: null, verdict: 'no-data' });
    expect(mean).toBe(876);
    expect(rows[0].index).toBe(1);
  });

  it('a player with severity but no penalty has rate 0 and is "lighter"', () => {
    const lenient = dossier('lenient', [[3, 0]]);
    const { rows } = computeMatrix([HIMASS, lenient]);
    expect(rows[1].rate).toBe(0);
    expect(rows[1].verdict).toBe('lighter');
  });

  it('when everybody has rate 0 the mean is 0 and nobody is called harsher or lighter (no division by zero)', () => {
    const { mean, rows } = computeMatrix([dossier('a', [[1, 0]]), dossier('b', [[2, 0]])]);
    expect(mean).toBe(0);
    expect(rows.map((r) => r.index)).toEqual([1, 1]);
    expect(rows.map((r) => r.verdict)).toEqual(['proportionate', 'proportionate']);
  });

  it('a single player is "as the others" (the mean is their own rate)', () => {
    const { rows } = computeMatrix([HIMASS]);
    expect(rows[0].index).toBe(1);
    expect(rows[0].verdict).toBe('proportionate');
  });

  it('handles no dossiers, null and undefined', () => {
    expect(computeMatrix([])).toEqual({ mean: null, rows: [] });
    expect(computeMatrix(undefined)).toEqual({ mean: null, rows: [] });
    expect(computeMatrix(null)).toEqual({ mean: null, rows: [] });
  });
});

describe('verdictOf', () => {
  it('has the thresholds 1.25 and 0.8, and both borders belong to the unusual side', () => {
    expect(HARSHER_AT).toBe(1.25);
    expect(LIGHTER_AT).toBe(0.8);
    expect(verdictOf(1.25)).toBe('harsher');
    expect(verdictOf(1.2499)).toBe('proportionate');
    expect(verdictOf(0.8)).toBe('lighter');
    expect(verdictOf(0.8001)).toBe('proportionate');
    expect(verdictOf(1)).toBe('proportionate');
    expect(verdictOf(null)).toBe('no-data');
  });
});
