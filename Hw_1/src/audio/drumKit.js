// src/audio/drumKit.js

// Exponential ramps cannot reach 0, so every envelope starts and ends at this floor
const SILENCE = 0.0001;
const ATTACK = 0.004;
const MASTER_GAIN = 0.8;

// peak is the voice's loudest gain (0..1); duration is the decay time in seconds
const VOICES = {
  kick: { peak: 1, layers: [{ kind: 'tone', type: 'sine', from: 150, to: 40, duration: 0.35 }] },
  snare: {
    peak: 0.75,
    layers: [
      { kind: 'noise', filter: 'highpass', cutoff: 1000, duration: 0.18 },
      { kind: 'tone', type: 'triangle', from: 180, to: 150, duration: 0.12, level: 0.6 },
    ],
  },
  hatClosed: { peak: 0.4, layers: [{ kind: 'noise', filter: 'highpass', cutoff: 7000, duration: 0.05 }] },
  hatOpen: { peak: 0.35, layers: [{ kind: 'noise', filter: 'highpass', cutoff: 7000, duration: 0.3 }] },
  tomHigh: { peak: 0.8, layers: [{ kind: 'tone', type: 'sine', from: 220, to: 110, duration: 0.3 }] },
  tomLow: { peak: 0.85, layers: [{ kind: 'tone', type: 'sine', from: 140, to: 70, duration: 0.4 }] },
  crash: { peak: 0.5, layers: [{ kind: 'noise', filter: 'highpass', cutoff: 5000, duration: 0.9 }] },
};

export function createDrumKit() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let disposed = false;

  // Created on the first play, which runs inside a user gesture (browser autoplay rules)
  function getContext() {
    if (disposed) return null;

    if (!context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;

      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(context.destination);
    }

    if (context.state === 'suspended') {
      // Resolves once the browser allows audio; a rejection here has nothing useful to report
      context.resume().catch(() => {});
    }

    return context;
  }

  function getNoiseBuffer(ctx) {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // Fade in from silence and back to silence, so the waveform never jumps (no click or pop)
  function applyEnvelope(param, start, peak, duration) {
    param.setValueAtTime(SILENCE, start);
    param.exponentialRampToValueAtTime(peak, start + ATTACK);
    param.exponentialRampToValueAtTime(SILENCE, start + ATTACK + duration);
  }

  function startLayer(ctx, layer, voicePeak, start) {
    const level = voicePeak * (layer.level ?? 1);
    const end = start + ATTACK + layer.duration;
    const gain = ctx.createGain();
    applyEnvelope(gain.gain, start, level, layer.duration);
    gain.connect(master);

    let source;
    const chain = [gain];

    if (layer.kind === 'tone') {
      source = ctx.createOscillator();
      source.type = layer.type;
      source.frequency.setValueAtTime(layer.from, start);
      source.frequency.exponentialRampToValueAtTime(layer.to, end);
      source.connect(gain);
    } else {
      source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.frequency.value = layer.cutoff;
      source.connect(filter);
      filter.connect(gain);
      chain.push(filter);
    }

    // Each voice disconnects its own nodes once it has finished playing
    source.onended = () => {
      source.disconnect();
      for (const node of chain) node.disconnect();
    };

    source.start(start);
    source.stop(end + 0.02);
  }

  function play(padId) {
    const voice = Object.hasOwn(VOICES, padId) ? VOICES[padId] : null;
    if (!voice) return 0;

    const ctx = getContext();
    if (!ctx) return 0;

    const start = ctx.currentTime;
    for (const layer of voice.layers) startLayer(ctx, layer, voice.peak, start);

    return voice.peak;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    if (context && context.state !== 'closed') {
      context.close().catch(() => {});
    }

    context = null;
    master = null;
    noiseBuffer = null;
  }

  return { play, dispose };
}
