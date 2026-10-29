import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AudioTaskQueue,
  DecodeError,
  DownloadError,
  DuplicateTaskError,
  QueueDisposedError,
  QueueFullError,
  TaskAbortedError,
  TaskFailedError,
  createTrackExecutor,
} from '../js/audio-task-queue.js';

             
                           
                                   
                                   
  

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// setTimeout rather than setImmediate: it is in the DOM lib, so the file type-checks without @types/node.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Executor where each task waits on a gate the test controls. It records
 * start order, completion order, and peak concurrency as seen by the executor.
 */
function gatedHarness(options) {
  const gates = new Map();
  const started = [];
  const completed = [];
  let running = 0;
  let peak = 0;

  const queue = new AudioTaskQueue({
    ...options,
    execute: (task, signal) => {
      started.push(task.id);
      running++;
      peak = Math.max(peak, running);
      const gate = deferred();
      gates.set(task.id, gate);
      signal.addEventListener('abort', () => gate.reject(signal.reason), { once: true });
      return gate.promise.finally(() => {
        running--;
        completed.push(task.id);
      });
    },
  });

  return {
    queue,
    started,
    completed,
    gates,
    peak: () => peak,
    resolve: (id) => gates.get(id) .resolve(`value:${id}`),
  };
}

describe('ordering and concurrency', () => {
  test('starts tasks in FIFO order and never exceeds maxConcurrency', async() => {
    const h = gatedHarness({ capacity: 50, maxConcurrency: 3 });
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const outcomes = ids.map((id) => h.queue.enqueue({ id, source: id }));

    await tick();
    assert.deepEqual(h.started, ['t0', 't1', 't2']);
    assert.equal(h.queue.inFlightCount, 3);

    for (const _ of ids) {
      // Settle the most recently started running task, so completion order
      // is deliberately not FIFO.
      const running = h.started.filter((s) => !h.completed.includes(s));
      assert.ok(running.length > 0, 'a task must be running before each settlement');
      h.resolve(running.at(-1) );
      await tick();
    }

    await h.queue.drain();
    assert.deepEqual(h.started, ids);
    assert.ok(h.peak() <= 3, `peak concurrency ${h.peak()} exceeded 3`);
    assert.notDeepEqual(h.completed, ids, 'completion order should be decoupled from start order');
    const results = await Promise.all(outcomes);
    assert.ok(results.every((r) => r.ok));
  });
});

describe('capacity and backpressure', () => {
  test('rejects with QueueFullError when queued depth reaches capacity; running tasks do not count', async() => {
    const h = gatedHarness({ capacity: 2, maxConcurrency: 1 });
    h.queue.enqueue({ id: 't0', source: 't0' }); // runs
    h.queue.enqueue({ id: 't1', source: 't1' }); // queued
    h.queue.enqueue({ id: 't2', source: 't2' }); // queued
    assert.equal(h.queue.queuedCount, 2);
    await assert.rejects(h.queue.enqueue({ id: 't3', source: 't3' }), QueueFullError);
  });

  test('fires backpressure once on crossing 80% and re-arms after depth drops', async() => {
    const depths = [];
    const h = gatedHarness({
      capacity: 5,
      maxConcurrency: 1,
      onBackpressure: (n) => depths.push(n),
    });
    h.queue.enqueue({ id: 't0', source: 't0' }); // running
    for (const id of ['t1', 't2', 't3']) h.queue.enqueue({ id, source: id });
    assert.deepEqual(depths, [], 'depth 3 of 5 is below the 80% threshold');

    h.queue.enqueue({ id: 't4', source: 't4' }); // depth 4 = 80%
    h.queue.enqueue({ id: 't5', source: 't5' }); // still high, must not re-fire
    assert.deepEqual(depths, [4]);

    h.queue.cancel('t5');
    h.queue.cancel('t4');
    h.queue.cancel('t3'); // depth 1, re-arms
    h.queue.enqueue({ id: 't6', source: 't6' });
    h.queue.enqueue({ id: 't7', source: 't7' });
    h.queue.enqueue({ id: 't8', source: 't8' }); // depth 4 again
    assert.deepEqual(depths, [4, 4]);
  });
});

describe('cancellation', () => {
  test('cancelling a queued task resolves it cancelled, never executes it, and takes no permit', async() => {
    const h = gatedHarness({ capacity: 5, maxConcurrency: 1 });
    const first = h.queue.enqueue({ id: 't0', source: 't0' });
    const second = h.queue.enqueue({ id: 't1', source: 't1' });

    assert.equal(h.queue.cancel('t1'), true);
    const outcome = await second;
    assert.equal(outcome.ok, false);
    assert.ok(!outcome.ok && outcome.error instanceof TaskAbortedError);

    h.resolve('t0');
    await first;
    await h.queue.drain();
    assert.deepEqual(h.started, ['t0']);
  });

  test('cancelling a running cooperative task resolves promptly and releases its permit only after the executor settles', async() => {
    const events = [];
    const gates = new Map();
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: (task, signal) => {
        events.push(`start:${task.id}`);
        const gate = deferred();
        gates.set(task.id, gate);
        signal.addEventListener('abort', () => gate.reject(signal.reason), { once: true });
        return gate.promise.finally(() => {
          events.push(`settle:${task.id}`);
        });
      },
    });

    const running = queue.enqueue({ id: 't0', source: 't0' });
    const next = queue.enqueue({ id: 't1', source: 't1' });
    await tick();

    assert.equal(queue.cancel('t0'), true);
    const outcome = await running;
    assert.ok(!outcome.ok && outcome.error instanceof TaskAbortedError);

    await tick();
    assert.deepEqual(events, ['start:t0', 'settle:t0', 'start:t1']);

    gates.get('t1') .resolve('ok');
    assert.ok((await next).ok);
  });

  test('a non-cooperative executor keeps its permit until it settles, so the in-flight bound holds', async() => {
    const gates = new Map();
    const started = [];
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: (task) => {
        started.push(task.id);
        const gate = deferred();
        gates.set(task.id, gate);
        return gate.promise; // ignores the signal entirely
      },
    });

    const first = queue.enqueue({ id: 't0', source: 't0' });
    const second = queue.enqueue({ id: 't1', source: 't1' });
    await tick();

    queue.cancel('t0');
    assert.equal((await first).ok, false, 'caller sees cancellation immediately');
    await tick();
    assert.deepEqual(started, ['t0'], 'in-flight bound: t1 must not start while t0 still runs');
    assert.equal(queue.inFlightCount, 1);

    gates.get('t0') .resolve('late value');
    await tick();
    await tick();
    assert.deepEqual(started, ['t0', 't1']);
    gates.get('t1') .resolve('ok');
    assert.ok((await second).ok);
  });

  test('a late value from an aborted task is discarded', async() => {
    const gate = deferred();
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: () => gate.promise,
    });
    const pending = queue.enqueue({ id: 't0', source: 't0' });
    await tick();
    queue.cancel('t0');
    gate.resolve('too late');
    const outcome = await pending;
    assert.equal(outcome.ok, false);
  });

  test('an already-aborted caller signal resolves cancelled without invoking the executor', async() => {
    let calls = 0;
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: async() => {
        calls++;
        return 'x';
      },
    });
    const controller = new AbortController();
    controller.abort();
    const outcome = await queue.enqueue({ id: 't0', source: 't0', signal: controller.signal });
    assert.equal(outcome.ok, false);
    assert.equal(calls, 0);
    assert.equal(queue.queuedCount, 0);
  });

  test('a caller signal aborted mid-run cancels the task and removes its listener once settled', async() => {
    const gate = deferred();
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: () => gate.promise,
    });

    const controller = new AbortController();
    const added = [];
    const removed = [];
    const signal = controller.signal;
    const realAdd = signal.addEventListener.bind(signal);
    const realRemove = signal.removeEventListener.bind(signal);
    signal.addEventListener = (type, fn, opts) => {
      added.push(fn);
      realAdd(type, fn, opts);
    };
    signal.removeEventListener = (type, fn, opts) => {
      removed.push(fn);
      realRemove(type, fn, opts);
    };

    const pending = queue.enqueue({ id: 't0', source: 't0', signal });
    await tick();
    controller.abort();
    const outcome = await pending;
    assert.ok(!outcome.ok && outcome.error instanceof TaskAbortedError);

    gate.resolve('late');
    await tick();
    assert.equal(added.length, 1);
    assert.equal(removed.length, 1, 'listener must be detached on settle');
  });

  test('cancel() of an unknown id returns false', () => {
    const queue = new AudioTaskQueue({
      capacity: 1,
      maxConcurrency: 1,
      execute: async() => 'x',
    });
    assert.equal(queue.cancel('nope'), false);
  });

  test('races between cancel and completion settle each task exactly once and leave the queue idle', async() => {
    for (let round = 0; round < 40; round++) {
      const queue = new AudioTaskQueue({
        capacity: 20,
        maxConcurrency: 3,
        execute: (task, signal) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve(task.source), (round + task.source) % 3);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(signal.reason);
            });
          }),
      });
      const ids = Array.from({ length: 12 }, (_, i) => `r${round}-${i}`);
      const outcomes = ids.map((id, i) => queue.enqueue({ id, source: i }));
      // Every cancel runs synchronously, before any timer can fire, so the
      // outcome of each task is fixed: even indices cancelled, odd indices completed.
      for (let i = 0; i < ids.length; i += 2) {
        assert.equal(queue.cancel(ids[i] ), true, `cancel must find active task ${ids[i]}`);
      }
      const settled = await Promise.all(outcomes);
      settled.forEach((outcome, i) => {
        if (i % 2 === 0) {
          assert.equal(outcome.ok, false, `task ${i} was cancelled`);
          assert.ok(!outcome.ok && outcome.error instanceof TaskAbortedError);
        } else {
          assert.deepEqual(outcome, { ok: true, id: ids[i], value: i }, `task ${i} must complete`);
        }
      });
      await queue.drain();
      assert.equal(queue.queuedCount, 0);
      assert.equal(queue.inFlightCount, 0);
    }
  });
});

describe('failures and isolation', () => {
  test('a failing executor resolves its own task as TaskFailedError and does not stall the queue', async() => {
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: async(task) => {
        if (task.id === 't0') throw new Error('boom');
        return `ok:${task.id}`;
      },
    });
    const [bad, good] = await Promise.all([
      queue.enqueue({ id: 't0', source: 't0' }),
      queue.enqueue({ id: 't1', source: 't1' }),
    ]);
    assert.equal(bad.ok, false);
    assert.ok(!bad.ok && bad.error instanceof TaskFailedError);
    assert.ok(!bad.ok && bad.error.cause instanceof Error);
    assert.deepEqual(good, { ok: true, id: 't1', value: 'ok:t1' });
    assert.equal(queue.inFlightCount, 0);
  });

  test('a synchronously throwing executor is treated as a failure', async() => {
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: () => {
        throw new Error('sync boom');
      },
    });
    const outcome = await queue.enqueue({ id: 't0', source: 't0' });
    assert.ok(!outcome.ok && outcome.error instanceof TaskFailedError);
    assert.equal(queue.inFlightCount, 0);
  });

  test('duplicate active ids reject with DuplicateTaskError', async() => {
    const h = gatedHarness({ capacity: 5, maxConcurrency: 1 });
    h.queue.enqueue({ id: 't0', source: 't0' });
    await assert.rejects(h.queue.enqueue({ id: 't0', source: 't0' }), DuplicateTaskError);
  });

  test('re-entrant enqueue from inside an executor completes without deadlock', async() => {
    const order = [];
    let queue;
    queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: (task) => {
        order.push(task.id);
        if (task.id === 'a') void queue.enqueue({ id: 'b', source: 'b' });
        return Promise.resolve(task.id);
      },
    });
    await queue.enqueue({ id: 'a', source: 'a' });
    await queue.drain();
    assert.deepEqual(order, ['a', 'b']);
  });
});

describe('pause, drain and dispose', () => {
  test('pause holds queued work until resume', async() => {
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 2,
      execute: async(task) => task.id,
    });
    queue.pause();
    const pending = queue.enqueue({ id: 't0', source: 't0' });
    await tick();
    assert.equal(queue.inFlightCount, 0);
    assert.equal(queue.state, 'PAUSED');

    queue.resume();
    assert.ok((await pending).ok);
  });

  test('drain resolves immediately when empty and state returns to IDLE', async() => {
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: async(task) => task.id,
    });
    await queue.drain();
    await queue.enqueue({ id: 't0', source: 't0' });
    await queue.drain();
    assert.equal(queue.state, 'IDLE');
  });

  test('dispose cancels queued and running tasks, waits for executors, then rejects new work', async() => {
    const gates = new Map();
    const queue = new AudioTaskQueue({
      capacity: 5,
      maxConcurrency: 1,
      execute: (task) => {
        const gate = deferred();
        gates.set(task.id, gate);
        return gate.promise;
      },
    });
    const running = queue.enqueue({ id: 't0', source: 't0' });
    const queued = queue.enqueue({ id: 't1', source: 't1' });
    await tick();

    let disposed = false;
    const disposing = queue.dispose().then(() => {
      disposed = true;
    });

    assert.ok(!(await running).ok);
    assert.ok(!(await queued).ok);
    await tick();
    assert.equal(disposed, false, 'dispose waits for the in-flight executor');

    gates.get('t0') .resolve('late');
    await disposing;
    assert.equal(queue.state, 'DISPOSED');
    await assert.rejects(queue.enqueue({ id: 't2', source: 't2' }), QueueDisposedError);
    await queue.dispose();
  });
});

describe('track pipeline executor', () => {
  const fakeBuffer = { duration: 1 };

  test('downloads then decodes and resolves with the AudioBuffer', async() => {
    const seen = [];
    const execute = createTrackExecutor({
      fetch: async(url, init) => {
        seen.push(url, init.signal instanceof AbortSignal);
        return {
          ok: true,
          status: 200,
          arrayBuffer: async() => new ArrayBuffer(4),
        };
      },
      decode: async(bytes) => {
        seen.push(bytes.byteLength);
        return fakeBuffer;
      },
    });
    const queue = new AudioTaskQueue({ capacity: 5, maxConcurrency: 2, execute });
    const outcome = await queue.enqueue({ id: 'track-1', source: '/a.mp3' });
    assert.deepEqual(seen, ['/a.mp3', true, 4]);
    assert.ok(outcome.ok);
    assert.equal(outcome.ok && outcome.value, fakeBuffer);
  });

  test('an HTTP error becomes a DownloadError inside TaskFailedError', async() => {
    const execute = createTrackExecutor({
      fetch: async() => ({ ok: false, status: 404 }),
      decode: async() => fakeBuffer,
    });
    const queue = new AudioTaskQueue({ capacity: 5, maxConcurrency: 1, execute });
    const outcome = await queue.enqueue({ id: 'track-2', source: '/missing.mp3' });
    assert.ok(!outcome.ok && outcome.error instanceof TaskFailedError);
    const cause = !outcome.ok && outcome.error instanceof TaskFailedError ? outcome.error.cause : undefined;
    if (!(cause instanceof DownloadError)) throw new Error('expected a DownloadError cause');
    assert.equal(cause.url, '/missing.mp3');
    if (!(cause.cause instanceof Error)) throw new Error('expected an HTTP Error as the download cause');
    assert.match(cause.cause.message, /HTTP 404/);
  });

  test('a decode failure becomes a DecodeError inside TaskFailedError', async() => {
    const execute = createTrackExecutor({
      fetch: async() => ({ ok: true, status: 200, arrayBuffer: async() => new ArrayBuffer(1) }),
      decode: async() => {
        throw new Error('EncodingError');
      },
    });
    const queue = new AudioTaskQueue({ capacity: 5, maxConcurrency: 1, execute });
    const outcome = await queue.enqueue({ id: 'track-3', source: '/bad.bin' });
    const cause = !outcome.ok ? (outcome.error).cause : undefined;
    assert.ok(cause instanceof DecodeError);
  });

  test('cancelling a download aborts the fetch signal', async() => {
    let fetchSignal;
    const execute = createTrackExecutor({
      fetch: (_url, init) => {
        fetchSignal = init.signal;
        return new Promise(() => {});
      },
      decode: async() => fakeBuffer,
    });
    const queue = new AudioTaskQueue({ capacity: 5, maxConcurrency: 1, execute });
    const pending = queue.enqueue({ id: 'track-4', source: '/slow.mp3' });
    await tick();
    queue.cancel('track-4');
    assert.ok(!(await pending).ok);
    assert.equal(fetchSignal?.aborted, true);
    assert.equal(queue.inFlightCount, 1, 'permit held until the non-cooperative fetch settles');
  });
});
