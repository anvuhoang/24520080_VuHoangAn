/**
 * Single owner of the audio pipeline: one engine and one task queue.
 *
 * Teardown order matters:
 *   1. Silence output (stop the active AudioBufferSourceNode).
 *   2. Cancel every pending download and wait for in-flight decodes to settle.
 *   3. Close the AudioContext. Decodes need the context alive, so it must go last.
 *
 * Ownership:
 * - The pipeline owns the queue and the engine it was given.
 * - Each decoded AudioBuffer belongs to the caller once `load()` resolves. The
 *   pipeline keeps no reference to it, so dropping the caller's reference frees it.
 */

import { AudioTaskQueue, createTrackExecutor } from './audio-task-queue.js';
                                                                        

/** The subset of AudioEngine the pipeline needs. Structural, so no import of the JS module. */
                                    
                                                   
                                                          
               
                           
 

                                            
                                     
                            
                                  
                                                                                
                                          
 

export class AudioTrackPipeline {
  #engine;
  #queue;
  #teardown = null;

  constructor(options) {
    this.#engine = options.engine;
    const fetchImpl = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.#queue = new AudioTaskQueue({
      capacity: options.capacity,
      maxConcurrency: options.maxConcurrency,
      execute: createTrackExecutor({
        fetch: fetchImpl,
        decode: (bytes) => this.#engine.decode(bytes),
      }),
    });
  }

  get queuedCount() {
    return this.#queue.queuedCount;
  }

  get inFlightCount() {
    return this.#queue.inFlightCount;
  }

  /**
   * Downloads and decodes a track. `signal` is the caller's cancellation:
   * aborting it cancels the download (or the queued task) at once.
   */
  load(id, url, signal) {
    return this.#queue.enqueue({ id, source: url, signal });
  }

  cancel(id) {
    return this.#queue.cancel(id);
  }

  /**
   * Cancels all pending loads and keeps the pipeline usable. Playback is not
   * affected. Resolves once in-flight work has settled.
   */
  reset() {
    return this.#queue.reset();
  }

  play(buffer) {
    return this.#engine.play(buffer);
  }

  stopPlayback() {
    this.#engine.stop();
  }

  /**
   * Unmount path. Idempotent. Aborts every pending fetch and decode, and
   * resolves once the context is closed.
   */
  dispose() {
    this.#teardown ??= this.#runTeardown();
    return this.#teardown;
  }

  async #runTeardown() {
    this.#engine.stop();
    await this.#queue.dispose();
    await this.#engine.dispose();
  }
}
