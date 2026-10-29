# Prompt Log - HW 2: Concurrent FIFO Audio Visualizer Queue Engine

## 1. Purpose and Conventions

This log records every substantive prompt issued to an AI agent on this project, together with its intent, outputs, verification evidence and human disposition. It serves as the traceability record between requirements, implementation and test evidence.

**Conventions**

- **Append-only.** Entries are never deleted or rewritten. A correction is recorded as a new entry that references the original ID.
- **Milestone-organised.** Entries are grouped by the five engineering milestones in Section 3. Each entry keeps its original sequential ID (`PL-NNN`), so chronology is still recoverable.
- **Verification is mandatory.** The `Verification` field must contain executed results, not intentions. Items that were not verified are listed explicitly under `Not verified`.
- **Cross-references.** Task identifiers (`M0`–`M7`) refer to `TASK_DECOMPOSITION.md`. Rule identifiers (§n) refer to `PROJECT_RULE.md`. Failure identifiers (`AF-NNN`) refer to `AI_FAILURE._AUDIT.md`.

---

## 2. Milestone Index

| Milestone | Name | Entries | Task reference | Status | Test evidence (at last entry) |
|---|---|---|---|---|---|
| **MS-1** | Project Architecture Setup | PL-001 | M0 | Complete (documentation); human review pending | None (documentation only) |
| **MS-2** | Web Audio Analyser Integration | PL-002 | M5 (partial) | Engine complete; exercised in headless Edge through `index.html` (PL-008, PL-009); autoplay gating and heap snapshot still open | 21 tests |
| **MS-3** | FIFO Queue Concurrency Controller | PL-003 | M1–M4 | Controller complete, now in JavaScript (TypeScript withdrawn, PL-009). The contract declarations were lost in conversion (AF-007, open) | 22 tests |
| **MS-4** | Memory Safety & AbortController Implementation | PL-004 | M6 (partial) | Implementation complete; heap-snapshot verification pending | 9 tests (GC test under `--expose-gc`) |
| **MS-5** | 60 fps Visualizer Optimization | PL-005 | M5 (completion) | Implementation complete; in-browser timing pending | 14 tests |

**Cumulative automated evidence (current, after PL-009):** `npm test` reports 66 passing, 0 failing, across four suites, with no dependencies installed. The TypeScript toolchain and its type-check were withdrawn in PL-009, so there is no longer a type-check step.

**Cross-cutting entries (PL-006 to PL-010)** cover the test-suite review, the type environment (withdrawn), the browser entry point, the conversion to JavaScript, and the documentation update. They are filed under the milestone they touch in Section 3.

---

## 3. Milestone Log

### MS-1 — Project Architecture Setup

Establishes the workspace, governance documents and the constraints that every later milestone must satisfy.

#### PL-001 | 2026-10-29 | M0 - Workspace & Governance

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Planning / Docs
- **Intent:** Initialise the HW 2 workspace and generate the four governance documents: task decomposition, project rules, prompt log and failure log.
- **Prompt (summary):** Act as a Technical Project Manager. Initialise the workspace for HW 2 - Concurrent FIFO Audio Visualizer Queue Engine. Generate `TASK_DECOMPOSITION.md`, `PROJECT_RULE.md`, `PROMPT_LOG.md` and `AI_FAILURE._AUDIT.md`, establishing strict agentic workflow governance, concurrency milestones and memory safety protocols. Work in the `Hw_2` folder.
- **Context supplied:** Existing repository layout; `Hw_1/docs/` and `Hw_3/docs/` used as structural reference.
- **Output:**
  - `Hw_2/docs/TASK_DECOMPOSITION.md` (milestones M0–M7, phased tasks, Definition of Done)
  - `Hw_2/docs/PROJECT_RULE.md` (stack, concurrency rules, memory protocol, human gates, logging obligations)
  - `Hw_2/docs/PROMPT_LOG.md` (this file, with template)
  - `Hw_2/docs/AI_FAILURE._AUDIT.md` (failure log with template and pre-registered risks)
- **Verification:** Documents reviewed for internal consistency against each other (milestone IDs, rule numbers, file names). No code executed; no code exists in this milestone.
- **Human decision:** Pending review.
- **Notes:**
  - Decision recorded: JavaScript is single-threaded, so "concurrency" is defined as bounded overlap of asynchronous work, not parallel execution. Revisit if a Web Worker decode stage is adopted in M5.
  - No runtime dependencies. Any change requires a new PL entry and human approval.

---

### MS-2 — Web Audio Analyser Integration

Implements the `AudioContext`, the `AnalyserNode` (FFT size 256 or 512) and the per-track source lifecycle.

#### PL-002 | 2026-10-29 | M5 (partial) - Audio Engine Core

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation
- **Intent:** Implement the core audio engine: Web Audio `AudioContext` with an `AnalyserNode` (fftSize 256 or 512) for real-time frequency analysis, with zero leaks and explicit context lifecycle.
- **Prompt (summary):** Implement the core audio processing engine integrating the Web Audio API with an `AnalyserNode` (FFT size 256/512) for real-time frequency analysis, ensuring zero memory leaks and proper audio context lifecycle management.
- **Context supplied:** `PROJECT_RULE.md` Sections 2–3 (ownership and lifecycle table), `TASK_DECOMPOSITION.md` Phases 6–7.
- **Output:**
  - `Hw_2/js/audio-engine.js`: `AudioEngine` class. Owns the context, analyser and frequency buffer; one active source at a time; `resume()`, `decode()`, `play()`, `stop()`, `getFrequencyData()`, `dispose()`.
  - `Hw_2/test/audio-engine.test.js`: 21 tests against an injected fake `AudioContext`.
  - `Hw_2/package.json`: `"type": "module"` and a `test` script. No dependencies.
- **Verification:** `npm test` in `Hw_2/`: 21 pass, 0 fail (Node v24.13.1). Covers FFT validation (rejects 128, 1024, strings and null before any context is created), bin counts (512→256, 256→128), a preallocated frequency buffer reused across calls, playback `ended`/`stopped` resolution, stale `ended` events not settling a newer track, a rejected `start()` leaving no dangling state, idempotent and concurrent `dispose()`, listener removal, and 50 create-play-dispose cycles with no live sources or listeners.
- **Not verified:** No real browser run. Real `AudioContext` behaviour, autoplay gating and heap snapshots (M6 exit criterion) are still pending.
- **Human decision:** Pending review.
- **Notes:**
  - "FFT size of 256/512 bins" was read as `fftSize` ∈ {256, 512}, which gives `frequencyBinCount` 128 or 256. Other power-of-two sizes are rejected deliberately.
  - `decodeAudioData` detaches the input `ArrayBuffer`; the docstring states this.
  - `play()` is tied to `stop()` and resolves `'ended' | 'stopped'`, so M5's sequential FIFO playback can await each track.

---

### MS-3 — FIFO Queue Concurrency Controller

Implements the bounded FIFO, the permit-based concurrency limit, the backpressure signal and the deterministic settlement rules.

#### PL-003 | 2026-10-29 | M1–M4 - Concurrent FIFO Task Queue (TypeScript)

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation
- **Intent:** Build `AudioTaskQueue`, a concurrent FIFO controller for simultaneous track download and decode, with explicit `AbortController` cancellation tokens and race-free state management.
- **Prompt (summary):** Build the concurrent FIFO queue controller (`AudioTaskQueue`) in TypeScript, mirroring the specification to handle simultaneous track downloads and audio buffer decoding. Implement explicit cancellation tokens via `AbortController` and state management to prevent race conditions during task execution.
- **Context supplied:** `TASK_DECOMPOSITION.md` M1–M4 (contracts, bounded FIFO, semaphore scheduler, cancellation); `PROJECT_RULE.md` Sections 2–3.
- **Output:**
  - `Hw_2/ts/audio-task-queue.ts`: `AudioTaskQueue`, error classes, `QueueState` (IDLE / RUNNING / PAUSED / DISPOSED), `createTrackExecutor` (fetch, then decode, in one queued task).
  - `Hw_2/test/audio-task-queue.test.ts`: 22 tests.
  - `Hw_2/tsconfig.json`: strict, `erasableSyntaxOnly`, DOM lib. Used for type-checking only.
  - `Hw_2/package.json`: `test` script runs both suites.
- **Design decisions:**
  - Permit tied to executor settlement. Cancelling a running task resolves the caller at once, but the permit is released only when the executor settles. This keeps the in-flight bound true even for executors that ignore the signal.
  - `#settle()` is the single exit point, guarded by a `settled` flag, so each task resolves once. Abort is invoked after settlement, so a re-entrant abort listener cannot double-count.
  - A late value from a cancelled task is discarded.
  - Cancellation is O(1) via tombstones in the FIFO. Dispatch skips settled entries.
  - Re-entrant `enqueue` from inside an executor is handled by a reconcile guard.
  - `enqueue` rejects only for misuse (duplicate id, full queue, disposed). Task failures and cancellations resolve the outcome.
- **Verification:**
  - `npm test`: 43 pass, 0 fail (21 engine, 22 queue), Node v24.13.1.
  - `npx -y -p typescript@5 tsc -p tsconfig.json`: exit 0, strict mode. One-off download; not added to `package.json`.
  - Covered: FIFO start order with peak concurrency ≤ 3; completion order decoupled from start order; `QueueFullError`; backpressure fires once and re-arms; cancellation of queued and running tasks; non-cooperative executor holds its permit; discarded late values; caller-signal listener removed on settlement; 40 rounds of cancel-versus-completion races; failure isolation; re-entrant enqueue; pause, drain and dispose; track pipeline error typing.
- **Not verified:** Real browser `fetch` and `decodeAudioData` behaviour; the M6 heap snapshot.
- **Human decision:** Pending review.
- **Notes:**
  - **Rule conflict, decision required.** `PROJECT_RULE.md` §1 states "No TypeScript build step" and "Vanilla ES2022+ JavaScript". The TypeScript request conflicts with that rule. The request was followed. Tests run under Node 24 type stripping, which needs no build. A browser cannot load `.ts`, so shipping to a page requires either a transpile step (an approved development dependency such as `tsc` or `esbuild`) or a JavaScript build. Decide, and amend §1 if approved.
  - `tsc` was not added as a dependency. Adding it is a human gate under PROJECT_RULE §4.3.
  - A hung test was traced to a test-authoring ordering error (`drain()` awaited before a gate was resolved). The queue behaved correctly. Logged as AF-001.
  - Test files are not type-checked. `tsconfig.json` includes only `ts/`.

---

### MS-4 — Memory Safety & AbortController Implementation

Implements deterministic teardown, `AbortSignal` propagation to fetch and decode, queue reset, and buffer lifetime control.

#### PL-004 | 2026-10-29 | M6 (partial) - Memory Safety & Signal Propagation

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation
- **Intent:** Strict memory safety for the audio pipeline: explicit `AudioBufferSourceNode` cleanup, buffer garbage-collection hygiene, and `AbortSignal` propagation that cancels pending fetch and decode work on unmount or queue reset.
- **Prompt (summary):** Implement strict memory safety mechanisms for the audio pipeline. Ensure explicit cleanup of `AudioBufferSourceNode` instances, GC optimisation for audio buffers, and `AbortSignal` propagation to cancel pending fetch and decode tasks immediately on unmount or queue reset.
- **Output:**
  - `Hw_2/ts/audio-task-queue.ts`:
    - `reset()`: cancels every active task, clears the FIFO, and holds dispatch off during the cancellation so nothing starts only to be cancelled.
    - Tombstone compaction: cancelled queued entries are removed from the FIFO array once they exceed `max(16, queuedCount)`.
    - `retainedSlots` getter, exposed so tests can bound retention.
  - `Hw_2/ts/audio-track-pipeline.ts` (new): `AudioTrackPipeline`, the single owner of the engine and queue. `dispose()` is the unmount path. Teardown order: stop playback, cancel the queue and wait for in-flight decodes, then close the context.
  - `Hw_2/test/memory-safety.test.ts` (new): 9 tests. *(Corrected from "12" in the original output line. See Section 4, correction C-1.)*
  - `Hw_2/tsconfig.json`: `allowImportingTsExtensions` added.
  - `Hw_2/package.json`: test script runs with `--expose-gc`.
- **Design decisions:**
  - **Decode cannot be interrupted.** `decodeAudioData` has no abort. On cancellation the caller is released at once, but the concurrency permit stays held until the native decode returns. The late buffer is dropped, so it can be garbage-collected. Immediate decode cancellation would require a Worker that can be terminated; this is a stack change and needs approval.
  - **Buffers have no explicit free.** Web Audio offers no way to free an `AudioBuffer`. The only levers are dropping references promptly and not retaining them. The pipeline keeps no reference to a loaded buffer. Stopped sources clear `buffer` and `onended`.
  - **Teardown order.** The engine is disposed last, because in-flight decodes need the `AudioContext` alive.
- **Verification:**
  - `npm test`: 52 pass, 0 fail (21 engine, 22 queue, 9 memory-safety; the GC test runs under `--expose-gc`).
  - `npx -y -p typescript@5 tsc -p tsconfig.json`: exit 0, strict. One-off download; not added to `package.json`.
  - Covered: dispose aborts a pending fetch and closes the context last; dispose waits for an in-flight decode; the active source is stopped and its references dropped; reset cancels running and queued work and the queue stays usable; a late decode after reset is dropped and its buffer is collected (verified with `FinalizationRegistry`); caller `AbortSignal` propagates to fetch; tombstone churn of 5,000 cancels leaves at most 17 FIFO slots.
- **Not verified:** Real browser abort behaviour of `fetch` and `decodeAudioData`; the M6 heap-snapshot check in DevTools.
- **Human decision:** Pending review.
- **Notes:**
  - Open decision: Worker-based decode for immediate cancellation (requires stack approval).
  - Four test-authoring errors were caught by the suite and are recorded in `AI_FAILURE._AUDIT.md` as AF-001 to AF-005. (AF-001 and AF-002 concern PL-003; AF-003 to AF-005 concern this entry.)

---

### MS-5 — 60 fps Visualizer Optimisation

Implements the `requestAnimationFrame` render loop with frame pacing, change-gated redraws, batched canvas calls and DOM-read-free resizing.

#### PL-005 | 2026-10-29 | M5 (completion) - rAF Spectrum Visualizer

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation
- **Intent:** A 60 fps frequency visualizer driven by `requestAnimationFrame`, optimised to avoid state thrashing, DOM reflow and unnecessary redraws during spectrum updates.
- **Prompt (summary):** Develop a high-performance 60 fps Canvas or SVG frequency visualizer driven by `requestAnimationFrame`. Optimise the render loop to prevent state thrashing, DOM reflow bottlenecks and unnecessary redraws during spectrum updates.
- **Output:**
  - `Hw_2/ts/spectrum-visualizer.ts`: `SpectrumVisualizer` (Canvas 2D). Injected scheduler and source, so it runs without a browser.
  - `Hw_2/test/spectrum-visualizer.test.ts`: 14 tests, using a recording fake canvas and a hand-driven frame scheduler.
  - `Hw_2/package.json`: test script includes the new suite.
- **Design decisions:**
  - **Canvas, not SVG.** One canvas draws every bar in one path and one fill. SVG would require one DOM node per bar, with style or attribute writes every frame, which causes reflow and style recalculation.
  - **Frame cap.** Frames arriving early are dropped before any work, with a 1 ms tolerance so 60 Hz timestamp jitter does not drop real frames. A 120 Hz display draws at 60 fps.
  - **Redraw only on change.** After smoothing, each bar's integer pixel height is compared with its last drawn height. The canvas is redrawn only when a height or the size changed. Silence settles to zero draws.
  - **No DOM reads in the loop.** `ResizeObserver` only stores the new size, applied at the start of the next frame. Layout is never read inside a frame, so no forced reflow occurs.
  - **Backing store assigned only on pixel-size change**, because assignment clears the context.
  - **Gradient cached per resize**, not rebuilt per frame. One `beginPath`, one `fill` and at most one `fillStyle` write per draw.
  - **Bins mapped to bars on a log scale.** Each bar takes the peak of its bin range, and every bar covers at least one bin.
  - **Reduced motion** disables smoothing and caps the rate at 15 fps.
  - **Preallocated state.** Levels, heights, the bin map and the drawn-heights snapshot are typed arrays allocated once.
- **Verification:**
  - `npm test`: 66 pass, 0 fail (21 engine, 22 queue, 9 memory-safety, 14 visualizer). Covered: 120 Hz pacing yields about 60 processed frames per second; no jitter throttling at 60 Hz; unchanged spectrum skipped with no context calls; decay settles; one fill and one `beginPath` per draw; a single bin lights one bar; resize applied at frame start; no canvas write when the size is unchanged or reverted; stop cancels the pending frame; dispose is idempotent.
  - `tsc -p tsconfig.json` (strict): exit 0.
  - No failures this round; nothing was logged to `AI_FAILURE._AUDIT.md`.
- **Not verified:**
  - Real paint cost and frame timing in a browser. The 60 fps figure is enforced by the frame cap in code and has not been measured on hardware. A DevTools Performance recording is required.
  - Integration with `index.html` and the `AudioEngine` play/pause flow. The host is expected to call `start()` on play and `stop()` on pause.
- **Human decision:** Pending review.
- **Notes:**
  - The visualizer is not yet wired into a page. That is a separate step once the mount point is decided.

---

## 4. Corrections Register

Corrections are recorded here and never edit the original entry text beyond the marked fix.

| ID | Date | Entry | Correction | Reason |
|---|---|---|---|---|
| C-1 | 2026-10-29 | PL-004 | "12 tests" in the Output section corrected to "9 tests". | The memory-safety suite contains 9 tests (4 unmount, 2 reset, 1 caller signal, 1 buffer lifetime, 1 retention bound). The Verification section already reported 9, and the total of 52 is consistent with 9. |
| C-2 | 2026-10-29 | PL-001, PL-003, PL-004, PL-005, PL-006, PL-007 and AF-001 to AF-006 | File-path references to `AI_FAILURE.md` are read as `AI_FAILURE._AUDIT.md`. Entry text is otherwise unchanged. | The failure log was renamed on disk to `docs/AI_FAILURE._AUDIT.md`. The user chose to keep that name (PL-008). The historical references are updated so they point to the existing file. |
| C-3 | 2026-10-29 | PL-003 to PL-008 | The TypeScript build decisions are withdrawn. The sources are JavaScript now (PL-009). Entries stay as written, and their statements about `ts/`, `tsc` and the build describe the state at the time. | The user asked for all `.ts` files to be converted to `.js` (PL-009). `PROJECT_RULE.md` §1 is restored to vanilla JavaScript. |

---

## 5. Open Decisions Register

Decisions raised by entries that require a human decision before the affected milestone can close.

| ID | Raised in | Decision | Affected milestone | Status |
|---|---|---|---|---|
| OD-1 | PL-003 | Permit to adopt TypeScript despite PROJECT_RULE §1. | MS-3 | Withdrawn (PL-009): the sources are JavaScript and §1 is restored |
| OD-2 | PL-003 | Approve development dependencies under PROJECT_RULE §4.3. `@types/node` and `typescript` were approved and installed (PL-007, PL-008); both were removed with the TypeScript sources (PL-009). | MS-3 | Withdrawn (PL-009) |
| OD-3 | PL-004 | Approve a Worker-based decode stage so that decode work can be terminated on cancellation. | MS-4 | Open |
| OD-4 | PL-002, PL-004 | Browser verification of `AudioContext` lifecycle, autoplay gating and heap snapshots (M6 exit criterion). Partly done: the enable-audio gesture and file playback were exercised in headless Edge (PL-008, PL-009). Heap snapshot not run. | MS-2, MS-4 | Partly resolved |
| OD-5 | PL-005 | Browser measurement of visualizer frame timing (DevTools Performance). | MS-5 | Open |
| OD-6 | PL-005 | Mount point for the visualizer and wiring to the engine play/pause flow. | MS-5 | Resolved (PL-008): `index.html` mounts the visualizer and starts or stops it with playback |
| OD-7 | PROJECT_RULE §8.3 (D-1) | Styles are inline in `index.html`, not in `css/variables.css`. Approve or require a `css/` file. | Docs, MS-5 | Open |
| OD-8 | PROJECT_RULE §8.3 (D-5) | The page-level `pagehide` listener is not removed. Approve as page-lifetime, or require a removal path. | MS-4 | Open |
| OD-9 | AF-007 (D-7) | Restore the JSDoc and the contract declarations that the conversion dropped. This changes source files, so it needs approval before work starts. | MS-3 | Open, P1 |
| OD-10 | AF-008 | Explain or confirm the project changes made outside an agent session, and whether the missing tsconfig files should stay absent. | All | Open, P1 |
| OD-11 | Repository | Add a `.gitignore` for `node_modules/` and commit the Hw_2 state (PROJECT_RULE §7). | All | Open |

---

## Appendix A — Entry Template

```markdown
#### PL-<NNN> | <YYYY-MM-DD> | <Milestone identifier> - <Title>

- **Agent / Model:** <name and model ID>
- **Role:** <Implementation | Review | Docs | Planning>
- **Intent:** <one sentence: outcome sought>
- **Prompt (summary or full):** <verbatim prompt, or a faithful summary if long>
- **Context supplied:** <files, rules or prior entries provided to the agent>
- **Output:** <files created or changed, with paths>
- **Design decisions:** <material choices and their rationale>
- **Verification:** <commands run, results, and evidence such as heap snapshot figures>
- **Not verified:** <explicitly listed gaps>
- **Human decision:** <accepted | accepted with edits | rejected | rework | pending review>
- **Notes:** <deviations from PROJECT_RULE.md, open questions, cross-references>
```

---

### MS-3 (continued) — Test Suite Review

#### PL-006 | 2026-10-29 | M3 - Queue Test Suite Defect Fixes

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Review / Implementation
- **Intent:** Correct defects in `test/audio-task-queue.test.ts` reported by the user, so the suite specifies behaviour rather than only detecting hangs.
- **Prompt (summary):** The user opened `Hw_2/test/audio-task-queue.test.ts` and reported that it contains bugs.
- **Context supplied:** The test file; `ts/audio-task-queue.ts`; `tsconfig.json` (include restricted to `ts/`).
- **Output:** `Hw_2/test/audio-task-queue.test.ts`:
  - Race test asserts the exact outcome of each task (even indices cancelled, odd indices completed with values).
  - Guarded the running-task lookup in the FIFO test.
  - Narrowed union and `cause` accesses with explicit guards.
  - Replaced `setImmediate` with `setTimeout(resolve, 0)`.
- **Findings from review:**
  - All 22 tests passed before the change, and 8 of 8 repeated runs were stable. The defects were in the assertions and typing, not in test pass rate.
  - The strict type check of the test file reported 5 typing errors (lines 84, 307, 334, 474 and 475), plus the `setImmediate` global. After the change it reports none apart from the `node:` module declarations.
- **Verification:**
  - `node --expose-gc --test --test-timeout=5000 test/audio-task-queue.test.ts`: 22 pass, 0 fail.
  - `tsc --noEmit --strict --noUncheckedIndexedAccess --allowImportingTsExtensions --lib ES2022,DOM` on the test file: no errors other than the missing `node:` module declarations, which need `@types/node`.
  - The strengthened race test has not been mutation-tested. A deliberate bug in the queue (for example, letting a cancelled task resolve `ok`) should make it fail. That check is still to do.
- **Not verified:** Mutation testing of the strengthened assertions; full type-checking of `node:test` imports, which requires `@types/node` (a human gate under PROJECT_RULE §4.3).
- **Human decision:** Pending review.
- **Notes:**
  - Logged as AF-006.
  - The dependency question (`@types/node`) joins open decision OD-2 in the register.

---

#### PL-007 | 2026-10-29 | M3 - Type Environment for Test Suite

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation (tooling)
- **Intent:** Let the editor and `tsc` resolve `node:test` and `node:assert/strict`, so the test suite can be type-checked alongside the sources.
- **Prompt (summary):** The IDE reported "Cannot find name 'node:test'" and "Cannot find name 'node:assert/strict'" in `test/audio-task-queue.test.ts`, and suggested installing `@types/node` and adding it to the tsconfig `types` field. The user selected the install option when asked.
- **Approval:** Explicit user approval, given through the question dialog, for the dependency under PROJECT_RULE §4.3. Closes the `@types/node` part of OD-2.
- **Output:**
  - `Hw_2/package.json`: `devDependencies` gains `"@types/node": "^24.19.2"`. Type declarations only; no runtime effect.
  - `Hw_2/package-lock.json` and `Hw_2/node_modules/`: created by the install. `node_modules/` is not yet ignored by git (no `.gitignore` in `Hw_2/`).
  - `Hw_2/tsconfig.json`:
    - `types: ["node"]`
    - `include` extended to `test/**/*.ts`
    - `allowJs: true` and `checkJs: false`, so the JavaScript engine module imported by the tests has a type shape. Its JavaScript is not type-checked.
  - Fixes exposed by including the tests:
    - `test/memory-safety.test.ts`: non-null assertion on `signals[0]` (two places).
    - `test/spectrum-visualizer.test.ts`: snapshot counters typed as `Record<string, number>`; rect tuples typed as `[number, number, number, number]`.
- **Verification:**
  - `npx -y -p typescript@5 tsc -p tsconfig.json` (strict, `noUncheckedIndexedAccess`): exit 0, covering `ts/` and `test/`.
  - `npm test`: 66 pass, 0 fail.
- **Not verified:** Editor (IDE) diagnostics after reload. The tsc result is the reference.
- **Human decision:** Accepted (dependency approved; see above).
- **Notes:**
  - `tsc` itself is still a one-off `npx` download and is not a project dependency. That part of OD-2 remains open.
  - Recommend adding a `.gitignore` containing `node_modules/` before committing. Not done; awaiting your instruction.

---

#### PL-008 | 2026-10-29 | M5 - Browser Entry Point and Compiled Output

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation
- **Intent:** Provide a browser entry point that runs under Live Server, and remove files that the served page does not need.
- **Prompt (summary):** "I use live server so lets write index.html file and remove unnecessary file."
- **Decisions taken with the user (question dialog):**
  - **Browser code:** compile the TypeScript sources to JavaScript in `js/` and commit the output. Option chosen: "Compile TS to js/ (Recommended)".
  - **Removal:** `node_modules/` and `package-lock.json`. Option chosen: those two.
  - **Failure log name:** keep the renamed file `docs/AI_FAILURE._AUDIT.md`. Option chosen: "Keep the new name".
- **Output:**
  - `Hw_2/index.html` (new): controls, visualizer canvas, queue status and an activity log. The AudioContext is created only on the "Enable audio" click, so the page complies with autoplay policy. Tracks load from the file input; each object URL is revoked once its load settles. Playback is in FIFO order, skipping any track invalidated by Stop or Cancel. Unmount on `pagehide` disposes the visualizer before the pipeline.
  - `Hw_2/tsconfig.build.json` (new): extends `tsconfig.json`, emits `ts/` to `js/`, with `rewriteRelativeImportExtensions`, so the emitted imports end in `.js`.
  - `Hw_2/js/`: compiled output, committed: `audio-task-queue.js`, `audio-track-pipeline.js`, `spectrum-visualizer.js` (generated); `audio-engine.js` (hand-written, unchanged).
  - `Hw_2/package.json`: scripts `build` (`tsc -p tsconfig.build.json`) and `typecheck` (`tsc -p tsconfig.json`). Dev dependency `typescript@^5.9.3` added.
  - `Hw_2/docs/PROJECT_RULE.md` §1: the language row is amended to permit a development-time build (`npm run build`) with committed output. A dev-dependency row is added.
  - `docs/AI_FAILURE.md` references updated to `AI_FAILURE._AUDIT.md` in `PROJECT_RULE.md`, `TASK_DECOMPOSITION.md` and `PROMPT_LOG.md` (see correction C-2).
  - Removed: `Hw_2/node_modules/` and `Hw_2/package-lock.json`.
- **Verification:**
  - `npm run build`: exit 0. Emitted imports are `./audio-task-queue.js` and similar.
  - `npm run typecheck` (`tsc -p tsconfig.json`, strict): exit 0. This ran before `node_modules` was removed.
  - `npm test`: 66 pass, 0 fail. Run after removal, with no `node_modules`.
  - Headless Microsoft Edge 155 under the DevTools protocol, served over HTTP from `Hw_2/`:
    - All four module URLs return 200. Dynamic `import()` of `js/audio-track-pipeline.js` resolves to a function. No page exceptions or console errors.
    - A real mouse click on "Enable audio" sets the status to `Context: running · Queued: 0 · In flight: 0` and unlocks the file input.
    - A generated 1-second, 440 Hz WAV attached to the file input produces the activity log entries "decoded, playing" and then "finished".
- **Not verified:**
  - Live Server specifically. The check used a Python static server on the same folder, which serves the same paths.
  - The spectrum drawing itself. The DOM and log were checked; the pixels were not.
  - Safari and Firefox.
- **Human decision:** Accepted by the user's answers, pending review.
- **Notes:**
  - `npm run build` and `npm run typecheck` need `npm install` first, because `node_modules/` was removed. The served page needs neither: `js/` is committed.
  - `typescript` is now a project dev dependency, so the earlier one-off `npx` downloads are no longer needed. Dependency approval is recorded here, under PROJECT_RULE §4.3.
  - No `.gitignore` exists in `Hw_2/`. Add one with `node_modules/` before committing.

---

#### PL-009 | 2026-10-29 | M3-M6 - Conversion of TypeScript Sources to JavaScript

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Implementation (refactor)
- **Intent:** Convert every `.ts` source and test file to JavaScript, so the project is plain JavaScript again and runs without a build step.
- **Prompt (summary):** "chuyển hết file ts sang js được không" (can you convert all the ts files to js?)
- **Approach:**
  - Types were removed with Node's built-in `stripTypeScriptTypes` in `strip` mode. The mode keeps comments and line layout. `transform` mode was rejected because it drops every comment, and the project's design rationale is in those comments.
  - A cleanup pass closed the gaps left by removed types. The pass skipped comment lines, so comment text is unchanged. The first version of the pass did alter comments, and the output was regenerated from the backups, so the final files carry no such damage.
  - Relative import specifiers were changed from `.ts` to `.js`. Test imports were changed from `../ts/` to `../js/`.
- **Output:**
  - `Hw_2/js/audio-task-queue.js`, `Hw_2/js/audio-track-pipeline.js`, `Hw_2/js/spectrum-visualizer.js` (converted). `Hw_2/js/audio-engine.js` is unchanged.
  - `Hw_2/test/audio-task-queue.test.js`, `Hw_2/test/memory-safety.test.js`, `Hw_2/test/spectrum-visualizer.test.js` (converted). `Hw_2/test/audio-engine.test.js` is unchanged.
  - Removed: `Hw_2/ts/` and the three `.ts` test files.
  - `Hw_2/package.json` recreated: `"type": "module"`, and a `test` script that points at the `.js` files. Dependencies are removed.
  - `PROJECT_RULE.md` §1 restored to vanilla JavaScript with no build step. The dev-dependency row now reads "None".
- **Backup:** The `.ts` originals are in the session scratchpad at `hw2-ts-backup/` (`ts/` and `test/`). The scratchpad is session-scoped and is not part of the repository.
- **Verification:**
  - `node --check` on every `.js` file in `js/` and `test/`: all pass.
  - `npm test`: 66 pass, 0 fail, with no `node_modules`.
  - Headless Microsoft Edge 155 over HTTP, served from `Hw_2/`: `index.html` loads with no exceptions. A real click on "Enable audio" sets the status to `Context: running`. A generated 440 Hz WAV loaded through the file input logs "decoded, playing" and then "finished".
- **Not verified:**
  - The type-checking that the TypeScript build gave is no longer available. The JSDoc comments are the only type documentation now.
  - Live Server itself (the check used a Python static server on the same folder).
- **Anomalies found during this change (not caused by this change, not resolved):**
  - `Hw_2/package.json`, `Hw_2/tsconfig.json` and `Hw_2/tsconfig.build.json` were missing when this session began the conversion. They had been present at the end of PL-008. `package.json` was recreated here because the JavaScript project needs `"type": "module"`. The two tsconfig files are not recreated, since the TypeScript toolchain is withdrawn.
  - Several files under `docs/` and `js/` carry timestamps that this session did not produce. The user was asked to confirm how the folder was changed.
- **Human decision:** Pending review. The user requested the conversion directly.
- **Notes:**
  - The earlier `.gitignore` recommendation (PL-008) still applies to `node_modules/`. There is no longer a `node_modules/` requirement.

---

#### PL-010 | 2026-10-29 | M0 (governance) - Update of All Governance Documents

- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Role:** Docs
- **Intent:** Bring all four governance documents in `Hw_2/docs/` up to the project's actual state after the conversion to JavaScript and the browser entry point.
- **Prompt (summary):** "lets update all file in Hw_2/docs/"
- **Context supplied:** The four documents as they stood on disk; the file tree of `Hw_2/`; the comment comparison between the TypeScript backup and the converted files.
- **Output:**
  - `TASK_DECOMPOSITION.md`: rewritten. Each item carries its real status (`[x]`, `[~]`, `[ ]`). Milestone statuses and evidence are updated. A deviations table (D-1 to D-6) and a changes section are added.
  - `PROJECT_RULE.md`: rewritten. §1 states the current language and dev-dependency policy. §3.2 and §3.4 reflect the implemented lifecycle and the substitute check. §4.2 adds a tree check and a verification rule for automated transformations. §4.3 adds the language change as a human gate. §5 and §6 require JSDoc on public contracts. New §8 gives the file layout and the open deviations (D-1, D-5, D-7).
  - `AI_FAILURE._AUDIT.md`: maintenance note added. Two categories added (`REFACTOR_DAMAGE`, `PROCESS_DRIFT`). Pre-registered risks R-16 and R-17 added. AF-007 (P1, open) and AF-008 (P1, open) recorded.
  - `PROMPT_LOG.md`: milestone index, evidence line and open-decisions register updated. OD-1 and OD-2 withdrawn; OD-6 resolved; OD-4 partly resolved; OD-7 to OD-11 added. This entry added.
- **Decisions in this update:**
  - Deviations are listed, not accepted. D-1, D-5 and D-7 stay open until the Human Lead decides, because the rules are binding and the code differs from them.
  - The deviation IDs are unique across `TASK_DECOMPOSITION.md` and `PROJECT_RULE.md` (D-2 to D-4 and D-6 in the first; D-1, D-5 and D-7 in the second).
- **Verification:**
  - Every checkbox was checked against the tree or a log entry. `Phase 3 FIFO property test`, `Phase 7 heap snapshot`, `Phase 8 contrast and Lighthouse` and `demo` are marked not done.
  - The comment comparison (AF-007) was rerun: 13 JSDoc lines differ across the three source modules; the test files are unchanged.
  - Stale-reference search over `TASK_DECOMPOSITION.md`, `PROJECT_RULE.md` and `AI_FAILURE._AUDIT.md` for `tsc`, `tsconfig`, `.ts` and `npm run build`: every remaining hit describes the withdrawal (PL-009) or a deviation, so no current instruction refers to a removed tool.
- **Not verified:** No source file was changed in this entry. The AF-007 fix and the AF-008 explanation are open.
- **Human decision:** Pending review.
- **Notes:**
  - Nothing was committed. `.gitignore` is still missing (OD-11).

---

<!-- Next entry: PL-011 -->
