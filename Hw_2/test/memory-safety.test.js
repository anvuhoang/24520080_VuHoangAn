import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/audio-engine.js';
import { AudioTaskQueue, QueueDisposedError, TaskAbortedError } from '../js/audio-task-queue.js';
import { AudioTrackPipeline } from '../js/audio-track-pipeline.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal Web Audio context for the real AudioEngine. Tracks every source,
 * listener and close so the tests can check what was released.
 */
function fakeContext(decodeHook) {
  const listeners = new Set();
  const sources = [];
  const ctx = {
    state: 'suspended',
    destination: {},
    closed: false,
    sources,
    listenerCount: () => listeners.size,
    addEventListener(_type, fn) {
      listeners.add(fn);
    },
    removeEventListener(_type, fn) {
      listeners.delete(fn);
    },
    createAnalyser() {
      return {
        fftSize: 512,
        smoothingTimeConstant: 0,
        get frequencyBinCount() {
          return this.fftSize / 2;
        },
        connect() {},
        disconnect() {},
        getByteFrequencyData() {},
      };
    },
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null,
        disconnected: false,
        started: false,
        stopped: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData: (bytes) => decodeHook(bytes),
    resume: async() => {},
    close: async() => {
      ctx.closed = true;
    },
  };
  return ctx;
}

/** Fetch that honours its signal the way the real one does: it rejects when aborted. */
function abortableFetch(log) {
  return (url, init) => {
    log.push(init.signal);
    return new Promise((resolve, reject) => {
      if (url.includes('slow')) {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        return;
      }
      resolve({
        ok: true,
        status: 200,
        arrayBuffer: async() => new ArrayBuffer(8),
      });
    });
  };
}

function buildPipeline(options
                                                        
                    
                          
                               
 ) {
  const ctx = fakeContext(options.decodeHook ?? (async() => ({ duration: 1 })));
  const engine = new AudioEngine({ createContext: () => ctx });
  const signals = options.fetchSignals ?? [];
  const pipeline = new AudioTrackPipeline({
    engine,
    capacity: options.capacity ?? 10,
    maxConcurrency: options.maxConcurrency ?? 2,
    fetch: abortableFetch(signals),
  });
  return { pipeline, ctx, engine, signals };
}

describe('unmount(dispose)', () => {
  test('aborts a pending download and resolves the caller immediately', async() => {
    const { pipeline, signals, ctx } = buildPipeline({ maxConcurrency: 1 });
    const pending = pipeline.load('a', '/slow.mp3');
    await tick();

    await pipeline.dispose();

    const outcome = await pending;
    assert.equal(outcome.ok, false);
    assert.ok(!outcome.ok && outcome.error instanceof TaskAbortedError);
    assert.equal(signals[0] .aborted, true, 'fetch signal must be aborted');
    assert.equal(ctx.closed, true, 'AudioContext closed last');
    assert.equal(pipeline.inFlightCount, 0);
  });

  test('stops the active source and drops its buffer reference before closing', async() => {
    const { pipeline, ctx } = buildPipeline({});
    const buffer = { duration: 2 };
    const playback = pipeline.play(buffer);
    const source = ctx.sources[0];
    assert.equal(source.started, true);

    await pipeline.dispose();

    assert.equal(await playback, 'stopped');
    assert.equal(source.disconnected, true);
    assert.equal(source.buffer, null, 'buffer reference must be dropped');
    assert.equal(source.onended, null, 'onended must be cleared');
    assert.equal(ctx.closed, true);
    assert.equal(ctx.listenerCount(), 0);
  });

  test('is idempotent and rejects any later load', async() => {
    const { pipeline } = buildPipeline({});
    await pipeline.dispose();
    await pipeline.dispose();
    await assert.rejects(pipeline.load('late', '/late.mp3'), QueueDisposedError);
  });

  test('waits for an in-flight decode before closing the context', async() => {
    let releaseDecode;
    const { pipeline, ctx } = buildPipeline({
      decodeHook: () => new Promise((resolve) => (releaseDecode = resolve)),
    });
    const pending = pipeline.load('d', '/d.mp3');
    await tick();

    let closedBeforeDecodeEnded = false;
    const disposing = pipeline.dispose().then(() => {
      closedBeforeDecodeEnded = ctx.closed;
    });
    await tick();
    assert.equal(ctx.closed, false, 'context must stay open while decode runs');

    releaseDecode({ duration: 1 });
    await disposing;
    assert.equal(closedBeforeDecodeEnded, true);
    assert.equal((await pending).ok, false);
  });
});

describe('queue reset', () => {
  test('cancels pending downloads, keeps the queue usable, and resumes normal loads', async() => {
    const { pipeline, signals } = buildPipeline({ maxConcurrency: 2 });
    const pending = [
      pipeline.load('s1', '/slow1.mp3'),
      pipeline.load('s2', '/slow2.mp3'),
      pipeline.load('s3', '/slow3.mp3'),
    ];
    await tick();
    assert.equal(pipeline.inFlightCount, 2);
    assert.equal(pipeline.queuedCount, 1);

    await pipeline.reset();

    const outcomes = await Promise.all(pending);
    assert.ok(outcomes.every((o) => !o.ok));
    assert.equal(signals.filter((s) => s.aborted).length, 2, 'both running fetches aborted');
    assert.equal(pipeline.queuedCount, 0);
    assert.equal(pipeline.inFlightCount, 0);

    const fresh = await pipeline.load('ok', '/ok.mp3');
    assert.equal(fresh.ok, true);
    await pipeline.dispose();
  });

  test('a queued load is cancelled by reset and never starts a download', async() => {
    const { pipeline, signals } = buildPipeline({ maxConcurrency: 1 });
    void pipeline.load('s1', '/slow1.mp3');
    const queued = pipeline.load('s2', '/ok2.mp3');
    await tick();
    const startedBefore = signals.length;

    await pipeline.reset();

    assert.equal((await queued).ok, false);
    assert.equal(signals.length, startedBefore, 'queued load must not reach fetch');
    await pipeline.dispose();
  });
});

describe('caller signal propagation', () => {
  test('aborting the caller signal cancels the download through the pipeline', async() => {
    const { pipeline, signals } = buildPipeline({ maxConcurrency: 1 });
    const controller = new AbortController();
    const pending = pipeline.load('c', '/slow.mp3', controller.signal);
    await tick();

    controller.abort();

    const outcome = await pending;
    assert.equal(outcome.ok, false);
    assert.equal(signals[0] .aborted, true);
    await pipeline.dispose();
  });
});

describe('buffer lifetime and retention', () => {
  test('a decode that finishes after reset is dropped, and its buffer is collected', {
    skip: typeof globalThis.gc === 'function' ? false : 'run with --expose-gc',
  }, async() => {
    const collected = [];
    const registry = new FinalizationRegistry((tag) => collected.push(tag));
    // Holds the pending decode's resolver. Cleared after use, because a live
    // resolver keeps its promise, and that promise keeps the resolved buffer.
    const hold = {};

    const { pipeline } = buildPipeline({
      maxConcurrency: 1,
      decodeHook: () => new Promise((resolve) => (hold.resolve = resolve)),
    });

    const outcome = pipeline.load('late', '/late.mp3');
    await tick();
    // Not awaited yet: reset() resolves only once the pending decode settles.
    const resetDone = pipeline.reset();
    assert.equal((await outcome).ok, false, 'caller released at once, without a buffer');
    assert.equal(pipeline.inFlightCount, 1, 'permit held until native decode returns');

    // Build the buffer inline so the test keeps no reference to it.
    hold.resolve(
      (() => {
        const buffer = { duration: 3, payload: new Uint8Array(1024) };
        registry.register(buffer, 'late-buffer');
        return buffer;
      })(),
    );
    hold.resolve = undefined;
    await resetDone;
    assert.equal(pipeline.inFlightCount, 0);

    for (let i = 0; i < 10 && collected.length === 0; i++) {
      globalThis.gc?.();
      await wait(10);
    }
    assert.deepEqual(collected, ['late-buffer']);
    await pipeline.dispose();
  });
});

describe('retention bounds', () => {
  test('cancelled queued entries are compacted, so FIFO slots stay bounded under churn', async() => {
    let releaseBlocker;
    const queue = new AudioTaskQueue({
      capacity: 10000,
      maxConcurrency: 1,
      execute: (task) =>
        task.id === 'block'
          ? new Promise((resolve) => (releaseBlocker = () => resolve('done')))
          : Promise.resolve(task.id),
    });
    void queue.enqueue({ id: 'block', source: 'block' });

    for (let i = 0; i < 5000; i++) {
      const id = `x${i}`;
      void queue.enqueue({ id, source: id });
      queue.cancel(id);
    }

    assert.equal(queue.queuedCount, 0);
    assert.ok(
      queue.retainedSlots <= 17,
      `retained ${queue.retainedSlots} FIFO slots after 5000 cancels; expected at most 17`,
    );
    releaseBlocker();
    await queue.drain();
  });
});
