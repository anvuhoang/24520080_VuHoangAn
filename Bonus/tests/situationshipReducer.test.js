// tests/situationshipReducer.test.js
import { describe, it, expect } from 'vitest';
import {
  situationshipReducer,
  ACTION_TYPES,
} from '../src/situationship/situationshipReducer.js';
import {
  RELATIONSHIP_PHASES,
  INITIAL_STATE,
} from '../src/situationship/constants.js';

describe('situationshipReducer FSM', () => {
  it('returns default initial state when given undefined', () => {
    const s = situationshipReducer(undefined, {});
    expect(s).toEqual(INITIAL_STATE);
  });

  it('allows valid transitions from DATING_NO_LOVE', () => {
    const toFriends = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.FRIENDS },
    });
    expect(toFriends.phase).toBe('FRIENDS');

    const toExit = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.SELF_RESPECT_EXIT },
    });
    expect(toExit.phase).toBe('SELF_RESPECT_EXIT');
  });

  it('rejects illegal transitions from terminal phases', () => {
    const ghosted = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.GHOSTED_EXIT },
    });
    expect(ghosted.phase).toBe('GHOSTED_EXIT');

    const rejectedHop = situationshipReducer(ghosted, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.DATING_NO_LOVE },
    });
    expect(rejectedHop).toBe(ghosted); // Unchanged reference
  });

  it('restores initial snapshot on RESET action', () => {
    const dirty = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.SELF_RESPECT_EXIT },
    });
    const reset = situationshipReducer(dirty, { type: ACTION_TYPES.RESET });
    expect(reset.phase).toBe('DATING_NO_LOVE');
    expect(reset.myTries).toBe(100);
    expect(reset.rivalTries).toBe(1);
  });

  it('increments effort counts and prepends new signal immutably', () => {
    const s1 = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.ADD_EFFORT,
      payload: { actor: 'EM', steps: 10, label: 'Nấu cơm' },
    });
    expect(s1.myTries).toBe(110);
    expect(s1.rivalTries).toBe(1);
    expect(s1.signals[0].label).toBe('Nấu cơm');
    expect(s1.signals).toHaveLength(INITIAL_STATE.signals.length + 1);

    const s2 = situationshipReducer(s1, {
      type: ACTION_TYPES.ADD_EFFORT,
      payload: { actor: 'AI_DO', steps: 2, label: 'Hẹn gặp' },
    });
    expect(s2.myTries).toBe(110);
    expect(s2.rivalTries).toBe(3);
  });

  it('manages message ping lifecycle: start, reply, and ghosting', () => {
    const s1 = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.START_MESSAGE,
      payload: { messageId: 'msg-test', text: 'Nhớ anh' },
    });
    expect(s1.pendingMessage?.id).toBe('msg-test');

    const s2 = situationshipReducer(s1, {
      type: ACTION_TYPES.MESSAGE_GHOSTED,
      payload: { messageId: 'msg-test' },
    });
    expect(s2.phase).toBe('GHOSTED_EXIT');
    expect(s2.pendingMessage).toBeNull();
  });

  // Open Failure #03 documented in AI_FAILURE_AUDIT.md:
  // Transitioning from DATING_NO_LOVE to COMMITTED is currently allowed even under severe effort asymmetry
  it.fails('blocks transition to COMMITTED when asymmetric effort is a red flag', () => {
    // Current behavior: allows transition unconditionally
    // Ideal safeguard: should reject transition when myImpact < rivalImpact
    const s = situationshipReducer(INITIAL_STATE, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.COMMITTED },
    });
    // This expects the transition to be BLOCKED, but reducer currently allows it, so test fails as expected
    expect(s.phase).toBe('DATING_NO_LOVE');
  });
});
