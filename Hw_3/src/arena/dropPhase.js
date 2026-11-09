// src/arena/dropPhase.js
import { DROP_WINDOW_MS } from './arenaData.js';

export const DROP_PHASES = Object.freeze({
  WARMUP: 'WARMUP',
  AIRDROP_LIVE: 'AIRDROP_LIVE',
  LOOTED_OUT: 'LOOTED_OUT',
  EXPIRED: 'EXPIRED',
});

export function getDropPhase({
  nowMs,
  dropEpochMs,
  remainingStock = 0,
  openWindowMs = DROP_WINDOW_MS,
} = {}) {
  // Without a usable clock or drop time nothing may be claimed
  if (!Number.isFinite(nowMs) || !Number.isFinite(dropEpochMs)) {
    return DROP_PHASES.WARMUP;
  }

  if (nowMs < dropEpochMs) return DROP_PHASES.WARMUP;

  const hasStock = Number.isFinite(remainingStock) && remainingStock > 0;
  if (!hasStock) return DROP_PHASES.LOOTED_OUT;

  const windowMs = Number.isFinite(openWindowMs) && openWindowMs > 0 ? openWindowMs : DROP_WINDOW_MS;
  return nowMs < dropEpochMs + windowMs ? DROP_PHASES.AIRDROP_LIVE : DROP_PHASES.EXPIRED;
}
