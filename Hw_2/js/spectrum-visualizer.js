/**
 * Canvas frequency visualizer driven by requestAnimationFrame.
 *
 * Frame budget (per tick, in order):
 *   1. Re-schedule the next frame first, so one throw cannot end the loop.
 *   2. Pace to `targetFps`. Frames that arrive early are dropped before any work.
 *   3. Apply a pending resize. Only the observer writes the size, and it never
 *      reads layout, so the loop never forces a reflow.
 *   4. Read the analyser into the preallocated buffer and map bins to bars.
 *   5. Redraw only if at least one bar's integer pixel height changed, or a
 *      resize happened.
 *
 * Hot-path rules:
 * - No allocations per frame. Level, height and bin-map arrays are allocated
 *   once and reused. Gradients are rebuilt only on resize.
 * - One beginPath, one fill and at most two fillStyle writes per draw. Bars
 *   are batched into one path, not drawn one fillRect at a time.
 * - The canvas backing store is assigned only when its pixel size changes,
 *   because assigning it clears the context and forces a reallocation.
 *
 * Ownership: the visualizer owns its frame request id and its ResizeObserver.
 * dispose() cancels the frame, disconnects the observer and drops every
 * canvas, context and source reference.
 */

/** Structural match for AudioEngine.getFrequencyData(). Returns the same array each call. */
                                 
                                 
 

/** Injected so tests can drive frames by hand. Defaults to requestAnimationFrame. */
                                 
                                                  
                           
 

                                 
                       
                          
 

                                            
                                     
                                  
                                                                        
                             
                                                                                        
                              
                                                                                
                              
                                                
                                   
                                   
                                      
                                                                                  
                                   
 

                                  
                               
                                                     
                                 
                                                               
                                   
                           
 

const DEFAULT_BAR_COUNT = 64;
const DEFAULT_TARGET_FPS = 60;
const REDUCED_MOTION_FPS = 15;
const DEFAULT_SMOOTHING = 0.7;
const DEFAULT_COLORS = { top: '#4ade80', bottom: '#1e293b' };
/** Tolerance so a 60 Hz display's timestamp jitter does not drop a real frame. */
const FRAME_TOLERANCE_MS = 1;
const BAR_FILL_RATIO = 0.8;

const DEFAULT_SCHEDULER = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

                       
                         
                          
                       
 

export class SpectrumVisualizer {
  #canvas;
  #ctx;
  #source;
  #scheduler;
  #barCount;
  #frameIntervalMs;
  #smoothing;
  #colors;

  // Bin-to-bar map, rebuilt only when the analyser's bin count changes.
  #binCount = -1;
  #binFrom;
  #binTo;

  // Per-frame state. Preallocated and reused, never reallocated in the loop.
  #levels;
  #heights;
  #drawnHeights;

  #cssWidth = 0;
  #cssHeight = 0;
  #currentDpr = 1;
  #gradient = null;
  #pendingSize = null;
  #needsDraw = true;

  #frameId = null;
  #running = false;
  #disposed = false;
  #lastDrawTime = Number.NEGATIVE_INFINITY;
  #observer = null;
  #stats = { framesDrawn: 0, framesSkipped: 0, framesThrottled: 0, resizes: 0 };

  /** Bound once. Passing `this.#onFrame` to the scheduler creates no new function per frame. */
  #onFrame = (timestamp) => {
    this.#frameId = null;
    if (!this.#running) return;
    this.#schedule();

    if (timestamp - this.#lastDrawTime < this.#frameIntervalMs - FRAME_TOLERANCE_MS) {
      this.#stats.framesThrottled++;
      return;
    }
    this.#lastDrawTime = timestamp;

    this.#applyPendingSize();
    const source = this.#source;
    if (!source) return;
    const bins = source.getFrequencyData();
    if (bins.length !== this.#binCount) this.#rebuildBinMap(bins.length);
    this.#updateHeights(bins);

    if (!this.#needsDraw && this.#heightsUnchanged()) {
      this.#stats.framesSkipped++;
      return;
    }
    this.#draw();
    this.#stats.framesDrawn++;
    this.#needsDraw = false;
  };

  constructor(options) {
    const barCount = options.barCount ?? DEFAULT_BAR_COUNT;
    if (!Number.isInteger(barCount) || barCount < 1) {
      throw new RangeError(`barCount must be an integer >= 1; received ${barCount}`);
    }
    const smoothing = options.reducedMotion ? 0 : (options.smoothing ?? DEFAULT_SMOOTHING);
    if (smoothing < 0 || smoothing >= 1) {
      throw new RangeError(`smoothing must be in [0, 1); received ${smoothing}`);
    }
    const fps = options.reducedMotion
      ? Math.min(REDUCED_MOTION_FPS, options.targetFps ?? REDUCED_MOTION_FPS)
      : (options.targetFps ?? DEFAULT_TARGET_FPS);
    if (!(fps > 0)) {
      throw new RangeError(`targetFps must be > 0; received ${fps}`);
    }

    const ctx = options.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');

    this.#canvas = options.canvas;
    this.#ctx = ctx;
    this.#source = options.source;
    this.#scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.#barCount = barCount;
    this.#frameIntervalMs = 1000 / fps;
    this.#smoothing = smoothing;
    this.#colors = options.colors ?? DEFAULT_COLORS;

    this.#binFrom = new Uint16Array(barCount);
    this.#binTo = new Uint16Array(barCount);
    this.#levels = new Float32Array(barCount);
    this.#heights = new Uint16Array(barCount);
    this.#drawnHeights = new Uint16Array(barCount);

    if ((options.observeResize ?? true) && typeof ResizeObserver !== 'undefined') {
      // The callback only stores the size. Layout is never read inside a frame.
      this.#observer = new ResizeObserver((entries) => {
        const box = entries[entries.length - 1]?.contentRect;
        if (box) this.resize(box.width, box.height, globalThis.devicePixelRatio ?? 1);
      });
      this.#observer.observe(options.canvas);
    }
  }

  get running() {
    return this.#running;
  }

  /** A copy, so callers cannot mutate the live counters. */
  get stats() {
    return { ...this.#stats };
  }

  start() {
    this.#assertNotDisposed();
    if (this.#running) return;
    this.#running = true;
    this.#lastDrawTime = Number.NEGATIVE_INFINITY;
    this.#schedule();
  }

  stop() {
    this.#running = false;
    if (this.#frameId !== null) {
      this.#scheduler.cancel(this.#frameId);
      this.#frameId = null;
    }
  }

  /**
   * Records a new CSS size and device pixel ratio. It takes effect at the next
   * frame, so no canvas state changes happen outside the loop.
   */
  resize(cssWidth, cssHeight, dpr) {
    if (this.#disposed) return;
    const width = Math.max(1, cssWidth);
    const height = Math.max(1, cssHeight);
    const scale = dpr > 0 ? dpr : 1;
    if (width === this.#cssWidth && height === this.#cssHeight && scale === this.#currentDpr) {
      this.#pendingSize = null;
      return;
    }
    this.#pendingSize = { width, height, dpr: scale };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#pendingSize = null;
    this.#gradient = null;
    this.#ctx = null;
    this.#canvas = null;
    this.#source = null;
  }

  #schedule() {
    this.#frameId = this.#scheduler.request(this.#onFrame);
  }

  #assertNotDisposed() {
    if (this.#disposed) throw new Error('SpectrumVisualizer has been disposed');
  }

  #applyPendingSize() {
    const pending = this.#pendingSize;
    if (pending === null || this.#canvas === null || this.#ctx === null) return;
    this.#pendingSize = null;

    const canvas = this.#canvas;
    const ctx = this.#ctx;
    const pixelWidth = Math.round(pending.width * pending.dpr);
    const pixelHeight = Math.round(pending.height * pending.dpr);
    // Assigning width or height clears the context. Assign only when the pixel size changes.
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(pending.dpr, 0, 0, pending.dpr, 0, 0);

    this.#gradient = ctx.createLinearGradient(0, 0, 0, pending.height);
    this.#gradient.addColorStop(0, this.#colors.top);
    this.#gradient.addColorStop(1, this.#colors.bottom);

    this.#cssWidth = pending.width;
    this.#cssHeight = pending.height;
    this.#currentDpr = pending.dpr;
    this.#needsDraw = true;
    this.#stats.resizes++;
  }

  /**
   * Maps bins to bars on a log scale. Low frequencies get narrow bins, high
   * frequencies get wide ones. Each bar covers at least one bin, so bars never
   * go empty even when there are more bars than bins.
   */
  #rebuildBinMap(binCount) {
    this.#binCount = binCount;
    const edge = (i) =>
      Math.floor(Math.pow(binCount, i / this.#barCount));
    for (let i = 0; i < this.#barCount; i++) {
      const from = Math.min(binCount - 1, Math.max(1, edge(i)));
      const to = Math.max(from + 1, Math.min(binCount, edge(i + 1)));
      this.#binFrom[i] = from;
      this.#binTo[i] = to;
    }
  }

  /** Peak bin per bar, smoothed, then converted to integer CSS pixel heights. */
  #updateHeights(bins) {
    const height = this.#cssHeight;
    const keep = this.#smoothing;
    const attack = 1 - keep;
    for (let i = 0; i < this.#barCount; i++) {
      let peak = 0;
      for (let b = this.#binFrom[i] ; b < this.#binTo[i] ; b++) {
        const value = bins[b] ;
        if (value > peak) peak = value;
      }
      const level = this.#levels[i] * keep + (peak / 255) * attack;
      this.#levels[i] = level;
      this.#heights[i] = Math.round(level * height);
    }
  }

  #heightsUnchanged() {
    for (let i = 0; i < this.#barCount; i++) {
      if (this.#heights[i] !== this.#drawnHeights[i]) return false;
    }
    return true;
  }

  #draw() {
    const ctx = this.#ctx;
    if (ctx === null) return;
    const width = this.#cssWidth;
    const height = this.#cssHeight;
    const slot = width / this.#barCount;
    const barWidth = slot * BAR_FILL_RATIO;
    const inset = (slot - barWidth) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.#gradient ?? this.#colors.top;
    ctx.beginPath();
    for (let i = 0; i < this.#barCount; i++) {
      const barHeight = this.#heights[i] ;
      ctx.rect(i * slot + inset, height - barHeight, barWidth, barHeight);
    }
    ctx.fill();

    this.#drawnHeights.set(this.#heights);
  }
}
