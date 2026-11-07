// src/audio/polyphonicSynth.js

// Exponential ramps cannot reach 0, so every envelope starts and ends at this floor
const SILENCE = 0.0001;
const VOICE_PEAK = 0.3;
const SUSTAIN_LEVEL = 0.18;
const ATTACK_S = 0.01;
const DECAY_S = 0.4;
const RELEASE_S = 0.04;
const MASTER_GAIN = 0.8;

export function createPolyphonicSynth({ maxVoices = 8 } = {}) {
  const limit = Number.isInteger(maxVoices) && maxVoices > 0 ? maxVoices : 8;

  // A Map keeps insertion order, so its first key is always the oldest voice (FIFO) in O(1)
  const voices = new Map();
  let context = null;
  let master = null; // every voice connects here
  let disposed = false;

  // Created on the first note, which runs inside a user gesture (browser autoplay rules)
  function getContext() {
    if (disposed) return null;

    if (!context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;

      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = MASTER_GAIN;
      // The compressor keeps a full chord of 8 voices from clipping
      const compressor = context.createDynamicsCompressor();
      master.connect(compressor);
      compressor.connect(context.destination);
    }

    if (context.state === 'suspended') {
      // Resolves once the browser allows audio; a rejection has nothing useful to report
      context.resume().catch(() => {});
    }

    return context;
  }

  // Fade the voice to silence and stop it afterwards, so the waveform never jumps
  function release(voice) {
    const now = context.currentTime;
    const current = Math.max(voice.gain.gain.value, SILENCE);

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(current, now);
    voice.gain.gain.exponentialRampToValueAtTime(SILENCE, now + RELEASE_S);
    voice.oscillator.stop(now + RELEASE_S + 0.01);
  }

  function noteOn(midi, freqHz) {
    if (!Number.isFinite(midi) || !Number.isFinite(freqHz) || freqHz <= 0) return;
    if (voices.has(midi)) return; // already sounding: no second voice

    const ctx = getContext();
    if (!ctx) return;

    if (voices.size >= limit) {
      const oldestMidi = voices.keys().next().value;
      release(voices.get(oldestMidi));
      voices.delete(oldestMidi);
    }

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freqHz, now);

    gain.gain.setValueAtTime(SILENCE, now);
    gain.gain.exponentialRampToValueAtTime(VOICE_PEAK, now + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SUSTAIN_LEVEL, now + ATTACK_S + DECAY_S);

    oscillator.connect(gain);
    gain.connect(master);

    // The voice disconnects its own nodes once it has finished playing
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };

    oscillator.start(now);
    voices.set(midi, { oscillator, gain });
  }

  function noteOff(midi) {
    const voice = voices.get(midi);
    if (!voice) return;

    release(voice);
    voices.delete(midi);
  }

  function stopAll() {
    for (const voice of voices.values()) release(voice);
    voices.clear();
  }

  function dispose() {
    if (disposed) return;

    if (context && context.state !== 'closed') {
      stopAll();
      context.close().catch(() => {});
    }

    disposed = true;
    voices.clear();
    context = null;
    master = null;
  }

  return {
    noteOn,
    noteOff,
    stopAll,
    dispose,
    get activeCount() {
      return voices.size;
    },
  };
}
