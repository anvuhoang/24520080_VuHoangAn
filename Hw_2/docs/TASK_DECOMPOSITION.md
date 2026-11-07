# TASK_DECOMPOSITION.md — Lab 3 · Homework 2 (WBS)

> Goal: an 88-key polyphonic piano (A0 to C8) with an 8-voice synth that steals the oldest note in FIFO order, a recorder that stores played notes in a FIFO queue, and an abortable replay at 0.5×, 1× and 2×. Pressing one key must re-render only that key.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md).
> Source: Lab 3 deck, slides 27–28 (HW2 spec, `PianoKey` and polyphonic-synth contracts).
> Working rule (slide 8): **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).

---

## Block 1 — Setup

Reuses the Homework 1 toolchain, including the test tooling; no new dependencies. Done by copying config files, not by prompting.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Hw_2/` with `package.json` (name `lab3-hw2`, `vitest` and Testing Library as dev dependencies, `npm test`), `vite.config.js` (with the `test` block), `index.html` (with an empty `data:` favicon) and `.gitignore` copied from `Hw_1/`. |
| 0.2 | Copy `src/main.jsx` (`createRoot` + `<StrictMode>`, throws if `#root` is missing), `tests/setup.js` and `docs/project-rules.md`. |
| 0.3 | Add placeholder `src/App.jsx` and `src/index.css` so the project builds before any feature exists. |
| 0.4 | Run `npm install` and `npm run build`. |

---

## Props Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
// src/music/keys.js
interface PianoKeyData {
  midi: number;          // 21 (A0) … 108 (C8); also the React key
  noteName: string;      // 'A0', 'A#0', 'B0', 'C1' … 'C8' (sharps only)
  isBlack: boolean;
  freqHz: number;        // 440 * 2 ** ((midi - 69) / 12)
}
midiToFrequency(midi: number): number
KEYS: readonly PianoKeyData[]   // 88 keys, generated, never typed out: 52 white + 36 black

// src/audio/polyphonicSynth.js
createPolyphonicSynth({ maxVoices = 8 } = {}): {
  noteOn(midi: number, freqHz: number): void;   // the 9th simultaneous note steals the OLDEST voice (FIFO)
  noteOff(midi: number): void;                  // fades out only that note
  stopAll(): void;                              // silences every voice at once
  dispose(): void;                              // closes the AudioContext, safe to call twice
  readonly activeCount: number;
}
// - AudioContext is created lazily on the first noteOn (autoplay policy) and resumed if suspended
// - voices are tracked in a Map so insertion order is the FIFO order and stealing is O(1)
// - envelopes never jump: fade in from silence, ramp to 0.0001 (about 40 ms) before the oscillator stops

// src/sequencer/fifoQueue.js
createFifoQueue(): { enqueue(item): void; dequeue(): item | undefined; size: number; toArray(): item[]; clear(): void }

// src/sequencer/audioTaskQueue.js — the concurrent FIFO queue from Lab 2 HW2, reused unchanged
//   (lab-2 branch: Hw_2/js/audio-task-queue.js), as the slide asks ("Lab 2 HW 2's FIFO AudioTaskQueue")
new AudioTaskQueue({ capacity, maxConcurrency, execute(task, signal), onBackpressure? })
  enqueue(task: { id, signal?, ... }): Promise<{ ok: true, id, value } | { ok: false, id, error }>
  cancel(id), reset(), pause(), resume(), drain(), dispose()   // reset/dispose cancel running and waiting tasks
  state, queuedCount, inFlightCount
// - tasks start in the order they were enqueued; at most `maxConcurrency` run at once
// - every task gets its own AbortController; `execute` receives its signal
// - `capacity` counts the tasks that are WAITING for a permit

// src/sequencer/replay.js  (runs on the AudioTaskQueue: one task per recorded note, maxConcurrency 1)
interface SequenceEvent { midi: number; freqHz: number; durationMs: number; deltaMs: number }
// deltaMs = time from the start of the previous event (0 for the first); durationMs = how long the key was held
replaySequence(
  events: readonly SequenceEvent[],
  options: { speed?: 0.5 | 1 | 2; signal?: AbortSignal; onNoteOn(e): void; onNoteOff(e): void }
): Promise<'completed' | 'aborted'>
// - a note starts at (sum of the previous deltaMs) / speed counted from the start of the replay, so timer delays do not add up
// - aborting cancels the waiting tasks, releases the notes still sounding and clears every timer

interface PianoKeyProps {      // React.memo — props are primitives and stable callbacks only
  midi: number; noteName: string; isBlack: boolean;
  isPressed?: boolean;         // default: false → aria-pressed
  onNoteOn(midi: number): void; onNoteOff(midi: number): void;
}

interface PianoProps {        // src/components/Piano.jsx
  pressedNotes?: ReadonlySet<number>;   // default: an empty Set; replaced by a new Set on every change
  onNoteOn(midi: number): void;         // must keep the same identity between renders (memoized keys)
  onNoteOff(midi: number): void;
}

interface TransportProps {    // src/components/Transport.jsx
  mode?: 'idle' | 'recording' | 'playing';   // default: 'idle'; anything else counts as 'idle'
  eventCount?: number;                       // default: 0 → notes recorded; Play is disabled at 0
  speed?: 0.5 | 1 | 2;                       // default: 1; any other value shows 1x
  onRecord(): void; onPlay(): void; onStop(): void;
  onSpeedChange(speed: number): void;        // sent as a number
}
// Record: enabled when idle · Play: idle and eventCount > 0 · Stop: recording or playing · Speed: not while playing
```

Defaults are set with ES6 default parameters in the destructured signature. `defaultProps` is banned.

---

## Sub-tasks

Each row is one prompt and one file. `P` numbers are the prompt order used in [PROMPT_LOG.md](PROMPT_LOG.md).

### Commit 1 — `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 1.1 | P1 | `src/music/keys.js` | Generate the 88 keys from MIDI 21 to 108 with the frequency formula; no hand-written list. | `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay` |
| 1.2 | P2 | `src/audio/polyphonicSynth.js` | 8 voices, FIFO voice stealing, click-free envelopes, lazy `AudioContext`, `dispose()`. | `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay` |
| 1.3 | P3 | `src/sequencer/fifoQueue.js` | A first-in-first-out queue for the recorded events. | `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay` |
| 1.4 | — | `src/sequencer/audioTaskQueue.js` | Reuse the Lab 2 `AudioTaskQueue` (copied from the `lab-2` branch, unchanged), as slide 27 asks. Not a prompt. | `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay` |
| 1.5 | P4 | `src/sequencer/replay.js` | Replay on the `AudioTaskQueue`: one task per recorded note, abortable, at 0.5×, 1× and 2×. | `feat(hw2): generate the 88 keys, polyphonic synth, FIFO queue and replay` |

### Commit 2 — `feat(hw2): add the memoized piano keys and the keyboard`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 2.1 | P5 | `src/index.css` | `:root` design tokens; every text/background pair ≥ 4.5:1, control borders ≥ 3:1. | `feat(hw2): add the memoized piano keys and the keyboard` |
| 2.2 | P6 | `src/components/PianoKey.jsx` | One key as a `React.memo` button: pointer and keyboard, no stuck notes. | `feat(hw2): add the memoized piano keys and the keyboard` |
| 2.3 | P7 | `src/components/PianoKey.module.css` | White and black key styling, pressed state not by color alone, focus ring. | `feat(hw2): add the memoized piano keys and the keyboard` |
| 2.4 | P8 | `src/components/Piano.jsx` | The 88 keys as a labelled, keyboard-scrollable region; black keys sit in the cell of the white key before them (no inline styles). | `feat(hw2): add the memoized piano keys and the keyboard` |
| 2.5 | P9 | `src/components/Piano.module.css` | Keyboard layout, 52 white columns, horizontal scrolling inside the region only. | `feat(hw2): add the memoized piano keys and the keyboard` |

### Commit 3 — `feat(hw2): assemble the grand piano with recorder and transport`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 3.1 | P10 | `src/components/Transport.jsx` | Record, play, stop and speed controls with a polite status message. | `feat(hw2): assemble the grand piano with recorder and transport` |
| 3.2 | P11 | `src/components/Transport.module.css` | Controls layout, 44px targets, focus ring. | `feat(hw2): assemble the grand piano with recorder and transport` |
| 3.3 | P12 | `src/components/GrandPiano.jsx` | State and wiring: synth, pressed keys, recording into the FIFO queue, replay with an `AbortController`, cleanup. | `feat(hw2): assemble the grand piano with recorder and transport` |
| 3.4 | P13 | `src/components/GrandPiano.module.css` | Layout of transport and keyboard. | `feat(hw2): assemble the grand piano with recorder and transport` |
| 3.5 | P14 | `src/App.module.css` | Page column, title, gutters. | `feat(hw2): assemble the grand piano with recorder and transport` |
| 3.6 | P15 | `src/App.jsx` | Replace the placeholder: `<main>` → `<h1>` → `<GrandPiano />`. | `feat(hw2): assemble the grand piano with recorder and transport` |

### Commit 4 — `test(hw2): add unit and integration tests`

One flat `tests/` folder (no sub-folders), `npm test`. Tests for a known defect are written as `it.fails(...)` and linked to their entry in [AI_FAILURE_AUDIT.md](AI_FAILURE_AUDIT.md).

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 4.1 | `tests/keys.test.js` | 88 keys, 52 white and 36 black, A0 27.5 Hz, A4 440 Hz, C8 ≈ 4186 Hz, names, immutability. |
| 4.2 | `tests/polyphonicSynth.test.js` | Lazy context, 8 voices, FIFO stealing, repeated note, `noteOff`, `stopAll`, node cleanup, `dispose()` twice (Web Audio faked). |
| 4.3 | `tests/fifoQueue.test.js` | Order, empty queue, copy from `toArray`, `clear`. |
| 4.4 | `tests/replay.test.js` | Timing at 0.5×, 1×, 2×, order, abort in the middle, no callbacks after an abort, notes released, timers cleared, queue disposed. |
| 4.10 | `tests/audioTaskQueue.test.js` | The reused Lab 2 queue: FIFO start order, `maxConcurrency`, `cancel`, `reset`, `dispose`, duplicate ids, capacity (the Lab 2 tests ported from `node:test` to Vitest). |
| 4.11 | `tests/fakeAudio.js` | Not a test: a small fake of the Web Audio API used by the synth and piano tests. |
| 4.5 | `tests/PianoKey.test.jsx` | Markup, `aria-pressed`, pointer and keyboard, no stuck note, only a changed key re-renders. |
| 4.6 | `tests/Piano.test.jsx` | 88 buttons, 52 white and 36 black, one render for the key that changes, accessible scroll region. |
| 4.7 | `tests/Transport.test.jsx` | Buttons, speed, status message, disabled states. |
| 4.8 | `tests/GrandPiano.test.jsx` | The assembled piano with a fake synth: play, record, replay, stop, unmount cleanup. |
| 4.9 | `tests/App.test.jsx` | Landmark, heading order, no `<div>`/`<span>` outside what the rules allow. |

---

## Checkpoint HW2 — Verification

Run from `Hw_2/` in Git Bash, with `npm run dev` for the browser checks.

- [ ] **Build passes:** `npm run build` → no errors.
- [ ] **88 keys, none typed out:** the page has 88 key buttons (52 white, 36 black) and `grep -rn "A0\|C8" src` shows no hand-written key list.
- [ ] **Frequencies:** A0 = 27.5 Hz, A4 = 440 Hz, C8 ≈ 4186 Hz.
- [ ] **Polyphony:** hold 8 notes → 8 voices; a 9th note stops the first one pressed (FIFO), the other 7 keep sounding.
- [ ] **No clicks:** released notes fade out (about 40 ms) instead of cutting off.
- [ ] **Render isolation:** React DevTools Profiler, press one key → only that key re-renders (the automated test counts renders of all 88).
- [ ] **Lab 2 queue reused:** `src/sequencer/audioTaskQueue.js` is the Lab 2 file (`diff` against `lab-2:Hw_2/js/audio-task-queue.js` shows only the added first line) and `replay.js` imports it.
- [ ] **Recorder and replay:** record a short phrase, replay at 0.5×, 1× and 2× (the duration halves and doubles), press **Stop** during playback → sound and callbacks stop at once.
- [ ] **Cleanup:** unmounting stops the replay and closes the `AudioContext`; no timers keep running.
- [ ] **No `<div>` / `<span>` / `alert(` / inline `style=` / `http://` / `keyCode`:** each `grep -rn … src | wc -l` → `0`.
- [ ] **No hex in modules:** `grep -n "#[0-9a-fA-F]\{3,6\}" src/*.module.css src/components/*.css | wc -l` → `0`.
- [ ] **Tests:** `npm test` → every file passes; the tests marked `it.fails` are the known defects of the audit.
- [ ] **Lighthouse:** Accessibility = **100** (desktop and mobile).
- [ ] **375px:** the page does not scroll sideways (`document.documentElement.scrollWidth <= window.innerWidth`); only the keyboard region scrolls and it can be reached and scrolled with the keyboard.
- [ ] **Console:** no errors or warnings.
- [ ] **Git history:** `git log --oneline` shows the four HW2 commits above.
