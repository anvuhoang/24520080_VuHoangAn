import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/audio-engine.js';

/**
 * Minimal Web Audio double. Records listeners, connections and closes so
 * lifecycle tests can assert on what the engine released.
 */
function createFakeContext() {
  const listeners = new Map();
  const sources = [];
  const analysers = [];
  const ctx = {
    state: 'suspended',
    destination: { name: 'destination' },
    closeCalls: 0,
    resumeCalls: 0,
    sources,
    analysers,
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn({ type, target: ctx });
    },
    createAnalyser() {
      const analyser = {
        fftSize: 2048,
        smoothingTimeConstant: 0,
        frequencyBinCount: 0,
        disconnected: false,
        connectedTo: null,
        connect(node) {
          this.connectedTo = node;
        },
        disconnect() {
          this.disconnected = true;
        },
        getByteFrequencyData(target) {
          for (let i = 0; i < target.length; i++) target[i] = i % 256;
        },
      };
      Object.defineProperty(analyser, 'frequencyBinCount', {
        get() {
          return this.fftSize / 2;
        },
      });
      analysers.push(analyser);
      return analyser;
    },
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null,
        started: false,
        stopped: false,
        disconnected: false,
        connectedTo: null,
        connect(node) {
          this.connectedTo = node;
        },
        disconnect() {
          this.disconnected = true;
        },
        start() {
          if (this.started) throw new Error('InvalidStateError: already started');
          this.started = true;
        },
        stop() {
          this.stopped = true;
          // Browsers fire `ended` asynchronously after stop(); mirror that.
          queueMicrotask(() => this.onended?.({ target: this }));
        },
        end() {
          this.onended?.({ target: this });
        },
      };
      sources.push(source);
      return source;
    },
    resume() {
      this.resumeCalls++;
      this.state = 'running';
      return Promise.resolve();
    },
    close() {
      this.closeCalls++;
      this.state = 'closed';
      return Promise.resolve();
    },
  };
  return ctx;
}

function createEngine(options = {}) {
  const ctx = createFakeContext();
  const engine = new AudioEngine({ createContext: () => ctx, ...options });
  return { engine, ctx };
}

const fakeBuffer = () => ({ duration: 1 });

describe('AudioEngine construction', () => {
  test('uses 512 FFT by default, giving 256 bins', () => {
    const { engine, ctx } = createEngine();
    assert.equal(ctx.analysers[0].fftSize, 512);
    assert.equal(engine.binCount, 256);
  });

  test('accepts 256 FFT, giving 128 bins', () => {
    const { engine, ctx } = createEngine({ fftSize: 256 });
    assert.equal(ctx.analysers[0].fftSize, 256);
    assert.equal(engine.binCount, 128);
  });

  test('rejects any other FFT size before creating a context', () => {
    let created = false;
    for (const bad of [0, 128, 1024, 2048, '512', null]) {
      assert.throws(
        () =>
          new AudioEngine({
            fftSize: bad,
            createContext: () => {
              created = true;
              return createFakeContext();
            },
          }),
        RangeError,
      );
    }
    assert.equal(created, false);
  });

  test('connects analyser to destination and registers one statechange listener', () => {
    const { ctx } = createEngine();
    assert.equal(ctx.analysers[0].connectedTo, ctx.destination);
    assert.equal(ctx.listenerCount(), 1);
  });

  test('reports suspended until resume() is called from a gesture', async () => {
    const { engine, ctx } = createEngine();
    assert.equal(engine.state, 'suspended');
    await engine.resume();
    assert.equal(ctx.resumeCalls, 1);
    assert.equal(engine.state, 'running');
  });

  test('forwards statechange events to onStateChange', () => {
    const seen = [];
    const { ctx } = createEngine({ onStateChange: (s) => seen.push(s) });
    ctx.state = 'running';
    ctx.emit('statechange');
    assert.deepEqual(seen, ['running']);
  });
});

describe('frequency analysis', () => {
  test('returns the same preallocated Uint8Array on every call', () => {
    const { engine } = createEngine();
    const first = engine.getFrequencyData();
    const second = engine.getFrequencyData();
    assert.ok(first instanceof Uint8Array);
    assert.equal(first, second);
    assert.equal(first.length, 256);
    assert.equal(first[10], 10);
  });

  test('frequency buffer length tracks the FFT size', () => {
    const { engine } = createEngine({ fftSize: 256 });
    assert.equal(engine.getFrequencyData().length, 128);
  });
});

describe('playback', () => {
  test('connects the source through the analyser and starts it', () => {
    const { engine, ctx } = createEngine();
    engine.play(fakeBuffer());
    const [source] = ctx.sources;
    assert.equal(source.connectedTo, ctx.analysers[0]);
    assert.equal(source.started, true);
  });

  test('resolves "ended" on natural end and releases the source', async () => {
    const { engine, ctx } = createEngine();
    const buffer = fakeBuffer();
    const playback = engine.play(buffer);
    const [source] = ctx.sources;

    source.end();
    assert.equal(await playback, 'ended');
    assert.equal(source.onended, null);
    assert.equal(source.disconnected, true);
    assert.equal(source.buffer, null);
  });

  test('starting a new track stops the previous one and resolves it "stopped"', async () => {
    const { engine, ctx } = createEngine();
    const first = engine.play(fakeBuffer());
    const [firstSource] = ctx.sources;

    const second = engine.play(fakeBuffer());
    assert.equal(await first, 'stopped');
    assert.equal(firstSource.stopped, true);
    assert.equal(firstSource.disconnected, true);
    assert.equal(firstSource.buffer, null);

    // The stale ended event from the first source must not settle the second.
    await new Promise((r) => setImmediate(r));
    ctx.sources[1].end();
    assert.equal(await second, 'ended');
  });

  test('stop() when idle is a no-op', () => {
    const { engine } = createEngine();
    assert.doesNotThrow(() => engine.stop());
  });

  test('stop() during playback resolves "stopped" and clears the source', async () => {
    const { engine, ctx } = createEngine();
    const playback = engine.play(fakeBuffer());
    engine.stop();
    assert.equal(await playback, 'stopped');
    assert.equal(ctx.sources[0].disconnected, true);
    assert.equal(ctx.sources[0].buffer, null);
  });

  test('a rejected start leaves no source or pending promise behind', () => {
    const { engine, ctx } = createEngine();
    const original = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => {
      const source = original();
      source.start = () => {
        throw new Error('start failed');
      };
      return source;
    };
    assert.throws(() => engine.play(fakeBuffer()), /start failed/);
    assert.equal(ctx.sources[0].disconnected, true);
    assert.equal(ctx.sources[0].onended, null);
    // Engine is still usable: no stale active source blocks the next play.
    ctx.createBufferSource = original;
    assert.doesNotThrow(() => engine.play(fakeBuffer()));
  });
});

describe('dispose and lifecycle', () => {
  test('closes the context, disconnects the analyser, and removes the listener', async () => {
    const { engine, ctx } = createEngine();
    await engine.dispose();
    assert.equal(ctx.closeCalls, 1);
    assert.equal(ctx.analysers[0].disconnected, true);
    assert.equal(ctx.listenerCount(), 0);
    assert.equal(engine.state, 'disposed');
  });

  test('releases any active source during dispose', async () => {
    const { engine, ctx } = createEngine();
    const playback = engine.play(fakeBuffer());
    await engine.dispose();
    assert.equal(await playback, 'stopped');
    assert.equal(ctx.sources[0].disconnected, true);
    assert.equal(ctx.sources[0].buffer, null);
  });

  test('is idempotent', async () => {
    const { engine, ctx } = createEngine();
    await engine.dispose();
    await engine.dispose();
    assert.equal(ctx.closeCalls, 1);
  });

  test('concurrent dispose calls close the context once', async () => {
    const { engine, ctx } = createEngine();
    await Promise.all([engine.dispose(), engine.dispose(), engine.dispose()]);
    assert.equal(ctx.closeCalls, 1);
  });

  test('public methods throw after dispose', async () => {
    const { engine } = createEngine();
    await engine.dispose();
    assert.throws(() => engine.getFrequencyData(), /disposed/);
    assert.throws(() => engine.play(fakeBuffer()), /disposed/);
    await assert.rejects(engine.resume(), /disposed/);
    await assert.rejects(engine.decode(new ArrayBuffer(8)), /disposed/);
  });

  test('a statechange emitted after dispose does not reach the callback', async () => {
    const seen = [];
    const { engine, ctx } = createEngine({ onStateChange: (s) => seen.push(s) });
    await engine.dispose();
    ctx.emit('statechange');
    assert.deepEqual(seen, []);
  });

  test('repeated create-play-dispose cycles leave no listeners or live sources', async () => {
    for (let i = 0; i < 50; i++) {
      const { engine, ctx } = createEngine();
      await engine.resume();
      engine.play(fakeBuffer());
      engine.play(fakeBuffer());
      await engine.dispose();
      assert.equal(ctx.listenerCount(), 0);
      assert.equal(ctx.closeCalls, 1);
      for (const source of ctx.sources) {
        assert.equal(source.onended, null);
        assert.equal(source.buffer, null);
        assert.equal(source.disconnected, true);
      }
    }
  });
});
