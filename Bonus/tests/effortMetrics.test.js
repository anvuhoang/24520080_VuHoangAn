// tests/effortMetrics.test.js
import { describe, it, expect } from 'vitest';
import {
  calculateImpact,
  calculateEffortDerived,
  createSignal,
} from '../src/situationship/effortMetrics.js';
import { RELATIONSHIP_PHASES } from '../src/situationship/constants.js';

describe('effortMetrics pure calculations', () => {
  describe('calculateImpact', () => {
    it('calculates product rounded to 1 decimal place', () => {
      expect(calculateImpact(100, 0.1)).toBe(10);
      expect(calculateImpact(1, 50.0)).toBe(50);
      expect(calculateImpact(33, 0.1)).toBe(3.3);
      expect(calculateImpact(0, 50.0)).toBe(0);
    });

    it('returns 0 for negative, NaN, non-finite or invalid inputs', () => {
      expect(calculateImpact(-10, 0.1)).toBe(0);
      expect(calculateImpact(10, -0.1)).toBe(0);
      expect(calculateImpact(NaN, 0.1)).toBe(0);
      expect(calculateImpact('100', 0.1)).toBe(0);
      expect(calculateImpact(undefined, null)).toBe(0);
    });
  });

  describe('calculateEffortDerived', () => {
    it('calculates exact Slide 32 spec: 100 vs 1 yields red flag', () => {
      const derived = calculateEffortDerived({
        myTries: 100,
        rivalTries: 1,
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
      });

      expect(derived.myImpact).toBe(10);
      expect(derived.rivalImpact).toBe(50);
      expect(derived.isRedFlag).toBe(true);
      expect(derived.ratio).toBe(5);
      expect(derived.alertMessage).toContain('[RED-FLAG] Red Flag: Hẹn hò nhưng không yêu');
      expect(derived.phaseDescription).toBe('Hẹn hò nhưng không yêu (Situationship)');
    });

    it('clears red flag when effort is balanced or winning', () => {
      const derived = calculateEffortDerived({
        myTries: 600,
        rivalTries: 1,
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
      });

      expect(derived.myImpact).toBe(60);
      expect(derived.rivalImpact).toBe(50);
      expect(derived.isRedFlag).toBe(false);
      expect(derived.alertMessage).toContain('[OK] Stable');
    });

    it('enforces strict boundary: equal impact (50 vs 50) is not a red flag', () => {
      const equal = calculateEffortDerived({
        myTries: 500,
        rivalTries: 1,
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
      });

      expect(equal.myImpact).toBe(50);
      expect(equal.rivalImpact).toBe(50);
      expect(equal.isRedFlag).toBe(false);
    });

    it('produces distinct announcements for all lifecycle phases', () => {
      expect(
        calculateEffortDerived({ phase: RELATIONSHIP_PHASES.COMMITTED }).alertMessage
      ).toContain('[OK] Tình yêu chính thức');

      expect(
        calculateEffortDerived({ phase: RELATIONSHIP_PHASES.GHOSTED_EXIT }).alertMessage
      ).toContain('[GHOSTED]');

      expect(
        calculateEffortDerived({ phase: RELATIONSHIP_PHASES.SELF_RESPECT_EXIT }).alertMessage
      ).toContain('[SELF-RESPECT]');
    });
  });

  describe('createSignal', () => {
    it('creates immutable signal object with UUID and timestamp', () => {
      const sig = createSignal({ actor: 'EM', label: 'Tặng hoa', steps: 3 });

      expect(sig.actor).toBe('EM');
      expect(sig.label).toBe('Tặng hoa');
      expect(sig.steps).toBe(3);
      expect(sig.multiplier).toBe(0.1);
      expect(sig.id).toBeTruthy();
      expect(typeof sig.timestamp).toBe('number');
      expect(Object.isFrozen(sig)).toBe(true);
    });

    it('defaults correctly when called with empty params', () => {
      const sig = createSignal();
      expect(sig.actor).toBe('EM');
      expect(sig.steps).toBe(1);
      expect(sig.multiplier).toBe(0.1);
    });
  });
});

