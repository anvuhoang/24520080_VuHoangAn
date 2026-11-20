// client/src/sla/useAppealSlaTimer.js — a countdown to an absolute deadline that cannot drift.
//
// Nothing is counted down. Every value is computed from three absolute things:
//   remaining = deadline - (Date.now() + offset)
// where `deadline` is an instant set by the server and `offset` is how far this device's clock is from the server's.
// A timer that fires late, a tab that was frozen, a laptop that slept: the next calculation is right anyway, because it
// never depended on how many ticks happened. The timeouts only decide WHEN to look at the clock again.
import { useEffect, useRef, useState } from 'react';
import { breakdown, formatRemaining, isoDuration, levelOf } from './formatRemaining.js';
import { fetchServerNow as defaultFetchServerNow } from './clockApi.js';

const SECOND = 1000;

export function useAppealSlaTimer(deadline, { fetchServerNow = defaultFetchServerNow } = {}) {
  const deadlineMs = typeof deadline === 'number' ? deadline : Date.parse(deadline);
  const [now, setNow] = useState(() => Date.now()); // this device's time at the last look; a tick only refreshes it
  const [offset, setOffset] = useState(0); // server time minus device time, in ms
  const [sync, setSync] = useState('syncing'); // 'syncing' | 'synced' | 'failed'
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');

  // The newest fetch function without making it a dependency: an inline function must not restart the sync every render.
  const fetchRef = useRef(fetchServerNow);
  useEffect(() => {
    fetchRef.current = fetchServerNow;
  });

  // Sync with the server clock: at start, when the tab becomes visible again, and when the network comes back.
  useEffect(() => {
    let controller = null;

    const resync = async () => {
      controller?.abort(); // an older answer must never overwrite a newer one
      const own = new AbortController();
      controller = own;
      const sent = Date.now();
      try {
        const serverNow = await fetchRef.current({ signal: own.signal });
        if (own.signal.aborted) return;
        const received = Date.now();
        // The server stamped its answer somewhere between "sent" and "received": assume the middle.
        setOffset(serverNow - (sent + received) / 2);
        setNow(received);
        setSync('synced');
      } catch {
        if (own.signal.aborted) return;
        setSync((previous) => (previous === 'synced' ? previous : 'failed')); // keep the last good offset
      }
    };

    const handleVisibility = () => {
      const isVisible = document.visibilityState !== 'hidden';
      setVisible(isVisible);
      if (isVisible) {
        setNow(Date.now()); // look at the clock at once: the timeouts did not run while the tab was hidden
        resync();
      }
    };

    resync();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', resync);
    return () => {
      controller?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', resync);
    };
  }, []);

  // Wake up when the displayed second changes. One timeout at a time, never an interval: an interval keeps its
  // period, a timeout that is re-planned from the clock each time cannot accumulate delay.
  useEffect(() => {
    if (Number.isNaN(deadlineMs) || !visible) return undefined;
    let timer = null;
    const plan = () => {
      const current = Date.now();
      const remaining = deadlineMs - (current + offset);
      if (remaining <= 0) {
        setNow(current);
        return;
      }
      timer = setTimeout(() => {
        setNow(Date.now());
        plan();
      }, remaining % SECOND || SECOND);
    };
    plan();
    return () => clearTimeout(timer);
  }, [deadlineMs, offset, visible]);

  const invalid = Number.isNaN(deadlineMs);
  const remainingMs = invalid ? 0 : Math.max(0, deadlineMs - (now + offset));
  // Before the first answer the device clock may be hours off: do not call the window closed on its word. If the
  // server cannot be reached, the device clock is all there is, and the server still decides at submit time.
  const expired = invalid || (sync !== 'syncing' && remainingMs <= 0);

  return {
    remainingMs,
    expired,
    level: expired ? 'expired' : levelOf(Math.max(remainingMs, 1)), // not "expired" while the first answer is still on its way
    text: formatRemaining(remainingMs),
    iso: isoDuration(remainingMs),
    parts: breakdown(remainingMs),
    sync,
    offsetMs: offset,
  };
}
