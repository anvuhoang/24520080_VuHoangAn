// tests/useCrateClaims.test.jsx
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimError, createArenaServer } from '../src/arena/mockServer.js';
import { useCrateClaims } from '../src/hooks/useCrateClaims.js';

const crates = [
  { id: 'a', remainingStock: 1 },
  { id: 'b', remainingStock: 3 },
  { id: 'z', remainingStock: 0 },
];
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const answer = (call, action) =>
  act(async () => {
    action(call);
  });

// A server whose answers the test controls
function manualServer() {
  const calls = [];
  return {
    calls,
    claim: vi.fn(
      (crateId, { signal }) =>
        new Promise((resolve, reject) => {
          calls.push({ crateId, signal, resolve, reject });
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        })
    ),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCrateClaims claiming', () => {
  it('starts from the crates', () => {
    const { result } = renderHook(() => useCrateClaims(crates, manualServer()));
    expect(result.current.stock).toEqual({ a: 1, b: 3, z: 0 });
    expect(result.current.inFlight).toEqual({});
    expect(result.current.notice).toEqual({ kind: 'idle' });
  });

  it('takes the unit at once, sends one request with a signal, and OK releases the lock', async () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    expect(result.current.stock.b).toBe(2);
    expect(Object.keys(result.current.inFlight)).toEqual(['b']);
    expect(typeof result.current.inFlight.b).toBe('string');
    expect(server.claim).toHaveBeenCalledTimes(1);
    expect(server.calls[0].crateId).toBe('b');
    expect(server.calls[0].signal).toBeInstanceOf(AbortSignal);
    await answer(server.calls[0], (call) => call.resolve({ crateId: 'b', remainingStock: 2 }));
    expect(result.current.stock.b).toBe(2);
    expect(result.current.inFlight).toEqual({});
    expect(result.current.notice).toEqual({ kind: 'ok', crateId: 'b' });
  });

  it('three quick calls in the same tick send ONE request and take ONE unit', () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => {
      result.current.claim('b');
      result.current.claim('b');
      result.current.claim('b');
    });
    expect(server.claim).toHaveBeenCalledTimes(1);
    expect(result.current.stock.b).toBe(2);
  });

  it('a 409 rolls back to 0 with a conflict notice, and the sold-out crate sends nothing more', async () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    await answer(server.calls[0], (call) => call.reject(new ClaimError(409, 'Looted out')));
    expect(result.current.stock.b).toBe(0);
    expect(result.current.notice).toEqual({ kind: 'conflict', crateId: 'b' });
    expect(result.current.inFlight).toEqual({});
    act(() => result.current.claim('b'));
    expect(server.claim).toHaveBeenCalledTimes(1);
  });

  it('other errors give the unit back, say error and allow a retry', async () => {
    for (const error of [new ClaimError(500, 'boom'), new ClaimError(404, 'x'), new Error('network'), undefined]) {
      const server = manualServer();
      const { result, unmount } = renderHook(() => useCrateClaims(crates, server));
      act(() => result.current.claim('b'));
      await answer(server.calls[0], (call) => call.reject(error));
      expect(result.current.stock.b).toBe(3);
      expect(result.current.notice).toEqual({ kind: 'error', crateId: 'b' });
      expect(result.current.inFlight).toEqual({});
      act(() => result.current.claim('b'));
      expect(server.claim).toHaveBeenCalledTimes(2);
      unmount();
    }
  });

  it('an AbortError that the hook did not cause is a failure, not a stuck lock (audit #02)', async () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    await answer(server.calls[0], (call) => call.reject(new DOMException('server gave up', 'AbortError')));
    expect(result.current.inFlight).toEqual({});
    expect(result.current.stock.b).toBe(3);
    expect(result.current.notice.kind).toBe('error');
    act(() => result.current.claim('b'));
    expect(server.claim).toHaveBeenCalledTimes(2); // the crate can be claimed again
  });

  it('sends nothing for a sold-out or unknown crate', () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => {
      result.current.claim('z');
      result.current.claim('nope');
      result.current.claim(undefined);
    });
    expect(server.claim).not.toHaveBeenCalled();
    expect(result.current.inFlight).toEqual({});
  });

  it('keeps two crates apart, each with its own claimId', async () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => {
      result.current.claim('a');
      result.current.claim('b');
    });
    expect(server.claim).toHaveBeenCalledTimes(2);
    expect(result.current.inFlight.a).not.toBe(result.current.inFlight.b);
    await answer(server.calls[1], (call) => call.resolve({ crateId: 'b', remainingStock: 2 }));
    expect(Object.keys(result.current.inFlight)).toEqual(['a']);
    await answer(server.calls[0], (call) => call.reject(new ClaimError(409)));
    expect(result.current.stock).toEqual({ a: 0, b: 2, z: 0 });
  });

  it('lets a crate be claimed again after a finished claim', async () => {
    const server = manualServer();
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    await answer(server.calls[0], (call) => call.resolve({ crateId: 'b', remainingStock: 2 }));
    act(() => result.current.claim('b'));
    expect(server.claim).toHaveBeenCalledTimes(2);
    expect(result.current.stock.b).toBe(1);
  });
});

describe('useCrateClaims with the real mock server', () => {
  it('takes the last unit once when claimed twice quickly', async () => {
    const server = createArenaServer({ crates, latencyMs: 100 });
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => {
      result.current.claim('a');
      result.current.claim('a');
    });
    await advance(100);
    expect(result.current.stock.a).toBe(0);
    expect(result.current.notice).toEqual({ kind: 'ok', crateId: 'a' });
    expect(server.stockOf('a')).toBe(0);
  });

  it('shows 3, the server has 0 (another player took them): the claim ends in a conflict', async () => {
    const server = createArenaServer({
      crates: [
        { id: 'b', remainingStock: 0 },
        { id: 'a', remainingStock: 1 },
      ],
      latencyMs: 100,
    });
    const { result } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    expect(result.current.stock.b).toBe(2);
    await advance(100);
    expect(result.current.stock.b).toBe(0);
    expect(result.current.notice).toEqual({ kind: 'conflict', crateId: 'b' });
  });
});

describe('useCrateClaims cleanup and identity', () => {
  it('on unmount aborts every request in flight; a late answer causes no warning and no notice', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = manualServer();
    const { result, unmount } = renderHook(() => useCrateClaims(crates, server));
    act(() => {
      result.current.claim('a');
      result.current.claim('b');
    });
    unmount();
    expect(server.calls.every((call) => call.signal.aborted)).toBe(true);
    await flush();
    server.calls[0].resolve({ crateId: 'a', remainingStock: 0 });
    await flush();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('on unmount with the real server the stock stays unchanged and no timer is left', async () => {
    const server = createArenaServer({ crates, latencyMs: 400 });
    const { result, unmount } = renderHook(() => useCrateClaims(crates, server));
    act(() => result.current.claim('b'));
    await advance(200);
    unmount();
    await advance(5000);
    expect(server.stockOf('b')).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps ONE claim function across renders, state changes and a new server, and calls the latest server', async () => {
    const server = manualServer();
    const { result, rerender } = renderHook(({ s }) => useCrateClaims(crates, s), { initialProps: { s: server } });
    const first = result.current.claim;
    rerender({ s: server });
    act(() => first('b'));
    expect(result.current.claim).toBe(first);
    await answer(server.calls[0], (call) => call.resolve({ crateId: 'b', remainingStock: 2 }));
    expect(result.current.claim).toBe(first);
    const second = manualServer();
    rerender({ s: second });
    expect(result.current.claim).toBe(first);
    act(() => first('a'));
    expect(second.claim).toHaveBeenCalledTimes(1);
    expect(server.claim).toHaveBeenCalledTimes(1);
  });

  it('survives React StrictMode and still aborts on unmount', async () => {
    const server = manualServer();
    const { result, unmount } = renderHook(() => useCrateClaims(crates, server), { wrapper: StrictMode });
    act(() => result.current.claim('b'));
    expect(server.claim).toHaveBeenCalledTimes(1);
    await answer(server.calls[0], (call) => call.resolve({ crateId: 'b', remainingStock: 2 }));
    expect(result.current.notice.kind).toBe('ok');
    act(() => result.current.claim('b'));
    unmount();
    expect(server.calls[1].signal.aborted).toBe(true);
  });
});

describe('useCrateClaims known defects (audit; each passes while the defect exists)', () => {
  // Audit #09: the hook builds its state from `crates` once; a new list of crates is ignored.
  // Change `it.fails` to `it` once the stock follows the crates (for example by resetting it with a `key`).
  it.fails('shows the stock of a new list of crates (known defect)', () => {
    const { result, rerender } = renderHook(({ list }) => useCrateClaims(list, manualServer()), { initialProps: { list: crates } });
    rerender({ list: [{ id: 'b', remainingStock: 7 }] });
    expect(result.current.stock).toEqual({ b: 7 });
  });
});
