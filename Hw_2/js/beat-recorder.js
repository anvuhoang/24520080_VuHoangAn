/**
 * HW2 Step 4: Independent FIFO Beat Recorder Module
 *
 * Requirements met:
 * 1. Independent BeatRecorder class decoupled from DOM, keyboard, and audio internals.
 * 2. Records timestamped events: { soundId, timestamp }.
 * 3. Uses performance.now() for relative timestamps from recording start.
 * 4. Preserves FIFO event order in event queue.
 * 5. Full lifecycle support: startRecording, stopRecording, stop, clear, play, stopPlayback.
 * 6. Replays events with exact original relative timing.
 * 7. Integrates with existing playSound(soundId) via callback.
 * 8. Prevents duplicate recording during playback (strictly ignores record calls when playing).
 */

export class BeatRecorder {
  /**
   * @param {Object} [options={}]
   * @param {(soundId: string) => void} [options.onPlaySound] - Callback to trigger sound on replay.
   * @param {(state: 'idle'|'recording'|'playing') => void} [options.onStateChange] - State change callback.
   * @param {(count: number) => void} [options.onQueueChange] - Queue size update callback.
   * @param {number} [options.maxEvents=500] - FIFO maximum queue capacity.
   * @param {() => number} [options.now] - High-resolution timestamp provider.
   */
  constructor(options = {}) {
    this.options = {
      maxEvents: 500,
      ...options,
    };

    this.onPlaySound = options.onPlaySound || null;
    this.onStateChange = options.onStateChange || null;
    this.onQueueChange = options.onQueueChange || null;

    // Use performance.now if available, fallback to Date.now
    this.now =
      options.now ||
      (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now.bind(performance)
        : Date.now);

    /** @type {'idle'|'recording'|'playing'} */
    this.state = 'idle';

    /** @type {Array<{soundId: string, timestamp: number}>} FIFO Event Queue */
    this.queue = [];

    /** @type {number} */
    this.startTime = 0;

    /** @type {number} Total recorded duration in ms */
    this.duration = 0;

    /** @type {number[]} Scheduled playback timeout IDs */
    this.playbackTimeouts = [];

    // Bind methods
    this.record = this.record.bind(this);
    this.recordEvent = this.record; // Alias
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.play = this.play.bind(this);
    this.stopPlayback = this.stopPlayback.bind(this);
    this.stop = this.stop.bind(this);
    this.clear = this.clear.bind(this);
  }

  /**
   * Returns current state: 'idle' | 'recording' | 'playing'
   * @returns {'idle'|'recording'|'playing'}
   */
  getState() {
    return this.state;
  }

  /**
   * @returns {boolean}
   */
  isRecording() {
    return this.state === 'recording';
  }

  /**
   * @returns {boolean}
   */
  isPlaying() {
    return this.state === 'playing';
  }

  /**
   * Begins recording beat sequence.
   * Clears previous sequence and resets relative start timer.
   */
  startRecording() {
    if (this.state === 'playing') {
      this.stopPlayback();
    }

    this.queue = [];
    this.duration = 0;
    this.startTime = this.now();
    this._setState('recording');
    this._notifyQueue();
  }

  /**
   * Records a drum hit event with relative timestamp.
   * Strictly ignores events when playing to prevent duplicate recording.
   *
   * @param {string} soundId - Sound identifier
   * @returns {boolean} Whether event was successfully queued
   */
  record(soundId) {
    // 1. Guard: Only record when in active 'recording' state
    if (this.state !== 'recording') {
      return false;
    }

    // 2. Guard: Avoid duplicate recording during playback
    if (this.state === 'playing') {
      return false;
    }

    if (!soundId || typeof soundId !== 'string') {
      return false;
    }

    // 3. Compute high-resolution relative timestamp
    const timestamp = Math.max(0, Math.round(this.now() - this.startTime));

    // 4. Enforce FIFO queue capacity (drop oldest if max reached)
    if (this.queue.length >= this.options.maxEvents) {
      this.queue.shift(); // FIFO discard
    }

    // 5. Append event chronologically
    this.queue.push({
      soundId: soundId.trim(),
      timestamp,
    });

    this._notifyQueue();
    return true;
  }

  /**
   * Stops active recording and captures total duration.
   */
  stopRecording() {
    if (this.state !== 'recording') return;

    this.duration = Math.max(0, Math.round(this.now() - this.startTime));
    this._setState('idle');
  }

  /**
   * Plays back recorded events preserving exact original relative timing.
   * @returns {boolean} Whether playback started
   */
  play() {
    if (this.queue.length === 0) {
      return false;
    }

    if (this.state === 'recording') {
      this.stopRecording();
    }

    if (this.state === 'playing') {
      this.stopPlayback();
    }

    this._setState('playing');
    this.playbackTimeouts = [];

    // Schedule each event in chronological FIFO order
    for (let i = 0; i < this.queue.length; i++) {
      const event = this.queue[i];
      const timeoutId = setTimeout(() => {
        if (this.state === 'playing' && typeof this.onPlaySound === 'function') {
          this.onPlaySound(event.soundId);
        }
      }, event.timestamp);

      this.playbackTimeouts.push(timeoutId);
    }

    // Determine total playback duration
    const lastEventTime = this.queue[this.queue.length - 1].timestamp;
    const finalDuration = Math.max(this.duration, lastEventTime + 50);

    // Schedule completion
    const endTimeoutId = setTimeout(() => {
      if (this.state === 'playing') {
        this.stopPlayback();
      }
    }, finalDuration);

    this.playbackTimeouts.push(endTimeoutId);
    return true;
  }

  /**
   * Stops active playback and cancels all pending timers.
   */
  stopPlayback() {
    if (this.state !== 'playing' && this.playbackTimeouts.length === 0) return;

    for (const id of this.playbackTimeouts) {
      clearTimeout(id);
    }
    this.playbackTimeouts = [];
    this._setState('idle');
  }

  /**
   * General stop method: halts either recording or playback.
   */
  stop() {
    if (this.state === 'recording') {
      this.stopRecording();
    } else if (this.state === 'playing') {
      this.stopPlayback();
    }
  }

  /**
   * Clears all recorded events and resets recorder state.
   */
  clear() {
    this.stop();
    this.queue = [];
    this.duration = 0;
    this._notifyQueue();
  }

  /**
   * Returns a copy of the recorded FIFO queue.
   * @returns {Array<{soundId: string, timestamp: number}>}
   */
  getQueue() {
    return this.queue.map((item) => ({ ...item }));
  }

  /**
   * Returns total event count in the queue.
   * @returns {number}
   */
  getEventCount() {
    return this.queue.length;
  }

  /**
   * Internal state transition helper.
   * @private
   * @param {'idle'|'recording'|'playing'} newState
   */
  _setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.state);
    }
  }

  /**
   * Internal queue notification helper.
   * @private
   */
  _notifyQueue() {
    if (typeof this.onQueueChange === 'function') {
      this.onQueueChange(this.queue.length);
    }
  }
}
