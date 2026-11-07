// tests/replay.test.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaySequence } from '../src/sequencer/replay.js';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

// starts at 0, 100, 200 and 250 ms (deltas 0, 100, 100, 50); every note is held 80 ms
const phrase = [
  { midi: 60, freqHz: 261.6, durationMs: 80, deltaMs: 0 },
  { midi: 62, freqHz: 293.7, durationMs: 80, deltaMs: 100 },
  { midi: 64, freqHz: 329.6, durationMs: 80, deltaMs: 100 },
  { midi: 65, freqHz: 349.2, durationMs: 80, deltaMs: 50 },
];

function start(events, options = {}) {
  const log = [];
  const t0 = performance.now();
  const stamp = () => Math.round(performance.now() - t0);
  const promise = replaySequence(events, {
    ...options,
    onNoteOn: (event) => log.push(`on${event.midi}@${stamp()}`),
    onNoteOff: (event) => log.push(`off${event.midi}@${stamp()}`),
  });
  return { promise, log };
}

const advance = (ms) => vi.advanceTimersByTimeAsync(ms);

describe('replaySequence', () => {
  it('plays every note at its moment and releases it after the time it was held (1x)', async () => {
    const { promise, log } = start(phrase);
    await advance(1000);

    expect(await promise).toBe('completed');
    expect(log).toEqual([
      'on60@0', 'off60@80', 'on62@100', 'off62@180', 'on64@200', 'on65@250', 'off64@280', 'off65@330',
    ]);
  });

  it('plays twice as fast at 2x and half as fast at 0.5x', async () => {
    const fast = start(phrase, { speed: 2 });
    await advance(1000);
    expect(await fast.promise).toBe('completed');
    expect(fast.log).toEqual([
      'on60@0', 'off60@40', 'on62@50', 'off62@90', 'on64@100', 'on65@125', 'off64@140', 'off65@165',
    ]);

    const slow = start(phrase, { speed: 0.5 });
    await advance(2000);
    expect(await slow.promise).toBe('completed');
    expect(slow.log).toEqual([
      'on60@0', 'off60@160', 'on62@200', 'off62@360', 'on64@400', 'on65@500', 'off64@560', 'off65@660',
    ]);
  });

  it('starts the notes in the order they were recorded', async () => {
    const { promise, log } = start(phrase);
    await advance(1000);
    await promise;

    const starts = log.filter((entry) => entry.startsWith('on')).map((entry) => Number(entry.slice(2).split('@')[0]));
    expect(starts).toEqual([60, 62, 64, 65]);
  });

  it('counts every start time from the start of the replay, so nothing drifts', async () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      midi: 40 + index, freqHz: 100, durationMs: 10, deltaMs: index === 0 ? 0 : 30,
    }));
    const { promise, log } = start(many);
    await advance(2000);
    await promise;

    const starts = log.filter((entry) => entry.startsWith('on')).map((entry) => Number(entry.split('@')[1]));
    starts.forEach((time, index) => expect(time).toBe(index * 30));
  });

  it('lets a long note keep sounding while later notes start and end', async () => {
    const { promise, log } = start([
      { midi: 60, freqHz: 1, durationMs: 300, deltaMs: 0 },
      { midi: 64, freqHz: 1, durationMs: 100, deltaMs: 50 },
      { midi: 67, freqHz: 1, durationMs: 100, deltaMs: 50 },
    ]);
    await advance(1000);
    await promise;

    expect(log).toEqual(['on60@0', 'on64@50', 'on67@100', 'off64@150', 'off67@200', 'off60@300']);
  });

  it('stops when the signal aborts: waiting notes never start and a sounding note is released', async () => {
    const controller = new AbortController();
    const { promise, log } = start(phrase, { signal: controller.signal });

    await advance(130); // note 60 is over, note 62 is sounding (100..180), notes 64 and 65 are waiting
    controller.abort();
    await advance(1000);

    expect(await promise).toBe('aborted');
    expect(log).toEqual(['on60@0', 'off60@80', 'on62@100', 'off62@130']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('plays nothing more after an abort, whatever the time', async () => {
    const controller = new AbortController();
    const { promise, log } = start(phrase, { signal: controller.signal });
    await advance(10);
    controller.abort();
    const afterAbort = log.length;

    await advance(5000);

    await promise;
    expect(log).toHaveLength(afterAbort);
  });

  it('plays nothing when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { promise, log } = start(phrase, { signal: controller.signal });

    expect(await promise).toBe('aborted');
    expect(log).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([[0], [-2], [Number.NaN], ['2'], [null], [undefined], [Number.POSITIVE_INFINITY]])(
    'falls back to normal speed for the invalid speed %s',
    async (speed) => {
      const { promise, log } = start([phrase[0], phrase[1]], { speed });
      await advance(1000);
      await promise;
      expect(log).toContain('on62@100');
    }
  );

  it('accepts any positive number as a speed', async () => {
    const { promise, log } = start([phrase[0], phrase[1]], { speed: 4 });
    await advance(1000);
    await promise;
    expect(log).toContain('on62@25');
  });

  it('completes at once for an empty list or something that is not a list', async () => {
    expect(await start([]).promise).toBe('completed');
    expect(await start(null).promise).toBe('completed');
    expect(await start(undefined).promise).toBe('completed');
  });

  it('rejects with the error of a callback that throws, after releasing every note', async () => {
    const released = [];
    const promise = replaySequence(phrase, {
      onNoteOn: (event) => {
        if (event.midi === 62) throw new Error('boom');
      },
      onNoteOff: (event) => released.push(event.midi),
    });
    const outcome = promise.then(() => 'resolved', (error) => error.message);
    await advance(1000);

    expect(await outcome).toBe('boom');
    expect(released.sort()).toEqual([60, 62, 64, 65]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs on the Lab 2 queue: one note per task, one at a time', async () => {
    const order = [];
    const { promise } = (() => {
      const result = replaySequence(phrase, {
        onNoteOn: (event) => order.push(event.midi),
        onNoteOff: () => {},
      });
      return { promise: result };
    })();
    await advance(1000);
    await promise;

    expect(order).toEqual([60, 62, 64, 65]);
  });

  it('leaves no timer running when it has finished', async () => {
    const { promise } = start(phrase);
    await advance(1000);
    await promise;

    expect(vi.getTimerCount()).toBe(0);
  });
});
