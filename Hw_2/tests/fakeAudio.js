// tests/fakeAudio.js — a small fake of the Web Audio API for the tests (not a test file itself)
import { vi } from 'vitest';

export class FakeParam {
  constructor(value = 1) {
    this.value = value;
    this.setCalls = [];
    this.rampCalls = [];
    this.cancelScheduledValues = vi.fn();
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
  // the frequency this oscillator was told to play
  get playedHz() {
    return this.frequency.setCalls[0]?.[0];
  }
}

// Installs a fake `AudioContext` and returns what it creates, so tests can inspect it
export function installFakeAudio() {
  const contexts = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = new FakeNode();
      this.gains = [];
      this.oscillators = [];
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
    createDynamicsCompressor() {
      return new FakeNode();
    }
    createOscillator() {
      const node = new FakeOscillator();
      this.oscillators.push(node);
      return node;
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  window.AudioContext = FakeAudioContext;

  return {
    contexts,
    oscillators: () => contexts.flatMap((context) => context.oscillators),
  };
}
