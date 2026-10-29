import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SpectrumVisualizer } from '../js/spectrum-visualizer.js';

/** Records every 2D context call the visualizer makes, plus fillStyle writes. */
function fakeCanvas() {
  const calls = {};
  const rects = [];
  let fillStyleWrites = 0;
  let widthWrites = 0;
  let heightWrites = 0;
  let transform = null;
  const count = (name) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const ctx = {
    clearRect: () => count('clearRect'),
    beginPath: () => count('beginPath'),
    fill: () => count('fill'),
    rect: (x, y, w, h) => {
      count('rect');
      rects.push([x, y, w, h]);
    },
    setTransform: (...args) => {
      count('setTransform');
      transform = args;
    },
    createLinearGradient: () => {
      count('createLinearGradient');
      return { addColorStop: () => {} };
    },
    set fillStyle(_value) {
      fillStyleWrites++;
    },
  };
  const canvas = {
    _width: 0,
    _height: 0,
    get width() {
      return this._width;
    },
    set width(value) {
      widthWrites++;
      this._width = value;
    },
    get height() {
      return this._height;
    },
    set height(value) {
      heightWrites++;
      this._height = value;
    },
    getContext: () => ctx,
  };
  return {
    canvas: canvas,
    raw: canvas,
    calls,
    rects,
    transform: () => transform,
    fillStyleWrites: () => fillStyleWrites,
    widthWrites: () => widthWrites,
    heightWrites: () => heightWrites,
    snapshot: () => ({ ...calls, fillStyle: fillStyleWrites }),
  };
}

/** Frame scheduler the test advances by hand. Only one callback can be pending, as in a browser. */
function manualScheduler() {
  let pending = null;
  let cancels = 0;
  let nextId = 0;
  return {
    request(callback) {
      pending = callback;
      return ++nextId;
    },
    cancel() {
      cancels++;
      pending = null;
    },
    flush(timestamp) {
      const callback = pending;
      pending = null;
      callback?.(timestamp);
      return callback !== null;
    },
    get hasPending() {
      return pending !== null;
    },
    get cancels() {
      return cancels;
    },
  };
}

function fakeSource(binCount = 128) {
  const data = new Uint8Array(binCount);
  return { data, getFrequencyData: () => data };
}

function setup(options = {}) {
  const canvas = fakeCanvas();
  const source = fakeSource(options.bins ?? 128);
  const scheduler = manualScheduler();
  const visualizer = new SpectrumVisualizer({
    canvas: canvas.canvas,
    source,
    barCount: options.barCount,
    targetFps: options.targetFps,
    smoothing: options.smoothing,
    reducedMotion: options.reducedMotion,
    scheduler,
    observeResize: false,
  });
  return { canvas, source, scheduler, visualizer };
}

describe('configuration', () => {
  test('rejects invalid bar counts and smoothing values', () => {
    assert.throws(() => setup({ barCount: 0 }), RangeError);
    assert.throws(() => setup({ smoothing: 1 }), RangeError);
    assert.throws(() => setup({ smoothing: -0.1 }), RangeError);
  });

  test('reduced motion caps the frame rate at 15 fps and disables smoothing', () => {
    const { visualizer, scheduler, source } = setup({ reducedMotion: true });
    visualizer.resize(300, 150, 1);
    source.data.fill(255);
    visualizer.start();
    scheduler.flush(0);
    // 15 fps interval is about 66.7 ms. A frame 20 ms later must be throttled.
    scheduler.flush(20);
    assert.equal(visualizer.stats.framesThrottled, 1);
    // With smoothing off, one frame at full scale reaches full height at once.
    assert.equal(visualizer.stats.framesDrawn, 1);
    visualizer.dispose();
  });
});

describe('frame pacing', () => {
  test('caps 120 Hz rAF timestamps at 60 fps by dropping early frames before any work', () => {
    const { visualizer, scheduler, source } = setup({ targetFps: 60 });
    visualizer.resize(300, 150, 1);
    visualizer.start();
    const frameMs = 1000 / 120;
    for (let k = 0; k < 120; k++) {
      // Change the spectrum every frame so skipped-for-no-change cannot hide a throttle.
      source.data.fill(k % 2 === 0 ? 200 : 40);
      scheduler.flush(k * frameMs);
    }
    const stats = visualizer.stats;
    const processed = stats.framesDrawn + stats.framesSkipped;
    assert.ok(processed >= 59 && processed <= 61, `processed ${processed} frames in 1 s at 120 Hz`);
    assert.ok(stats.framesThrottled >= 59 && stats.framesThrottled <= 61);
    visualizer.dispose();
  });

  test('a 60 Hz display is never throttled by its own timestamp jitter', () => {
    const { visualizer, scheduler, source } = setup({ targetFps: 60 });
    visualizer.resize(300, 150, 1);
    visualizer.start();
    for (let k = 0; k < 60; k++) {
      source.data.fill(k % 2 === 0 ? 200 : 40);
      scheduler.flush(k * (1000 / 60) - 0.9);
    }
    assert.equal(visualizer.stats.framesThrottled, 0);
    visualizer.dispose();
  });
});

describe('redraw avoidance', () => {
  test('an unchanged spectrum after the first frame is skipped and never redrawn', () => {
    const { visualizer, scheduler, canvas } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    scheduler.flush(0);
    assert.equal(visualizer.stats.framesDrawn, 1);
    const before = canvas.snapshot();

    for (let k = 1; k <= 30; k++) scheduler.flush(k * 20);

    assert.equal(visualizer.stats.framesDrawn, 1);
    assert.equal(visualizer.stats.framesSkipped, 30);
    assert.deepEqual(canvas.snapshot(), before, 'no context call may happen on skipped frames');
    visualizer.dispose();
  });

  test('a decaying spectrum redraws until the integer heights settle, then stops', () => {
    const { visualizer, scheduler, source } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    let t = 0;
    for (let k = 0; k < 10; k++, t += 20) {
      source.data.fill(255);
      scheduler.flush(t);
    }
    for (let k = 0; k < 200; k++, t += 20) {
      source.data.fill(0);
      scheduler.flush(t);
    }
    const settledDraws = visualizer.stats.framesDrawn;
    for (let k = 0; k < 50; k++, t += 20) {
      source.data.fill(0);
      scheduler.flush(t);
    }
    assert.equal(visualizer.stats.framesDrawn, settledDraws, 'silence must reach a steady state');
    visualizer.dispose();
  });
});

describe('batching', () => {
  test('a draw is one beginPath, one fill, one rect per bar, and at most one fillStyle write', () => {
    const { visualizer, scheduler, source, canvas } = setup({ barCount: 64 });
    visualizer.resize(300, 150, 1);
    visualizer.start();
    scheduler.flush(0); // applies the resize and draws the first frame
    source.data.fill(180);
    const before = canvas.snapshot();
    scheduler.flush(20);
    const after = canvas.snapshot();

    const delta = (key) => (after[key] ?? 0) - (before[key] ?? 0);
    assert.equal(delta('beginPath'), 1);
    assert.equal(delta('fill'), 1);
    assert.equal(delta('rect'), 64);
    assert.equal(delta('fillStyle'), 1, 'gradient set once per draw');
    assert.equal(delta('createLinearGradient'), 0, 'gradient is cached, not rebuilt per frame');
    visualizer.dispose();
  });

  test('bins map to bars on a log scale, and a single bin lights exactly one bar', () => {
    const { visualizer, scheduler, source, canvas } = setup({ barCount: 64, bins: 128 });
    visualizer.resize(300, 150, 1);
    visualizer.start();
    source.data[100] = 255;
    scheduler.flush(0);
    const lit = canvas.rects.filter(([, y, , h]) => h > 0 && y < 150);
    assert.equal(lit.length, 1);
    visualizer.dispose();
  });
});

describe('resize and DOM writes', () => {
  test('a resize is applied at the next frame, not when reported', () => {
    const { visualizer, scheduler, canvas } = setup();
    visualizer.resize(300, 150, 2);
    assert.equal(canvas.widthWrites(), 0, 'no canvas write outside the frame loop');
    visualizer.start();
    scheduler.flush(0);
    assert.equal(canvas.raw.width, 600);
    assert.equal(canvas.raw.height, 300);
    assert.deepEqual(canvas.transform(), [2, 0, 0, 2, 0, 0]);
    visualizer.dispose();
  });

  test('an unchanged size does not reassign the backing store, which would clear the context', () => {
    const { visualizer, scheduler, canvas } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    scheduler.flush(0);
    const widthBefore = canvas.widthWrites();
    const heightBefore = canvas.heightWrites();

    visualizer.resize(300, 150, 1);
    scheduler.flush(20);

    assert.equal(canvas.widthWrites(), widthBefore);
    assert.equal(canvas.heightWrites(), heightBefore);
    visualizer.dispose();
  });

  test('a size change reported and reverted before the next frame causes no canvas write', () => {
    const { visualizer, scheduler, canvas } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    scheduler.flush(0);
    const widthBefore = canvas.widthWrites();

    visualizer.resize(500, 200, 1);
    visualizer.resize(300, 150, 1);
    scheduler.flush(20);

    assert.equal(canvas.widthWrites(), widthBefore);
    visualizer.dispose();
  });
});

describe('start, stop and dispose', () => {
  test('stop cancels the pending frame and nothing draws until start again', () => {
    const { visualizer, scheduler, source } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    scheduler.flush(0);
    visualizer.stop();
    assert.equal(scheduler.cancels, 1);
    assert.equal(scheduler.hasPending, false);

    source.data.fill(200);
    const drawn = visualizer.stats.framesDrawn;
    assert.equal(scheduler.flush(20), false, 'no frame may be scheduled after stop');
    assert.equal(visualizer.stats.framesDrawn, drawn);

    visualizer.start();
    assert.equal(scheduler.hasPending, true);
    visualizer.dispose();
  });

  test('dispose cancels the loop, is idempotent, and rejects further start', () => {
    const { visualizer, scheduler } = setup();
    visualizer.resize(300, 150, 1);
    visualizer.start();
    visualizer.dispose();
    visualizer.dispose();
    assert.equal(visualizer.running, false);
    assert.equal(scheduler.hasPending, false);
    assert.throws(() => visualizer.start(), /disposed/);
  });

  test('a resize after dispose is ignored', () => {
    const { visualizer, scheduler, canvas } = setup();
    visualizer.dispose();
    visualizer.resize(300, 150, 1);
    assert.equal(canvas.widthWrites(), 0);
    assert.equal(scheduler.hasPending, false);
  });
});
