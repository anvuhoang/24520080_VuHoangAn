// src/situationship/messageService.js
const setTimer = typeof window !== 'undefined' ? window.setTimeout : globalThis.setTimeout;
const clearTimer = typeof window !== 'undefined' ? window.clearTimeout : globalThis.clearTimeout;

/**
 * Simulated async partner communication service.
 * Honors AbortSignal strictly and simulates "seen không rep" latency.
 */
export function sendSimulatedMessage({
  text = 'Em nhớ anh...',
  latencyMs = 6000,
  signal,
} = {}) {
  return new Promise((resolve, reject) => {
    // 1. Check if already aborted before starting
    if (signal?.aborted) {
      reject(new DOMException('This message was aborted before transmission.', 'AbortError'));
      return;
    }

    let timerId = null;

    const onAbort = () => {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
      reject(new DOMException('The message request was aborted.', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const safeLatency = typeof latencyMs === 'number' && !Number.isNaN(latencyMs) && latencyMs >= 0
      ? latencyMs
      : 6000;

    timerId = setTimer(() => {
      timerId = null;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve({
        reply: `Anh vừa đọc tin: "${text.slice(0, 30)}..."`,
        timestamp: Date.now(),
      });
    }, safeLatency);
  });
}
