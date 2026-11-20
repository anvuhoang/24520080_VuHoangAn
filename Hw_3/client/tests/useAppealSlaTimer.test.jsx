// client/tests/useAppealSlaTimer.test.jsx — the countdown, with fake timers and a fake server clock.
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppealSlaTimer } from '../src/sla/useAppealSlaTimer.js';

const S = 1000;
const H = 3600 * S;
const DEADLINE = Date.UTC(2026, 10, 23, 12, 0, 0);
const NINETY_S_BEFORE = DEADLINE - 90 * S;

let visibility = 'visible';
const setVisibility = (value) => {
  visibility = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

// A server clock that is `skew` ms away from the device clock; answers at once
const serverClock = (skew = 0) => vi.fn(async () => Date.now() + skew);

// Only setTimeout is faked; the device clock is a variable the test sets by hand. That is what lets a test make a timer
// fire LATE: move the clock first, then let the timer run.
let clock = NINETY_S_BEFORE;
const setClock = (ms) => {
  clock = ms;
};
const flush = () => act(async () => {});
const advance = (ms) =>
  act(async () => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  clock = NINETY_S_BEFORE;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  vi.useRealTimers();
  delete document.visibilityState; // back to the prototype's getter
});

async function mount(deadline = DEADLINE, fetchServerNow = serverClock(), options = {}) {
  const view = renderHook(({ d, f }) => useAppealSlaTimer(d, { fetchServerNow: f }), {
    initialProps: { d: deadline, f: fetchServerNow },
    ...options,
  });
  await flush();
  return { ...view, fetchServerNow };
}

describe('counting down', () => {
  it('starts as "syncing", then "synced", and shows the time left', async () => {
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow: serverClock() }));
    expect(view.result.current.sync).toBe('syncing');
    await flush();
    expect(view.result.current.sync).toBe('synced');
    expect(view.result.current.text).toBe('00:01:30');
    expect(view.result.current.remainingMs).toBe(90 * S);
    expect(view.result.current.expired).toBe(false);
  });

  it('shows one second less after each second', async () => {
    const { result } = await mount();
    await advance(S);
    expect(result.current.text).toBe('00:01:29');
    await advance(S);
    expect(result.current.text).toBe('00:01:28');
    await advance(30 * S);
    expect(result.current.text).toBe('00:00:58');
  });

  it('keeps exactly one timeout pending, never an interval', async () => {
    await mount();
    expect(vi.getTimerCount()).toBe(1);
    await advance(5 * S);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('plans the next look at the moment the displayed second changes, even when it starts in the middle of a second', async () => {
    setClock(NINETY_S_BEFORE + 250); // 89.75 s left, shown as 00:01:30
    const { result } = await mount();
    expect(result.current.text).toBe('00:01:30');
    await advance(749);
    expect(result.current.text).toBe('00:01:30');
    await advance(1);
    expect(result.current.text).toBe('00:01:29');
  });

  it('changes level at one hour and five minutes', async () => {
    setClock(DEADLINE - H - 2 * S);
    const { result } = await mount();
    expect(result.current.level).toBe('ok');
    await advance(2 * S);
    expect(result.current.level).toBe('urgent');
    setClock(DEADLINE - 5 * 60 * S - S);
    await advance(S);
    expect(result.current.level).toBe('critical');
  });
});

describe('zero drift', () => {
  it('a timer that fires LATE shows the real time left, not one second less than before', async () => {
    const { result } = await mount();
    expect(result.current.text).toBe('00:01:30');
    // The main thread was blocked for 10 s: the timer was due at +1 s but the clock is already at +10 s
    setClock(NINETY_S_BEFORE + 10 * S);
    await act(async () => { vi.advanceTimersByTime(S); }); // the timer runs now, at its own (late) time
    expect(result.current.text).toBe('00:01:20'); // a counter that subtracts one per tick would show 00:01:29
  });

  it('a long freeze (a sleeping laptop) is accounted for at the next look', async () => {
    const { result } = await mount();
    setClock(NINETY_S_BEFORE + 61 * S);
    await act(async () => { vi.advanceTimersByTime(S); });
    expect(result.current.text).toBe('00:00:29');
  });

  it('ten thousand small steps end exactly where the clock says', async () => {
    setClock(DEADLINE - 10_000 * S);
    const { result } = await mount();
    for (let i = 0; i < 100; i++) await advance(100 * S);
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });
});

describe('the device clock is wrong', () => {
  it('a device clock one hour AHEAD of the server is corrected, and the window is not called closed before the answer', async () => {
    // Server time is NINETY_S_BEFORE; the device says one hour more, which is after the deadline
    setClock(NINETY_S_BEFORE + H);
    const fetchServerNow = vi.fn(async () => NINETY_S_BEFORE);
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow }));
    expect(view.result.current.sync).toBe('syncing');
    expect(view.result.current.remainingMs).toBe(0); // the device clock says "over"
    expect(view.result.current.expired).toBe(false); // but nobody has asked the server yet
    await flush();
    expect(view.result.current.offsetMs).toBe(-H);
    expect(view.result.current.text).toBe('00:01:30');
    expect(view.result.current.expired).toBe(false);
    await advance(S);
    expect(view.result.current.text).toBe('00:01:29');
  });

  it('a device clock one hour BEHIND is corrected too', async () => {
    setClock(NINETY_S_BEFORE - H);
    const fetchServerNow = vi.fn(async () => NINETY_S_BEFORE);
    const { result } = await mount(DEADLINE, fetchServerNow);
    expect(result.current.offsetMs).toBe(H);
    expect(result.current.text).toBe('00:01:30');
  });

  it('assumes the server stamped its answer in the middle of the round trip', async () => {
    const t0 = Date.now();
    let release;
    const fetchServerNow = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow }));
    await advance(400); // the request takes 400 ms
    await act(async () => release(t0 + 200)); // the server stamped it at +200 ms: the clocks agree
    expect(view.result.current.offsetMs).toBe(0);
    expect(view.result.current.remainingMs).toBe(89_600); // 400 ms have gone
  });
});

describe('the tab is hidden and shown', () => {
  it('stops planning timeouts while hidden', async () => {
    await mount();
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => setVisibility('hidden'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('when shown again it looks at the clock at once and asks the server again', async () => {
    const { result, fetchServerNow } = await mount();
    await act(async () => setVisibility('hidden'));
    setClock(NINETY_S_BEFORE + 40 * S); // forty seconds pass while the tab sleeps
    expect(result.current.text).toBe('00:01:30'); // nothing ran
    await act(async () => setVisibility('visible'));
    expect(result.current.text).toBe('00:00:50'); // right away, not at the next tick
    expect(fetchServerNow).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('a hidden event does not ask the server', async () => {
    const { fetchServerNow } = await mount();
    await act(async () => setVisibility('hidden'));
    expect(fetchServerNow).toHaveBeenCalledTimes(1);
  });

  it('asks the server again when the network comes back', async () => {
    const { fetchServerNow } = await mount();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(fetchServerNow).toHaveBeenCalledTimes(2);
  });
});

describe('listeners and timers are cleaned up', () => {
  const track = () => {
    const live = new Set();
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, o) => {
      if (type === 'visibilitychange') live.add(fn);
      return add(type, fn, o);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, fn, o) => {
      if (type === 'visibilitychange') live.delete(fn);
      return remove(type, fn, o);
    });
    return live;
  };

  it('adds one visibilitychange listener and removes that same listener on unmount', async () => {
    const live = track();
    const { unmount } = await mount();
    expect(live.size).toBe(1);
    unmount();
    expect(live.size).toBe(0);
  });

  it('re-rendering does not add listeners', async () => {
    const live = track();
    const { rerender, fetchServerNow } = await mount();
    for (let i = 0; i < 5; i++) rerender({ d: DEADLINE, f: fetchServerNow });
    expect(live.size).toBe(1);
  });

  it('under Strict Mode (mount, unmount, mount) exactly one listener is left, and none after unmount', async () => {
    const live = track();
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow: serverClock() }), { wrapper: StrictMode });
    await flush();
    expect(live.size).toBe(1);
    view.unmount();
    expect(live.size).toBe(0);
  });

  it('after unmount nothing runs: no timeout, no request, no reaction to the tab', async () => {
    const { unmount, fetchServerNow } = await mount();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(fetchServerNow).toHaveBeenCalledTimes(1);
  });

  it('aborts the request that is still on its way when it unmounts', async () => {
    let signal;
    const fetchServerNow = vi.fn((options) => { signal = options.signal; return new Promise(() => {}); });
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow }));
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('an inline fetch function that changes on every render does not restart the sync', async () => {
    const fetches = vi.fn(async () => Date.now());
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow: (o) => fetches(o) }));
    await flush();
    for (let i = 0; i < 5; i++) view.rerender();
    await flush();
    expect(fetches).toHaveBeenCalledTimes(1);
  });
});

describe('answers that arrive out of order or fail', () => {
  it('an older answer that arrives after a newer one is ignored (and its request was aborted)', async () => {
    const pending = [];
    const fetchServerNow = vi.fn((options) => new Promise((resolve) => pending.push({ resolve, signal: options.signal })));
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow }));
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible')); // a second request
    expect(pending).toHaveLength(2);
    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => pending[1].resolve(Date.now() + 5 * S)); // the newer answer: server is 5 s ahead
    expect(view.result.current.offsetMs).toBeCloseTo(5 * S, -2);
    await act(async () => pending[0].resolve(Date.now() + 60 * S)); // the older one arrives late
    expect(view.result.current.offsetMs).toBeCloseTo(5 * S, -2);
  });

  it('a failed first sync gives "failed" and the device clock, and the window still works', async () => {
    const fetchServerNow = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const { result } = await mount(DEADLINE, fetchServerNow);
    expect(result.current.sync).toBe('failed');
    expect(result.current.offsetMs).toBe(0);
    expect(result.current.text).toBe('00:01:30');
    await advance(S);
    expect(result.current.text).toBe('00:01:29');
  });

  it('after a failed sync a closed window is shown as closed (the device clock is all there is)', async () => {
    setClock(DEADLINE + S);
    const fetchServerNow = vi.fn(async () => { throw new Error('down'); });
    const { result } = await mount(DEADLINE, fetchServerNow);
    expect(result.current.expired).toBe(true);
  });

  it('a later failure keeps the last good offset and stays "synced"', async () => {
    const answers = [async () => Date.now() + 7 * S, async () => { throw new Error('down'); }];
    const fetchServerNow = vi.fn(() => answers.shift()());
    const { result } = await mount(DEADLINE, fetchServerNow);
    expect(result.current.offsetMs).toBeCloseTo(7 * S, -2);
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));
    expect(fetchServerNow).toHaveBeenCalledTimes(2);
    expect(result.current.sync).toBe('synced');
    expect(result.current.offsetMs).toBeCloseTo(7 * S, -2);
  });

  it('a failed sync becomes "synced" when a later one works', async () => {
    const answers = [async () => { throw new Error('down'); }, async () => Date.now()];
    const fetchServerNow = vi.fn(() => answers.shift()());
    const { result } = await mount(DEADLINE, fetchServerNow);
    expect(result.current.sync).toBe('failed');
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));
    expect(result.current.sync).toBe('synced');
  });
});

describe('the deadline', () => {
  it('is expired exactly at the deadline, with zero left and nothing more planned', async () => {
    setClock(DEADLINE - 2 * S);
    const { result } = await mount();
    await advance(S);
    expect(result.current.expired).toBe(false);
    await advance(S);
    expect(result.current).toMatchObject({ remainingMs: 0, expired: true, level: 'expired', text: '00:00:00' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never goes below zero', async () => {
    setClock(DEADLINE + 5 * H);
    const { result } = await mount();
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.text).toBe('00:00:00');
  });

  it('a deadline that has already passed is expired as soon as the server has answered, with no timer', async () => {
    setClock(DEADLINE + H);
    const view = renderHook(() => useAppealSlaTimer(DEADLINE, { fetchServerNow: serverClock() }));
    expect(view.result.current.expired).toBe(false); // not before the answer
    await flush();
    expect(view.result.current.expired).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes a new deadline when it changes, and an ISO string as well as a number', async () => {
    const { result, rerender, fetchServerNow } = await mount(DEADLINE);
    expect(result.current.text).toBe('00:01:30');
    rerender({ d: new Date(DEADLINE + 30 * S).toISOString(), f: fetchServerNow });
    expect(result.current.text).toBe('00:02:00');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('treats a deadline that is not a date as closed, without throwing or planning anything', async () => {
    const { result } = await mount('not a date');
    expect(result.current.expired).toBe(true);
    expect(result.current.remainingMs).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
