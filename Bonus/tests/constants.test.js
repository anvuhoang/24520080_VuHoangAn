// tests/constants.test.js
import { describe, it, expect } from 'vitest';
import {
  RELATIONSHIP_PHASES,
  ACTOR_CONFIG,
  INITIAL_SIGNALS,
  INITIAL_STATE,
} from '../src/situationship/constants.js';

describe('situationship constants', () => {
  it('defines 5 frozen relationship phases', () => {
    expect(RELATIONSHIP_PHASES).toEqual({
      FRIENDS: 'FRIENDS',
      DATING_NO_LOVE: 'DATING_NO_LOVE',
      COMMITTED: 'COMMITTED',
      GHOSTED_EXIT: 'GHOSTED_EXIT',
      SELF_RESPECT_EXIT: 'SELF_RESPECT_EXIT',
    });
    expect(Object.isFrozen(RELATIONSHIP_PHASES)).toBe(true);
    expect(() => {
      RELATIONSHIP_PHASES.MUTATED = 'MUTATED';
    }).toThrow();
  });

  it('defines frozen actor configs with 0.1 vs 50.0 weights', () => {
    expect(ACTOR_CONFIG.EM.weight).toBe(0.1);
    expect(ACTOR_CONFIG.EM.multiplier).toBe(0.1);
    expect(ACTOR_CONFIG.AI_DO.weight).toBe(50.0);
    expect(ACTOR_CONFIG.AI_DO.multiplier).toBe(50.0);
    expect(Object.isFrozen(ACTOR_CONFIG)).toBe(true);
    expect(Object.isFrozen(ACTOR_CONFIG.EM)).toBe(true);
    expect(Object.isFrozen(ACTOR_CONFIG.AI_DO)).toBe(true);
  });

  it('defines deep frozen INITIAL_SIGNALS and INITIAL_STATE', () => {
    expect(INITIAL_STATE.phase).toBe('DATING_NO_LOVE');
    expect(INITIAL_STATE.myTries).toBe(100);
    expect(INITIAL_STATE.rivalTries).toBe(1);
    expect(INITIAL_STATE.pendingMessage).toBeNull();
    expect(Object.isFrozen(INITIAL_STATE)).toBe(true);
    expect(Object.isFrozen(INITIAL_SIGNALS)).toBe(true);
    expect(() => {
      INITIAL_SIGNALS.push({});
    }).toThrow();
  });
});

