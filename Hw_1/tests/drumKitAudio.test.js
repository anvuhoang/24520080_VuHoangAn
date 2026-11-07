// tests/drumKitAudio.test.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PADS } from '../src/data/pads.js';
import { createDrumKit } from '../src/audio/drumKit.js';

// A tiny fake of the Web Audio API: it records what the kit builds and lets the tests inspect it
class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.setCalls = [];
    this.rampCalls = [];
  }
  setValueAtTime(value, time) {
    this.setCalls.push([value, time]);
  }
  exponentialRampToValueAtTime(value, time) {
    this.rampCalls.push([value, time]);
  }
}

class FakeNode {
  constructor() {
    this.connect = vi.fn((node) => node);
    this.disconnect = vi.fn();
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeParam(1);
  }
}

class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new FakeParam(440);
    this.start = vi.fn();
    this.stop = vi.fn();
    this.onended = null;
  }
}

class FakeBufferSource extends FakeNode {
  constructor() {
    super();
    this.buffer = null;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.onended = null;
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = { value: 350 };
  }
}

let contexts = [];

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = new FakeNode();
    this.gains = [];
    this.oscillators = [];
    this.bufferSources = [];
    this.resume = vi.fn(() => {
      this.state = 'running';
      return Promise.resolve();
    });
    this.close = vi.fn(() => {
      this.state = 'closed';
      return Promise.resolve();
    });
    contexts.push(this);
  }
  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  }
  createBufferSource() {
    const node = new FakeBufferSource();
    this.bufferSources.push(node);
    return node;
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

beforeEach(() => {
  contexts = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  window.AudioContext = FakeAudioContext;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDrumKit', () => {
  it('creates no audio context until the first play (browser autoplay rules)', () => {
    createDrumKit();
    expect(contexts).toHaveLength(0);
  });

  it('creates one context on the first play, resumes it, and reuses it afterwards', () => {
    const kit = createDrumKit();

    kit.play('kick');
    kit.play('snare');

    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalled();
    expect(contexts[0].state).toBe('running');
  });

  it('returns 0 for an unknown pad id and creates nothing', () => {
    const kit = createDrumKit();

    for (const id of ['cowbell', '', undefined, null, 'constructor', '__proto__', 'toString']) {
      expect(kit.play(id)).toBe(0);
    }
    expect(contexts).toHaveLength(0);
  });

  it.each(PADS.map((pad) => [pad.id]))('plays the %s voice and reports a level between 0 and 1', (id) => {
    const kit = createDrumKit();

    const level = kit.play(id);

    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(1);
    const ctx = contexts[0];
    const sources = [...ctx.oscillators, ...ctx.bufferSources];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.start).toHaveBeenCalledTimes(1);
      expect(source.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('fades every voice in from silence and back out, never to exactly 0 (no click or pop)', () => {
    const kit = createDrumKit();
    for (const pad of PADS) kit.play(pad.id);

    const voiceGains = contexts[0].gains.slice(1); // the first gain is the master output
    expect(voiceGains.length).toBeGreaterThan(0);
    for (const gain of voiceGains) {
      const [startValue] = gain.gain.setCalls[0];
      expect(startValue).toBeGreaterThan(0);
      expect(startValue).toBeLessThan(0.001);
      for (const [target] of gain.gain.rampCalls) expect(target).toBeGreaterThan(0);
      const lastRamp = gain.gain.rampCalls.at(-1)[0];
      expect(lastRamp).toBeLessThan(0.001);
    }
    // pitch sweeps must not target 0 either (an exponential ramp to 0 is invalid)
    for (const osc of contexts[0].oscillators) {
      for (const [target] of osc.frequency.rampCalls) expect(target).toBeGreaterThan(0);
    }
  });

  it('lets each voice disconnect its own nodes once it has finished', () => {
    const kit = createDrumKit();
    kit.play('snare');

    const sources = [...contexts[0].oscillators, ...contexts[0].bufferSources];
    for (const source of sources) {
      expect(source.onended).toBeTypeOf('function');
      source.onended();
      expect(source.disconnect).toHaveBeenCalled();
    }
  });

  it('closes the audio context on dispose, and disposing twice is safe', () => {
    const kit = createDrumKit();
    kit.play('kick');

    expect(() => {
      kit.dispose();
      kit.dispose();
    }).not.toThrow();

    expect(contexts[0].close).toHaveBeenCalledTimes(1);
  });

  it('does nothing after dispose, and does not open a new context', () => {
    const kit = createDrumKit();
    kit.dispose();

    expect(kit.play('kick')).toBe(0);
    expect(contexts).toHaveLength(0);
  });

  it('does not create a context when disposed before the first play', () => {
    const kit = createDrumKit();
    expect(() => kit.dispose()).not.toThrow();
    expect(contexts).toHaveLength(0);
  });

  it('does not log anything to the console', () => {
    const spies = ['log', 'info', 'warn', 'error'].map((method) => vi.spyOn(console, method));
    const kit = createDrumKit();
    for (const pad of PADS) kit.play(pad.id);
    kit.play('cowbell');
    kit.dispose();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  // Audit #04: play() returns the voice's nominal peak (kick 1.0) but the output goes through a
  // master gain of 0.8 first, so the real level is lower and the UI meter reads too high.
  // Change `it.fails` to `it` once play() reports the level that is actually produced.
  it.fails('reports the level that is actually produced, master gain included (known defect)', () => {
    const kit = createDrumKit();

    const level = kit.play('kick');

    expect(level).toBeCloseTo(0.8, 1);
  });
});
