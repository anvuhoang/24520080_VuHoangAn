/**
 * Core audio engine: one AudioContext, one AnalyserNode, and at most one
 * active playback source at a time.
 *
 * Ownership:
 * - AudioEngine owns the AudioContext, the AnalyserNode, and the
 *   frequency buffer. dispose() releases all three.
 * - Each AudioBufferSourceNode is owned by the engine while it plays.
 *   It is released (onended cleared, disconnected, buffer dropped) on
 *   end, on stop(), or on dispose().
 */

/** @typedef {'suspended' | 'running' | 'disposed'} EngineState */

/** @typedef {'ended' | 'stopped'} PlaybackResult */

/** FFT sizes allowed by this lab. frequencyBinCount is fftSize / 2. */
export const VALID_FFT_SIZES = Object.freeze([256, 512]);

/**
 * @param {unknown} fftSize
 */
function assertValidFftSize(fftSize) {
  if (!VALID_FFT_SIZES.includes(fftSize)) {
    throw new RangeError(
      `fftSize must be one of ${VALID_FFT_SIZES.join(', ')}; received ${String(fftSize)}`,
    );
  }
}

function defaultCreateContext() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API is not available in this environment');
  }
  return new Ctor();
}

export class AudioEngine {
  /** @type {AudioContext} */
  #context;
  /** @type {AnalyserNode | null} */
  #analyser;
  /** @type {Uint8Array | null} Reused on every frame; never reallocated. */
  #frequencyData;
  /** @type {AudioBufferSourceNode | null} */
  #activeSource = null;
  /** @type {((result: PlaybackResult) => void) | null} */
  #settlePlayback = null;
  /** @type {((state: EngineState) => void) | undefined} */
  #onStateChange;
  /** @type {boolean} */
  #disposed = false;
  /** Stored so the same reference can be passed to removeEventListener. */
  #handleContextStateChange = () => {
    this.#onStateChange?.(this.state);
  };

  /**
   * @param {object} [options]
   * @param {256 | 512} [options.fftSize=512] FFT size; yields 128 or 256 frequency bins.
   * @param {number} [options.smoothingTimeConstant=0.8] Analyser smoothing in [0, 1].
   * @param {(state: EngineState) => void} [options.onStateChange]
   * @param {() => AudioContext} [options.createContext] Injected for tests.
   */
  constructor({
    fftSize = 512,
    smoothingTimeConstant = 0.8,
    onStateChange,
    createContext = defaultCreateContext,
  } = {}) {
    assertValidFftSize(fftSize);

    this.#onStateChange = onStateChange;
    this.#context = createContext();
    this.#analyser = this.#context.createAnalyser();
    this.#analyser.fftSize = fftSize;
    this.#analyser.smoothingTimeConstant = smoothingTimeConstant;
    this.#analyser.connect(this.#context.destination);
    this.#frequencyData = new Uint8Array(this.#analyser.frequencyBinCount);

    this.#context.addEventListener('statechange', this.#handleContextStateChange);
  }

  /** @returns {EngineState} */
  get state() {
    return this.#disposed ? 'disposed' : this.#context.state;
  }

  /** @returns {number} Number of frequency bins written by getFrequencyData(). */
  get binCount() {
    return this.#frequencyData?.length ?? 0;
  }

  /**
   * Resumes the AudioContext. Browsers only allow this inside a user
   * gesture, so call it from a click or key handler.
   * @returns {Promise<void>}
   */
  async resume() {
    this.#assertNotDisposed();
    await this.#context.resume();
  }

  /**
   * Decodes compressed audio into an AudioBuffer.
   * The input ArrayBuffer is detached by decodeAudioData and must not be reused.
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<AudioBuffer>}
   */
  async decode(arrayBuffer) {
    this.#assertNotDisposed();
    return this.#context.decodeAudioData(arrayBuffer);
  }

  /**
   * Plays a decoded buffer. Any active playback is stopped first, so at
   * most one source exists at a time.
   * @param {AudioBuffer} audioBuffer
   * @returns {Promise<PlaybackResult>} Resolves 'ended' on natural end, 'stopped' if interrupted.
   */
  play(audioBuffer) {
    this.#assertNotDisposed();
    this.stop();

    const source = this.#context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.#analyser);
    source.onended = this.#handleSourceEnded;

    const playback = new Promise((resolve) => {
      this.#settlePlayback = resolve;
    });
    try {
      source.start();
    } catch (error) {
      this.#releaseSource(source);
      this.#settlePlayback = null;
      throw error;
    }
    this.#activeSource = source;
    return playback;
  }

  /**
   * Stops the active source, if any. Safe to call when idle.
   */
  stop() {
    const source = this.#activeSource;
    const settle = this.#settlePlayback;
    if (source) {
      this.#releaseSource(source);
      source.stop();
    }
    this.#settlePlayback = null;
    settle?.('stopped');
  }

  /**
   * Fills the preallocated frequency buffer with the current spectrum.
   * The returned array is the same instance on every call. Read it within
   * the current frame; do not keep a reference across frames.
   * @returns {Uint8Array} Byte magnitudes in [0, 255], one per bin.
   */
  getFrequencyData() {
    this.#assertNotDisposed();
    this.#analyser.getByteFrequencyData(this.#frequencyData);
    return this.#frequencyData;
  }

  /**
   * Stops playback, disconnects the analyser, removes listeners, and closes
   * the AudioContext. Idempotent: calls after the first resolve immediately
   * without closing the context again.
   * @returns {Promise<void>}
   */
  async dispose() {
    if (this.#disposed) return;
    // Mark disposed before any await so concurrent calls cannot re-enter.
    this.#disposed = true;

    this.stop();
    this.#analyser.disconnect();
    this.#context.removeEventListener('statechange', this.#handleContextStateChange);
    this.#onStateChange = undefined;
    this.#analyser = null;
    this.#frequencyData = null;

    await this.#context.close();
  }

  #assertNotDisposed() {
    if (this.#disposed) {
      throw new Error('AudioEngine has been disposed');
    }
  }

  /**
   * Natural end of the active source. Bound once in the constructor so it
   * can be cleared with `onended = null`.
   * @param {Event} event
   */
  #handleSourceEnded = (event) => {
    const source = /** @type {AudioBufferSourceNode} */ (event.target);
    if (source !== this.#activeSource) return;
    const settle = this.#settlePlayback;
    this.#releaseSource(source);
    this.#settlePlayback = null;
    settle?.('ended');
  };

  /**
   * Clears every reference that could keep the source or its decoded
   * buffer alive. Does not call stop(); callers decide that.
   * @param {AudioBufferSourceNode} source
   */
  #releaseSource(source) {
    source.onended = null;
    source.disconnect();
    source.buffer = null;
    if (this.#activeSource === source) {
      this.#activeSource = null;
    }
  }
}
