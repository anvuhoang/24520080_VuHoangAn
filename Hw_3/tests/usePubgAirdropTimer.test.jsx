// tests/usePubgAirdropTimer.test.jsx
import { StrictMode, useEffect, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePubgAirdropTimer } from '../src/hooks/usePubgAirdropTimer.js';

const T0 = 1_700_000_000_000;
let visibility;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
});

const wake = () =>
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
// The clock moves but no timer fires: what a throttled background tab does
const jump = (ms) => vi.setSystemTime(Date.now() + ms);
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));
const listeners = (spy) => spy.mock.calls.filter((call) => call[0] === 'visibilitychange').length;

describe('usePubgAirdropTimer counting', () => {
  it('counts down from the clock', () => {
    const { result } = renderHook(() => usePubgAirdropTimer(T0 + 10_000));
    expect(result.current).toEqual({ remainingMs: 10_000, isLive: false });
    tick(1000);
    expect(result.current.remainingMs).toBe(9000);
    tick(200);
    expect(result.current.remainingMs).toBe(8800);
  });

  it('shows the right time after a tick that is late by seconds (no drift)', () => {
    const { result } = renderHook(() => usePubgAirdropTimer(T0 + 60_000));
    jump(5000);
    expect(result.current.remainingMs).toBe(60_000); // still the old reading: no tick has run
    tick(200); // the late tick finally runs
    expect(result.current.remainingMs).toBe(60_000 - 5200); // a counter that subtracts per tick would show 59,800
  });

  it('re-reads the clock at once when the tab becomes visible, not on the next tick', () => {
    const { result } = renderHook(() => usePubgAirdropTimer(T0 + 60_000));
    visibility = 'hidden';
    jump(30_000);
    wake(); // hidden: ignored
    expect(result.current.remainingMs).toBe(60_000);
    visibility = 'visible';
    wake();
    expect(result.current.remainingMs).toBe(30_000);
  });

  it('never goes below zero, is live at zero and then stops ticking', () => {
    const { result } = renderHook(() => usePubgAirdropTimer(T0 + 500));
    expect(vi.getTimerCount()).toBe(1);
    tick(400);
    expect(result.current).toEqual({ remainingMs: 100, isLive: false });
    tick(200);
    expect(result.current).toEqual({ remainingMs: 0, isLive: true });
    expect(vi.getTimerCount()).toBe(0);
    jump(99_999);
    wake();
    expect(result.current.remainingMs).toBe(0);
  });

  it('with a target in the past it is 0 and live, and never starts an interval', () => {
    const set = vi.spyOn(window, 'setInterval');
    const { result } = renderHook(() => usePubgAirdropTimer(T0 - 1));
    expect(result.current).toEqual({ remainingMs: 0, isLive: true });
    expect(set).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies the server offset (positive: the server is ahead) and ignores an invalid one', () => {
    expect(renderHook(() => usePubgAirdropTimer(T0 + 10_000, 3000)).result.current.remainingMs).toBe(7000);
    expect(renderHook(() => usePubgAirdropTimer(T0 + 10_000, -2000)).result.current.remainingMs).toBe(12_000);
    expect(renderHook(() => usePubgAirdropTimer(T0 + 10_000, Number.NaN)).result.current.remainingMs).toBe(10_000);
  });

  it('shows zero and not live for a missing or invalid target, and starts no timer', () => {
    for (const target of [undefined, null, Number.NaN]) {
      const { result } = renderHook(() => usePubgAirdropTimer(target));
      expect(result.current).toEqual({ remainingMs: 0, isLive: false });
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('usePubgAirdropTimer cleanup', () => {
  it('restarts with no old timer or listener when the target changes', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { result, rerender } = renderHook(({ target }) => usePubgAirdropTimer(target), { initialProps: { target: T0 + 10_000 } });
    expect(vi.getTimerCount()).toBe(1);
    rerender({ target: T0 + 50_000 });
    expect(vi.getTimerCount()).toBe(1);
    expect(result.current.remainingMs).toBe(50_000);
    expect([listeners(add), listeners(remove)]).toEqual([2, 1]);
    rerender({ target: T0 + 50_000 }); // same target: nothing restarts
    expect(listeners(add)).toBe(2);
    rerender({ target: undefined });
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current).toEqual({ remainingMs: 0, isLive: false });
  });

  it('restarts when the offset changes', () => {
    const { result, rerender } = renderHook(({ offset }) => usePubgAirdropTimer(T0 + 10_000, offset), { initialProps: { offset: 0 } });
    rerender({ offset: 4000 });
    expect(result.current.remainingMs).toBe(6000);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('removes its interval and listener on unmount and does nothing afterwards', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const error = vi.spyOn(console, 'error');
    const { unmount } = renderHook(() => usePubgAirdropTimer(T0 + 10_000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(remove)).toBe(1);
    jump(1000);
    wake();
    vi.advanceTimersByTime(1000);
    expect(error).not.toHaveBeenCalled();
  });

  it('survives React StrictMode: one interval and one listener in the end', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() => usePubgAirdropTimer(T0 + 10_000), { wrapper: StrictMode });
    expect(vi.getTimerCount()).toBe(1);
    expect(listeners(add) - listeners(remove)).toBe(1);
    tick(1000);
    expect(result.current.remainingMs).toBe(9000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(add) - listeners(remove)).toBe(0);
  });

  it('renders once per tick, not twice', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return usePubgAirdropTimer(T0 + 10_000);
    });
    const base = renders;
    for (let i = 0; i < 5; i += 1) tick(200); // one act per tick, because React batches inside an act
    expect(renders - base).toBe(5);
  });
});

// The reference hook of slide 30, copied as it is, to show what it does when the target changes
function slideVersion(targetEpochMs, serverOffsetMs = 0) {
  const calcRemaining = () => Math.max(0, targetEpochMs - (Date.now() + serverOffsetMs));
  const [remainingMs, setRemainingMs] = useState(calcRemaining);
  useEffect(() => {
    const syncClock = () => setRemainingMs(calcRemaining());
    syncClock();
    const timerId = window.setInterval(syncClock, 200);
    const onWake = () => {
      if (document.visibilityState === 'visible') syncClock();
    };
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [targetEpochMs, serverOffsetMs]);
  return { remainingMs, isLive: remainingMs === 0 };
}

describe('the frame right after the target changes (audit #07)', () => {
  const rendersAfterChange = (useTimer) => {
    const seen = [];
    const { rerender } = renderHook(
      ({ target }) => {
        const value = useTimer(target).remainingMs;
        seen.push(value);
        return value;
      },
      { initialProps: { target: T0 + 10_000 } }
    );
    seen.length = 0;
    rerender({ target: T0 + 50_000 });
    return seen;
  };

  it('the slide version first paints the OLD target\'s time, then corrects itself', () => {
    const seen = rendersAfterChange(slideVersion);
    expect(seen[0]).toBe(10_000); // wrong: the new target is 50,000 ms away
    expect(seen.at(-1)).toBe(50_000);
  });

  it('our hook paints the new target\'s time in the very first frame', () => {
    const seen = rendersAfterChange(usePubgAirdropTimer);
    expect(seen[0]).toBe(50_000);
    expect(new Set(seen)).toEqual(new Set([50_000]));
  });
});
