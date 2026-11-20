// client/src/sla/formatRemaining.js — a number of milliseconds as the countdown shows it. Pure.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const URGENT_MS = HOUR; // from here on the countdown is "urgent"
export const CRITICAL_MS = 5 * MINUTE; // and from here "critical"

const two = (n) => String(n).padStart(2, '0');

// Whole seconds are rounded UP: with 400 ms left the display says 00:00:01, and 00:00:00 is shown only when the time is really over.
export function breakdown(ms) {
  const total = ms > 0 ? Math.ceil(ms / SECOND) : 0;
  return {
    totalSeconds: total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function formatRemaining(ms) {
  const { days, hours, minutes, seconds } = breakdown(ms);
  const clock = `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

// For <time datetime="…">: an ISO 8601 duration such as PT1H2M3S
export function isoDuration(ms) {
  const { days, hours, minutes, seconds } = breakdown(ms);
  return `P${days}DT${hours}H${minutes}M${seconds}S`;
}

export function levelOf(ms) {
  if (ms <= 0) return 'expired';
  if (ms <= CRITICAL_MS) return 'critical';
  if (ms <= URGENT_MS) return 'urgent';
  return 'ok';
}

export const LEVEL_MESSAGES = Object.freeze({
  ok: '',
  urgent: 'Less than one hour left to file an appeal.',
  critical: 'Less than five minutes left to file an appeal.',
  expired: 'The appeal window is closed.',
});
