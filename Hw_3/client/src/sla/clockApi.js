// client/src/sla/clockApi.js — asks the server what time it is. The answer is the one clock that counts.

// Resolves to the server time in milliseconds since the epoch. Rejects on any failure (the caller keeps what it had).
export async function fetchServerNow({ signal } = {}) {
  const response = await fetch('/api/clock', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`The clock answered ${response.status}`);
  const body = await response.json();
  const ms = Date.parse(body?.now);
  if (Number.isNaN(ms)) throw new Error('The clock answered with a time that is not a date.');
  return ms;
}
