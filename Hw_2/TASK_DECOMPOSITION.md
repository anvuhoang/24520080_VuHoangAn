# HW2: Drum Kit Engine — Task Decomposition & Architectural Plan

## 1. Project Overview & Architectural Principles

This document defines the contract-first, decoupled architecture for **HW2: Drum Kit Engine**. Each component is designed with single responsibility and zero hard dependencies on sibling modules.

```
+-------------------------------------------------------------------+
|                        HTML Contract Layer                        |
|   Buttons / Pads: [data-key], [data-sound], aria-*                |
|   Control Panel: Record, Stop, Play, Clear                        |
+-------------------------------------------------------------------+
           | (DOM Queries / Events)             |
           v                                    v
+-----------------------+              +----------------------------+
| Input Controller      |              | Recorder UI Controller     |
| - Keydown listener    |              | - Button click handlers    |
| - event.repeat guard  |              | - Recording/Playback status|
| - Pointer/touch click |              +----------------------------+
| - Visual feedback     |                             |
+-----------------------+                             |
           |                                          v
           | soundTriggered            +----------------------------+
           +-------------------------->| Beat Recorder Engine (FIFO)|
           |                           | - Timestamped event queue  |
           v                           | - Relative timing capture  |
+-----------------------+              | - Playback scheduler       |
| Polyphonic Audio      |<-------------+----------------------------+
| Engine                |  play(soundId)
| - AudioContext / Pool |
| - Zero DOM dependency |
+-----------------------+
```

### Core Architecture Rules:
- **Contract-First**: HTML data attributes define sound triggers before JS is introduced. Commit HTML contract prior to JS development.
- **Strict Decoupling**:
  - `AudioEngine` knows **only** sound IDs and audio buffers/elements. No DOM references.
  - `InputController` handles keyboard/pointer events, throttling, and visual state. Dispatches sound requests.
  - `BeatRecorder` manages FIFO recording state and relative timestamped events. Dispatches sound requests to `AudioEngine`.
- **Zero Inline Handlers**: Event listeners attached exclusively via modern JS APIs (`addEventListener`).
- **No Unrelated Changes**: Only HW2 Drum Kit Engine scope.
- **No Auto-Commit**: Code is staged for user review and commit.

---

## 2. Component Contracts & Interfaces

### 2.1 HTML Data Contract
- **Trigger Element**: `<button class="drum-pad" data-key="KeyW" data-sound="crash" aria-label="Crash Cymbal">...</button>`
- **Contract Attributes**:
  - `data-key`: Physical keyboard key identifier (`KeyboardEvent.code` format, e.g. `KeyW`, `KeyA`, `KeyS`, `KeyD`, `KeyJ`, `KeyK`, `KeyL`).
  - `data-sound`: Sound identifier string matching audio registry (e.g. `kick`, `snare`, `hihat`, `crash`, `tom-1`, `tom-2`, `tom-3`).
  - Accessibility: `role="button"`, `tabindex="0"`, descriptive `aria-label`.

### 2.2 Polyphonic Audio Engine Interface
```javascript
class AudioEngine {
  /**
   * Registers a sound by ID with its audio file path or AudioBuffer.
   * @param {string} soundId - Unique sound identifier (e.g., 'kick')
   * @param {string} sourceUrl - Audio source URL/path
   */
  registerSound(soundId, sourceUrl);

  /**
   * Plays sound polyphonically (multiple concurrent instances without truncation).
   * @param {string} soundId - Unique sound identifier
   * @returns {Promise<void>}
   */
  play(soundId);

  /**
   * Unlocks AudioContext on initial user interaction.
   * @returns {Promise<void>}
   */
  unlock();
}
```

### 2.3 Input Controller Interface
```javascript
class InputController {
  /**
   * @param {Object} options
   * @param {Element} options.container - Root container for drum pads
   * @param {(soundId: string) => void} options.onTrigger - Callback when a pad/key is triggered
   */
  constructor({ container, onTrigger });

  /**
   * Handles keydown event, applying event.repeat throttling.
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event);

  /**
   * Handles keyup / pointerup to reset visual active state.
   */
  handleRelease(keyOrCode);
}
```

### 2.4 FIFO Beat Recorder Interface
```javascript
/**
 * @typedef {Object} BeatEvent
 * @property {string} soundId - Triggered sound ID
 * @property {number} timestamp - Milliseconds elapsed since recording started
 */

class BeatRecorder {
  /**
   * @param {Object} options
   * @param {number} [options.maxEvents=100] - FIFO maximum capacity
   * @param {(soundId: string) => void} options.onPlaySound - Playback callback
   * @param {(state: 'idle'|'recording'|'playing') => void} options.onStateChange
   */
  constructor({ maxEvents, onPlaySound, onStateChange });

  startRecording();
  recordEvent(soundId);
  stopRecording();
  play();
  stopPlayback();
  clear();
  getQueue(); // Returns readonly array of BeatEvent
}
```

---

## 3. Phased Task Decomposition

### Phase 1: HTML Data-Sound Contract & Visual Scaffold (Step 1)
> **Goal**: Establish the semantic HTML contract and visual layout without JS.
> **Checkpoint**: Ready for git commit before any JS changes.
- [x] **1.1 Directory & Asset Structure**:
  - Create directory layout (`index.html`, `css/styles.css`, `js/`, `assets/sounds/`).
- [x] **1.2 HTML Contract Implementation**:
  - Build drum pads with explicit `data-key` and `data-sound` attributes (`crash`, `kick`, `snare`, `tom1`, `tom2`, `tom3`, `hihat`).
  - Implement recorder control panel scaffold (`#btn-record`, `#btn-stop`, `#btn-play`, `#btn-clear`, `#recording-status`, `#beat-count`).
  - Add semantic landmarks, `aria-label`, and keyboard focus styling.
- [x] **1.3 Visual Styling & Active States**:
  - Modern drum kit pad grid layout with responsive styling in `css/styles.css`.
  - Interactive `.pressed` active states and responsive layout.
- [x] **1.4 Contract Verification**:
  - HTML data contract established and preserved.

---

### Phase 2: Independent Polyphonic Audio Engine (Step 2) 
> **Goal**: Low-latency, polyphonic sound playback isolated from the DOM.
- [x] **2.1 Audio Engine Core (`js/audio-engine.js`)**:
  - Implemented decoupled `AudioEngine` class with Web Audio API `AudioContext`.
  - Automatic `unlock()` mechanism for browser autoplay policies.
  - Safe handling of missing audio files with studio-calibrated DSP synthetic fallback buffers.
- [x] **2.2 Sound Registry & Preloading**:
  - `AudioEngine.extractSoundIds()` scans HTML `[data-sound]` contract.
  - Preloads audio buffers asynchronously; missing assets fall back gracefully without unhandled errors.
- [x] **2.3 Polyphony & Concurrency Verification**:
  - Verified overlapping repeated hits of the same sound allocating independent `AudioBufferSourceNode` instances.
  - Verified concurrent playback of multiple different sounds without clipping or cutoff.
  - Exposes standalone `playSound(soundId)` decoupled export.
  - Strictly zero keyboard listeners or recording logic implemented.

---

### Phase 3: Keyboard Listener & Throttling Controller (Step 3) [COMPLETED]
> **Goal**: Robust input handling with `event.repeat` throttling and UI synchronization.
- [x] **3.1 Keyboard Controller (`js/keyboard-controller.js`)**:
  - Bound `keydown` and `keyup` listeners via decoupled `KeyboardController`.
  - Enforced `event.repeat` guard: safely discards held-key repeat storms.
  - Dynamically resolves key mappings directly from HTML `data-key` attributes without hardcoded JS keymaps.
  - Ignores unmapped keystrokes and typing inside form controls (`input`, `textarea`, `select`, `contenteditable`).
- [x] **3.2 Pointer / Click Event Delegation**:
  - Attached delegated click handler to `.drum-pad` elements resolving `data-sound`.
- [x] **3.3 Visual State Management**:
  - Applies `.pressed` class on trigger.
  - Releases visual active state on `keyup` or click release.
- [x] **3.4 Bridge to Audio Engine**:
  - Connects input trigger to existing `playSound(soundId)`.

---

### Phase 4: FIFO Beat Recorder with Timestamped Events (Step 4) [COMPLETED]
> **Goal**: Record beat sequences with relative timestamps and play them back sequentially.
- [x] **4.1 Beat Recorder Engine (`js/beat-recorder.js`)**:
  - Encapsulated state machine: `idle`, `recording`, `playing`.
  - Relative time tracking via `performance.now()`.
  - FIFO event model: `{ soundId: string, timestamp: number }`.
  - Bounded FIFO queue management with chronological preservation.
- [x] **4.2 Playback Scheduler**:
  - Accurate timer scheduling for timestamped events with original relative timing.
  - Clean cancellation/stopping via `stopPlayback()` or `stop()`.
  - Prevents duplicate recording during playback replay.
- [x] **4.3 Recorder UI Integration (`js/main.js` & `css/styles.css`)**:
  - Bound Record, Stop, Play, Clear toolbar button handlers.
  - Real-time indicator dot (pulsing red for recording, blue for playback) and beat counter.
- [x] **4.4 Decoupled Integration**:
  - Connected live drum hits to `recorder.record(soundId)` during active recording.
  - Replay events invoke `playSound(soundId)` with synchronized pad visual flashes.

---

### Phase 5: Verification, Edge Cases & Polish (Step 5) [COMPLETED]
> **Goal**: Comprehensive testing, accessibility checks, and final verification.
- [x] **5.1 Polyphony & Latency Verification**: Overlapping hits and rapid repeat triggers verified (7/7 tests passed in `test/test-audio-engine.js`).
- [x] **5.2 `event.repeat` Throttling Verification**: Sustained keypress drops repeat events (7/7 tests passed in `test/test-keyboard-controller.js`).
- [x] **5.3 FIFO Queue Verification**: Chronological order, relative timing replay, and duplicate recording guards verified (11/11 tests passed in `test/test-beat-recorder.js`).
- [x] **5.4 Documentation**: `TASK_DECOMPOSITION.md` and `PROMPT_LOG.md` fully audited and established.

---

## 4. Current Status

- **Status**: **All HW2 Steps (1 through 4) Completed, Verified & Documented**.
- **Audit Log**: Fully documented in [`PROMPT_LOG.md`](PROMPT_LOG.md).



