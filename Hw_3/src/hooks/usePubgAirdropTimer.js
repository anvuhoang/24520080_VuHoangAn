// src/hooks/usePubgAirdropTimer.js
import { useEffect, useState } from 'react';

const TICK_MS = 200;

const toOffset = (value) => (Number.isFinite(value) ? value : 0);

export function usePubgAirdropTimer(targetEpochMs, serverOffsetMs = 0) {
  // The only state is the last clock reading; the remaining time is derived from it during render
  const [nowMs, setNowMs] = useState(Date.now);

  const hasTarget = Number.isFinite(targetEpochMs);
  const offsetMs = toOffset(serverOffsetMs);

  useEffect(() => {
    if (!hasTarget) return undefined;

    let timerId = null;

    const stopTicking = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    // Reads the clock, publishes it, and reports whether the target has been reached
    const syncClock = () => {
      const now = Date.now();
      setNowMs(now);
      const isDone = targetEpochMs - (now + offsetMs) <= 0;
      if (isDone) stopTicking();
      return isDone;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncClock();
    };

    if (!syncClock()) timerId = window.setInterval(syncClock, TICK_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopTicking();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasTarget, targetEpochMs, offsetMs]);

  if (!hasTarget) return { remainingMs: 0, isLive: false };

  const remainingMs = Math.max(0, targetEpochMs - (nowMs + offsetMs));
  return { remainingMs, isLive: remainingMs === 0 };
}
