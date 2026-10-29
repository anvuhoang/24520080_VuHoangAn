# Project Rules - HW 2: Concurrent FIFO Audio Visualizer Queue Engine

These rules govern every human and AI agent contribution to this project. They are binding. When a rule conflicts with a convenient shortcut, the rule wins and the conflict is raised in the prompt log. Where the code currently differs from a rule, the difference is listed as a deviation in §8.3 and is open until the Human Lead decides on it.

---

## 1. Scope & Stack

| Area | Rule |
|---|---|
| Language | Vanilla ES2022+ JavaScript (ES Modules). No TypeScript and no build step. Types are documented with JSDoc on every public contract. (Restored under PL-009; the TypeScript build of PL-003 to PL-008 is withdrawn.) |
| Dev dependencies | **None.** Any dev dependency requires explicit human approval. |
| Runtime dependencies | **None.** A new dependency requires a written justification in `PROMPT_LOG.md` and explicit human approval. |
| Markup | Semantic HTML5. Native elements first; ARIA only where native semantics are insufficient. |
| Styling | Plain CSS with custom properties. The current page keeps its styles in a `<style>` block inside `index.html` (deviation D-1, open). |
| Browser target | Latest two versions of Chrome, Edge, Firefox and Safari. Live Server is the supported way to serve the page. |
| Tests | `node --test` (Node's built-in runner), run through `npm test`. Tests import the ES modules directly and need no bundler. |

---

## 2. Concurrency Rules

1. **Bounded in-flight work.** No code path may start more than `maxConcurrency` tasks concurrently. Every task start goes through the queue's permit check. Direct calls that bypass the scheduler are forbidden.
2. **Strict FIFO start order.** Tasks start in enqueue order. Completion order is not guaranteed and must never affect start order or playback order.
3. **No unbounded queues.** Every queue has a `capacity`. Unbounded growth is a defect.
4. **Non-blocking main thread.** Any CPU-bound analysis longer than 16 ms per frame must be moved off the main thread (Web Worker) or chunked. Do not call `decodeAudioData` synchronously on large buffers without yielding. Current status: decoding runs on the browser's decode thread; a Worker-based decode stage is open (OD-3).
5. **Permit release is guaranteed.** Every acquired permit is released in a `finally` block or on the equivalent settlement path. A permit leak is a P0 defect.
6. **No busy-waiting.** Use Promises, events or `await` on a signal. `setTimeout(fn, 0)` polling loops are not acceptable.
7. **Cancellation is cooperative and total.** Every async operation accepts an `AbortSignal` and checks it at each await boundary.

---

## 3. Memory Safety Protocol

These rules apply to all code, human or AI-generated.

### 3.1 Ownership
- Every resource (`AudioContext`, `AnalyserNode`, `AudioBufferSourceNode`, `Blob` URL, `Worker`, event listener, animation frame) has **exactly one owner** documented in a comment at its creation site.
- The owner is responsible for releasing it. Ownership transfer must be explicit and recorded in the code.

### 3.2 Lifecycle Checklist
| Resource | Create | Release |
|---|---|---|
| `AudioContext` | Once, in the engine constructor, after a user gesture | `close()` in `dispose()` |
| `AudioBufferSourceNode` | Per track playback | `stop()` and `disconnect()` on `ended` or abort; `buffer` and `onended` set to `null` |
| `AnalyserNode` | Once per context | `disconnect()` in `dispose()` |
| Decoded `AudioBuffer` | Decode stage | Reference set to `null` after playback or cancel; the pipeline keeps none |
| Object URL | `URL.createObjectURL()` before the load | `URL.revokeObjectURL()` when the load settles, in `finally` |
| `requestAnimationFrame` | Visualizer `start()` | `cancelAnimationFrame()` in `stop()` and `dispose()` |
| Event listeners | `addEventListener` with a stored handler | `removeEventListener` in `dispose()`. Exception: the page-level `pagehide` listener in `index.html` lives for the page lifetime (deviation D-5, open). |

### 3.3 Prohibited Patterns
- Anonymous listeners that cannot be removed.
- Closures that capture an `AudioBuffer` and outlive its playback.
- Creating a new `AudioContext` per track. There is one context per engine instance.
- Allocating a new `Uint8Array` inside the animation loop. Preallocate and reuse.
- Storing decoded audio in global variables or in `localStorage`.
- Calling `dispose()` implicitly through garbage-collection assumptions. Disposal is explicit.

### 3.4 Verification
- Each milestone that creates resources must include a heap snapshot comparison (baseline vs. after N cycles) recorded in `PROMPT_LOG.md`. Not yet done for any milestone (OD-4).
- A retained-size increase above **5%** after a full enqueue-play-dispose cycle is a blocking defect.
- Where a heap snapshot is not possible in the environment, a `FinalizationRegistry` check under `--expose-gc` is an accepted substitute for a single object's lifetime. It does not replace the snapshot.

---

## 4. Agentic Workflow Governance

### 4.1 Roles
| Role | Responsibility |
|---|---|
| Human Lead (Technical PM) | Owns scope, approves milestones, approves dependency changes, signs off on DoD. |
| Implementation Agent | Writes code and tests against `TASK_DECOMPOSITION.md`. Cannot mark its own milestone complete. |
| Review Agent / Human | Reviews diff for concurrency, memory and accessibility rules before merge. |

### 4.2 Work Protocol
1. **Read first.** Every agent session begins by reading this file, `TASK_DECOMPOSITION.md`, and the most recent entries of `PROMPT_LOG.md` and `AI_FAILURE._AUDIT.md`.
2. **Check the tree before editing.** Files in `Hw_2/` may change outside an agent session. Before a session, list the project files and compare them with the last `PROMPT_LOG.md` entry. Record any unexplained difference (see AF-008).
3. **One milestone at a time.** Do not start M(n+1) until M(n) exit criteria are met and recorded.
4. **Tests before implementation** for any contract, queue or scheduler change.
5. **Small diffs.** A single change should touch one module and one concern. Target under 300 changed lines per commit.
6. **No silent scope changes.** If an agent discovers a required task that is not in the decomposition, it must add it to `TASK_DECOMPOSITION.md` with a note, not implement it silently.
7. **Stop on ambiguity.** When a requirement conflicts with a rule in this file, the agent stops and asks the Human Lead.
8. **Automated transformations are verified.** A conversion, formatting or refactoring pass must be checked against its source. Comment text, JSDoc and public declarations must be compared, not only checked for syntax (see AF-007).

### 4.3 Human Gates (agent must not proceed without approval)
- Adding any dependency, including development dependencies.
- Changing a public API signature defined in M1.
- Relaxing a concurrency or memory rule.
- Changing the language or build model (for example, adding TypeScript or a build step).
- Marking a milestone complete.
- Any force-push, history rewrite, or deletion of logs or source files.

### 4.4 Logging Obligations
- Every substantive prompt is logged in `PROMPT_LOG.md` using the entry template in that file.
- Every agent error, hallucination, rule violation or rework is logged in `AI_FAILURE._AUDIT.md` within the same session it is discovered.
- Logs are append-only. Corrections are added as new entries that reference the original.
- Documentation changes that alter a rule or a status are logged in `PROMPT_LOG.md`.

---

## 5. Code Quality & Accessibility

- **Naming:** `camelCase` for values and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants. Names describe intent (`inFlightCount`, not `n`).
- **Comments:** Explain *why*, not *what*. Document ownership and concurrency invariants at the site where they are enforced.
- **Types:** JavaScript has no compile-time types here, so each public contract (options objects, outcome shapes, error classes) is documented with a JSDoc `@typedef` or `@param` block where it is defined.
- **Errors:** Throw typed errors (`QueueFullError`, `TaskAbortedError`, `DecodeError`). Never throw strings.
- **Accessibility:** WCAG 2.2 AA. Contrast ratio 4.5:1 minimum for text. All interactive controls keyboard-operable with visible focus. `prefers-reduced-motion` respected. Live status updates use `aria-live="polite"`.
- **Autoplay:** `AudioContext.resume()` is only invoked inside a user-initiated event handler.

---

## 6. Definition of Done

A task is done only when all of the following are true:
1. Acceptance criteria in `TASK_DECOMPOSITION.md` are met.
2. Tests exist and pass (`npm test`).
3. Concurrency and memory rules in Sections 2 and 3 are satisfied; the relevant owner is documented.
4. No new dependency, or the dependency is approved and logged.
5. Lighthouse Accessibility and Best Practices score is 100 for any milestone that changes UI (M5 onward). Not yet run.
6. Public contracts carry JSDoc (Section 5). Not currently satisfied for the queue and pipeline option objects (AF-007).
7. `PROMPT_LOG.md` entry written; any failure recorded in `AI_FAILURE._AUDIT.md`.
8. Human Lead has reviewed and approved the diff.

---

## 7. Commit & Branch Conventions

- Branch: `lab-2` for development, `main` for release.
- Commit message format: `type(scope): summary` where type is one of `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`.
- Scope examples: `queue`, `scheduler`, `audio`, `visualizer`, `lifecycle`, `docs`.
- Example: `feat(scheduler): gate task start with counting semaphore`
- Add a `.gitignore` containing `node_modules/` before the first commit of `Hw_2/` (not yet present).

---

## 8. Project Layout and Deviations

### 8.1 Layout (`Hw_2/`)

| Path | Purpose | Owner |
|---|---|---|
| `index.html` | Browser entry point. Served by Live Server. Holds the page markup, the styles, and the module script that wires the components. | Page |
| `js/audio-engine.js` | `AudioEngine`: `AudioContext`, `AnalyserNode`, one active source, `dispose()`. | Engine |
| `js/audio-task-queue.js` | `AudioTaskQueue`: bounded concurrent FIFO, cancellation, backpressure; `createTrackExecutor`. | Queue |
| `js/audio-track-pipeline.js` | `AudioTrackPipeline`: owns one engine and one queue; unmount path. | Pipeline |
| `js/spectrum-visualizer.js` | `SpectrumVisualizer`: `requestAnimationFrame` canvas renderer. | Visualizer |
| `test/*.test.js` | Node test suites: engine, queue, memory safety, visualizer. Run with `npm test`. | Tests |
| `docs/` | Governance: task decomposition, project rules, prompt log, failure log. | Governance |
| `package.json` | `"type": "module"` and the `test` script. No dependencies. | Project |

### 8.2 Build and Serving
- No build step. The files in `js/` are the sources. Live Server serves `Hw_2/` directly.
- `npm test` runs all suites. No `node_modules` is needed.

### 8.3 Open Deviations (decision by the Human Lead)

| ID | Rule affected | Deviation | Status |
|---|---|---|---|
| D-1 | §1 Styling | Styles are inline in `index.html`, not in `css/variables.css`. | Open |
| D-5 | §3.2 Event listeners | The page-level `pagehide` listener is not removed. | Open |
| D-7 | §5 Types, §6 item 6 | Queue and pipeline option types and the `Task` contract lost their JSDoc in the TypeScript-to-JavaScript conversion (AF-007). | Open; fix pending approval |

Deviations D-2 to D-4 and D-6 are recorded in `TASK_DECOMPOSITION.md`. The IDs are unique across both documents.
