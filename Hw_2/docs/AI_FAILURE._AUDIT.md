# AI Failure Log - HW 2: Concurrent FIFO Audio Visualizer Queue Engine

This log records every failure, hallucination, rule violation, or rework caused by an AI agent on this project. Its purpose is to make agent reliability measurable and to turn each failure into a guard against the next one. It is append-only.

**Maintenance note.** AF-001 to AF-006 refer to `*.ts` files (for example `test/audio-task-queue.test.ts`). Those sources were converted to JavaScript under PL-009; the same-named `*.js` files now hold the code. The entries are otherwise unchanged. See correction C-3 in `PROMPT_LOG.md`.

---

## Severity Scale

| Level | Definition | Required Response |
|---|---|---|
| **P0** | Permit or resource leak, FIFO order violation, unbounded in-flight work, data race on shared state | Stop work. Root-cause in same session. Add regression test before continuing. |
| **P1** | Incorrect behavior that passes review but fails a test or a rule (e.g., missing `finally`, wrong `AbortSignal` handling) | Fix before milestone exit. Log guard added. |
| **P2** | Style, naming, or documentation violation; hallucinated API that is caught by a test | Fix in the same PR. |
| **P3** | Cosmetic or wording issue with no runtime effect | Note only. |

## Failure Categories

- **HALLUCINATED_API** - Agent invents a Web Audio or DOM method/option that does not exist or behaves differently.
- **CONCURRENCY** - Violation of Section 2 of `PROJECT_RULE.md` (in-flight bound, FIFO order, permit release).
- **MEMORY** - Violation of Section 3 (uncleared node, retained buffer, unrevoked URL, leaked listener).
- **SCOPE_DRIFT** - Agent implements work not in `TASK_DECOMPOSITION.md`, or skips work that is.
- **RULE_VIOLATION** - Adds a dependency, skips a human gate, or uses a banned pattern.
- **A11Y** - Missing focus state, contrast failure, or missing ARIA on a custom control.
- **SYCOPHANCY / OVERCLAIM** - Agent reports a test as passing or a milestone as done without evidence.
- **REFACTOR_DAMAGE** - An automated transformation (conversion, formatting, stripping) removes or alters content it should preserve, such as comments, JSDoc or exported declarations. Syntax checks and tests do not catch this.
- **PROCESS_DRIFT** - Project files change or disappear outside an agent session, so the recorded state no longer matches the tree.

---

## Pre-Registered Risks

These are failure modes anticipated before any agent output exists. Each has a guard. When one occurs, log it below and reference its risk ID.

| Risk ID | Anticipated Failure | Category | Guard |
|---|---|---|---|
| R-01 | Using `Array.prototype.shift()` in the queue hot path, causing O(n) dequeue | CONCURRENCY / PERF | Contract test with 10k-item throughput budget; reviewer checklist item |
| R-02 | Starting a task without acquiring a semaphore permit | CONCURRENCY | Instrumented `inFlight` assertion at every dispatch point |
| R-03 | Permit not released on thrown error or abort | CONCURRENCY (P0) | `finally` block required; test covering throw and abort paths |
| R-04 | Completion order used to drive playback order | CONCURRENCY (P0) | Test: randomized task durations; assert playback order equals enqueue order |
| R-05 | Creating multiple `AudioContext` instances (browser limit and leak) | MEMORY | Single-owner rule; assertion in engine constructor |
| R-06 | `AudioBufferSourceNode` reused after `start()` (throws `InvalidStateError`) | HALLUCINATED_API | Create a new source node per playback; code review checklist |
| R-07 | Calling `AudioContext.resume()` without user gesture, leaving context suspended silently | HALLUCINATED_API / A11Y | Gesture-gated handler; UI state shows "audio suspended" when relevant |
| R-08 | Object URLs created but never revoked on cancel path | MEMORY | Revoke in `finally`; heap snapshot comparison at M6 |
| R-09 | `requestAnimationFrame` loop continuing after `dispose()` | MEMORY | Store frame ID; cancel in `dispose()`; test that no frame fires post-dispose |
| R-10 | Anonymous event listeners that cannot be removed | MEMORY | Stored handler references; lint-style review rule |
| R-11 | Allocating `Uint8Array` inside render loop each frame | MEMORY / PERF | Preallocated buffer; review checklist |
| R-12 | Agent claims tests pass without running them | OVERCLAIM | Verification field in PROMPT_LOG is mandatory and must contain actual output |
| R-13 | Agent adds a convenience dependency (e.g., a queue or async library) | RULE_VIOLATION | Human gate in PROJECT_RULE Section 4.3 |
| R-14 | Agent treats JavaScript as truly parallel and proposes shared-memory primitives without a worker | HALLUCINATED_API / SCOPE_DRIFT | Concurrency model stated in TASK_DECOMPOSITION; reviewer must check |
| R-15 | Low-contrast canvas labels or missing `prefers-reduced-motion` handling | A11Y | Contrast validator in M7; reduced-motion check in review |
| R-16 | An automated conversion or formatting pass drops comments, JSDoc or exported declarations while tests and syntax checks still pass | REFACTOR_DAMAGE | Comment-and-declaration comparison against the source for every converted file (see AF-007); recorded in the review checklist |
| R-17 | Project files change or go missing between agent sessions, and the next session works from a stale picture | PROCESS_DRIFT | Tree listing and comparison with the last `PROMPT_LOG.md` entry before any edit (PROJECT_RULE §4.2 item 2; see AF-008) |

---

## Failure Log

### Entry Template

```markdown
### AF-<NNN> | <YYYY-MM-DD> | <Milestone> | <Severity>
- **Category:** <from Failure Categories>
- **Risk ID:** <R-xx if pre-registered, otherwise "NEW">
- **Agent / Model:** <name and model ID>
- **Prompt reference:** <PL-NNN>
- **What happened:** <observable behavior, with the offending code or claim quoted>
- **How it was detected:** <test, review, runtime check, heap snapshot, human>
- **Root cause:** <why the agent produced it: missing context, ambiguous spec, rule not read, etc.>
- **Fix:** <what was changed, with commit hash>
- **Guard added:** <test, rule, checklist item, or prompt change that prevents recurrence>
- **Status:** <open | resolved | accepted risk>
```

---

### AF-001 | 2026-10-29 | M3 (PL-003) | P2
- **Category:** CONCURRENCY (test authoring)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-003
- **What happened:** The test "cancelling a running cooperative task..." called `await queue.drain()` before resolving the gate of the task it waited on. The test hung until the 120 s command timeout.
- **How it was detected:** Runtime hang. Re-running with `--test-timeout` located the test.
- **Root cause:** The test asserted an idle state while a task it had just started was still gated open. The queue behaved correctly.
- **Fix:** Replaced `drain()` with a tick and an explicit assertion on the event order, then resolved the gate.
- **Guard added:** Rule for test authors: never await `drain()` while a gated task is still open. Run tests with `--test-timeout`.
- **Status:** resolved

### AF-002 | 2026-10-29 | M3 (PL-003) | P2
- **Category:** OVERCLAIM (wrong expectation)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-003
- **What happened:** The same test expected `t1` to wait for `t0`'s executor after the abort. But the executor settles as soon as it sees the abort, so `t1` correctly starts earlier.
- **How it was detected:** Test failure. Analysis showed the queue was right and the expectation was wrong.
- **Root cause:** The assertion checked timing with a fixed tick count instead of event ordering.
- **Fix:** Rewrote the assertion to check `start:t0 → settle:t0 → start:t1` in order.
- **Guard added:** Ordering invariants are asserted as event sequences, not as tick-counted snapshots.
- **Status:** resolved

### AF-003 | 2026-10-29 | M4 (PL-003) | P2
- **Category:** HALLUCINATED_API (test authoring)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-003
- **What happened:** The test expected `outcome.error.cause` to be a `TaskAbortedError`. A cancelled outcome carries the error directly, with no wrapping.
- **How it was detected:** Test failure in PL-004 (`memory-safety.test.ts`).
- **Root cause:** Confused the wrapped `TaskFailedError` shape with the direct `TaskAbortedError` shape.
- **Fix:** Asserted `outcome.error instanceof TaskAbortedError`.
- **Guard added:** Outcome shapes are asserted against the type definition in `audio-task-queue.ts`.
- **Status:** resolved

### AF-004 | 2026-10-29 | M6 (PL-004) | P2
- **Category:** MEMORY (test authoring; risk R-08 family)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-004
- **What happened:** The GC test kept the decode promise's resolver in a test-scope `let` variable. A live resolver keeps its promise alive, and that promise keeps the resolved buffer alive, so `FinalizationRegistry` never fired.
- **How it was detected:** The test failed with an empty collected list. No library leak was present.
- **Root cause:** Test-held references were not cleared after use.
- **Fix:** The resolver is held in a holder object and cleared immediately after the call. The buffer is built inline, so the test keeps no reference to it.
- **Guard added:** GC tests must keep zero references to the object under test. Clear every holder after use.
- **Status:** resolved

### AF-005 | 2026-10-29 | M6 (PL-004) | P2
- **Category:** CONCURRENCY (test authoring)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-004
- **What happened:** The GC test awaited `pipeline.reset()` before releasing the pending decode. `reset()` waits for in-flight work, so the test would have hung.
- **How it was detected:** Found on re-reading the test before running it.
- **Root cause:** `reset()` and "idle" were assumed to be independent of the pending decode.
- **Fix:** Stored the reset promise, asserted the caller was released, released the decode, then awaited the reset.
- **Guard added:** Any test that awaits `reset()` or `drain()` must release every gated task first, or store the promise and await it after release.
- **Status:** resolved

### AF-006 | 2026-10-29 | M3 (PL-003, reported in PL-006) | P2
- **Category:** OVERCLAIM (weak assertion) with RULE_VIOLATION (test typing)
- **Risk ID:** NEW
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-003 (authored); PL-006 (reported by the user, fixed)
- **What happened:** In `test/audio-task-queue.test.ts`, the race test "races between cancel and completion" asserted `settled.length === ids.length`. `Promise.all` always returns one entry per input, so the assertion could never fail and the test did not check exactly-once settlement or the correct outcome of each task. Separately:
  - `running[running.length - 1]` was passed to `gates.get()!` with no guard. An empty `running` list would have crashed the test with an unhelpful error.
  - Three places read `.error`, `.cause` or `.cause.message` without narrowing the union type. The file type-checked only by accident of the runtime path.
  - `setImmediate` is a Node-only global, so the file could not be type-checked without `@types/node`, which the project does not have.
- **How it was detected:** User report, then a strict `tsc` pass over the test file (outside the `tsconfig` include), which listed the typing errors.
- **Root cause:** The race test was written as a smoke test ("it does not hang") rather than a specification test. The suite was not type-checked because `tsconfig.json` includes only `ts/`.
- **Fix:**
  - The race test now asserts the outcome of every task. Even indices are cancelled with `TaskAbortedError`; odd indices complete with their values. This is deterministic because every cancel runs before any timer fires.
  - Added a guard for the running list and used `.at(-1)`.
  - Replaced unnarrowed accesses with explicit `instanceof` guards that throw.
  - Replaced `setImmediate` with `setTimeout(resolve, 0)`.
- **Guard added:** The test file must pass a strict `tsc` check with `--noUncheckedIndexedAccess` (command in PL-006). Spec-style tests must assert outcomes, not only that the code terminates.
- **Status:** resolved (not yet mutation-tested; see PL-006)

### AF-007 | 2026-10-29 | M1 (PL-009) | P1
- **Category:** REFACTOR_DAMAGE
- **Risk ID:** R-16
- **Agent / Model:** Claude Code (claude-haiku-5-5)
- **Prompt reference:** PL-009
- **What happened:** The TypeScript-to-JavaScript conversion used Node's `stripTypeScriptTypes` in `strip` mode. Two kinds of content were lost:
  - **Declarations.** Every type-only interface was erased, including `Task`, `AudioTaskQueueOptions`, `Entry`, `TrackPipeline`, `AudioDecodeTarget`, `AudioTrackPipelineOptions`, `SpectrumSource`, `FrameScheduler`, `SpectrumColors`, `SpectrumVisualizerOptions`, `VisualizerStats` and `PendingSize`. The JavaScript has no replacement declaration, so the M1 contract is no longer written down anywhere in the code.
  - **Comments.** Thirteen JSDoc comment lines attached to those interface fields were erased with them. Comment counts per file went from 82 to 75 (queue), 27 to 26 (pipeline) and 50 to 43 (visualizer). The test files lost nothing.
  - A first cleanup pass also altered comment text (for example `Invariants (PROJECT_RULE.md` became `Invariants(PROJECT_RULE.md`). That damage was reverted by regenerating the files from the backup with a comment-safe pass. The final files carry no such damage.
- **How it was detected:** A comparison script over comment lines between the TypeScript backup and the converted files. The 66 passing tests and the `node --check` syntax checks did not detect it.
- **Root cause:** Stripping types removes type-only declarations and the comments attached to them. Verification checked behaviour and syntax, not documentation. The conversion was accepted on test results alone.
- **Fix:** Pending. Not applied in PL-010, which changed documentation only. Recommended fix: restore each contract as a JSDoc `@typedef` (with the option fields and their comments) in the module that defines it, then rerun the comment comparison and log the result. Requires Human Lead approval, because it changes source files.
- **Guard added:** R-16 is pre-registered. PROJECT_RULE §4.2 item 8 requires comparison of comments and declarations for any automated transformation. PROJECT_RULE §6 item 6 requires JSDoc on public contracts.
- **Status:** open (P1). Tracked as deviation D-7 in `PROJECT_RULE.md` §8.3 and as D-2 in `TASK_DECOMPOSITION.md`.

### AF-008 | 2026-10-29 | M0-M5 (PL-008, PL-009) | P1
- **Category:** PROCESS_DRIFT
- **Risk ID:** R-17
- **Agent / Model:** Claude Code (claude-haiku-5-5), detecting; cause not attributable to the agent
- **Prompt reference:** PL-008 (last state recorded), PL-009 (detected)
- **What happened:** When PL-009 began, `Hw_2/package.json`, `Hw_2/tsconfig.json` and `Hw_2/tsconfig.build.json` were missing. They were present at the end of PL-008. Several files in `docs/` and `js/` carried modification times that this session did not produce. The editor reported that `package.json` and the governance documents had changed on disk during the session.
- **How it was detected:** A directory listing taken before the conversion, compared with the listing recorded at the end of PL-008.
- **Root cause:** Not established. A manual action, a sync tool or an editor may have caused it. No agent action removes these files.
- **Fix:** `package.json` was recreated, because the JavaScript project needs `"type": "module"` to run its ES modules. The two tsconfig files were not recreated, because the TypeScript toolchain is withdrawn. Other changes were not reverted; they are treated as the current state.
- **Guard added:** R-17 is pre-registered. PROJECT_RULE §4.2 item 2 requires a tree check before editing, and an unexplained difference is recorded here.
- **Status:** open. The user has been asked to confirm how the folder was changed.

<!-- Next entry: AF-009 -->
