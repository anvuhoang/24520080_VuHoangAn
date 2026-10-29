# AI Failure and Audit Report - HW 3: High-Concurrency Flash-Sale E-Commerce Engine

## 1. Purpose, Scope and Method

This report records every agent error, wrong assumption, rule violation and rework on this project, and every finding raised by the audits in `PROJECT_RULE.md` §7. It exists to make agent reliability measurable and to turn each failure into a guard. It is append-only. A correction is a new entry that references the original.

**Scope.** The code written by the AI agent in `Hw_3/js/` (timer, inventory FSM, engine, traffic simulator, dashboard) and its tests.

**Method.** Each finding below is backed by something that was run, not by reading alone:
- unit and race tests (186 tests at the time of writing);
- mutation audits, where defects are planted in a scratch copy and the tests must fail (FSM 19 of 19, timer 8 of 8, engine 18 of 18 after fixes);
- seeded simulation runs and four saved measurement scripts under `Hw_3/test/audit/`;
- a real browser (headless Microsoft Edge 155, driven through the DevTools protocol) for the page-level checks.

**Honesty rules for this report.** A finding is listed only if it was reproduced. A hazard that was tested and turned out harmless is recorded as such in Section 4, not as a flaw. Where a number is arithmetic and not a measurement, it says so.

Severity follows `PROJECT_RULE.md` §7.1 (P0 to P3). Findings follow the lifecycle in §7.2: `open`, `fixed`, `verified`, `closed`, or `accepted` by the Human Lead.

---

## 2. Summary of Findings

| ID | Theme | Finding | Sev | Status |
|---|---|---|---|---|
| AF-001 | Clock / display | The finished phase never showed its final 00:00.000 when the server boundary fired first | P2 | verified |
| AF-002 | Animation frame | `AntiDriftTimer.start()` could start a second frame loop when a handler restarted it | P2 | verified |
| AF-003 | Test quality | 3 of 18 planted engine defects survived the first test set | P1 | verified |
| AF-004 | UI | Stale rows after Stop, wrong product in a message, Buy button lag | P2 | fixed |
| AF-005 | Process | `Hw_3/package.json` went missing (also seen in Hw_2) | P1 | open |
| **AF-006** | **Race / contention** | **The per-SKU optimistic version check collapses under load: about 80% of the stock went unsold** | **P1** | **open** |
| **AF-007** | **Race / oversell** | **The check-then-act race, reproduced: a naive reserve sold 60 units of 5. The shipped FSM prevents it by design** | **P0 class** | **verified (class)** |
| **AF-008** | **Animation frame** | **Quantifies AF-002: two frame loops, one stray callback after unmount. A page-level unmount audit found no leak** | **P2** | **verified** |
| **AF-009** | **Clock drift** | **The countdown follows wall-clock steps and is corrected only once for a constant offset** | **P2** | **open** |
| **AF-010** | **Race / idempotency** | **A retry after key eviction sells the same intent twice, and the invariant audit does not notice** | **P2** | **open** |

Open: AF-005, AF-006, AF-009, AF-010. No run in this project ever violated a stock invariant, so none of them is an oversell. They differ in kind: AF-006 and AF-009 cost sales and accuracy, and AF-010 can sell one purchase intent twice once a record is evicted, which the invariant checker does not detect.

---

## 3. The Three Themes

### 3.1 Race conditions during simultaneous stock reservations (AF-006, AF-007, AF-010)

The central risk of this project is a stock check and its decrement being separated by an `await`. The AI-generated naive version of that code is the default shape (check, await I/O, write), and it fails badly: **60 buyers sold a 5-unit stock, and availability went to -55** (AF-007). The shipped FSM avoids this because its whole API is synchronous. That part held in every test and every run.

The same measurements show where the real flaws are. They are not in the check-then-act path; they are in what was built around it:
- **AF-006.** Optimistic locking made safe by construction (no oversell) but not live: with every buyer sending the version they read, **299 of 1,500 units sold, 1,201 were left unsold, and 2,699 of 3,000 buyers gave up**, at about 43 conflicts per successful hold.
- **AF-010.** An idempotency key is forgotten when its record is evicted, so a late retry **sold one purchase intent twice**, and the invariant checker reported no violation because it has no idempotency check.

### 3.2 `requestAnimationFrame` lifecycle at unmount (AF-002, AF-008)

A real defect existed and was found by review (AF-002): a restart inside a completion handler produced **two frame loops**. Measured (AF-008): 2 callbacks per frame instead of 1, and **one stray callback ran after `dispose()`** because the first loop's id had been overwritten and could not be cancelled. It ended itself after that one frame, so it was bounded. It was not an unbounded leak, and the report does not claim one.

The end-to-end audit of the page found **no leak**: after every Stop, no animation frame, timeout, interval or `visibilitychange` listener remained (Section 4).

### 3.3 Clock drift between client local time and server timestamps (AF-009, AF-001)

Two different things are called "drift" here, and the module only solves one:
- **Timer drift** (a `setInterval` countdown losing time to late or skipped ticks) is solved: every sample is `target - clock`. 5,000 irregular frames gave an exact value at every tick.
- **Clock error** (the device clock being wrong, or changing) is only partly solved. A constant offset is corrected once by `calibrateClient`. A **step** in the wall clock moves the countdown by the same amount: a 10 s backward step made 00:00:40.000 become 00:00:49.984, and a 50 s forward step completed the countdown with 39.984 s of real time left (AF-009).

The server's decision is not affected: with the device clock 55 s ahead, the sale stayed `UPCOMING` and the purchase was refused with a correct 55,000 ms retry hint. The flaw is in the display, not in the sale.

---

## 4. Checked and Found Clean

These were tested because they were suspected. They are not flaws.

| Check | Result | Evidence |
|---|---|---|
| Stock oversell under load | None. Zero invariant violations in every simulator run, every audit script row and every random-operation sequence | tests; `test/audit/contention.mjs` |
| Sale decision vs a stepped client clock | Unaffected. Phase stayed `UPCOMING`, purchase refused, retry hint correct | `test/audit/clock-steps.mjs`, part 3 |
| Page unmount leaks (frame, timers, listeners) | None found | Table below |
| Page behaviour under rapid Start then Stop | Clean | Table below |
| Input validation | Works. A first run of the audit script used an invalid sale length (10 s, minimum 15), and the page rejected it with a message | browser run |

**Page-level unmount audit** (headless Edge 155, wrappers counting every outstanding `requestAnimationFrame`, `setTimeout`, `setInterval` and `visibilitychange` listener):

| Moment | Frames | Timeouts | Intervals | Listeners |
|---|---|---|---|---|
| Idle, before any run | 0 | 0 | 0 | 0 |
| Running, before opening (4 cycles) | 2 | 3 | 1 | 1 |
| After Stop (4 cycles) | 0 | 0 | 0 | 0 |
| Live sale, mid-run | 2 | 4 | 1 | 1 |
| After Stop, mid live sale | 0 | 0 | 0 | 0 |
| Start then Stop in one tick | 0 | 0 | 0 | 0 |
| Sale ended, Stop not pressed | 1 | 2 | 1 | 0 |
| After Stop, post-sale | 0 | 0 | 0 | 0 |

After a sale ends, the countdown has released its frame loop and its listener. The page's own redraw loop and audit interval keep running until Stop, by design.

**Not covered.** Heap size, detached DOM nodes and long-run growth were not measured. Only handle counts were. A real hidden tab, Safari, Firefox and a physical phone were not tested.

---

## 5. Why the AI Produced These

The same few patterns explain most of the findings:

1. **Modelling the mechanism, not the load.** The optimistic lock copies database row-version semantics. The tests ran at zero latency, so conflicts looked cheap. At real latency times a real event rate, nearly every in-flight request is stale (AF-006).
2. **Documenting a trade-off without sizing it.** The FSM's JSDoc said a strict version check "rejects buyers for whom stock was still available". It did not say that this rejects four buyers in five. The prompt log then called the first browser observation (4,259 conflicts, 767 buyers giving up) "the trade-off documented in the FSM" (AF-006, an overclaim).
3. **Redundant mechanisms hide a missing one.** The countdown and the phase timer both notice a boundary, so tests passed when one of them was broken (AF-003).
4. **Accepting a prescribed API without challenge.** The request named `Date.now()`. It is not monotonic, and the module said so in a comment, but nothing detected or tested a step (AF-009). The name "anti-drift" also invited a stronger reading than the module delivers.
5. **Tests that assert the unsafe behaviour.** One test asserted that a retry after key eviction creates a second hold, which is the opposite of the requirement it was written for (AF-010).
6. **First-run passes.** Every suite passed on its first run. Only the mutation audits showed which tests did not protect anything.

---

## 6. Recommended Actions (need Human Lead approval)

| For | Action | Acceptance check |
|---|---|---|
| AF-006 | Make the version advisory, or replace it with an availability precondition (`expectedAvailableAtLeast`). Cap retries with backoff and jitter. Default the dashboard checkbox and the simulator share off until fixed | `contention.mjs`: at 100% optimistic buyers, units sold is at least 95% of the demand-limited maximum |
| AF-009 | After calibration, anchor the server time to a monotonic clock. Compare wall and monotonic deltas each frame to detect a step. Re-sync periodically using the lowest-round-trip sample | `clock-steps.mjs`: a 10 s step leaves the countdown within one frame of the truth |
| AF-010 | Keep idempotency records for the whole sale window plus the longest client retry window (time-based, not count-based). Add an I-6 checker | `idempotency-eviction.mjs`: the retry after any churn is a replay or a refusal, never a second sale |
| AF-007 | Before M5 (admission control), add a static check or review gate that no `await` appears between a stock read and its write | A review checklist item and a failing example in the test suite |
| AF-005 | Decide whether `package.json` should exist, and update `PROJECT_RULE.md` §10.1 accordingly | The rule and the file agree |

---

## 7. Reproduction

Node v24.13.1. From `Hw_3/`:

| Evidence | Command |
|---|---|
| AF-007 | `node test/audit/check-then-act.mjs` |
| AF-006 | `node test/audit/contention.mjs` (seeds 2024, 1, 2; 0% and 100% optimistic buyers; retry budgets 4 and 40) |
| AF-009 | `node test/audit/clock-steps.mjs` |
| AF-008, AF-002 | `node test/audit/frame-loop.mjs` |
| AF-010 | `node test/audit/idempotency-eviction.mjs` |
| All tests | `node --test test/anti-drift-timer.test.js test/inventory-fsm.test.js test/flash-sale-engine.test.js test/traffic-simulator.test.js` |

The page-level unmount audit (Section 4) used headless Edge 155 and the DevTools protocol, with wrappers around the frame, timer and listener APIs that count outstanding handles. That script is not saved in the repository.

**Limits of the evidence.** Network latency in the simulator is synthetic. Clocks in the audit scripts are fake and stepped on purpose. Everything runs in one JavaScript realm, so this models a server-side engine and is not one.

---

## 8. Failure Categories and Entry Template

- **LOGIC** - The code did the wrong thing, found by a test, a review or a run.
- **WEAK_TEST** - A test or an audit let a defect through, so the suite does not specify the behaviour it claims to.
- **REFACTOR_DAMAGE** - An automated change dropped or altered content it should have kept.
- **PROCESS_DRIFT** - Project files changed or disappeared outside an agent session.
- **OVERCLAIM** - A claim of "passes" or "done" without evidence.
- **UI** - A defect in the page's behaviour or layout.

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

## 9. Failure Log

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

### AF-006 | 2026-10-29 | M2, M4 (PL-003, PL-004; measured in PL-005) | P1
- **Category:** LOGIC (design), with OVERCLAIM in how it was reported
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-003 (designed), PL-004 (observed and under-reported), PL-005 (measured)
- **What happened:** `reserve({ expectedVersion })` compares one per-SKU `version` before it looks at availability, and that version rises on every change to the SKU: every reserve, checkout, confirm, release and expiry. Under load, almost every in-flight request is therefore stale, and it fails with `VersionConflictError` even though stock is available. The same seeded 3,000-buyer spike (1,500 units offered, `test/audit/contention.mjs`):

  | Seed | Optimistic buyers | Requests | Conflicts | Conflicts per hold | Holds | Buyers who gave up | Units sold | Units left unsold | Invariant violations |
  |---|---|---|---|---|---|---|---|---|---|
  | 2024 | 0% | 3,729 | 0 | 0 | 1,316 | 0 | 1,290 | 210 | 0 |
  | 2024 | 100% | 13,949 | 12,919 | 42.9 | 301 | 2,699 | 299 | **1,201** | 0 |
  | 1 | 0% | 3,745 | 0 | 0 | 1,306 | 0 | 1,276 | 224 | 0 |
  | 1 | 100% | 13,945 | 12,901 | 43.2 | 299 | 2,701 | 295 | **1,205** | 0 |
  | 2 | 0% | 3,704 | 0 | 0 | 1,295 | 0 | 1,270 | 230 | 0 |
  | 2 | 100% | 13,926 | 12,916 | 42.2 | 306 | 2,694 | 302 | **1,198** | 0 |
  | 2024 | 100%, 40 retries | 111,647 | 110,466 | 244.4 | 452 | 2,548 | 447 | **1,053** | 0 |

  Safety held in every row (no oversell). Liveness did not: with all buyers optimistic, about 80% of the stock went unsold while buyers were refused, and a larger retry budget made the load 8 times heavier for 1.5 times the holds.
- **How it was detected:** The first browser run showed 4,259 conflicts and 767 buyers giving up out of 3,000 while stock remained. That was recorded as an observation. The comparison above, at 0% versus 100% optimistic buyers, was run for this report.
- **Root cause (technical):**
  - The version is per SKU, not per decision. An unrelated buyer's change invalidates everyone's view.
  - A buyer reads version `v`, and the request reaches the server one network latency later. In the simulator that is 25 to 410 ms one way, depending on the market, with 3% of requests four times slower. At the simulated peak the sale takes hundreds of holds per second, so the SKU has usually changed before the request arrives, and `v` is stale. (The number of changes inside one window was not counted separately.)
  - A retry carries the version from the conflict response, but that response also travels back and forth, so it is stale again by arrival. By analysis (not measured here), the chance of success per attempt falls roughly exponentially with events per second times latency, so retries amplify load without improving the outcome.
  - The tests ran at zero latency (microtask yields), where conflicts are cheap. The exhaustive 90-interleaving test checked only safety. The 20-seed race test allowed 200 retries per buyer at zero latency, which let every buyer eventually succeed and so hid the problem.
  - The FSM's JSDoc described the cost as a "trade-off" without sizing it, and the prompt log repeated that wording after seeing the numbers. That was an overclaim: an 80% undersell is a defect, not a trade-off.
- **Fix:** Not applied; it changes the meaning of `expectedVersion` and needs approval. See Section 6.
- **Guard added:** `test/audit/contention.mjs` reproduces the measurement. No test fails on this yet, because the acceptance threshold (units sold at least 95% of the demand-limited maximum at 100% optimistic buyers) is not defined in the suite.
- **Status:** open

### AF-007 | 2026-10-29 | M2 (PL-003) | P0 class
- **Category:** LOGIC (defect class reproduced; not a shipped defect)
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-003
- **What happened:** The check-then-act race, reproduced deliberately as a control. A reserve that reads stock, yields once, then writes, run by 60 concurrent buyers against a stock of 5:

  | Implementation | Stock | Buyers | Units sold | Available after |
  |---|---|---|---|---|
  | Naive (an `await` between check and write) | 5 | 60 | **60** | **-55** |
  | `InventoryFsm` (synchronous reserve) | 5 | 60 | 5 | 0 |

  The FSM reports zero invariant violations under the same load.
- **How it was detected:** By design. The control test exists to show that the race tests would fail if the defect were present.
- **Root cause (technical):** JavaScript runs one thread, so a race needs an `await`. Each of the 60 buyers runs its check synchronously, finds `available = 5`, and only then yields. All 60 therefore pass the check before any of them writes. The shipped FSM has no `await` anywhere between a read and its dependent write, so nothing can interleave.
- **Fix:** Not needed for the shipped code. The residual risk is a future change: an admission queue (M5), a database call or an async wrapper around `reserve` would reintroduce the defect, and nothing detects it statically.
- **Guard added:** The control test "the same load does oversell when an await sits between the check and the write"; the test that no public operation returns a promise; `PROJECT_RULE.md` §2.1; the FSM mutation audit (19 of 19 planted defects caught). `test/audit/check-then-act.mjs` reproduces the table.
- **Status:** verified for the shipped code; the residual risk stays open until M5.

### AF-008 | 2026-10-29 | M9 (PL-004; measured in PL-005) | P2
- **Category:** LOGIC (latent defect), plus an evidence-quality note
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-002 (authored), PL-005 (measured)
- **What happened:** This entry quantifies AF-002. When a completion handler restarts the timer while `start()` is still running, an unguarded `start()` schedules a second frame loop and overwrites the first loop's id. Only the latest id is ever cancelled. Measured with a frame queue that keeps every pending callback (`test/audit/frame-loop.mjs`):

  | Variant | Frame loops after start | Callbacks per frame | Queued after `dispose()` | Ran after `dispose()` | Ticks after `dispose()` |
  |---|---|---|---|---|---|
  | Shipped (guarded) | 1 | 1,1,1,1,1 | 0 | 0 | 0 |
  | Guard removed | 2 | 2,2,2,2,2 | **1** | **1** | 0 |

  So the unguarded code does double the per-frame work, and after unmount one callback it can no longer cancel still runs. That callback finds the timer stopped and ends the chain, so it was a bounded leak (one frame), not an unbounded one. No tick reached the page after disposal.

  The page-level unmount audit found no leak (Section 4): after every Stop, 0 frames, 0 timeouts, 0 intervals and 0 listeners remained, across four Start and Stop cycles, a Stop in the middle of a live sale, a Start and Stop in one tick, and a sale that ran to its end.
- **How it was detected:** Review (AF-002), then the measurement above. The page-level audit was run to look for the leak the review suggested.
- **Root cause:** A frame loop that can be started from two places keeps one id, so a second loop is invisible to `stop()`.
- **Fix:** `start()` schedules a frame only if none is pending (AF-002).
- **Evidence-quality note:** The first run of the page-level audit printed all zeros, including while "running". That was suspicious and was checked: the script had used a sale length of 10 s, the form requires at least 15 s, so the page rejected the input and no run started. The script was fixed and rerun, and the table in Section 4 is from the corrected run. A result of zero is only meaningful if the run actually started.
- **Not measured:** Heap size, detached DOM nodes and growth over a long run. Only outstanding handles were counted. The audit script is not saved in the repository.
- **Guard added:** The regression test for AF-002; `test/audit/frame-loop.mjs`.
- **Status:** verified

### AF-009 | 2026-10-29 | M8, M9 (PL-002, PL-004; measured in PL-005) | P2
- **Category:** LOGIC (design), with a risk of OVERCLAIM in the module's name and request
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-002 (authored), PL-004 (client-clock handling), PL-005 (measured)
- **What happened:** `AntiDriftTimer` computes `remaining = target - (Date.now() + offset)` at every sample. `Date.now()` is the wall clock, and it can step: a manual change, a network time correction, a sleep and resume. Measured with a 60 s countdown (`test/audit/clock-steps.mjs`):
  - **Wall clock steps back 10 s at real t = 20 s:** the display went from `00:00:40.000` to `00:00:49.984`. The countdown went up, and `sinceLastSampleMs` was **-9,984**.
  - **Wall clock steps forward 50 s at real t = 20 s:** the countdown completed at 20.016 s of real time with **39.984 s still to run**, and reported `lateByMs: 10016`, which is meaningless.
  - **The server's decision is unaffected.** With the device clock 55 s ahead and the server 5 s ahead, the sale stayed `UPCOMING`, the purchase was refused with `SaleNotStartedError`, and the retry hint was a correct 55,000 ms.
- **How it was detected:** Reasoning about the `Date.now()` requirement, then the experiment above. No test covered a clock step; the "Not verified" list in the first timer entry named it.
- **Root cause (technical):**
  - The prompt prescribed `Date.now()` deltas, and the module accepted it. The limitation was written in a comment but never detected or tested.
  - `calibrate` removes one constant offset, with an error of up to half the round trip if the two directions are equally fast. It is not repeated, and it does not estimate that the two clocks run at slightly different rates. By arithmetic, not measurement, a difference of 50 parts per million adds about 180 ms of error over a one-hour sale.
  - The name "anti-drift" solves timer drift (late or skipped ticks) but not clock error, and the two are easy to confuse. The tests and the JSDoc say "never drifts", which is true of the first and not of the second.
- **Fix:** Not applied. See Section 6: anchor the server time to a monotonic clock after calibration, detect a step by comparing the wall and monotonic deltas, and re-sync periodically.
- **Guard added:** `test/audit/clock-steps.mjs` reproduces the measurement. There is no failing test yet, because the intended behaviour under a clock step is not decided.
- **Status:** open

### AF-010 | 2026-10-29 | M4 (PL-003) | P2
- **Category:** LOGIC and WEAK_TEST
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Prompt reference:** PL-003
- **What happened:** An idempotency key is remembered only as long as its reservation record is retained. When the record is evicted, the same key is a new request. One purchase intent then sells twice (`test/audit/idempotency-eviction.mjs`):

  | `terminalRetention` | Retry is a replay of the first | Units sold for one intent | Invariant violations |
  |---|---|---|---|
  | 50,000 (default) | yes | 1 | 0 |
  | 2 | **no** | **2** | **0** |

  The invariant checker reports nothing because it checks stock arithmetic (I-1 to I-4 and I-7) and there is no check for I-6.
- **How it was detected:** Re-reading the decomposition. Phase 5 asks for a test that eviction cannot allow a double effect inside the sale window. The test that was written, "a key is forgotten only when its finished reservation is evicted", asserts the opposite: that after eviction the retry is a new request.
- **Root cause:** The behaviour was treated as an acceptable boundary because the default retention is large (50,000 in the FSM, 20,000 in the engine), and the test was written to document the boundary and not the requirement. Retention is counted in reservations, not in time, so a late retry after a busy period can fall outside it.
- **Fix:** Not applied. See Section 6: time-based retention that covers the sale window plus the longest client retry window, and an I-6 checker.
- **Guard added:** `test/audit/idempotency-eviction.mjs`. The decomposition item is marked partly done and says so.
- **Status:** open

<!-- Next entry: AF-011 -->
