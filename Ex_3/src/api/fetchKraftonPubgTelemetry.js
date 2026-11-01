// src/api/fetchKraftonPubgTelemetry.js
const PACKET_LOSS_MAPS = new Set(['Erangel', 'Miramar']);

const createAbortError = () => new DOMException('Aborted', 'AbortError');

// Resolves after `ms`; rejects with an AbortError as soon as `signal` aborts.
// The timer and the abort listener are always cleaned up when the promise settles.
function waitWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timerId);
      reject(createAbortError());
    };

    const timerId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchKraftonPubgTelemetry(
  squadId,
  { signal, delayMs = 1200, lossRate = 0.35 } = {}
) {
  // Start the request immediately and hold the result for `delayMs`: aborting a squad switch
  // then cancels a real in-flight request instead of one that never started.
  const [response] = await Promise.all([
    fetch(`/telemetry/squads.json?squad=${encodeURIComponent(squadId)}`, { signal }),
    waitWithAbort(delayMs, signal),
  ]);
  if (!response.ok) {
    throw new Error('Telemetry request failed');
  }

  const squads = await response.json();
  const squad = squads.find((item) => item.id === squadId);
  if (!squad) {
    throw new Error('Unknown squad');
  }

  if (PACKET_LOSS_MAPS.has(squad.map) && Math.random() < lossRate) {
    throw new Error('Satellite packet lost');
  }

  return squad;
}
