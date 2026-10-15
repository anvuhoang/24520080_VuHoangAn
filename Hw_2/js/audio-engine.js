/**
 * HW2: Independent Polyphonic Audio Engine
 *
 * Requirements met:
 * 1. Reads sound identifiers from the HTML data-sound contract.
 * 2. Independent reusable module without DOM/keyboard/recorder coupling.
 * 3. Polyphonic playback supporting overlapping hits & rapid repeated triggers.
 * 4. Safe error handling for missing/unreachable audio files with DSP synthesis fallback.
 * 5. Exposes playSound(soundId).
 */

export class AudioEngine {
  /**
   * Reads unique sound identifiers from DOM elements implementing the data-sound contract.
   * @param {ParentNode} [root=document] - Root container or document to scan.
   * @returns {string[]} Array of unique sound IDs found in data-sound attributes.
   */
  static extractSoundIds(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return [];
    }
    const elements = root.querySelectorAll('[data-sound]');
    const soundIds = new Set();
    elements.forEach((el) => {
      const id = el.dataset.sound;
      if (id && typeof id === 'string') {
        soundIds.add(id.trim());
      }
    });
    return Array.from(soundIds);
  }

  /**
   * @param {Object} [options={}]
   * @param {AudioContext} [options.audioContext] - Existing AudioContext or mock for testing.
   * @param {Record<string, string>} [options.soundMap] - Optional map of soundId -> asset URL.
   * @param {boolean} [options.enableSynthesisFallback=true] - Fall back to synthesized buffers if assets missing.
   * @param {ParentNode} [options.contractRoot=document] - DOM root to read data-sound contract from.
   */
  constructor(options = {}) {
    this.options = {
      enableSynthesisFallback: true,
      contractRoot: typeof document !== 'undefined' ? document : null,
      ...options,
    };

    /** @type {AudioContext|null} */
    this.ctx = options.audioContext || null;

    /** @type {Map<string, AudioBuffer>} */
    this.buffers = new Map();

    /** @type {Map<string, string>} */
    this.soundMap = new Map();

    /** @type {Set<string>} */
    this.registeredSoundIds = new Set();

    /** @type {boolean} */
    this.isInitialized = false;

    // Bind methods for safe standalone passing
    this.playSound = this.playSound.bind(this);
    this.play = this.playSound; // Alias for flexibility
  }

  /**
   * Initializes the AudioContext and registers sound contracts from DOM or options.
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) return;

    // 1. Initialize Web Audio API AudioContext
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }

    // 2. Discover sound identifiers from HTML data-sound contract
    const contractIds = this.options.contractRoot
      ? AudioEngine.extractSoundIds(this.options.contractRoot)
      : [];

    contractIds.forEach((id) => this.registeredSoundIds.add(id));

    // 3. Register sound URLs from options or default asset paths
    if (this.options.soundMap) {
      for (const [id, url] of Object.entries(this.options.soundMap)) {
        this.registeredSoundIds.add(id);
        this.soundMap.set(id, url);
      }
    }

    // Default asset convention: assets/sounds/{soundId}.wav
    for (const id of this.registeredSoundIds) {
      if (!this.soundMap.has(id)) {
        this.soundMap.set(id, `assets/sounds/${id}.wav`);
      }
    }

    // 4. Preload buffers or generate synthetic fallbacks
    await this.preloadAll();

    this.isInitialized = true;
  }

  /**
   * Ensures the AudioContext is running (unlocks on user gesture if suspended).
   * @returns {Promise<void>}
   */
  async unlock() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[AudioEngine] Could not resume AudioContext:', err);
      }
    }
  }

  /**
   * Preloads all registered sounds, falling back safely on failure.
   * @returns {Promise<void>}
   */
  async preloadAll() {
    const promises = Array.from(this.registeredSoundIds).map((id) => {
      const url = this.soundMap.get(id);
      return this.loadSound(id, url);
    });
    await Promise.allSettled(promises);
  }

  /**
   * Loads and decodes an audio file into an AudioBuffer.
   * Handles missing/unreachable files safely by falling back to synthetic audio.
   * @param {string} soundId - Unique sound identifier
   * @param {string} url - Audio asset URL
   * @returns {Promise<AudioBuffer|null>}
   */
  async loadSound(soundId, url) {
    if (!this.ctx) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(soundId, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      // Safe missing audio handling
      console.warn(
        `[AudioEngine] Notice: Sound file "${url}" for "${soundId}" could not be loaded (${err.message}). Using synthetic fallback.`
      );

      if (this.options.enableSynthesisFallback) {
        const syntheticBuffer = this.synthesizeBuffer(soundId);
        if (syntheticBuffer) {
          this.buffers.set(soundId, syntheticBuffer);
          return syntheticBuffer;
        }
      }
      return null;
    }
  }

  /**
   * Plays a sound polyphonically. Overlapping sounds (including rapid repeated hits
   * of the same sound) play concurrently without truncating previous instances.
   *
   * @param {string} soundId - Sound identifier to play
   * @returns {boolean} Whether playback successfully initiated
   */
  playSound(soundId) {
    if (!soundId) return false;

    // Auto-resume suspended AudioContext on interaction
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const buffer = this.buffers.get(soundId);
    if (!buffer || !this.ctx) {
      // Fallback check: if buffer not preloaded yet, try synthesizing on the fly
      if (this.ctx && this.options.enableSynthesisFallback) {
        const syntheticBuffer = this.synthesizeBuffer(soundId);
        if (syntheticBuffer) {
          this.buffers.set(soundId, syntheticBuffer);
          return this._triggerSourceNode(syntheticBuffer);
        }
      }
      console.warn(`[AudioEngine] Sound "${soundId}" is not available for playback.`);
      return false;
    }

    return this._triggerSourceNode(buffer);
  }

  /**
   * Internal helper: creates an independent AudioBufferSourceNode and triggers playback.
   * Every trigger allocates a fresh node, ensuring 100% polyphonic mixing.
   * @private
   * @param {AudioBuffer} buffer
   * @returns {boolean}
   */
  _triggerSourceNode(buffer) {
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      source.start(0);
      return true;
    } catch (err) {
      console.warn('[AudioEngine] Playback trigger failed:', err);
      return false;
    }
  }

  /**
   * High-fidelity DSP drum sound synthesis fallback.
   * Renders studio-calibrated drum transients directly to an AudioBuffer.
   *
   * @param {string} soundId - Sound identifier (kick, snare, hihat, crash, tom1, tom2, tom3)
   * @returns {AudioBuffer|null}
   */
  synthesizeBuffer(soundId) {
    if (!this.ctx) return null;

    const sampleRate = this.ctx.sampleRate || 44100;

    switch (soundId.toLowerCase()) {
      case 'kick': {
        const duration = 0.35;
        const totalSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);
        let phase = 0;

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Exponential frequency drop: 160Hz -> 35Hz
          const freq = 35 + 125 * Math.exp(-t * 22);
          phase += (2 * Math.PI * freq) / sampleRate;
          // Exponential envelope
          const amp = Math.exp(-t * 9);
          data[i] = Math.sin(phase) * amp;
        }
        return buffer;
      }

      case 'snare': {
        const duration = 0.25;
        const totalSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);
        let phase = 0;

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Body tone: 185Hz drop
          const freq = 120 + 65 * Math.exp(-t * 25);
          phase += (2 * Math.PI * freq) / sampleRate;
          const body = Math.sin(phase) * Math.exp(-t * 18);

          // Snare wire noise with fast decay
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16);
          data[i] = (body * 0.45 + noise * 0.55);
        }
        return buffer;
      }

      case 'hihat': {
        const duration = 0.08;
        const totalSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // High-frequency noise burst
          const noise = Math.random() * 2 - 1;
          const env = Math.exp(-t * 55);
          data[i] = noise * env * 0.6;
        }
        return buffer;
      }

      case 'crash': {
        const duration = 1.2;
        const totalSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Metallic ring frequencies mixed with noise
          const ring1 = Math.sin(2 * Math.PI * 820 * t);
          const ring2 = Math.sin(2 * Math.PI * 1340 * t);
          const noise = Math.random() * 2 - 1;
          const env = Math.exp(-t * 3.5);
          data[i] = (noise * 0.7 + ring1 * 0.15 + ring2 * 0.15) * env * 0.7;
        }
        return buffer;
      }

      case 'tom1':
      case 'tom2':
      case 'tom3': {
        const configs = {
          tom1: { startFreq: 220, endFreq: 90, duration: 0.35, decay: 8 },
          tom2: { startFreq: 165, endFreq: 65, duration: 0.38, decay: 7 },
          tom3: { startFreq: 120, endFreq: 48, duration: 0.42, decay: 6 },
        };
        const cfg = configs[soundId.toLowerCase()];
        const totalSamples = Math.floor(sampleRate * cfg.duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);
        let phase = 0;

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          const freq = cfg.endFreq + (cfg.startFreq - cfg.endFreq) * Math.exp(-t * 18);
          phase += (2 * Math.PI * freq) / sampleRate;
          const amp = Math.exp(-t * cfg.decay);
          data[i] = Math.sin(phase) * amp * 0.85;
        }
        return buffer;
      }

      default: {
        // Generic fallback tone
        const duration = 0.2;
        const totalSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          data[i] = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 15);
        }
        return buffer;
      }
    }
  }

  /**
   * Returns list of currently registered sound IDs.
   * @returns {string[]}
   */
  getRegisteredSounds() {
    return Array.from(this.registeredSoundIds);
  }

  /**
   * Checks if a sound buffer is ready for instant playback.
   * @param {string} soundId
   * @returns {boolean}
   */
  hasSound(soundId) {
    return this.buffers.has(soundId);
  }
}

// Global singleton instance for convenient decoupled consumption
let defaultAudioEngine = null;

/**
 * Initializes or returns the default singleton AudioEngine.
 * @param {Object} [options]
 * @returns {AudioEngine}
 */
export function getAudioEngine(options) {
  if (!defaultAudioEngine) {
    defaultAudioEngine = new AudioEngine(options);
  }
  return defaultAudioEngine;
}

/**
 * Standalone playSound export adhering to HW2 specification.
 * Decoupled from caller and keyboard/recording logic.
 *
 * @param {string} soundId - Sound identifier from the HTML contract
 * @returns {boolean}
 */
export function playSound(soundId) {
  const engine = getAudioEngine();
  return engine.playSound(soundId);
}

// Expose on global window object for browser access and testing
if (typeof window !== 'undefined') {
  window.AudioEngine = AudioEngine;
  window.getAudioEngine = getAudioEngine;
  window.playSound = playSound;
}
