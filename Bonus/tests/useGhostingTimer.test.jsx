// tests/useGhostingTimer.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGhostingTimer } from '../src/hooks/useGhostingTimer.js';
import { RELATIONSHIP_PHASES } from '../src/situationship/constants.js';

describe('useGhostingTimer hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('counts down and fires onGhosted after 5000ms', () => {
    const onGhosted = vi.fn();
    const sentAt = 100000;
    vi.setSystemTime(sentAt);

    const { result } = renderHook(() =>
      useGhostingTimer({
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
        pendingMessage: { id: 'm-1', text: 'Hey', sentAt },
        onGhosted,
        timeoutMs: 5000,
      })
    );

    expect(result.current.isWaitingReply).toBe(true);
    expect(result.current.secondsLeft).toBe(5);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.secondsLeft).toBe(2);
    expect(onGhosted).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.remainingMs).toBe(0);
    expect(result.current.secondsLeft).toBe(0);
    expect(onGhosted).toHaveBeenCalledTimes(1);
    expect(onGhosted).toHaveBeenCalledWith('m-1');
  });

  it('unmounting before 5000ms clears timers and prevents onGhosted', () => {
    const onGhosted = vi.fn();
    const sentAt = 100000;
    vi.setSystemTime(sentAt);

    const { unmount } = renderHook(() =>
      useGhostingTimer({
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
        pendingMessage: { id: 'm-1', text: 'Hey', sentAt },
        onGhosted,
        timeoutMs: 5000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onGhosted).not.toHaveBeenCalled();
  });

  it('cancelMessage stops countdown immediately and does not fire onGhosted', () => {
    const onGhosted = vi.fn();
    const sentAt = 100000;
    vi.setSystemTime(sentAt);

    const { result } = renderHook(() =>
      useGhostingTimer({
        phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
        pendingMessage: { id: 'm-1', text: 'Hey', sentAt },
        onGhosted,
        timeoutMs: 5000,
      })
    );

    act(() => {
      result.current.cancelMessage();
    });

    expect(result.current.remainingMs).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onGhosted).not.toHaveBeenCalled();
  });

  it('is inactive when phase is not DATING_NO_LOVE or message is null', () => {
    const onGhosted = vi.fn();
    const { result } = renderHook(() =>
      useGhostingTimer({
        phase: RELATIONSHIP_PHASES.COMMITTED,
        pendingMessage: { id: 'm-1', text: 'Hey', sentAt: 1000 },
        onGhosted,
      })
    );

    expect(result.current.isWaitingReply).toBe(false);
    expect(result.current.remainingMs).toBe(0);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onGhosted).not.toHaveBeenCalled();
  });
});

