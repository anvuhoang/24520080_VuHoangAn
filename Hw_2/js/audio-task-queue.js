/**
 * Concurrent FIFO task queue for track download and decode work.
 *
 * Invariants (PROJECT_RULE.md Section 2):
 * - At most `maxConcurrency` executor calls are unsettled at once.
 * - Tasks start in enqueue order. Completion order does not affect start order.
 * - A permit is released when the executor settles, not when the caller is
 *   told a task was cancelled. This keeps the in-flight bound true.
 * - Each task settles exactly once. `#settle()` is the only place that
 *   resolves a caller's promise and detaches listeners.
 *
 * Ownership:
 * - The queue owns each task's AbortController. Its signal is the cancellation
 *   token handed to the executor.
 * - A caller-supplied AbortSignal is linked to that token and unlinked on settle.
 *
 * This module uses erasable TypeScript only (no enums, namespaces or
 * parameter properties), so Node can run it directly with type stripping.
 */

export const QueueState = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  DISPOSED: 'DISPOSED',
};

                                                                      

export class QueueFullError extends Error {
  constructor(capacity) {
    super(`Queue is full(capacity ${capacity})`);
    this.name = 'QueueFullError';
  }
}

export class QueueDisposedError extends Error {
  constructor() {
    super('AudioTaskQueue has been disposed');
    this.name = 'QueueDisposedError';
  }
}

export class DuplicateTaskError extends Error {
  constructor(id) {
    super(`A task with id "${id}" is already queued or running`);
    this.name = 'DuplicateTaskError';
  }
}

export class TaskAbortedError extends Error {
  id;

  constructor(id, reason) {
    super(`Task ${id} aborted: ${reason}`);
    this.name = 'TaskAbortedError';
    this.id = id;
  }
}

export class TaskFailedError extends Error {
  id;

  constructor(id, cause) {
    super(`Task ${id} failed`, { cause });
    this.name = 'TaskFailedError';
    this.id = id;
  }
}

export class DownloadError extends Error {
  url;

  constructor(url, cause) {
    super(`Download failed: ${url}`, { cause });
    this.name = 'DownloadError';
    this.url = url;
  }
}

export class DecodeError extends Error {
  id;

  constructor(id, cause) {
    super(`Decode failed for task ${id}`, { cause });
    this.name = 'DecodeError';
    this.id = id;
  }
}

                                
                      
                           
                                                                             
                                
 

/**
 * Runs one task. The executor must honour `signal`. A permit is released only
 * when the returned promise settles, so an executor that ignores the signal
 * holds its permit until it finishes.
 */
                                             
                      
                      
                     

                                                         
                            
                                  
                                                  
     
                                                                         
                                                                        
                                   
     
                                                          
 

/** Every enqueued task resolves to one of these. Task failures never reject. */
                                 
                                                                      
                                                                                                    

const BACKPRESSURE_RATIO = 0.8;

/** Tombstones tolerated before the FIFO is compacted. Keeps memory proportional to live work. */
const COMPACT_MIN_TOMBSTONES = 16;

                                  
                               
                                       
                                                           
                           
                                                                  
                  
                   
 

/**
 * Array-backed FIFO with O(1) amortised push and shift. Settled entries are
 * left in place as tombstones and skipped by the caller. This makes cancel O(1).
 */
class Fifo {
  #items = [];
  #head = 0;

  push(item) {
    this.#items.push(item);
  }

  shift() {
    if (this.#head >= this.#items.length) return undefined;
    const item = this.#items[this.#head];
    // Drop the reference so a settled entry cannot be kept alive by the queue.
    this.#items[this.#head] = undefined;
    this.#head++;
    if (this.#head > 1024 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return item;
  }

  clear() {
    this.#items = [];
    this.#head = 0;
  }

  /** Rebuilds the backing array with only the items `keep` accepts. */
  prune(keep) {
    const live = [];
    for (let i = this.#head; i < this.#items.length; i++) {
      const item = this.#items[i];
      if (item !== undefined && keep(item)) live.push(item);
    }
    this.#items = live;
    this.#head = 0;
  }

  /** Array slots still held, including tombstones. Exposed so tests can bound retention. */
  get retainedSlots() {
    return this.#items.length - this.#head;
  }
}

export class AudioTaskQueue {
  #capacity;
  #maxConcurrency;
  #execute;
  #onBackpressure;
  #backpressureThreshold;
  #fifo = new Fifo();
  #active = new Map();
  #idleWaiters = [];

  #state = QueueState.IDLE;
  #queuedCount = 0;
  #inFlight = 0;
  #reconciling = false;
  #backpressureActive = false;
  /** Settled entries still sitting in the FIFO array. Skipped on dispatch, removed on compaction. */
  #tombstones = 0;

  constructor(options) {
    if (!Number.isInteger(options.capacity) || options.capacity < 1) {
      throw new RangeError(`capacity must be an integer >= 1; received ${options.capacity}`);
    }
    if (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1) {
      throw new RangeError(
        `maxConcurrency must be an integer >= 1; received ${options.maxConcurrency}`,
      );
    }
    this.#capacity = options.capacity;
    this.#maxConcurrency = options.maxConcurrency;
    this.#execute = options.execute;
    this.#onBackpressure = options.onBackpressure;
    this.#backpressureThreshold = Math.ceil(options.capacity * BACKPRESSURE_RATIO);
  }

  get state() {
    return this.#state;
  }

  /** Tasks waiting for a permit. */
  get queuedCount() {
    return this.#queuedCount;
  }

  /** Executor calls not yet settled. Never exceeds `maxConcurrency`. */
  get inFlightCount() {
    return this.#inFlight;
  }

  /** FIFO slots held, including cancelled-but-not-yet-removed entries. */
  get retainedSlots() {
    return this.#fifo.retainedSlots;
  }

  /**
   * Adds a task to the FIFO. Rejects only for misuse: duplicate id, full queue,
   * or a disposed queue. Task failures and cancellations resolve the outcome.
   */
  enqueue(task) {
    if (this.#state === QueueState.DISPOSED) {
      return Promise.reject(new QueueDisposedError());
    }
    if (this.#active.has(task.id)) {
      return Promise.reject(new DuplicateTaskError(task.id));
    }
    if (this.#queuedCount >= this.#capacity) {
      return Promise.reject(new QueueFullError(this.#capacity));
    }

    let resolveOutcome;
    const outcome = new Promise((resolve) => {
      resolveOutcome = resolve;
    });
    const entry = {
      task,
      controller: new AbortController(),
      resolve: resolveOutcome,
      detachCaller: () => {},
      queued: false,
      settled: false,
    };

    const callerSignal = task.signal;
    if (callerSignal?.aborted) {
      this.#settle(entry, cancelledOutcome(task.id, 'caller signal was already aborted'));
      return outcome;
    }

    if (callerSignal) {
      const onCallerAbort = () => {
        this.#cancelEntry(entry, 'caller signal aborted');
      };
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      entry.detachCaller = () => callerSignal.removeEventListener('abort', onCallerAbort);
    }

    this.#active.set(task.id, entry);
    entry.queued = true;
    this.#queuedCount++;
    this.#fifo.push(entry);
    if (this.#state === QueueState.IDLE) {
      this.#state = QueueState.RUNNING;
    }
    this.#reconcile();
    return outcome;
  }

  /**
   * Cancels a queued or running task by id. Returns false if the id is not
   * active. The caller's promise resolves immediately. A running task keeps
   * its permit until its executor settles.
   */
  cancel(id) {
    const entry = this.#active.get(id);
    if (!entry) return false;
    this.#cancelEntry(entry, 'cancelled by caller');
    return true;
  }

  /**
   * Cancels every active task and clears the FIFO, but keeps the queue usable.
   * Dispatch is held off while cancelling, so no task starts only to be
   * cancelled straight after. Resolves once in-flight executors have settled.
   */
  reset() {
    if (this.#state === QueueState.DISPOSED) return this.#waitIdle();

    const previous = this.#state;
    this.#state = QueueState.PAUSED;
    for (const entry of [...this.#active.values()]) {
      this.#cancelEntry(entry, 'queue reset');
    }
    this.#fifo.clear();
    this.#tombstones = 0;
    this.#state = previous;
    this.#reconcile();
    return this.#waitIdle();
  }

  /** Stops dispatching new tasks. Running tasks continue. */
  pause() {
    if (this.#state === QueueState.DISPOSED) return;
    this.#state = QueueState.PAUSED;
  }

  resume() {
    if (this.#state !== QueueState.PAUSED) return;
    this.#state = QueueState.RUNNING;
    this.#reconcile();
  }

  /**
   * Resolves when nothing is queued or in flight. A paused queue with queued
   * work will not drain until resumed.
   */
  drain() {
    return this.#waitIdle();
  }

  /**
   * Cancels every active task and rejects further enqueues. Resolves once all
   * in-flight executors have settled. Safe to call more than once.
   */
  dispose() {
    if (this.#state === QueueState.DISPOSED) return this.#waitIdle();

    this.#state = QueueState.DISPOSED;
    for (const entry of [...this.#active.values()]) {
      this.#cancelEntry(entry, 'queue disposed');
    }
    this.#fifo.clear();
    this.#tombstones = 0;
    return this.#waitIdle();
  }

  #cancelEntry(entry, reason) {
    if (entry.settled) return;
    const { id } = entry.task;
    const error = new TaskAbortedError(id, reason);
    // Settle before aborting. An abort listener in the executor may call back
    // into the queue, and settled-first makes that re-entry a no-op.
    this.#settle(entry, { ok: false, id, error });
    entry.controller.abort(error);
    this.#reconcile();
  }

  #settle(entry, outcome) {
    if (entry.settled) return;
    entry.settled = true;
    if (entry.queued) {
      entry.queued = false;
      this.#queuedCount--;
      this.#tombstones++;
    }
    entry.detachCaller();
    if (this.#active.get(entry.task.id) === entry) {
      this.#active.delete(entry.task.id);
    }
    entry.resolve(outcome);
  }

  /**
   * Dispatches queued tasks up to the permit limit, then re-checks
   * backpressure and idleness. Re-entrant calls (an executor that enqueues
   * synchronously) return early. The outer loop picks up their work.
   */
  #reconcile() {
    if (this.#reconciling) return;
    this.#reconciling = true;
    try {
      while (this.#state === QueueState.RUNNING && this.#inFlight < this.#maxConcurrency) {
        const entry = this.#takeNextLive();
        if (!entry) break;
        this.#start(entry);
      }
      if (this.#tombstones > Math.max(COMPACT_MIN_TOMBSTONES, this.#queuedCount)) {
        this.#fifo.prune((entry) => !entry.settled);
        this.#tombstones = 0;
      }
      this.#checkBackpressure();
    } finally {
      this.#reconciling = false;
    }
    this.#notifyIfIdle();
  }

  #takeNextLive() {
    let entry = this.#fifo.shift();
    while (entry !== undefined && entry.settled) {
      this.#tombstones--;
      entry = this.#fifo.shift();
    }
    return entry;
  }

  #start(entry) {
    entry.queued = false;
    this.#queuedCount--;
    // Take the permit synchronously, before any await, so the bound holds.
    this.#inFlight++;
    void this.#run(entry);
  }

  async #run(entry) {
    const { id } = entry.task;
    try {
      const value = await this.#execute(entry.task, entry.controller.signal);
      // If the task was cancelled while running, #settle is a no-op here and
      // the late value is discarded.
      this.#settle(entry, { ok: true, id, value });
    } catch (cause) {
      this.#settle(entry, { ok: false, id, error: new TaskFailedError(id, cause) });
    } finally {
      this.#inFlight--;
      this.#reconcile();
    }
  }

  #checkBackpressure() {
    const high = this.#queuedCount >= this.#backpressureThreshold;
    if (high && !this.#backpressureActive) {
      this.#backpressureActive = true;
      this.#onBackpressure?.(this.#queuedCount);
    } else if (!high) {
      this.#backpressureActive = false;
    }
  }

  #isIdle() {
    return this.#queuedCount === 0 && this.#inFlight === 0;
  }

  #notifyIfIdle() {
    if (!this.#isIdle()) return;
    if (this.#state === QueueState.RUNNING) {
      this.#state = QueueState.IDLE;
    }
    const waiters = this.#idleWaiters.splice(0);
    for (const wake of waiters) wake();
  }

  #waitIdle() {
    if (this.#isIdle()) return Promise.resolve();
    return new Promise((resolve) => {
      this.#idleWaiters.push(resolve);
    });
  }
}

function cancelledOutcome(id, reason) {
  return { ok: false, id, error: new TaskAbortedError(id, reason) };
}

// ---------------------------------------------------------------------------
// Track pipeline: download, then decode. Both stages run inside one queued
// task, so they share the same concurrency limit.
// ---------------------------------------------------------------------------

                                
                                                                                    
                                                                
 

export function createTrackExecutor(
  pipeline,
) {
  return async(task, signal) => {
    let response;
    try {
      response = await pipeline.fetch(task.source, { signal });
    } catch (cause) {
      throw new DownloadError(task.source, cause);
    }
    if (!response.ok) {
      throw new DownloadError(task.source, new Error(`HTTP ${response.status}`));
    }

    const bytes = await response.arrayBuffer();
    // Web Audio decoding cannot be interrupted, so check before the costly step.
    if (signal.aborted) throw signal.reason;

    try {
      return await pipeline.decode(bytes);
    } catch (cause) {
      throw new DecodeError(task.id, cause);
    }
  };
}
