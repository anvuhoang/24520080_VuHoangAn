// src/arena/mockServer.js
export class ClaimError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ClaimError';
    this.status = status;
  }
}

const abortError = () => new DOMException('The claim was aborted.', 'AbortError');

export function createArenaServer({ crates = [], latencyMs = 400 } = {}) {
  const stock = new Map(crates.map((crate) => [crate.id, crate.remainingStock]));
  const delayMs = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 400;

  function claim(crateId, { signal } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }

      const onAbort = () => {
        window.clearTimeout(timerId);
        reject(abortError());
      };

      const timerId = window.setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);

        if (!stock.has(crateId)) {
          reject(new ClaimError(404, `Unknown crate: ${crateId}`));
          return;
        }

        const remaining = stock.get(crateId);
        if (remaining <= 0) {
          reject(new ClaimError(409, 'Looted out: no stock left.'));
          return;
        }

        stock.set(crateId, remaining - 1);
        resolve({ crateId, remainingStock: remaining - 1 });
      }, delayMs);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  return {
    claim,
    stockOf: (crateId) => stock.get(crateId),
  };
}
