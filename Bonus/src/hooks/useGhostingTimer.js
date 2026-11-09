// src/hooks/useGhostingTimer.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { RELATIONSHIP_PHASES } from '../situationship/constants.js';

const TICK_INTERVAL_MS = 100;

/**
 * Custom hook managing the 5-second "seen không rep" countdown timer.
 * Enforces zero-drift monotonic calculation against target epoch,
 * cleans up intervals deterministically, and aborts pending requests via AbortController.
 */
export function useGhostingTimer({
  phase = RELATIONSHIP_PHASES.DATING_NO_LOVE,
  pendingMessage = null,
  onGhosted,
  timeoutMs = 5000,
} = {}) {
  const onGhostedRef = useRef(onGhosted);
  onGhostedRef.current = onGhosted;

  const controllerRef = useRef(null);
  const isCancelledRef = useRef(false);

  const isEligible = phase === RELATIONSHIP_PHASES.DATING_NO_LOVE && Boolean(pendingMessage?.id);

  // Helper to compute monotonic remaining ms from the target epoch, preventing countdown drift
  const computeRemaining = useCallback(() => {
    if (!isEligible || !pendingMessage?.sentAt || isCancelledRef.current) {
      return 0;
    }
    const targetEpoch = pendingMessage.sentAt + timeoutMs;
    return Math.max(0, targetEpoch - Date.now());
  }, [isEligible, pendingMessage?.sentAt, timeoutMs]);

  const [remainingMs, setRemainingMs] = useState(computeRemaining);

  // External cancellation callback
  const cancelMessage = useCallback(() => {
    isCancelledRef.current = true;
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setRemainingMs(0);
  }, []);

  useEffect(() => {
    isCancelledRef.current = false;

    if (!isEligible) {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setRemainingMs(0);
      return undefined;
    }

    // Instantiate new AbortController tied to this pending message lifecycle
    const controller = new AbortController();
    controllerRef.current = controller;

    const messageId = pendingMessage.id;
    let hasFired = false;

    const syncTick = () => {
      if (isCancelledRef.current) {
        return;
      }

      const remaining = computeRemaining();
      setRemainingMs(remaining);

      if (remaining === 0 && !hasFired) {
        hasFired = true;
        controller.abort();
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        onGhostedRef.current?.(messageId);
      }
    };

    // Initial sync
    syncTick();

    const timerId = window.setInterval(syncTick, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
      controller.abort();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [isEligible, pendingMessage?.id, computeRemaining]);

  const secondsLeft = Math.ceil(remainingMs / 1000);

  return {
    remainingMs,
    secondsLeft,
    isWaitingReply: isEligible && remainingMs > 0 && !isCancelledRef.current,
    cancelMessage,
    abortSignal: controllerRef.current?.signal,
  };
}
