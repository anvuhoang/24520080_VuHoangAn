# Prompt Log - HW 3: High-Concurrency Flash-Sale E-Commerce Engine

This log records every substantive prompt given to an AI agent on this project: intent, outputs, executed verification, and the Human Lead's decision. It is append-only. A correction is a new entry that references the original ID. `PROJECT_RULE.md` §5.4 sets the obligations.

**Entry template**

```markdown
### PL-<NNN> | <YYYY-MM-DD> | <Milestone> - <Title>
- **Agent / Model:** <name and model ID>
- **Intent:** <one sentence>
- **Prompt (summary):** <faithful summary>
- **Output:** <files created or changed>
- **Design decisions:** <material choices and why>
- **Verification:** <commands run and their actual results>
- **Not verified:** <explicit gaps>
- **Human decision:** <accepted | accepted with edits | rejected | pending review>
- **Notes:** <deviations, open questions, cross-references>
```

---

### PL-001 | 2026-10-29 | M0 - Workspace Governance Documents
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Intent:** Initialise the HW 3 workspace documents with strict agentic governance, concurrency milestones and an audit framework.
- **Prompt (summary):** Initialise the project workspace structure for Hw 3: High-Concurrency Flash-Sale E-Commerce Engine. Generate `TASK_DECOMPOSITION.md` and `PROJECT_RULE.md`, establishing governance, concurrency milestones and audit frameworks.
- **Output:**
  - `Hw_3/docs/TASK_DECOMPOSITION.md`: twelve domain invariants (I-1 to I-12), a ten-entry concurrency defect catalogue, milestones M0 to M10, phase checklists, a traceability matrix and a Definition of Done.
  - `Hw_3/docs/PROJECT_RULE.md`: stack, twelve concurrency rules (central rule: no `await` between a stock read and its dependent write), integrity and ledger protocol, agent governance with human gates, and audits A1 to A8 with a P0 to P3 severity scale.
  - `PROMPT_LOG.md` and `AI_FAILURE_AUDIT.md` were left empty at that point.
- **Design decisions:**
  - The stack was proposed as vanilla JavaScript with no build step and no dependencies, following the final HW 2 decision. It is marked "confirm at M0".
  - No performance target was promised. Only "oversell = 0" is a hard threshold; throughput and latency are recorded as a baseline at M8.
- **Verification:** The four files were listed before writing and found empty (0 bytes), so nothing was overwritten. Internal cross-references (rule numbers, audit IDs, invariant IDs) were reviewed by reading. No code existed.
- **Not verified:** Whether the Human Lead accepts the proposed stack and the invariant set.
- **Human decision:** Pending review.

---

### PL-002 | 2026-10-29 | M9 (added task) - Anti-Drift Countdown Timer
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Intent:** A countdown timer module for the Vietnam mega-sale scenario (Shopee / Lazada 11.11 midnight flash sale) that does not drift and survives background-tab throttling.
- **Prompt (summary):** Act as a Frontend Performance Engineer. Implement `anti-drift-timer.js` in pure JavaScript (ES modules) using `requestAnimationFrame` and `Date.now()` delta calculation instead of drift-prone `setInterval`, for an 11.11 midnight flash sale, with millisecond accuracy and JSDoc types. (The request first named a `.ts` file, then was restated as `.js`; the restated request was followed.)
- **Output:**
  - `Hw_3/js/anti-drift-timer.js`: `AntiDriftTimer`, `splitDuration`, `formatCountdown`, `vietnamLocalToEpoch`, `nextMegaSaleStart`, `VIETNAM_UTC_OFFSET_MINUTES`. JSDoc typedefs for `Countdown`, `CompletionInfo` and `TimerOptions`.
  - `Hw_3/test/anti-drift-timer.test.js`: 43 tests.
  - `Hw_3/package.json`: `"type": "module"` and the `test` script. No dependencies.
  - `Hw_3/docs/TASK_DECOMPOSITION.md`: one added item under Phase 10, because the timer was not in the original plan (`PROJECT_RULE.md` §5.2 item 6).
- **Design decisions:**
  - **Absolute target, no accumulation.** Every sample is `targetTime - clock`. A late, coalesced or skipped frame loses nothing.
  - **Injected clock.** `PROJECT_RULE.md` §1 forbids calling `Date.now()` in the core. The module takes `now` as an option that defaults to the `Date.now` function reference, so the `Date.now()` delta approach is kept and tests use a fake clock.
  - **Background tabs.** Three safeguards: the first sample after a gap is computed from the absolute target; a `visibilitychange` listener samples at once when the tab returns; and one fallback `setTimeout`, armed for the exact remaining time, fires completion while frames are paused. `lateByMs` reports how late the browser let it run.
  - **First paint without waiting for a frame.** `start()` samples synchronously.
  - **Fewer DOM writes.** `resolutionMs` (for example 1000) emits only when the rounded-up display value changes. The tick object is reused to avoid allocation at frame rate.
  - **Server alignment.** `calibrate(serverTime, sentAt, receivedAt)` removes a constant device-to-server offset, with error up to half the round trip.
  - **Vietnam time.** UTC+7 with no daylight saving; `nextMegaSaleStart` reads the year as Vietnam sees it, so a moment just after midnight on 1 January is handled correctly.
  - **Lifecycle.** The timer owns one frame request, one timeout and one listener, and releases all three on `stop()`, completion and `dispose()`.
- **Verification:**
  - `node --check js/anti-drift-timer.js`: syntax ok.
  - `npm test`: 43 pass, 0 fail (Node v24.13.1). Covers the helpers, 11.11 midnight (`2025-11-10T17:00:00.000Z`), drift (5,000 irregular frames with exact `target - clock` at every tick), a naive fixed-step counter falling more than 1 s behind while this timer stays exact, a five-minute frame gap corrected by one tick, visibility resampling, completion through the fallback timeout (on time, late and early), step re-arming past the platform timeout limit, coarse resolution, calibration, retargeting, lifecycle release, and input validation.
  - **Mutation audit (A3):** 8 planted defects in a scratch copy (a 1 ms bias, an uncancelled frame, a kept listener, no resample on return, no lateness report, emit on every frame, no timeout clamp, a timeout left armed on dispose). All 8 were caught by at least one test.
  - **Real browser (headless Microsoft Edge 155, served over HTTP):** a 4-second countdown with two main-thread stalls of 600 ms and 300 ms. `AntiDriftTimer` completed 1 ms after the target; a `setInterval` counter running in the same page was 880 ms behind. 191 ticks; no page errors. The probe page was deleted afterwards.
- **Not verified:**
  - **A real hidden tab.** A second tab was brought to the front, but headless Edge kept the first tab `visible` and its frames kept running, so no background throttling happened. The hidden-tab behaviour is verified only against the fake world in the tests, not in a real browser. A headed browser check is needed.
  - Accuracy against a real server clock; `calibrate` was tested with synthetic times only.
  - Safari, Firefox, mobile browsers and battery-saver modes.
  - Wiring into `index.html`. There is no page yet.
  - Behaviour if the user changes the device clock while the countdown runs. The countdown follows the clock (documented), and no test covers a backward jump.
- **Human decision:** Pending review.
- **Notes:**
  - No invariant from `TASK_DECOMPOSITION.md` is touched. The timer only reads time. It can share the engine's injected clock, so reservation expiry (I-5) and the sale-start countdown agree.
  - `Hw_3/package.json` was created because the layout in `PROJECT_RULE.md` §10.1 calls for it and ES modules need `"type": "module"` to run under Node.
  - Nothing was committed. `.gitignore` is still to be added (`PROJECT_RULE.md` §10.2).

---

### PL-003 | 2026-10-29 | M1-M4 - Inventory Finite State Machine
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Intent:** An FSM that holds, expires, rolls back and confirms stock reservations with optimistic locking, so a high-concurrency flash sale cannot oversell.
- **Prompt (summary):** Develop an FSM module named `inventory-fsm.js` in pure JavaScript (ES modules) to handle optimistic inventory locking during high-concurrency flash sales. Explicitly handle state transitions for stock reservation, lock-expiry countdowns, automatic rollback on expiration, and final checkout confirmation, to prevent race conditions and overselling.
- **Output:**
  - `Hw_3/js/inventory-fsm.js`: `InventoryFsm`, the frozen `TRANSITIONS` table with `nextState` and `isTerminal`, eight typed errors, and `checkInvariantState`. JSDoc typedefs for every public contract.
  - `Hw_3/test/inventory-fsm.test.js`: 80 tests.
  - `Hw_3/package.json`: the test script now runs both suites.
  - `Hw_3/docs/TASK_DECOMPOSITION.md`: M1 to M4 and their checklists updated item by item (11 done, 11 partly done; none ticked complete, because milestone sign-off is the Human Lead's).
- **Design decisions:**
  - **A synchronous API is the anti-oversell mechanism.** The stock check and the decrement happen in one uninterrupted section, with no `await`, callback or promise boundary between them (`PROJECT_RULE.md` §2.1). A control test shows that a version with an `await` in the middle oversells under the same load.
  - **Optimistic locking by version.** Each SKU has a version that rises on every change. `reserve({ expectedVersion })` fails with `VersionConflictError` carrying the fresh snapshot, so a stale view cannot win. Omitting it skips the check; the reservation is still atomic. Under heavy contention a strict check turns away buyers for whom stock remained, which is stated in the docs.
  - **Five states.** `HELD → CHECKOUT → CONFIRMED`, plus `RELEASED` and `EXPIRED`. `CHECKOUT` is an addition to the plan: it lets a buyer who is paying near the deadline finish. It extends the deadline once and never shortens it. The plan's `commit` is named `confirm`.
  - **Three expiry paths, one rule.** Expiry runs lazily on every access, in a sweep at the start of each `reserve`, and from one timer armed for the earliest live deadline (a min-heap with stale-entry skipping). The lazy path is what stops a zombie commit when the timer is throttled. A hold is valid at `ttl - 1` and expired at `ttl`.
  - **Bounded work and memory.** Each sweep expires at most `sweepBudget` holds. Live reservations cannot exceed total stock. Finished reservations are kept up to `terminalRetention`, oldest evicted first, and their idempotency keys go with them.
  - **Idempotency.** `reserve` requires a key. Only successful reservations are remembered. The other operations are idempotent by reservation id.
  - **Outcomes are values.** Business outcomes (out of stock, limit, conflict, expired) are returned as typed results; malformed input throws. A failed call changes nothing and writes no journal entry.
  - **Journal and hook, not yet a ledger.** Every change writes one entry in the same atomic section, and `onTransition` delivers it after the state is consistent. The in-memory journal is capped. The hash chain, replay and tamper checks belong to M7.
  - **The invariant checker recomputes.** `checkInvariants()` rebuilds reserved and sold totals from the reservation records, so a counter bug is caught and not trusted. It covers I-1, I-2, I-3, I-4 and I-7.
- **Verification:**
  - `node --check js/inventory-fsm.js`: syntax ok.
  - `npm test`: 123 pass, 0 fail (43 timer, 80 FSM), Node v24.13.1.
  - Covered: all twenty state and event pairs (exactly seven legal); boundary expiry; confirm after a throttled timer; the zombie commit (a slow payer after expiry cannot confirm and the unit is never sold twice); 100 concurrent identical requests giving one effect; optimistic retries over 20 seeds of 60 buyers selling exactly 5; all 90 interleavings of 3 buyers and 2 units, with and without the version check; 30 seeded random-operation sequences of 200 steps with the invariant checker run after every step; bounded memory; hook delivery, re-entrancy and error isolation.
  - **Mutation audit (A3):** 19 defects planted in a scratch copy, one guard each (no lazy expiry, no sweep before reserve, an oversell off-by-one, rollback that returns no stock, both boundary off-by-ones, no version check, no limit check, a timer never re-armed, stale heap entries treated as live, and others). All 19 were caught.
- **Not verified:**
  - **Cross-tab or cross-user safety.** This FSM is one object in one JavaScript realm. It models the server-side engine. If every browser tab ran its own copy, nothing would stop two tabs overselling. A real sale needs one authoritative instance behind a server. The module cannot fix that, and the page must never be its source of truth.
  - **Browser run.** Only Node was used. The module uses no browser API, but it was not loaded in a browser.
  - **Scale.** No load profile (M8). Behaviour at hundreds of thousands of reservations is untested.
  - **Throttled real timers.** Timer throttling is simulated by not firing the timer; no real hidden tab was used.
  - **M4 beyond `reserve`**, and everything in M5 to M10: admission control, failure injection and payment, the hash-chained ledger with replay, the demo page.
  - Use together with `anti-drift-timer.js` (feed `getCountdown().expiresAt` to its `targetTime`) is designed for but not tested.
- **Human decision:** Pending review.
- **Notes:**
  - Plan changes to approve: `commit` → `confirm`; a new `CHECKOUT` state and checkout window; reservation state names differ from the plan's list; a journal and hook in place of the full ledger for now.
  - A reserve replay returns the reservation in its current state, which can already be `EXPIRED`. A caller that wants a fresh hold must use a new key. This is documented in the JSDoc.
  - Nothing was committed.

---

### PL-004 | 2026-10-29 | M8-M9 - Flash-Sale Engine and Simulation Dashboard
- **Agent / Model:** Claude Code (claude-sonnet-5-5)
- **Intent:** The core engine that coordinates the anti-drift countdown and the optimistic inventory FSM, plus a responsive vanilla dashboard that simulates Southeast Asian peak-load traffic with live stock, checkout actions and reservation timers.
- **Prompt (summary):** Build the core Flash-Sale Engine module (`flash-sale-engine.js`) coordinating the zero-drift countdown timer and the optimistic inventory lock FSM using ES modules. Create a responsive Vanilla JavaScript / HTML / CSS simulation dashboard mirroring peak-load traffic conditions in Southeast Asian e-commerce platforms, including real-time stock status, checkout action triggers and active reservation timers.
- **Output:**
  - `Hw_3/js/flash-sale-engine.js`: `FlashSaleEngine`, `SalePhase`, `SaleNotStartedError`, `SaleEndedError`.
  - `Hw_3/js/traffic-simulator.js`: `TrafficSimulator`, `REGIONS`, `PROFILE_INFO`, `createSeededRandom`, `arrivalOffset`.
  - `Hw_3/js/dashboard.js`, `Hw_3/index.html`, `Hw_3/css/dashboard.css`: the dashboard.
  - `Hw_3/test/flash-sale-engine.test.js` (40 tests) and `Hw_3/test/traffic-simulator.test.js` (22 tests).
  - `Hw_3/js/anti-drift-timer.js`: one guard added (AF-002) and one regression test.
  - `Hw_3/docs/TASK_DECOMPOSITION.md` (M8 and M9 items, one status at a time) and `Hw_3/docs/AI_FAILURE_AUDIT.md` (AF-001 to AF-005).
- **Design decisions:**
  - **The server clock decides the phase; the countdown is display only.** UPCOMING, LIVE and ENDED come from the server clock, recomputed lazily on every operation and by one exact timer for the next boundary. The `AntiDriftTimer` runs on the client clock plus a calibrated offset. A hidden tab, a throttled timer or a wrong device clock cannot open the sale early or shut it late.
  - **A wrong device clock is visible, not hidden.** The countdown can reach zero while the server is still UPCOMING. The engine reports `countdown-zero`, purchases are still refused with a retry hint, and `calibrateClient` resumes the countdown with the right remaining time.
  - **Holds outlive the sale.** New holds are accepted only while LIVE. A hold taken before the end can still be checked out and paid until its own deadline.
  - **The engine keeps a display copy** of active holds, recent holds and orders, built from the FSM journal, and applies pending expiry before every read. The FSM stays the source of truth. The display lists are capped; totals are not.
  - **The dashboard renders on a budget.** Engine events only mark the view dirty; one `requestAnimationFrame` loop updates the hold timers; heavy panels redraw at most every 100 ms when dirty and every 250 ms otherwise; every write skips unchanged text; rows are reused.
  - **The simulator keeps no timers.** It is stepped by the host with a budget, and events carry their own simulated times, so a run does not depend on how often it is stepped. It is seeded, so a run can be reproduced.
  - **Traffic model.** Six markets with different latency and a slow tail; a pre-sale crowd that retries with jittered backoff after refusal; double clicks; optimistic buyers that send the stock version they read; abandoned carts; failed payments; late payments.
- **Verification:**
  - `node --test` over the four files: 186 pass, 0 fail (44 timer, 80 FSM, 40 engine, 22 simulator), Node v24.13.1. `package.json` was absent (AF-005), so the files were run directly.
  - **Mutation audit (A3), engine:** 18 defects planted in a scratch copy. 15 were caught at first; 3 survived and exposed weak tests (AF-003). After adding tests, 18 of 18 were caught. The timer guard (AF-002) was checked by removing it: its regression test fails without it and passes with it.
  - **Simulator tests** check the invariants as they run. After a full run: nothing oversold, no hold left active once expired holds are swept, `reserved = paid + payment failed + abandoned + expired before checkout + expired during payment`, `paid` equals the engine's order count, and revenue equals the engine's revenue.
  - **Real browser** (headless Microsoft Edge 155, served over HTTP), driven through the DevTools protocol:
    - Main run (3,000 buyers, spike, sale opens in 4 s, lasts 15 s, hold time 8 s): the countdown counted down at millisecond resolution; the chip changed to LIVE at about 4.0 s; at about 1.5 s after opening, 2,188 of 3,000 buyers had arrived at roughly 1,800 to 2,700 requests per second; the three products showed live available, held and sold counts; my own purchase went through hold, checkout and pay (1,290,000 ₫); the stock audit passed 20 checks; the phase ended with the buy buttons disabled and the countdown at 00:00:00.000; no page errors.
    - Layout checked from screenshots at 1280 px (full page) and 390 px (mobile, device scale 2): the 390 px page has no horizontal overflow, and at 1280 px the countdown, reservation timers and form no longer leave a gap after a layout fix.
    - Clock-skew run (device clock 3 s fast): the countdown reached zero about 3 s early and the page said so; a purchase was refused with "opens in 2.8 s"; "Sync with server" applied a −3.00 s correction and the countdown resumed; after the sale opened, the purchase succeeded.
- **Observations from the runs (not a baseline):**
  - With the default settings, the 200 phones were all held within about 1.5 s of opening.
  - The strict optimistic version check turned away many buyers while stock remained (one run: 4,259 version conflicts and 767 buyers giving up out of 3,000). This is the trade-off documented in the FSM: a strict check rejects buyers for whom stock remained.
  - About 70 holds were still in progress when the sale closed and completed afterwards, as designed.
- **Not verified:**
  - **A real hidden tab.** Headless Edge does not hide a tab, so countdown behaviour in a background tab is verified only against the fake world in the tests.
  - A physical phone. Mobile was emulated by viewport size only.
  - Colour contrast measurement and Lighthouse. The colour tokens were chosen to meet 4.5:1 but not measured.
  - Safari and Firefox.
  - A baseline, and a demand level of 100 times stock. The default is about 3.3 buyers per unit.
  - The buyer's queue position and any admission control (M5). The simulator's latency is synthetic network latency, not engine processing time.
  - Cross-tab or cross-user behaviour: the engine and the simulator run in one JavaScript realm, so this models a server-side engine and is not one.
- **Human decision:** Pending review.
- **Notes:**
  - `Hw_3/package.json` went missing again (AF-005, open). It was not recreated; the question for the Human Lead is whether it should exist.
  - The Human Lead committed the timer and the docs between prompts. The new files in this entry are not committed.
  - Plan changes to approve: the timer and engine sit under M8 and M9, which were not planned to own them; a device-clock skew demo was added.

---

<!-- Next entry: PL-005 -->
