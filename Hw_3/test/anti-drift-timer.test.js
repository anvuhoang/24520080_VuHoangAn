import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AntiDriftTimer,
  formatCountdown,
  nextMegaSaleStart,
  splitDuration,
  vietnamLocalToEpoch,
} from '../js/anti-drift-timer.js';

/**
 * A fake world: a clock the test moves, a frame scheduler it drives by hand, fake timers,
 * and a fake document for visibility changes. Nothing here reads real time.
 */
function createWorld(startMs = 1_000_000) {
  let clock = startMs;
  let nextId = 1;
  let pendingFrame = null; // { id, callback }
  const timers = new Map(); // id -> { callback, delay, firesAt }
  const listeners = new Set();
  const stats = { framesRequested: 0, framesCancelled: 0, timersSet: 0, timersCleared: 0 };

  const doc = {
    hidden: false,
    addEventListener: (type, fn) => type === 'visibilitychange' && listeners.add(fn),
    removeEventListener: (type, fn) => type === 'visibilitychange' && listeners.delete(fn),
  };

  const world = {
    stats,
    doc,
    get clock() {
      return clock;
    },
    set clock(value) {
      clock = value;
    },
    get listenerCount() {
      return listeners.size;
    },
    get hasPendingFrame() {
      return pendingFrame !== null;
    },
    get timerCount() {
      return timers.size;
    },
    /** Latest armed timer, or undefined. */
    get timer() {
      return [...timers.values()].at(-1);
    },
    options: {
      now: () => clock,
      requestFrame: (callback) => {
        stats.framesRequested++;
        pendingFrame = { id: nextId++, callback };
        return pendingFrame.id;
      },
      cancelFrame: (id) => {
        stats.framesCancelled++;
        if (pendingFrame?.id === id) pendingFrame = null;
      },
      setTimer: (callback, delay) => {
        stats.timersSet++;
        const id = nextId++;
        timers.set(id, { callback, delay, firesAt: clock + delay });
        return id;
      },
      clearTimer: (id) => {
        stats.timersCleared++;
        timers.delete(id);
      },
      visibility: doc,
    },
    /** Moves the clock by `ms`, then runs the pending frame, as a browser would. */
    frame(ms) {
      clock += ms;
      const frame = pendingFrame;
      pendingFrame = null;
      frame?.callback(clock);
      return frame !== null;
    },
    /** Runs the oldest armed timer at its due time, or at `at` if given (a late timer). */
    fireTimer(at) {
      const [id, timer] = [...timers.entries()][0];
      timers.delete(id);
      clock = at ?? Math.max(clock, timer.firesAt);
      timer.callback();
    },
    setVisible(visible) {
      doc.hidden = !visible;
      for (const fn of [...listeners]) fn();
    },
  };
  return world;
}

function track(world, extra = {}) {
  const ticks = [];
  const completions = [];
  const timer = new AntiDriftTimer({
    ...world.options,
    ...extra,
    onTick: (countdown) => ticks.push({ ...countdown }),
    onComplete: (info) => completions.push({ ...info }),
  });
  return { timer, ticks, completions };
}

describe('duration helpers', () => {
  test('splitDuration separates days, hours, minutes, seconds and milliseconds', () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds, 5 milliseconds
    assert.deepEqual(splitDuration(93_784_005), { days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5 });
    assert.deepEqual(splitDuration(0), { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
    assert.equal(splitDuration(-5).milliseconds, 0, 'negative input clamps to zero');
  });

  test('splitDuration fills a supplied object instead of allocating', () => {
    const out = {};
    assert.equal(splitDuration(1500, out), out);
    assert.equal(out.seconds, 1);
    assert.equal(out.milliseconds, 500);
  });

  test('formatCountdown pads fields and shows days only when present', () => {
    assert.equal(formatCountdown(3_723_004), '01:02:03.004');
    assert.equal(formatCountdown(3_723_004, { milliseconds: false }), '01:02:03');
    assert.equal(formatCountdown(90_061_000, { milliseconds: false }), '1d 01:01:01');
    assert.equal(formatCountdown(0), '00:00:00.000');
  });
});

describe('Vietnam mega-sale time', () => {
  test('11.11 midnight in Vietnam is 17:00 UTC on 10 November', () => {
    const start = vietnamLocalToEpoch({ year: 2025, month: 11, day: 11 });
    assert.equal(new Date(start).toISOString(), '2025-11-10T17:00:00.000Z');
  });

  test('vietnamLocalToEpoch rejects impossible fields', () => {
    assert.throws(() => vietnamLocalToEpoch({ year: 2025, month: 13, day: 1 }), RangeError);
    assert.throws(() => vietnamLocalToEpoch({ year: 2025, month: 11, day: 0 }), RangeError);
    assert.throws(() => vietnamLocalToEpoch({ year: 2025.5, month: 11, day: 11 }), RangeError);
  });

  test('nextMegaSaleStart returns the first 11.11 midnight strictly after the given moment', () => {
    const justBefore = Date.parse('2025-11-10T16:59:59.999Z');
    assert.equal(new Date(nextMegaSaleStart(justBefore)).toISOString(), '2025-11-10T17:00:00.000Z');

    const atStart = Date.parse('2025-11-10T17:00:00.000Z');
    assert.equal(new Date(nextMegaSaleStart(atStart)).toISOString(), '2026-11-10T17:00:00.000Z');
  });

  test('nextMegaSaleStart uses the Vietnam year, which can differ from the UTC year', () => {
    // 31 Dec 2025 18:00 UTC is already 1 Jan 2026 in Vietnam.
    const vietnamNewYear = Date.parse('2025-12-31T18:00:00.000Z');
    assert.equal(new Date(nextMegaSaleStart(vietnamNewYear)).toISOString(), '2026-11-10T17:00:00.000Z');
  });

  test('nextMegaSaleStart accepts another date such as 12.12', () => {
    const from = Date.parse('2025-11-20T00:00:00.000Z');
    assert.equal(new Date(nextMegaSaleStart(from, { month: 12, day: 12 })).toISOString(), '2025-12-11T17:00:00.000Z');
  });
});

describe('drift resistance', () => {
  test('every tick equals the absolute target minus the clock, however irregular the frames', () => {
    const world = createWorld();
    const target = world.clock + 600_000;
    const { timer: t, ticks } = track(world, { targetTime: target });
    t.start();

    // Frame gaps include normal frames, long-task jank and a stall, from a fixed seed.
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 5000; i++) {
      const gap = rand() < 0.05 ? 100 + Math.floor(rand() * 400) : 8 + Math.floor(rand() * 25);
      world.frame(gap);
    }

    assert.ok(ticks.length > 4000);
    for (const tick of ticks) {
      assert.equal(tick.remainingMs, target - tick.sampledAt, 'no accumulated error at any tick');
    }
    assert.equal(t.remainingMs, target - world.clock);
  });

  test('a naive fixed-step counter loses the time that jank swallows; this timer does not', () => {
    const world = createWorld();
    const target = world.clock + 10_000;
    const { timer, ticks } = track(world, { targetTime: target });
    timer.start();

    // A fixed-step counter subtracts 16 ms for each frame it sees.
    let naiveRemaining = 10_000;
    const gaps = [16, 16, 400, 16, 16, 700, 16];
    for (const gap of gaps) {
      world.frame(gap);
      naiveRemaining -= 16;
    }
    const trueRemaining = target - world.clock;
    const last = ticks.at(-1);

    assert.equal(last.remainingMs, trueRemaining);
    assert.ok(naiveRemaining - trueRemaining > 1000, `naive counter was ${naiveRemaining - trueRemaining} ms behind`);
  });

  test('ticks report how many milliseconds passed since the previous sample', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    world.frame(16);
    world.frame(250);
    assert.deepEqual(ticks.map((t) => t.sinceLastSampleMs), [0, 16, 250]);
  });
});

describe('background tab throttling', () => {
  test('a long gap with no frames is corrected by the next sample, with no catch-up ticks', () => {
    const world = createWorld();
    const target = world.clock + 10 * 60_000;
    const { timer, ticks } = track(world, { targetTime: target });
    timer.start();
    assert.equal(ticks.length, 1);

    world.frame(5 * 60_000); // the tab was hidden for five minutes, then one frame ran

    assert.equal(ticks.length, 2, 'one tick, not one per missed frame');
    assert.equal(ticks[1].remainingMs, 5 * 60_000);
    assert.equal(ticks[1].sinceLastSampleMs, 5 * 60_000);
  });

  test('becoming visible samples at once, before the next frame', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 120_000 });
    timer.start();
    world.setVisible(false);
    world.clock += 90_000; // hidden, no frames
    assert.equal(ticks.length, 1);

    world.setVisible(true);

    assert.equal(ticks.length, 2);
    assert.equal(ticks[1].remainingMs, 30_000);
  });

  test('hiding the tab does not sample or emit', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 120_000 });
    timer.start();
    world.setVisible(false);
    assert.equal(ticks.length, 1);
  });

  test('completion still fires with no frames at all, through the fallback timeout', () => {
    const world = createWorld();
    const { timer, completions } = track(world, { targetTime: world.clock + 5000 });
    timer.start();
    assert.equal(world.timer.delay, 5000, 'timeout is armed for the exact remaining time');

    world.fireTimer();

    assert.equal(completions.length, 1);
    assert.equal(completions[0].lateByMs, 0);
    assert.equal(world.hasPendingFrame, false);
    assert.equal(world.timerCount, 0);
  });

  test('a throttled timeout that fires late reports how late', () => {
    const world = createWorld();
    const target = world.clock + 5000;
    const { timer, completions } = track(world, { targetTime: target });
    timer.start();

    world.fireTimer(target + 800);

    assert.equal(completions.length, 1);
    assert.equal(completions[0].lateByMs, 800);
    assert.equal(completions[0].completedAt, target + 800);
  });

  test('a timeout that fires slightly early re-arms for the exact remainder and does not complete early', () => {
    const world = createWorld();
    const target = world.clock + 5000;
    const { timer, completions } = track(world, { targetTime: target });
    timer.start();

    world.fireTimer(target - 1);
    assert.equal(completions.length, 0);
    assert.equal(world.timer.delay, 1);

    world.fireTimer();
    assert.equal(completions.length, 1);
  });

  test('a target beyond the longest timeout is re-armed in steps', () => {
    const world = createWorld();
    const forty = 40 * 24 * 3_600_000;
    const { timer, completions } = track(world, { targetTime: world.clock + forty });
    timer.start();
    assert.equal(world.timer.delay, 2 ** 31 - 1);

    world.fireTimer();
    assert.equal(completions.length, 0);
    assert.ok(world.timer.delay < forty);
  });

  test('backgroundCompletion: false arms no timeout', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 5000, backgroundCompletion: false });
    timer.start();
    assert.equal(world.timerCount, 0);
  });
});

describe('completion', () => {
  test('emits a final zero tick and one completion, then stops asking for frames', () => {
    const world = createWorld();
    const target = world.clock + 50;
    const { timer, ticks, completions } = track(world, { targetTime: target });
    timer.start();

    world.frame(16);
    world.frame(16);
    world.frame(16);
    world.frame(16); // 64 ms in: past the target by 14

    assert.equal(ticks.at(-1).remainingMs, 0);
    assert.equal(completions.length, 1);
    assert.equal(completions[0].lateByMs, 14);
    assert.equal(world.hasPendingFrame, false);
    assert.equal(world.timerCount, 0);
    assert.equal(world.listenerCount, 0);
    assert.equal(timer.completed, true);
    assert.equal(timer.running, false);
  });

  test('a late timeout after frame-driven completion does nothing', () => {
    const world = createWorld();
    const { timer, completions } = track(world, { targetTime: world.clock + 20 });
    timer.start();
    world.frame(30);
    assert.equal(completions.length, 1);
    assert.equal(world.timerCount, 0, 'the fallback timeout was cleared');
  });

  test('a target already in the past completes during start', () => {
    const world = createWorld();
    const { timer, ticks, completions } = track(world, { targetTime: world.clock - 250 });
    timer.start();
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0].remainingMs, 0);
    assert.equal(completions.length, 1);
    assert.equal(completions[0].lateByMs, 250);
    assert.equal(world.hasPendingFrame, false);
  });

  test('start after completion does nothing until the timer is retargeted', () => {
    const world = createWorld();
    const { timer, completions } = track(world, { targetTime: world.clock + 10 });
    timer.start();
    world.frame(20);
    timer.start();
    assert.equal(world.hasPendingFrame, false);
    assert.equal(completions.length, 1);
  });

  test('retarget lets a finished timer count to a new moment, such as sale start to sale end', () => {
    const world = createWorld();
    const { timer, ticks, completions } = track(world, { targetTime: world.clock + 100 });
    timer.start();
    world.frame(150);
    assert.equal(completions.length, 1);

    timer.retarget(world.clock + 3_600_000);
    timer.start();
    world.frame(1000);

    assert.equal(timer.completed, false);
    assert.equal(ticks.at(-1).remainingMs, 3_599_000);
  });

  test('retarget on a running timer resamples at once', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.retarget(world.clock + 5_000);
    assert.equal(ticks.at(-1).remainingMs, 5_000);
    assert.equal(world.timer.delay, 5_000);
  });
});

describe('display resolution', () => {
  test('a one-second resolution emits only when the whole-second display changes', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 3500, resolutionMs: 1000 });
    timer.start();
    for (let i = 0; i < 40; i++) world.frame(100);

    const shown = ticks.map((t) => Math.ceil(t.remainingMs / 1000));
    assert.deepEqual(shown, [4, 3, 2, 1, 0]);
  });

  test('the default resolution emits on every frame whose value changed', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 10_000 });
    timer.start();
    for (let i = 0; i < 10; i++) world.frame(16);
    assert.equal(ticks.length, 11);
  });

  test('a frame that finds the same value emits nothing', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 10_000 });
    timer.start();
    world.frame(0); // same millisecond
    assert.equal(ticks.length, 1);
  });

  test('the tick object is reused, so frame-rate updates allocate nothing', () => {
    const world = createWorld();
    const seen = [];
    const timer = new AntiDriftTimer({
      ...world.options,
      targetTime: world.clock + 10_000,
      onTick: (countdown) => seen.push(countdown),
    });
    timer.start();
    world.frame(16);
    world.frame(16);
    assert.equal(seen[0], seen[1]);
    assert.equal(seen[1], seen[2]);
    assert.equal(seen[2].remainingMs, 10_000 - 32);
  });
});

describe('server calibration', () => {
  test('a device clock 5 s behind the server is corrected by the offset', () => {
    const world = createWorld();
    const serverTarget = world.clock + 5000 + 10_000; // 10 s away on the server clock
    const { timer, ticks } = track(world, { targetTime: serverTarget });
    const offset = timer.calibrate(world.clock + 5000, world.clock, world.clock);
    assert.equal(offset, 5000);

    timer.start();
    assert.equal(ticks[0].remainingMs, 10_000);
  });

  test('calibrate splits the round trip evenly', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 60_000 });
    const sent = world.clock;
    const received = world.clock + 200;
    // The server clock is 5 s ahead and stamped its reply 100 ms into the trip.
    const serverStamp = sent + 100 + 5000;
    assert.equal(timer.calibrate(serverStamp, sent, received), 5000);
  });

  test('calibrating a running timer resamples and re-arms the timeout', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.setOffset(10_000);
    assert.equal(ticks.at(-1).remainingMs, 50_000);
    assert.equal(world.timer.delay, 50_000);
  });

  test('calibrate rejects a response that arrived before the request was sent', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 1000 });
    assert.throws(() => timer.calibrate(0, 100, 50), RangeError);
  });
});

describe('lifecycle and memory', () => {
  test('start registers one visibility listener, and stop releases frame, timeout and listener', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    assert.equal(world.listenerCount, 1);
    assert.equal(world.hasPendingFrame, true);
    assert.equal(world.timerCount, 1);

    timer.stop();

    assert.equal(world.listenerCount, 0);
    assert.equal(world.hasPendingFrame, false);
    assert.equal(world.timerCount, 0);
    assert.equal(timer.running, false);
  });

  test('start twice does not double-register', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.start();
    assert.equal(world.listenerCount, 1);
    assert.equal(world.stats.framesRequested, 1);
  });

  test('stop then start resumes with the correct remaining time', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.stop();
    world.clock += 20_000;
    timer.start();
    assert.equal(ticks.at(-1).remainingMs, 40_000);
  });

  test('dispose releases everything, is idempotent, and rejects further use', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.dispose();
    timer.dispose();

    assert.equal(world.listenerCount, 0);
    assert.equal(world.hasPendingFrame, false);
    assert.equal(world.timerCount, 0);
    assert.throws(() => timer.start(), /disposed/);
    assert.throws(() => timer.retarget(1), /disposed/);
    assert.throws(() => timer.setOffset(1), /disposed/);
  });

  test('a stale frame callback after stop does not tick or reschedule', () => {
    const world = createWorld();
    const { timer, ticks } = track(world, { targetTime: world.clock + 60_000 });
    timer.start();
    timer.stop();
    const before = ticks.length;
    world.frame(100);
    assert.equal(ticks.length, before);
    assert.equal(world.hasPendingFrame, false);
  });

  test('a handler that restarts the timer during start does not create a second frame loop', () => {
    // The target has already passed, so the first sample completes the timer inside start().
    // The handler points it at a new target and starts it again before the outer start() returns.
    const world = createWorld();
    let timer;
    timer = new AntiDriftTimer({
      ...world.options,
      targetTime: world.clock - 10,
      onComplete: () => {
        timer.retarget(world.clock + 10_000);
        timer.start();
      },
    });

    timer.start();

    assert.equal(world.stats.framesRequested, 1, 'one frame loop, not two');
    assert.equal(timer.running, true);
    timer.dispose();
  });

  test('a throwing onTick does not end the frame loop', () => {
    const world = createWorld();
    let calls = 0;
    const timer = new AntiDriftTimer({
      ...world.options,
      targetTime: world.clock + 60_000,
      onTick: () => {
        calls++;
        if (calls === 2) throw new Error('render failed');
      },
    });
    timer.start();
    assert.throws(() => world.frame(16), /render failed/);
    assert.equal(world.hasPendingFrame, true, 'the next frame was already scheduled');
    world.frame(16);
    assert.equal(calls, 3);
  });

  test('works without a visibility source', () => {
    const world = createWorld();
    const { timer } = track(world, { targetTime: world.clock + 1000, visibility: null });
    timer.start();
    timer.stop();
    assert.equal(world.listenerCount, 0);
  });
});

describe('validation', () => {
  test('rejects a target that is not a finite number', () => {
    const world = createWorld();
    for (const targetTime of [Number.NaN, Infinity, '2025-11-11', undefined, null]) {
      assert.throws(() => new AntiDriftTimer({ ...world.options, targetTime }), RangeError);
    }
  });

  test('rejects a resolution below one millisecond and a non-finite offset', () => {
    const world = createWorld();
    const base = { ...world.options, targetTime: world.clock + 1000 };
    assert.throws(() => new AntiDriftTimer({ ...base, resolutionMs: 0 }), RangeError);
    assert.throws(() => new AntiDriftTimer({ ...base, resolutionMs: 0.5 }), RangeError);
    assert.throws(() => new AntiDriftTimer({ ...base, offsetMs: Number.NaN }), RangeError);
  });

  test('reports a clear error when requestAnimationFrame is missing and none is injected', () => {
    const world = createWorld();
    const timer = new AntiDriftTimer({
      now: world.options.now,
      setTimer: world.options.setTimer,
      clearTimer: world.options.clearTimer,
      visibility: null,
      targetTime: world.clock + 1000,
    });
    assert.throws(() => timer.start(), /requestAnimationFrame is not available/);
  });
});
