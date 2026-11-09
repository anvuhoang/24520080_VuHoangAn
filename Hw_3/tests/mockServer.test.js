// tests/mockServer.test.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRATES } from '../src/arena/arenaData.js';
import { ClaimError, createArenaServer } from '../src/arena/mockServer.js';

const crates = [
  { id: 'a', remainingStock: 1 },
  { id: 'b', remainingStock: 3 },
  { id: 'z', remainingStock: 0 },
];
const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
const advance = (ms) => vi.advanceTimersByTimeAsync(ms);

describe('createArenaServer with fake timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for the latency, then takes one unit', async () => {
    const server = createArenaServer({ crates, latencyMs: 400 });
    const claim = settle(server.claim('b'));
    await advance(399);
    expect(server.stockOf('b')).toBe(3);
    expect(vi.getTimerCount()).toBe(1);
    await advance(1);
    expect(await claim).toEqual({ ok: true, value: { crateId: 'b', remainingStock: 2 } });
    expect(server.stockOf('b')).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('two claims for the last unit: one wins and one gets 409; the stock stays at 0', async () => {
    const server = createArenaServer({ crates, latencyMs: 100 });
    const first = settle(server.claim('a'));
    const second = settle(server.claim('a'));
    await advance(100);
    const [r1, r2] = [await first, await second];
    expect(r1.ok).toBe(true);
    expect(r1.value.remainingStock).toBe(0);
    expect(r2.ok).toBe(false);
    expect(r2.error).toBeInstanceOf(ClaimError);
    expect(r2.error.status).toBe(409);
    expect(r2.error.name).toBe('ClaimError');
    expect(server.stockOf('a')).toBe(0);
  });

  it('rejects with 409 for no stock and 404 for an unknown crate, both after the latency', async () => {
    const server = createArenaServer({ crates, latencyMs: 50 });
    const soldOut = settle(server.claim('z'));
    const unknown = settle(server.claim('nope'));
    const missing = settle(server.claim(undefined));
    await advance(49);
    expect(vi.getTimerCount()).toBe(3);
    await advance(1);
    expect((await soldOut).error.status).toBe(409);
    expect((await unknown).error.status).toBe(404);
    expect((await unknown).error.message).toContain('nope');
    expect((await missing).error.status).toBe(404);
    expect(server.stockOf('nope')).toBeUndefined();
  });

  it('aborting during the wait: AbortError, stock unchanged, no timer, no listener left', async () => {
    const server = createArenaServer({ crates, latencyMs: 400 });
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const claim = settle(server.claim('b', { signal: controller.signal }));
    await advance(200);
    controller.abort();
    const result = await claim;
    expect(result.ok).toBe(false);
    expect(result.error.name).toBe('AbortError');
    expect(result.error).toBeInstanceOf(DOMException);
    expect(result.error.status).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    await advance(5000);
    expect(server.stockOf('b')).toBe(3);
    expect(add).toHaveBeenCalledTimes(1);
    controller.abort(); // a second abort changes nothing
  });

  it('an already-aborted signal rejects at once and never starts a timer', async () => {
    const server = createArenaServer({ crates, latencyMs: 400 });
    const controller = new AbortController();
    controller.abort();
    const result = await settle(server.claim('b', { signal: controller.signal }));
    expect(result.error.name).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
    expect(server.stockOf('b')).toBe(3);
  });

  it('a claim that finished has removed its abort listener, and a later abort changes nothing', async () => {
    const server = createArenaServer({ crates, latencyMs: 10 });
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const claim = settle(server.claim('b', { signal: controller.signal }));
    await advance(10);
    expect((await claim).ok).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    controller.abort();
    expect(server.stockOf('b')).toBe(2);
  });

  it('aborting one claim does not touch another, and an aborted claim frees the last unit for the other', async () => {
    const server = createArenaServer({ crates, latencyMs: 100 });
    const controller = new AbortController();
    const aborted = settle(server.claim('a', { signal: controller.signal }));
    const other = settle(server.claim('a'));
    controller.abort();
    await advance(100);
    expect((await aborted).error.name).toBe('AbortError');
    expect((await other).ok).toBe(true);
    expect(server.stockOf('a')).toBe(0);
  });

  it('copies the stock: the frozen data does not change and a new server starts fresh', async () => {
    const server = createArenaServer({ crates: CRATES, latencyMs: 0 });
    const claim = settle(server.claim('gcoin-crate-2500'));
    await advance(0);
    expect((await claim).ok).toBe(true);
    expect(CRATES.find((c) => c.id === 'gcoin-crate-2500').remainingStock).toBe(1);
    expect(server.stockOf('gcoin-crate-2500')).toBe(0);
    expect(createArenaServer({ crates: CRATES }).stockOf('gcoin-crate-2500')).toBe(1);
  });

  it('works with no options and falls back to 400 ms for an invalid latency', async () => {
    expect(createArenaServer().stockOf('x')).toBeUndefined();
    for (const latencyMs of [-5, Number.NaN, undefined]) {
      const server = createArenaServer({ crates, latencyMs });
      const claim = settle(server.claim('b'));
      await advance(399);
      expect(server.stockOf('b')).toBe(3);
      await advance(1);
      expect((await claim).ok).toBe(true);
    }
  });
});

describe('createArenaServer with the real clock', () => {
  it('two claims for the last unit give exactly one success', async () => {
    const server = createArenaServer({ crates, latencyMs: 60 });
    const started = performance.now();
    const results = await Promise.all([settle(server.claim('a')), settle(server.claim('a'))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0].error.status).toBe(409);
    expect(performance.now() - started).toBeGreaterThanOrEqual(55);
  });
});
