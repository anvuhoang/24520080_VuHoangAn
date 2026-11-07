// src/sequencer/replay.js
import { AudioTaskQueue, TaskAbortedError } from './audioTaskQueue.js';

const toMs = (value) => (Number.isFinite(value) && value > 0 ? value : 0);
const toSpeed = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1);

export async function replaySequence(events, { speed = 1, signal, onNoteOn, onNoteOff } = {}) {
  const sequence = Array.isArray(events) ? events : [];
  if (signal?.aborted) return 'aborted';
  if (sequence.length === 0) return 'completed';

  const rate = toSpeed(speed);

  // Every start time is counted from the start of the replay, so timer delays never add up
  let elapsedMs = 0;
  const tasks = sequence.map((event, index) => {
    elapsedMs += toMs(event.deltaMs);
    return {
      id: `note-${index}`,
      event,
      startMs: elapsedMs / rate,
      holdMs: toMs(event.durationMs) / rate,
    };
  });

  const sounding = new Set(); // events whose note is on
  const releaseTimers = new Set(); // timers that will release a note
  let aborted = false;
  let notifyReleased = () => {};

  const releaseNote = (event) => {
    if (sounding.delete(event)) onNoteOff?.(event);
  };

  const stopEverything = () => {
    for (const timerId of releaseTimers) clearTimeout(timerId);
    releaseTimers.clear();
    for (const event of [...sounding]) releaseNote(event);
  };

  const startedAt = performance.now();

  // Waits until `targetMs` after the start of the replay, or rejects as soon as the task is cancelled
  const waitUntil = (targetMs, taskSignal) =>
    new Promise((resolve, reject) => {
      if (taskSignal.aborted) {
        reject(taskSignal.reason);
        return;
      }
      const remaining = targetMs - (performance.now() - startedAt);
      if (remaining <= 0) {
        resolve();
        return;
      }

      const onTaskAbort = () => {
        clearTimeout(timerId);
        reject(taskSignal.reason);
      };
      const timerId = setTimeout(() => {
        taskSignal.removeEventListener('abort', onTaskAbort);
        resolve();
      }, remaining);
      taskSignal.addEventListener('abort', onTaskAbort, { once: true });
    });

  // One task per note; the queue starts them one at a time, in the order they were recorded
  const queue = new AudioTaskQueue({
    capacity: tasks.length,
    maxConcurrency: 1,
    execute: async (task, taskSignal) => {
      await waitUntil(task.startMs, taskSignal);

      sounding.add(task.event);
      onNoteOn?.(task.event);

      const timerId = setTimeout(() => {
        releaseTimers.delete(timerId);
        releaseNote(task.event);
        notifyReleased();
      }, task.holdMs);
      releaseTimers.add(timerId);
    },
  });

  const onAbort = () => {
    aborted = true;
    void queue.dispose(); // cancels the notes that are still waiting
    stopEverything(); // releases the notes that are still sounding and clears every timer
    notifyReleased();
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const outcomes = await Promise.all(tasks.map((task) => queue.enqueue(task)));
    if (aborted) return 'aborted';

    const failure = outcomes.find((outcome) => !outcome.ok && !(outcome.error instanceof TaskAbortedError));
    if (failure) throw failure.error.cause ?? failure.error;

    // Every note has started; wait for the last one to be released
    await new Promise((resolve) => {
      notifyReleased = () => {
        if (aborted || releaseTimers.size === 0) resolve();
      };
      notifyReleased();
    });

    return aborted ? 'aborted' : 'completed';
  } finally {
    signal?.removeEventListener('abort', onAbort);
    stopEverything();
    await queue.dispose();
  }
}
