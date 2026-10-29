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
| M1 | Domain Contracts & Invariant Checker | Types documented, `checkInvariants` implemented, invariant tests written | [ ] | |
| M2 | Atomic Inventory Core | I-1 to I-3 hold under exhaustive interleavings of N buyers | [ ] | |
| M3 | Reservations & Expiry | I-4, I-5 hold; expiry driven by an injected clock | [ ] | |
| M4 | Idempotency & Purchase Limits | I-6, I-7 hold under duplicate and concurrent retries | [ ] | |
| M5 | Admission Control & Fairness | I-8, I-9 hold; bounded queue, backpressure, rate limit | [ ] | |
| M6 | Failure Injection & Recovery | I-12 holds; every injected failure ends in a consistent state | [ ] | |
| M7 | Ledger & Audit Framework | I-10, I-11 hold; replay, tamper and reconciliation audits pass | [ ] | |
| M8 | Load Simulation & Metrics | Oversell = 0 across seeded runs; baseline throughput and latency recorded | [ ] | |
| M9 | Demo UI & Accessibility | Live stock, queue position and order status; WCAG 2.2 AA | [ ] | |
| M10 | Final Audit & Review | All audits pass; open findings closed or accepted; demo recorded | [ ] | |

---

## Phase 1: Workspace & Governance (M0)
- [ ] Confirm the stack and the file layout with the Human Lead (`PROJECT_RULE.md` §1 and §10).
- [ ] Create the layout: `Hw_3/docs/`, `Hw_3/js/`, `Hw_3/css/`, `Hw_3/test/`, `Hw_3/index.html`, `Hw_3/package.json` (`"type": "module"`, `test` script only).
- [ ] Finalise `TASK_DECOMPOSITION.md` and `PROJECT_RULE.md`; start `PROMPT_LOG.md` and `AI_FAILURE_AUDIT.md`.
- [ ] Add a `.gitignore` before the first commit.
- [ ] List the tree and record it as the baseline in `PROMPT_LOG.md` (`PROJECT_RULE.md` §5.2).

## Phase 2: Domain Contracts & Invariant Checker (M1)
- [ ] Document with JSDoc: `Sku`, `StockRecord`, `Reservation`, `Order`, `Request`, `Outcome`, `LedgerEntry`, `EngineOptions`.
- [ ] Define closed state sets: reservation (`active | committed | released | expired`), order (`pending | paid | failed | refunded`), engine (`IDLE | RUNNING | DRAINING | DISPOSED`).
- [ ] Define typed errors: `OutOfStockError`, `LimitExceededError`, `ReservationExpiredError`, `QueueFullError`, `RateLimitedError`, `DuplicateRequestError`, `InvariantViolationError`.
- [ ] Implement `checkInvariants(state, ledger)` returning every violation with its invariant ID.
- [ ] Write the invariant tests first, against hand-built valid and invalid states.
- [ ] Inject the clock, the ID generator and the random source. The core never calls `Date.now()` or `Math.random()`.

## Phase 3: Atomic Inventory Core (M2)
- [ ] Implement `reserve`, `commit` and `release` as single synchronous sections over one store.
- [ ] Prove no `await` sits between any stock read and its write (review checklist plus a test with an adversarial scheduler).
- [ ] Build a **deterministic scheduler** that runs N request coroutines under a chosen interleaving.
- [ ] Explore interleavings exhaustively for small N (for example 3 buyers, 2 units) and by seeded sampling for large N. Assert I-1 to I-3 after each run.
- [ ] Add a **planted defect** version (an `await` inserted between check and decrement). The tests must fail on it (mutation audit, `PROJECT_RULE.md` §7.3).

## Phase 4: Reservations & Expiry (M3)
- [ ] Reservation holds stock for a time-to-live measured on the injected clock.
- [ ] Expiry returns held units to `available` exactly once.
- [ ] `commit` after expiry or release fails with `ReservationExpiredError` (I-5).
- [ ] Test expiry at the boundary (`ttl - 1`, `ttl`, `ttl + 1`), expiry racing a commit, and many reservations expiring on one tick.
- [ ] Expiry sweep is bounded per tick and cannot starve request handling.

## Phase 5: Idempotency & Purchase Limits (M4)
- [ ] Every state-changing request carries an idempotency key. A missing key is rejected.
- [ ] Store the key with its outcome. A repeat returns the stored outcome; a repeat while the first is in flight waits for it, and does not run again.
- [ ] Enforce the per-buyer, per-SKU limit across holds and sold units together (I-7).
- [ ] Define key lifetime and eviction, and test that eviction cannot allow a double effect inside the sale window.
- [ ] Test: 100 concurrent identical requests produce one effect.

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
- [ ] A seeded load generator: ramp, spike (all buyers at t = 0), and sustained profiles; mixed outcomes (success, out of stock, duplicate, failure).
- [ ] Metrics: accepted, rejected by cause, oversell count, p50 and p95 latency on the simulated clock, queue depth over time.
- [ ] Hard pass condition: oversell count = 0 and all invariants hold, for every seed in a fixed list.
- [ ] Record a baseline (throughput, p95) in `PROMPT_LOG.md`. Later changes are compared to it. No performance number is promised before the baseline exists.
- [ ] Run at least one profile where demand is 100 times stock.

## Phase 10: Demo UI & Accessibility (M9)
- [ ] `index.html` shows remaining stock, the buyer's queue position, the order status, and the activity log.
- [ ] Controls are native elements with visible focus; status updates use `aria-live="polite"`.
- [ ] Respect `prefers-reduced-motion` and `prefers-color-scheme`; text contrast at least 4.5:1.
- [ ] The page holds no business logic: it calls the engine and renders its results.
- [ ] Run the load profile from the page and show the invariant checker's verdict.

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
