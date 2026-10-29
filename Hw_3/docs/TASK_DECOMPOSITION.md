# Task Decomposition - HW 3: High-Concurrency Flash-Sale E-Commerce Engine

**Objective:** Build a flash-sale engine that sells a limited stock to many simultaneous buyers without ever overselling, double-charging or losing an order, and that can prove this with an audit trail. The engine admits requests in a controlled, fair order, reserves stock atomically, expires abandoned reservations, tolerates duplicate and failed requests, and records every state change in an append-only, verifiable ledger.

**Scope boundary:** The engine is a simulated back end written as plain ES modules. It runs unchanged in Node (for tests and load simulation) and in the browser (for the demo page). There is no real payment provider, database or network service. Time, randomness and identifiers are injected so every scenario is reproducible.

**Stack (proposed, confirm at M0):** Vanilla HTML5, CSS3 and ES2022+ JavaScript (ES Modules). Node's built-in test runner. JSDoc for types. No frameworks, no build step, no runtime or dev dependencies. This follows the final stack decision recorded for HW 2; any change is a Human Lead gate (`PROJECT_RULE.md` §6.3).

**Concurrency model (decided up front):** JavaScript runs on one thread, so "high concurrency" here means *many overlapping asynchronous requests whose steps interleave at every `await`*. Correctness therefore depends on one rule: **any read-check-write on shared stock happens inside a single synchronous section with no `await` in the middle.** The engine must hold its invariants under every possible interleaving of request steps, not only the ones a test happens to produce.

---

## Domain Invariants (the audit contract)

Every milestone is judged against these invariants. They are checked by code (`checkInvariants`), not by inspection. Identifiers are stable and are cited by tests, log entries and failure reports.

| ID | Invariant | Applies from |
|---|---|---|
| I-1 | **No oversell.** Units sold never exceed initial stock for any SKU, at any instant. | M2 |
| I-2 | **Conservation.** For every SKU: `initial = available + reserved + sold`. | M2 |
| I-3 | **Non-negativity.** `available`, `reserved` and `sold` are never below zero. | M2 |
| I-4 | **Reservation exclusivity.** A reservation is active or in exactly one terminal state (`committed`, `released`, `expired`). It never changes terminal state. | M3 |
| I-5 | **No zombie commit.** A reservation that has expired or been released cannot be committed. | M3 |
| I-6 | **Idempotency.** Repeating a request with the same idempotency key returns the original result and applies its effect once. | M4 |
| I-7 | **Purchase limit.** A buyer never holds or owns more than the per-SKU limit. | M4 |
| I-8 | **Bounded resources.** Queue depth never exceeds capacity and in-flight work never exceeds the concurrency limit. | M5 |
| I-9 | **Fair admission.** Within one priority class, requests start in arrival order, and none waits forever while later ones are served. | M5 |
| I-10 | **Ledger completeness.** Every state change has exactly one ledger entry, and replaying the ledger rebuilds the current state exactly. | M7 |
| I-11 | **Ledger integrity.** The hash chain verifies end to end; any edit, deletion or reordering is detected. | M7 |
| I-12 | **Money correctness.** Amounts are integer minor units; an order total equals the sum of its lines; no refund exceeds the charge. | M6 |

---

## Concurrency Defect Catalogue (what the tests must be able to catch)

| Code | Defect | Typical symptom | Violated invariant | Covered at |
|---|---|---|---|---|
| C-1 | Check-then-act race (`await` between stock check and decrement) | Oversell | I-1, I-2 | M2 |
| C-2 | Lost update (two writers overwrite one another) | Stock drifts from truth | I-2 | M2 |
| C-3 | Double submit (client retry, double click) | Two orders for one intent | I-6 | M4 |
| C-4 | Reservation leak (hold never released on failure) | Stock stuck as `reserved` | I-2, I-4 | M3, M6 |
| C-5 | Zombie commit (payment returns after expiry) | Sold after release | I-5 | M3, M6 |
| C-6 | Thundering herd / retry storm | Queue overflow, latency spike | I-8 | M5 |
| C-7 | Starvation / unfair ordering | Early buyers lose to late ones | I-9 | M5 |
| C-8 | Partial failure (charge succeeds, commit fails) | Money taken, no order | I-10, I-12 | M6 |
| C-9 | Ledger gap or reorder | Replay disagrees with state | I-10, I-11 | M7 |
| C-10 | Clock skew or non-injected time | Expiry wrong or untestable | I-5 | M3 |

---

## Milestone Overview

| Milestone | Name | Exit Criteria | Status | Evidence |
|---|---|---|---|---|
| M0 | Workspace & Governance | Docs in place, stack confirmed, folder layout created | [ ] | |
| M1 | Domain Contracts & Invariant Checker | Types documented, `checkInvariants` implemented, invariant tests written | [~] Implemented for the inventory FSM; awaiting Human Lead sign-off | `js/inventory-fsm.js` (contracts; checker for I-1 to I-4 and I-7); `test/inventory-fsm.test.js` |
| M2 | Atomic Inventory Core | I-1 to I-3 hold under exhaustive interleavings of N buyers | [~] Implemented; awaiting Human Lead sign-off | All 90 interleavings of 3 buyers and 2 units; 20 seeded races of 60 buyers; 19 of 19 planted defects caught (PL-003) |
| M3 | Reservations & Expiry | I-4, I-5 hold; expiry driven by an injected clock | [~] Implemented; awaiting Human Lead sign-off | Lazy, swept and timer-driven expiry; checkout window; boundary and zombie-commit tests (PL-003) |
| M4 | Idempotency & Purchase Limits | I-6, I-7 hold under duplicate and concurrent retries | [~] Partly implemented (reserve only); awaiting Human Lead sign-off | 100 concurrent identical requests give one effect; per-buyer limit across holds and sold units (PL-003) |
| M5 | Admission Control & Fairness | I-8, I-9 hold; bounded queue, backpressure, rate limit | [ ] | |
| M6 | Failure Injection & Recovery | I-12 holds; every injected failure ends in a consistent state | [ ] | |
| M7 | Ledger & Audit Framework | I-10, I-11 hold; replay, tamper and reconciliation audits pass | [ ] | |
| M8 | Load Simulation & Metrics | Oversell = 0 across seeded runs; baseline throughput and latency recorded | [~] Simulator and live metrics implemented; no baseline recorded; awaiting Human Lead sign-off | `js/traffic-simulator.js`; `test/traffic-simulator.test.js`; browser run (PL-004) |
| M9 | Demo UI & Accessibility | Live stock, queue position and order status; WCAG 2.2 AA | [~] Dashboard implemented and exercised in a real browser; contrast, Lighthouse and queue position not done; awaiting Human Lead sign-off | `index.html`; `css/dashboard.css`; `js/dashboard.js`; `js/flash-sale-engine.js` (PL-004) |
| M10 | Final Audit & Review | All audits pass; open findings closed or accepted; demo recorded | [ ] | |

---

## Phase 1: Workspace & Governance (M0)
- [ ] Confirm the stack and the file layout with the Human Lead (`PROJECT_RULE.md` §1 and §10).
- [ ] Create the layout: `Hw_3/docs/`, `Hw_3/js/`, `Hw_3/css/`, `Hw_3/test/`, `Hw_3/index.html`, `Hw_3/package.json` (`"type": "module"`, `test` script only).
- [ ] Finalise `TASK_DECOMPOSITION.md` and `PROJECT_RULE.md`; start `PROMPT_LOG.md` and `AI_FAILURE_AUDIT.md`.
- [ ] Add a `.gitignore` before the first commit.
- [ ] List the tree and record it as the baseline in `PROMPT_LOG.md` (`PROJECT_RULE.md` §5.2).

## Phase 2: Domain Contracts & Invariant Checker (M1)
- [~] Document contracts with JSDoc. Done in `js/inventory-fsm.js` for `ReservationView`, `StockSnapshot`, `ReserveRequest`, `Result`, `JournalEntry`, `InventoryFsmOptions` and `ExportedState`. Not yet: `Order`, a ledger entry with a hash, and the engine-level request type.
- [~] Define closed state sets. Done for reservations: `HELD | CHECKOUT | CONFIRMED | RELEASED | EXPIRED`, with an exported, frozen transition table. The plan's `active | committed | released | expired` became these five names, adding `CHECKOUT` for the payment window. Not yet: order and engine states.
- [~] Define typed errors. Done: `OutOfStockError`, `LimitExceededError`, `ReservationExpiredError`, `VersionConflictError`, `InvalidTransitionError`, `UnknownSkuError`, `UnknownReservationError`, `IdempotencyConflictError`. Not yet: `QueueFullError`, `RateLimitedError`, `InvariantViolationError`.
- [~] Implement `checkInvariants` returning every violation with its invariant ID. Done for I-1, I-2, I-3, I-4 and I-7 (`checkInvariantState`, a pure function, and `InventoryFsm.checkInvariants()`). I-5 is enforced by the transition rules and tested, not by the checker. I-6 and I-8 to I-12 belong to later milestones.
- [ ] Write the invariant tests first, against hand-built valid and invalid states. Not followed: the hand-built state tests exist, but they were written after the implementation (PL-003).
- [x] Inject the clock and the ID generator. The core never calls `Date.now()` or `Math.random()`; `Date.now` is only the default value of the `clock` option. No random source is needed yet.

## Phase 3: Atomic Inventory Core (M2)
- [x] Implement `reserve`, `confirm` (the plan's `commit`) and `release` as single synchronous sections over one store (`js/inventory-fsm.js`).
- [~] Prove no `await` sits between any stock read and its write. A test checks that no public operation returns a promise, and a control test shows that a version with an `await` in the middle oversells under the same load. There is no review checklist or static check yet.
- [~] Deterministic scheduler. Not built as a reusable component: the tests contain an interleaving generator for small cases and seeded microtask yields for large ones.
- [x] Explore interleavings exhaustively for small N (3 buyers, 2 units: all 90 schedules, with and without the version check) and by seeded sampling for large N (20 seeds of 60 buyers, 30 random-operation sequences). I-1 to I-4 and I-7 are asserted after each step.
- [~] Planted defects. 19 defects were planted in a scratch copy of the module, and all 19 were caught (PL-003). The specific "await inserted between check and decrement" defect is covered by the control test and not by a planted copy of the module, because the module's API is synchronous.

## Phase 4: Reservations & Expiry (M3)
- [x] Reservation holds stock for a time-to-live measured on the injected clock.
- [x] Expiry returns held units to `available` exactly once, through the timer, the sweep and the lazy check on access.
- [x] `confirm` after expiry or release fails (I-5): `ReservationExpiredError` after expiry, `InvalidTransitionError` after release.
- [~] Test expiry at the boundary: valid at `ttl - 1`, expired at `ttl` and well past it. Many reservations expiring on one tick are covered by the sweep budget test. Expiry racing a confirm is covered through lazy expiry on access; there is no separate interleaving test for it.
- [x] Expiry sweep is bounded per tick (`sweepBudget`) and re-arms at once for the rest.
- [x] Added under PL-003: a checkout window. `beginCheckout` extends the deadline once and never shortens it; a checkout that outlasts its window expires and rolls back.

## Phase 5: Idempotency & Purchase Limits (M4)
- [~] Every creating request carries an idempotency key, and a missing key is rejected. `reserve` does this. `confirm`, `release` and `beginCheckout` are idempotent by reservation id instead of by key.
- [x] Store the key with its reservation. A repeat returns the same reservation (`replayed: true`). Every operation is synchronous, so there is no in-flight state to wait for. Only successful reservations are remembered, because a failed attempt had no effect.
- [x] Enforce the per-buyer, per-SKU limit across holds and sold units together (I-7).
- [~] Define key lifetime and eviction. A key lives as long as its reservation record, which is kept up to `terminalRetention` finished reservations. After eviction the same key is a new request. This is tested and documented, but it is a boundary and not a guarantee: `terminalRetention` must exceed the retries expected inside the sale window.
- [x] Test: 100 concurrent identical requests produce one effect.

## Phase 6: Admission Control & Fairness (M5)
- [ ] Bounded FIFO request queue with a stated capacity and a backpressure signal at 80% depth.
- [ ] A concurrency limit on in-flight requests; permits are released on every path (success, failure, abort).
- [ ] Per-buyer rate limit using the injected clock; the rejection is a typed, retryable error with a retry-after hint.
- [ ] Assert I-8 (bounds) and I-9 (arrival order within a priority class, no starvation) with randomised task durations.
- [ ] Cancellation through `AbortSignal` removes a queued request and releases an in-flight one cleanly.

## Phase 7: Failure Injection & Recovery (M6)
- [ ] A fault injector that can fail payment, time out payment, drop a response, and crash between two steps.
- [ ] Payment failure releases the reservation and leaves no order in `paid`.
- [ ] Payment success after expiry triggers an automatic refund or compensation entry (C-5, C-8).
- [ ] Retry policy with bounded attempts and jitter from the injected random source; no unbounded retry (C-6).
- [ ] After every injected failure scenario, `checkInvariants` passes.

## Phase 8: Ledger & Audit Framework (M7)
- [ ] Append-only ledger: each entry carries a sequence number, the clock time, the event, and the hash of the previous entry.
- [ ] `replay(ledger)` rebuilds the full state; the result must equal the live state (I-10).
- [ ] `verifyChain(ledger)` detects an edited, removed or reordered entry (I-11).
- [ ] `reconcile(state, ledger)` produces a report: totals per SKU, open reservations, orders by state, discrepancies.
- [ ] Tamper test: change one entry in a copy; verification must fail and name the first bad sequence number.
- [ ] Recovery test: discard live state, rebuild from the ledger, continue selling.

## Phase 9: Load Simulation & Metrics (M8)
- [x] A seeded load generator with spike, ramp and steady profiles, a pre-sale crowd, double clicks, optimistic-lock conflicts, abandoned carts and payment failures (`js/traffic-simulator.js`), drawing buyers from six Southeast Asian markets with different latency. The spike is an exponential burst around opening, not "all buyers at t = 0".
- [~] Metrics: holds taken, refusals by cause, conflicts, duplicates absorbed, expiries, and p50 and p95 latency. The latency is the simulated network round trip, not engine processing time. The oversell count is reported through the invariant audit and not as a counter. No queue depth, because there is no admission queue yet (M5).
- [~] Hard pass condition: the simulator tests run the invariant checker after sampled steps, and every dashboard run audits once a second. The tests use a handful of seeds, not a fixed list.
- [ ] Record a baseline (throughput, p95). Not done. PL-004 notes one informal observation from headless Edge; it is not a baseline.
- [ ] Run at least one profile where demand is 100 times stock. Not done. The default demand is about 3.3 buyers per unit (5,000 buyers for 1,500 units).

## Phase 10: Demo UI & Accessibility (M9)
- [~] `index.html` shows remaining stock (available, held and sold per product), the buyer's own holds with live timers, and the activity log, which also carries the order status. Not done: the buyer's queue position, because there is no admission queue yet (M5).
- [x] Controls are native elements with visible focus; status updates use `aria-live="polite"`. The countdown has `role="timer"`.
- [~] The CSS respects `prefers-reduced-motion` and `prefers-color-scheme`. Colour tokens were chosen to meet 4.5:1, but contrast was not measured.
- [~] Sale countdown: `js/anti-drift-timer.js`, coordinated by `js/flash-sale-engine.js` and shown on the dashboard. Added under PL-002 (not in the original plan). Unit-tested, and shown counting down in headless Edge, including with a skewed device clock. Not yet checked in a real hidden tab.
- [x] The page holds no business logic: `js/dashboard.js` reads engine state, renders it and forwards clicks.
- [x] Added under PL-004: a device-clock skew demo. The countdown can run on a wrong clock, hit zero early while the server keeps the sale closed, and resume with the true remaining time after "Sync with server".
- [x] Run the load profile from the page and show the invariant checker's verdict (the audit chip, updated every second).

## Phase 11: Final Audit & Review (M10)
- [ ] Run every audit in `PROJECT_RULE.md` §7 and attach the output to `PROMPT_LOG.md`.
- [ ] Close or explicitly accept every open failure in `AI_FAILURE_AUDIT.md`.
- [ ] Lighthouse: Accessibility and Best Practices at 100.
- [ ] Record a demo covering a spike, a duplicate-request burst, an injected payment failure, an expiry, and the audit report.
- [ ] Human Lead signs off each milestone in the table above.

---

## Traceability Matrix (maintained from M1)

| Requirement | Invariant | Test (file :: name) | Audit | Status |
|---|---|---|---|---|
| Never oversell | I-1, I-2 | | A2, A3, A6 | [ ] |
| One effect per intent | I-6 | | A2, A6 | [ ] |
| Held stock is never lost | I-2, I-4, I-5 | | A1, A4 | [ ] |
| Orderly, fair admission | I-8, I-9 | | A2, A6 | [ ] |
| Consistent after failure | I-12 | | A1, A4 | [ ] |
| Provable history | I-10, I-11 | | A4, A5 | [ ] |

Rows are added as requirements are refined. A requirement with no test in this table cannot be marked done.

---

## Definition of Done (applies to every task)
1. Code reads cleanly and matches the surrounding style; no dead code or commented-out blocks.
2. The invariants the task touches are named, and a test checks each one.
3. `checkInvariants` passes at the end of every test scenario that changes state.
4. No `await` appears between a stock read and the write that depends on it.
5. No dependency added, runtime or development, without approval.
6. Public contracts carry JSDoc.
7. Any automated transformation (conversion, formatting) is compared with its source for comments and declarations, not only syntax.
8. The matching `PROMPT_LOG.md` entry is written, with executed output as verification; any agent failure is recorded in `AI_FAILURE_AUDIT.md`.
9. The traceability matrix row is filled in.
