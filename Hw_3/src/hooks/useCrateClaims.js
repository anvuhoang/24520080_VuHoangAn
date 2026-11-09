// src/hooks/useCrateClaims.js
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { CLAIM_ACTIONS, claimReducer, createInitialClaimState } from '../arena/claimReducer.js';

let fallbackCounter = 0;

// crypto.randomUUID only exists in secure contexts (https, localhost)
function createClaimId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `claim-${Date.now()}-${fallbackCounter}`;
}

export function useCrateClaims(crates, server) {
  const [state, dispatch] = useReducer(claimReducer, crates, createInitialClaimState);

  // Refs let claim() keep one identity while still reading the latest state and server
  const stateRef = useRef(state);
  const serverRef = useRef(server);
  // crateId -> AbortController of the request in flight (a lock that works before React re-renders)
  const controllersRef = useRef(new Map());

  useEffect(() => {
    stateRef.current = state;
    serverRef.current = server;
  }, [state, server]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  const claim = useCallback((crateId) => {
    const controllers = controllersRef.current;
    if (controllers.has(crateId)) return;
    if ((stateRef.current.stock[crateId] ?? 0) <= 0) return;

    const claimId = createClaimId();
    const controller = new AbortController();
    controllers.set(crateId, controller);
    dispatch({ type: CLAIM_ACTIONS.START, crateId, claimId });

    const finish = (action) => {
      // An aborted claim (the component went away) changes nothing and shows no error
      if (controller.signal.aborted) return;
      controllers.delete(crateId);
      dispatch({ crateId, claimId, ...action });
    };

    serverRef.current
      .claim(crateId, { signal: controller.signal })
      .then(
        (answer) => finish({ type: CLAIM_ACTIONS.OK, remainingStock: answer.remainingStock }),
        (error) => finish({ type: error?.status === 409 ? CLAIM_ACTIONS.CONFLICT : CLAIM_ACTIONS.FAILED })
      );
  }, []);

  return { stock: state.stock, inFlight: state.inFlight, notice: state.notice, claim };
}
