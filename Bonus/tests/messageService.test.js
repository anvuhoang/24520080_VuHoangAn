// tests/messageService.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSimulatedMessage } from '../src/situationship/messageService.js';

describe('sendSimulatedMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('resolves after specified latency with reply', async () => {
    const promise = sendSimulatedMessage({ text: 'Tối đi dạo không?', latencyMs: 2000 });

    vi.advanceTimersByTime(2000);
    const result = await promise;

    expect(result.reply).toContain('Anh vừa đọc tin');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('rejects immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      sendSimulatedMessage({ text: 'Alo', latencyMs: 1000, signal: controller.signal })
    ).rejects.toThrow('aborted');
  });

  it('clears timeout and rejects when aborted during latency delay', async () => {
    const controller = new AbortController();
    const promise = sendSimulatedMessage({
      text: 'Chờ em với',
      latencyMs: 5000,
      signal: controller.signal,
    });

    vi.advanceTimersByTime(2000);
    controller.abort();

    await expect(promise).rejects.toThrow('aborted');
    expect(vi.getTimerCount()).toBe(0);
  });
});

