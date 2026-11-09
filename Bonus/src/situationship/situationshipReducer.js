// src/situationship/situationshipReducer.js
import { RELATIONSHIP_PHASES, INITIAL_STATE } from './constants.js';
import { createSignal } from './effortMetrics.js';

export const ACTION_TYPES = Object.freeze({
  TRANSITION_PHASE: 'TRANSITION_PHASE',
  ADD_EFFORT: 'ADD_EFFORT',
  START_MESSAGE: 'START_MESSAGE',
  MESSAGE_REPLIED: 'MESSAGE_REPLIED',
  MESSAGE_GHOSTED: 'MESSAGE_GHOSTED',
  ABORT_MESSAGE: 'ABORT_MESSAGE',
  RESET: 'RESET',
});

/**
 * Valid state transition rules matrix for the Situationship Finite State Machine.
 */
const VALID_TRANSITIONS = Object.freeze({
  [RELATIONSHIP_PHASES.FRIENDS]: Object.freeze([
    RELATIONSHIP_PHASES.DATING_NO_LOVE,
    RELATIONSHIP_PHASES.COMMITTED,
    RELATIONSHIP_PHASES.SELF_RESPECT_EXIT,
  ]),
  [RELATIONSHIP_PHASES.DATING_NO_LOVE]: Object.freeze([
    RELATIONSHIP_PHASES.COMMITTED,
    RELATIONSHIP_PHASES.GHOSTED_EXIT,
    RELATIONSHIP_PHASES.SELF_RESPECT_EXIT,
    RELATIONSHIP_PHASES.FRIENDS,
  ]),
  [RELATIONSHIP_PHASES.COMMITTED]: Object.freeze([
    RELATIONSHIP_PHASES.DATING_NO_LOVE,
    RELATIONSHIP_PHASES.SELF_RESPECT_EXIT,
    RELATIONSHIP_PHASES.FRIENDS,
  ]),
  // Terminal exit phases cannot transition without explicit RESET action
  [RELATIONSHIP_PHASES.GHOSTED_EXIT]: Object.freeze([]),
  [RELATIONSHIP_PHASES.SELF_RESPECT_EXIT]: Object.freeze([]),
});

/**
 * Pure reducer governing the Situationship Finite State Machine.
 * Enforces strict transitions, immutable updates, and prevents situationship boolean soup.
 */
export function situationshipReducer(state = INITIAL_STATE, action = {}) {
  if (!action || typeof action !== 'object' || !action.type) {
    return state;
  }

  switch (action.type) {
    case ACTION_TYPES.TRANSITION_PHASE: {
      const nextPhase = action.payload?.nextPhase;
      if (!nextPhase || nextPhase === state.phase) {
        return state;
      }

      const allowedTransitions = VALID_TRANSITIONS[state.phase] || [];
      if (!allowedTransitions.includes(nextPhase)) {
        return state; // Reject invalid transition, keep state reference intact
      }

      return {
        ...state,
        phase: nextPhase,
        pendingMessage: nextPhase === RELATIONSHIP_PHASES.GHOSTED_EXIT || nextPhase === RELATIONSHIP_PHASES.SELF_RESPECT_EXIT
          ? null
          : state.pendingMessage,
        lastActionNotice: `Chuyển trạng thái sang: ${nextPhase}`,
      };
    }

    case ACTION_TYPES.ADD_EFFORT: {
      const { actor = 'EM', steps = 1, label = '' } = action.payload || {};
      const numSteps = typeof steps === 'number' && !Number.isNaN(steps) && steps > 0 ? Math.floor(steps) : 1;
      const isRival = actor === 'AI_DO';

      const newSignal = createSignal({
        actor: isRival ? 'AI_DO' : 'EM',
        label,
        steps: numSteps,
      });

      return {
        ...state,
        myTries: isRival ? state.myTries : state.myTries + numSteps,
        rivalTries: isRival ? state.rivalTries + numSteps : state.rivalTries,
        signals: [newSignal, ...state.signals],
        lastActionNotice: isRival ? `Ai đó thêm ${numSteps} phần cố gắng` : `Em thêm ${numSteps} lần cố gắng`,
      };
    }

    case ACTION_TYPES.START_MESSAGE: {
      if (state.phase !== RELATIONSHIP_PHASES.DATING_NO_LOVE) {
        return state;
      }

      const messageId = action.payload?.messageId || `msg-${Date.now()}`;
      const text = String(action.payload?.text || 'Em nhớ anh...').trim();

      return {
        ...state,
        pendingMessage: {
          id: messageId,
          text,
          sentAt: Date.now(),
        },
        lastActionNotice: 'Đã gửi tin nhắn, đang chờ hồi âm (Seen không rep 5s)...',
      };
    }

    case ACTION_TYPES.MESSAGE_REPLIED: {
      const messageId = action.payload?.messageId;
      if (!state.pendingMessage || (messageId && state.pendingMessage.id !== messageId)) {
        return state;
      }

      return {
        ...state,
        pendingMessage: null,
        lastActionNotice: 'Đối phương đã hồi âm!',
      };
    }

    case ACTION_TYPES.MESSAGE_GHOSTED: {
      const messageId = action.payload?.messageId;
      if (!state.pendingMessage || (messageId && state.pendingMessage.id !== messageId)) {
        return state;
      }

      return {
        ...state,
        phase: RELATIONSHIP_PHASES.GHOSTED_EXIT,
        pendingMessage: null,
        lastActionNotice: 'Đối phương seen không rep sau 5s — Tự động giải phóng bộ nhớ!',
      };
    }

    case ACTION_TYPES.ABORT_MESSAGE: {
      if (!state.pendingMessage) {
        return state;
      }

      return {
        ...state,
        pendingMessage: null,
        lastActionNotice: 'Đã hủy gửi tin nhắn thành công.',
      };
    }

    case ACTION_TYPES.RESET: {
      return {
        ...INITIAL_STATE,
        signals: [...INITIAL_STATE.signals],
        lastActionNotice: 'Đã thiết lập lại trạng thái phân tích ban đầu.',
      };
    }

    default:
      return state;
  }
}

