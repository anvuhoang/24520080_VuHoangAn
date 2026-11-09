// src/situationship/constants.js
/**
 * Domain simulation inspired by Wendy Thảo's hit song "Hẹn Hò Nhưng Không Yêu".
 * Models the Situationship Finite State Machine and asymmetric effort metrics.
 */

export const RELATIONSHIP_PHASES = Object.freeze({
  FRIENDS: 'FRIENDS',
  DATING_NO_LOVE: 'DATING_NO_LOVE',
  COMMITTED: 'COMMITTED',
  GHOSTED_EXIT: 'GHOSTED_EXIT',
  SELF_RESPECT_EXIT: 'SELF_RESPECT_EXIT',
});

export const ACTOR_CONFIG = Object.freeze({
  EM: Object.freeze({
    actor: 'EM',
    label: 'Em cố trăm lần',
    weight: 0.1,
    multiplier: 0.1,
  }),
  AI_DO: Object.freeze({
    actor: 'AI_DO',
    label: 'Ai đó một phần',
    weight: 50.0,
    multiplier: 50.0,
  }),
});

export const INITIAL_SIGNALS = Object.freeze([
  Object.freeze({
    id: 'sig-init-em',
    actor: 'EM',
    label: 'Chủ động nhắn tin, quan tâm từng bữa ăn giấc ngủ (100 lần)',
    steps: 100,
    multiplier: 0.1,
    timestamp: 1,
  }),
  Object.freeze({
    id: 'sig-init-rival',
    actor: 'AI_DO',
    label: 'Thả một chiếc reaction vô tình (1 phần)',
    steps: 1,
    multiplier: 50.0,
    timestamp: 2,
  }),
]);

export const INITIAL_STATE = Object.freeze({
  phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
  myTries: 100,
  rivalTries: 1,
  signals: INITIAL_SIGNALS,
  pendingMessage: null,
  lastActionNotice: '',
});
