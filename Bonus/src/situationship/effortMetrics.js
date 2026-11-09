// src/situationship/effortMetrics.js
import { RELATIONSHIP_PHASES, ACTOR_CONFIG } from './constants.js';

/**
 * Calculates raw effort impact. Returns non-negative number rounded to 1 decimal place.
 * Invalid, negative, or non-numeric inputs fall back to 0.
 */
export function calculateImpact(steps, multiplier) {
  const numSteps = typeof steps === 'number' && !Number.isNaN(steps) && Number.isFinite(steps) ? steps : 0;
  const numMult = typeof multiplier === 'number' && !Number.isNaN(multiplier) && Number.isFinite(multiplier) ? multiplier : 0;

  if (numSteps <= 0 || numMult <= 0) return 0;
  return Math.round(numSteps * numMult * 10) / 10;
}

/**
 * Purely computes derived situationship metrics and alert announcements during render.
 * Never stores derived values in state or syncs them inside useEffect.
 */
export function calculateEffortDerived({
  myTries = 0,
  rivalTries = 0,
  phase = RELATIONSHIP_PHASES.DATING_NO_LOVE,
} = {}) {
  const safeMy = typeof myTries === 'number' && !Number.isNaN(myTries) && myTries >= 0 ? myTries : 0;
  const safeRival = typeof rivalTries === 'number' && !Number.isNaN(rivalTries) && rivalTries >= 0 ? rivalTries : 0;

  const myImpact = calculateImpact(safeMy, ACTOR_CONFIG.EM.multiplier);
  const rivalImpact = calculateImpact(safeRival, ACTOR_CONFIG.AI_DO.multiplier);
  const isRedFlag = phase === RELATIONSHIP_PHASES.DATING_NO_LOVE && myImpact < rivalImpact;

  const rawRatio = safeMy === 0 && safeRival === 0 ? 0 : rivalImpact / (myImpact || 1);
  const ratio = Math.round(rawRatio * 10) / 10;

  let alertMessage = '[OK] Stable — Trạng thái cân bằng';
  if (isRedFlag) {
    alertMessage = '[RED-FLAG] Red Flag: Hẹn hò nhưng không yêu — Giải phóng bộ nhớ!';
  } else if (phase === RELATIONSHIP_PHASES.COMMITTED) {
    alertMessage = '[OK] Tình yêu chính thức — Cả hai cùng vun đắp';
  } else if (phase === RELATIONSHIP_PHASES.GHOSTED_EXIT) {
    alertMessage = '[GHOSTED] Đối phương seen không rep quá 5s — Đã giải phóng bộ nhớ!';
  } else if (phase === RELATIONSHIP_PHASES.SELF_RESPECT_EXIT) {
    alertMessage = '[SELF-RESPECT] Em chọn tự trọng buông tay — Bộ nhớ đã được giải phóng!';
  }

  let phaseDescription = 'Không xác định';
  switch (phase) {
    case RELATIONSHIP_PHASES.FRIENDS:
      phaseDescription = 'Bạn bè thân thiết';
      break;
    case RELATIONSHIP_PHASES.DATING_NO_LOVE:
      phaseDescription = 'Hẹn hò nhưng không yêu (Situationship)';
      break;
    case RELATIONSHIP_PHASES.COMMITTED:
      phaseDescription = 'Tình yêu chính thức / Cam kết';
      break;
    case RELATIONSHIP_PHASES.GHOSTED_EXIT:
      phaseDescription = 'Seen không rep / Đã ghosted';
      break;
    case RELATIONSHIP_PHASES.SELF_RESPECT_EXIT:
      phaseDescription = 'Chủ động buông tay / Tự trọng';
      break;
  }

  return Object.freeze({
    myImpact,
    rivalImpact,
    isRedFlag,
    ratio,
    alertMessage,
    phaseDescription,
  });
}

let signalCounter = 0;

/**
 * Creates an immutable EffortSignal data object at interaction creation time.
 */
export function createSignal({ actor = 'EM', label = '', steps = 1 } = {}) {
  const safeActor = actor === 'AI_DO' ? 'AI_DO' : 'EM';
  const multiplier = ACTOR_CONFIG[safeActor].multiplier;
  const numSteps = typeof steps === 'number' && !Number.isNaN(steps) && steps > 0 ? Math.floor(steps) : 1;

  let id = `sig-${Date.now()}-${signalCounter++}`;
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    try {
      id = globalThis.crypto.randomUUID();
    } catch {
      // fallback to counter
    }
  }

  return Object.freeze({
    id,
    actor: safeActor,
    label: String(label || (safeActor === 'EM' ? 'Nỗ lực từ Em' : 'Nỗ lực từ Ai Đó')).trim(),
    steps: numSteps,
    multiplier,
    timestamp: Date.now(),
  });
}

