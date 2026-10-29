# AI Failure and Audit Log - HW 3: High-Concurrency Flash-Sale E-Commerce Engine

This log records every agent error, wrong assumption, rule violation and rework on this project, and every finding raised by the audits in `PROJECT_RULE.md` §7. It exists to make agent reliability measurable and to turn each failure into a guard. It is append-only. A correction is a new entry that references the original.

Severity follows `PROJECT_RULE.md` §7.1 (P0 to P3). Findings follow the lifecycle in §7.2: `open`, `fixed`, `verified`, `closed`, or `accepted` by the Human Lead.

## Failure Categories

- **LOGIC** - The code did the wrong thing, found by a test, a review or a run.
- **WEAK_TEST** - A test or an audit let a defect through, so the suite does not specify the behaviour it claims to.
- **REFACTOR_DAMAGE** - An automated change dropped or altered content it should have kept.
- **PROCESS_DRIFT** - Project files changed or disappeared outside an agent session.
- **OVERCLAIM** - A claim of "passes" or "done" without evidence.
- **UI** - A defect in the page's behaviour or layout.

## Entry Template

```markdown
### AF-<NNN> | <YYYY-MM-DD> | <Milestone> | <Severity>
- **Category:** <from the list above>
- **Agent / Model:** <name and model ID>
- **Prompt reference:** <PL-NNN>
- **What happened:** <observable behaviour>
- **How it was detected:** <test, audit, review, browser run, human>
- **Root cause:** <why it happened>
- **Fix:** <what was changed>
- **Guard added:** <test, rule or check that prevents recurrence>
- **Status:** <open | fixed | verified | closed | accepted>
```

---

### AF-001 | 2026-10-29 | M9 (PL-004) | P2
- **Category:** LOGIC
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-004
- **What happened:** In `FlashSaleEngine`, the exact timer for a phase boundary can fire before the countdown's own last frame. The engine then retargeted the countdown at once, so the finished phase never showed its final value. The display would jump from a few milliseconds straight to the next phase and never reach 00:00.000.
- **How it was detected:** An engine test ("each phase ends with a zero tick") failed. A second test failed in the same area; that one was a wrong expectation (the clamped final tick is not `target - sampledAt`) and was corrected separately.
- **Root cause:** The design assumed the countdown would always deliver its own final tick before the server boundary was handled. Two mechanisms race, and either can win.
- **Fix:** On a phase change, the engine emits one final zero tick for the finished phase unless the countdown already delivered one.
- **Guard added:** Test "each phase ends with a zero tick"; the mutation "the finished phase gets no final zero tick" is caught.
- **Status:** verified

### AF-002 | 2026-10-29 | M9 (PL-004) | P2
- **Category:** LOGIC
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-002 (authored), PL-004 (found and fixed)
- **What happened:** `AntiDriftTimer.start()` scheduled a frame after its first sample without checking whether an `onComplete` handler had already restarted the timer during that sample. In that case two frame loops would run.
- **How it was detected:** Review while tracing re-entrancy between the engine's `retarget` and the timer's completion. Not found by any test.
- **Root cause:** The restart-inside-completion path was never considered when the timer was written.
- **Fix:** `start()` schedules a frame only if none is pending.
- **Guard added:** Test "a handler that restarts the timer during start does not create a second frame loop". Checked by removing the guard: the test fails; with the guard it passes.
- **Status:** verified

### AF-003 | 2026-10-29 | M9 (PL-004) | P1
- **Category:** WEAK_TEST
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-004
- **What happened:** The first mutation audit of `FlashSaleEngine` (18 planted defects) caught 15. Three survived, and each showed a gap in the engine tests:
  1. **The phase timer is not re-armed after a phase change.** The countdown's own completion also notices a boundary, so no test needed the phase timer to work alone.
  2. **An order total that ignores the quantity.** Every test order had quantity 1.
  3. **A phase timer that fires early does not re-arm.** The same redundancy hid it. The meaningful case is a slow client clock, where only the server-side timer can announce the boundary on time.
- **How it was detected:** Mutation audit (A3). By `PROJECT_RULE.md` §7.3 a surviving planted defect is a P1 finding against the suite.
- **Root cause:** The tests exercised the engine through its most convenient path, where several mechanisms overlap. Independent mechanisms were not tested independently.
- **Fix:** Three tests added: the phase timer announces every boundary when no frame runs; the server boundary is announced on time with a slow client clock (including an early timer firing); an order with quantity 3 gives a total of three times the price.
- **Guard added:** Rerun of the audit: 18 of 18 caught.
- **Status:** verified

### AF-004 | 2026-10-29 | M9 (PL-004) | P2
- **Category:** UI
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-004
- **What happened:** Three dashboard defects, all in code written in this prompt:
  1. After "Stop and reset", the old hold rows stayed on the page, because the idle render cleared them through a helper that returned an empty map once the run was gone.
  2. The pay and cancel messages looked up the product through the engine state, so an expired hold could name the wrong product.
  3. The Buy button could stay disabled for up to 100 ms after a phase change or an early countdown zero, because the page waited for the next scheduled redraw.
- **How it was detected:** Defects 1 and 2 by reading the controller before running it. Defect 3 by the browser run: a scripted click straight after the sale opened found the button still disabled.
- **Root cause:** The redraw throttle was applied to events that decide which buttons work, and row clearing depended on state that no longer existed.
- **Fix:** The idle render empties the two lists directly. Each row remembers its own SKU. A phase change or an early zero forces a redraw on the next frame.
- **Guard added:** Browser scenarios (main and clock skew) cover the stop path, the user purchase flow and the early-zero case. There is no automated browser test in the repository.
- **Status:** fixed (verified by hand-run browser scenarios only)

### AF-005 | 2026-10-29 | M0 (PL-002, PL-003, PL-004) | P1
- **Category:** PROCESS_DRIFT
- **Agent / Model:** Claude Code (claude-sonnet-5-5), detecting; cause not attributable to the agent
- **Prompt reference:** PL-002 (created `package.json`), PL-004 (found missing)
- **What happened:** `Hw_3/package.json` was created in PL-002 and edited in PL-003 and PL-004. It was missing when PL-004 ran `npm test`, which failed with `ENOENT`. It is not tracked by git, and the user committed other Hw_3 files in between. An earlier project (`Hw_2`) lost its `package.json` and two other config files the same way (see that project's AF-008).
- **How it was detected:** `npm test` failed; a file listing and `git ls-files` confirmed the file was neither present nor tracked.
- **Root cause:** Not established. The pattern, repeated across two projects, suggests the file may be removed deliberately, but that has not been confirmed.
- **Fix:** Not recreated, because recreating a file that may have been removed on purpose would repeat the same loop. Node 24 runs the ES-module `.js` tests without it, so all tests were run with `node --test` and an explicit file list. This works only because of Node's module-syntax detection.
- **Guard added:** None yet. The Human Lead is asked to say whether `package.json` should exist. If it should not, `PROJECT_RULE.md` §10.1 and the test command in the logs should be changed to say so.
- **Status:** open

<!-- Next entry: AF-006 -->
