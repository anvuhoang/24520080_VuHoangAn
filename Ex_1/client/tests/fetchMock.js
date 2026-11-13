// client/tests/fetchMock.js
import { vi } from 'vitest';

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

// A fetch whose answers the test decides, one by one: calls[i].resolve(body, status) or calls[i].reject(error)
export function controlledFetch() {
  const calls = [];
  const fetchMock = vi.fn(
    (url, init = {}) =>
      new Promise((resolve, reject) => {
        calls.push({
          url,
          init,
          signal: init.signal,
          resolve: (body, status = 200) => resolve(jsonResponse(body, status)),
          reject,
        });
        init.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      })
  );
  return { fetchMock, calls };
}

// A fetch that answers at once from a function (url, init) -> Response | body, honouring an already aborted signal
export function routedFetch(handler) {
  return vi.fn(async (url, init = {}) => {
    if (init.signal?.aborted) throw abortError();
    const result = await handler(url, init);
    return result instanceof Response ? result : jsonResponse(result);
  });
}
