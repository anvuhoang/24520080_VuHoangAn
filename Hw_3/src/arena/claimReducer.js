// src/arena/claimReducer.js
export const CLAIM_ACTIONS = Object.freeze({
  START: 'CLAIM_START',
  OK: 'CLAIM_OK',
  CONFLICT: 'CLAIM_CONFLICT',
  FAILED: 'CLAIM_FAILED',
});

const IDLE_NOTICE = Object.freeze({ kind: 'idle' });

export function createInitialClaimState(crates = []) {
  return {
    stock: Object.fromEntries(crates.map((crate) => [crate.id, Math.max(0, crate.remainingStock)])),
    inFlight: {},
    notice: IDLE_NOTICE,
  };
}

// A new inFlight record without the claim of one crate
function withoutClaim(inFlight, crateId) {
  return Object.fromEntries(Object.entries(inFlight).filter(([id]) => id !== crateId));
}

export function claimReducer(state, action) {
  const { type, crateId, claimId } = action ?? {};
  const known = Object.hasOwn(state.stock, crateId);

  switch (type) {
    case CLAIM_ACTIONS.START: {
      if (!known || Object.hasOwn(state.inFlight, crateId) || state.stock[crateId] <= 0) return state;

      return {
        ...state,
        // Optimistic: take the unit now, the server will confirm or refuse it
        stock: { ...state.stock, [crateId]: state.stock[crateId] - 1 },
        inFlight: { ...state.inFlight, [crateId]: claimId },
      };
    }

    case CLAIM_ACTIONS.OK: {
      if (!known || state.inFlight[crateId] !== claimId) return state;

      const serverStock = Number.isInteger(action.remainingStock) ? Math.max(0, action.remainingStock) : state.stock[crateId];
      return {
        stock: { ...state.stock, [crateId]: serverStock },
        inFlight: withoutClaim(state.inFlight, crateId),
        notice: { kind: 'ok', crateId },
      };
    }

    case CLAIM_ACTIONS.CONFLICT: {
      if (!known || state.inFlight[crateId] !== claimId) return state;

      // Give the optimistic unit back, then the server is the truth: nothing is left
      return {
        stock: { ...state.stock, [crateId]: 0 },
        inFlight: withoutClaim(state.inFlight, crateId),
        notice: { kind: 'conflict', crateId },
      };
    }

    case CLAIM_ACTIONS.FAILED: {
      if (!known || state.inFlight[crateId] !== claimId) return state;

      return {
        stock: { ...state.stock, [crateId]: state.stock[crateId] + 1 },
        inFlight: withoutClaim(state.inFlight, crateId),
        notice: { kind: 'error', crateId },
      };
    }

    default:
      return state;
  }
}
