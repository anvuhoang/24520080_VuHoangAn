# Task Decomposition - HW 2: Concurrent FIFO Audio Visualizer Queue Engine

**Objective:** Build a browser-based audio visualizer driven by a concurrent, bounded, FIFO task queue. Audio tracks are downloaded, decoded and analysed under a fixed concurrency limit, played strictly in arrival order, and rendered to a canvas at a steady frame rate, without leaking memory or blocking the main thread.

**Stack:** Vanilla HTML5, CSS3 and ES2022+ JavaScript (ES Modules). Web Audio API, Promises, `AbortController`, `requestAnimationFrame`. No frameworks, no build step, no runtime or dev dependencies. TypeScript was tried and withdrawn under PL-009.

**Concurrency model (decided up front):** JavaScript executes on a single thread, so "concurrency" here means *overlapping asynchronous work* (network I/O, decoding and scheduling) with a cap on in-flight tasks. The engine must never allow more than `maxConcurrency` tasks in flight, must start tasks in strict FIFO order, and must never let a slow task reorder playback.

**Status legend:** `[x]` done · `[~]` done with a deviation or partly done (see Section "Deviations") · `[ ]` not done

---

## Milestone Overview

| Milestone | Name | Exit Criteria | Status | Evidence |
|---|---|---|---|---|
| M0 | Workspace & Governance | Docs in place, rules accepted, folder layout created | Documentation complete; human review and commit pending | `docs/` (4 files) |
| M1 | Contracts & Interfaces | `Task`, `QueueOptions`, `QueueState` documented; contract tests written | Implemented; the contract declarations were lost in PL-009 (AF-007, open) | `js/audio-task-queue.js`; `test/audio-task-queue.test.js` |
| M2 | Bounded FIFO Queue | Enqueue/dequeue amortised O(1), capacity enforced, backpressure signal emitted | Implemented; no randomised property test | `js/audio-task-queue.js` |
| M3 | Concurrent Scheduler | In-flight count never exceeds limit; completion order does not affect start order | Implemented and tested | `test/audio-task-queue.test.js` |
| M4 | Cancellation & Failure Isolation | `AbortSignal` propagates; one failed task does not stall the queue | Implemented and tested | `test/audio-task-queue.test.js`; `test/memory-safety.test.js` |
| M5 | Audio Pipeline & Visualizer | Decode, analyse and play chain works; canvas renders from `AnalyserNode` | Implemented; browser paint and frame timing not measured | `js/audio-engine.js`; `js/audio-track-pipeline.js`; `js/spectrum-visualizer.js`; `index.html` |
| M6 | Memory Safety & Lifecycle | Zero retained nodes or buffers after `dispose()`; heap snapshot diff verified | Implemented and tested; heap snapshot in DevTools not run | `test/memory-safety.test.js`; `test/audio-engine.test.js` |
| M7 | Accessibility, Audit & Final Review | WCAG 2.2 AA controls, Lighthouse 100 on a11y and best practices, demo recorded | Not started (partial: focus styles, reduced motion) | `index.html` |

---

## Phase 1: Workspace & Governance (M0)
- [~] Create the folder layout. `docs/`, `js/`, `test/` and `index.html` exist. `css/` does not: styles are inline in `index.html` (deviation D-1).
- [ ] Commit the four governance documents. Not committed; `.gitignore` not yet added.
- [ ] Confirm that every agent session reads `PROJECT_RULE.md` before writing code. Process item; recorded in PL-001 onward but not verified per session.

## Phase 2: Contracts & Interfaces (M1)
- [~] Define `Task` shape: `{ id: string, source: string, signal?: AbortSignal }`. Deviation D-2: `priority` and `enqueuedAt` were not implemented (not needed by the FIFO design). The declaration itself was lost in PL-009 (AF-007).
- [~] Define `QueueOptions`: `{ capacity, maxConcurrency, execute, onBackpressure? }`. Deviation D-2: `execute` is required. The declaration was lost in PL-009 (AF-007).
- [x] Define the queue state as a closed set: `IDLE | RUNNING | PAUSED | DISPOSED`, exported as `QueueState`.
- [x] Specify the public API: `enqueue(task)`, `cancel(id)`, `drain()`, `dispose()`. Added beyond the plan: `pause()`, `resume()`, `reset()`.
- [ ] Write contract tests against the API before any implementation (red state first). Not followed. Tests were written after the implementation.

## Phase 3: Bounded FIFO Queue (M2)
- [~] Implement a FIFO with amortised O(1) `push` and `shift`. Deviation D-3: an array with a head index and periodic compaction was used, not a ring buffer or linked list. `Array.prototype.shift()` is not used.
- [x] Enforce `capacity`. When full, `enqueue` rejects with `QueueFullError`.
- [x] Emit a backpressure event when queued depth reaches 80% of capacity. The event re-arms when depth falls below that threshold.
- [ ] Verify FIFO ordering with a randomised property test. Not done. Ordering is covered by deterministic tests (`starts tasks in FIFO order…`).

## Phase 4: Concurrent Scheduler (M3)
- [~] Implement a counting semaphore that gates in-flight tasks at `maxConcurrency`. Deviation D-4: the permit is an in-flight counter inside the queue, not a separate semaphore class. Behaviour is the same.
- [x] Dispatch rule: a task starts only when it is at the head of the FIFO and a permit is free.
- [x] Record start order and completion order separately. Tests assert FIFO start order and that completion order can differ.
- [~] Assert `inFlight <= maxConcurrency` at every dispatch point. The counter is exposed as `inFlightCount` and checked by tests; no runtime assertion is in the dispatch path.

## Phase 5: Cancellation & Failure Isolation (M4)
- [x] Accept an optional `AbortSignal` per task. On abort, the queued task is removed, or a running task's caller is released at once and its permit is released when the executor settles.
- [x] The permit is released in a `finally` block on every path, including throw and abort.
- [x] A rejected task resolves its own outcome with an error; the scheduler loop is not rejected.
- [~] A throw, a hang until abort and a normal completion in one run. Covered by separate tests rather than one combined run.

## Phase 6: Audio Pipeline & Visualizer (M5)
- [x] Stage 1 - **Fetch**: `createTrackExecutor` fetches a URL with the task's signal. The page passes an object URL created from the selected `File`.
- [x] Stage 2 - **Decode**: `AudioContext.decodeAudioData()` runs inside the same queued task, so it is bounded by the same concurrency limit.
- [x] Stage 3 - **Play**: `AudioBufferSourceNode` → `AnalyserNode` → `destination`. Playback follows FIFO order through a chained promise in `index.html`.
- [x] Render loop: `requestAnimationFrame` reads `getByteFrequencyData()` into a preallocated `Uint8Array` and draws bars to a `<canvas>`.
- [x] Autoplay policy: `AudioContext` is created and resumed only inside the "Enable audio" click handler.
- [x] Text equivalent for screen readers: the queue status and activity log use `aria-live="polite"`.
- [ ] Browser paint cost and frame timing measured. Not done; the 60 fps cap is enforced in code only (OD-5).

## Phase 7: Memory Safety & Lifecycle (M6)
- [x] Every `AudioContext` and `AnalyserNode` has a single owner, which calls `disconnect()` and `close()` on `dispose()`.
- [x] Decoded `AudioBuffer` references are dropped after playback or cancel; the pipeline keeps none.
- [x] Every `URL.createObjectURL()` result is revoked with `URL.revokeObjectURL()` when its load settles.
- [x] `requestAnimationFrame` is cancelled on `dispose()`; a test checks that no callback fires afterwards.
- [~] Event listeners are removed on dispose. The engine, queue and visualizer do this. The `pagehide` listener in `index.html` is not removed, because it lives for the page lifetime (deviation D-5).
- [ ] Chrome DevTools heap snapshot: 50 tracks loaded, played and disposed, retained size within tolerance of baseline. Not run. A GC-based test checks that one buffer is collected (OD-4).

## Phase 8: Accessibility, Audit & Final Review (M7)
- [x] Controls (Enable audio, Add tracks, Stop, Cancel pending loads) are native `<button>` or `<label>` elements with visible focus states.
- [ ] Contrast of all UI text and canvas labels meets 4.5:1 (WCAG 2.2 AA). Not measured.
- [x] Respect `prefers-reduced-motion`: the visualizer disables smoothing and caps at 15 fps, and CSS disables transitions and animations.
- [ ] Run Lighthouse; target 100 on Accessibility and Best Practices. Not run.
- [ ] Record a 2-minute demo covering: enqueue burst, concurrency limit visible in UI, cancellation mid-decode, and dispose. Not done. The UI does not yet show the concurrency limit; only the in-flight count is displayed.

---

## Definition of Done (applies to every task)
1. Code reads cleanly and matches the surrounding style; no dead code or commented-out blocks.
2. Contract or unit test exists and passes.
3. No new runtime dependency added.
4. Memory lifecycle for any new resource is documented in the code's owner.
5. The matching `PROMPT_LOG.md` entry is written, and any agent failure is recorded in `AI_FAILURE._AUDIT.md`.
6. Types are documented with JSDoc at each public contract (see AF-007).

---

## Deviations

| ID | Phase | Planned | Actual | Reason | Status |
|---|---|---|---|---|---|
| D-1 | 1 | `css/variables.css` | Styles inline in `index.html` | Single-page app; one file for Live Server | Open. Needs Human Lead approval (see PROJECT_RULE §1 and §8). |
| D-2 | 2 | `Task` with `priority`, `enqueuedAt`; typed contract | Fields omitted; contract declarations lost in PL-009 | FIFO does not use the fields. Declarations lost in the TS → JS conversion | Open (AF-007) |
| D-3 | 3 | Ring buffer or linked list | Array with head index and compaction | Simpler, amortised O(1), tested for retention | Accepted by implementation; not yet approved |
| D-4 | 4 | Separate semaphore class | Counter inside the queue | Fewer moving parts; same invariant | Accepted by implementation; not yet approved |
| D-5 | 7 | All listeners removed on dispose | `pagehide` listener in `index.html` remains | Page-lifetime listener | Accepted by implementation; not yet approved |
| D-6 | 0–8 | TypeScript sources | Withdrawn; plain JavaScript | User request, PL-009 | Closed |

---

## Changes Since the Original Plan

- **PL-003 to PL-008:** Queue, pipeline and visualizer were written in TypeScript, then compiled to `js/` through a build step (PL-008).
- **PL-009:** All TypeScript sources and tests were converted to JavaScript. The build step and TypeScript dependencies were removed. Types were stripped with Node's `strip` mode, which kept comments but dropped 13 JSDoc comments on option fields and erased the interface declarations (AF-007).
- **PL-008:** `index.html` added as the browser entry point. Verified in headless Edge: module loading, enable-audio gesture, and file load with playback.
