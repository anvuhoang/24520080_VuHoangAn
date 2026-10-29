# Project Rules - HW 3: High-Concurrency Flash-Sale E-Commerce Engine

These rules govern every human and AI agent contribution to this project. They are binding. When a rule conflicts with a convenient shortcut, the rule wins and the conflict is raised in the prompt log. Where the code differs from a rule, the difference is recorded as a deviation and stays open until the Human Lead decides on it.

---

## 1. Scope & Stack

| Area | Rule |
|---|---|
| Language | Vanilla ES2022+ JavaScript (ES Modules). No TypeScript and no build step. Types are documented with JSDoc on every public contract. |
| Runtime dependencies | **None.** A new dependency needs a written justification in `PROMPT_LOG.md` and explicit human approval. |
| Dev dependencies | **None.** Any dev dependency, including type packages and linters, needs explicit human approval. |
| Engine | Plain ES modules with no browser or Node-only API in the core, so the same code runs in Node and in the browser. |
| Time, identity, randomness | Injected (`clock`, `newId`, `random`). The core never calls `Date.now()`, `Math.random()` or `crypto.randomUUID()` directly. |
| Markup and styling | Semantic HTML5; plain CSS with custom properties in `css/`. No CSS framework. |
| Tests | `node --test` (Node's built-in runner), run through `npm test`. Tests import the modules directly and need no bundler. |
| Browser target | Latest two versions of Chrome, Edge, Firefox and Safari. Live Server is the supported way to serve the page. |

The stack above is proposed from the final HW 2 decision. The Human Lead confirms it at M0. Changing the language, adding a build step or adding any dependency is a gate (§6.3).

---

## 2. Concurrency Rules

JavaScript is single-threaded, so races occur at `await` points. These rules close them.

1. **Atomic sections.** Any read-check-write on shared state (stock, reservations, purchase counts, idempotency records) happens inside one synchronous section. **No `await`, callback or promise boundary may sit between the read and the dependent write.** This is the most important rule in the project. A violation is a P0 defect.
2. **Single owner of state.** All mutable engine state lives in one store object. Only the store's methods change it. No other module holds a mutable reference to stock or reservations.
3. **Idempotent writes.** Every state-changing request carries an idempotency key. A request with no key is rejected. A repeat with the same key returns the stored outcome and applies nothing new. A repeat that arrives while the first is in flight waits for it.
4. **Bounded everything.** Queues have a capacity. In-flight work has a limit. Retry counts have a ceiling. Stored keys and ledger buffers have a stated lifetime or size. Unbounded growth is a defect.
5. **Fair, ordered admission.** Within a priority class, requests start in arrival order. No class may starve another.
6. **Permits are released on every path.** A concurrency permit or a held reservation is released in a `finally` block or on the equivalent settlement path, for success, failure and abort. A leak is a P0 defect.
7. **Reservations expire.** Every hold has a time-to-live on the injected clock. Expiry returns stock exactly once, and a commit after expiry fails.
8. **Cooperative cancellation.** Async operations accept an `AbortSignal`. A cancelled request leaves no hold, permit or half-written record.
9. **No busy-waiting.** Use promises, events or awaits on a signal. Polling loops are not acceptable.
10. **Retries are bounded and jittered.** Jitter comes from the injected random source. A retried operation must be idempotent.
11. **Ordering of multi-resource operations.** An operation that touches more than one SKU or record acquires them in a fixed order, to rule out deadlock.
12. **Money is integer minor units.** No floating-point amounts. Totals are computed from line items, never stored independently of them.

---

## 3. Data Integrity & Audit Protocol

### 3.1 Invariants
The twelve invariants I-1 to I-12 in `TASK_DECOMPOSITION.md` are the contract. They are implemented in `checkInvariants` and are never weakened without Human Lead approval (§6.3).

### 3.2 Ledger
- Every state change is appended to the ledger as one entry: sequence number, injected-clock time, event, payload, and the hash of the previous entry.
- The ledger is append-only. No code edits, deletes or reorders an entry.
- The live state must always equal the replay of the ledger (I-10). The hash chain must always verify (I-11).
- A ledger entry is written in the same atomic section as the state change it records.

### 3.3 Reconciliation
- After every test scenario that changes state, and at the end of every simulation run, `checkInvariants` and `reconcile` run, and their output is part of the evidence.
- A discrepancy is a defect, not a warning.

### 3.4 Prohibited Patterns
- An `await` between a stock read and its write.
- A direct `Date.now()`, `Math.random()` or ID generation call in the core.
- A state change with no ledger entry.
- A catch block that swallows an error without releasing holds and permits.
- A shared mutable object handed out to callers (return copies or frozen views).
- A test that passes only for the interleaving the author expected.
- Floating-point money.

---

## 4. Security & Abuse Resistance

- Validate every request at the boundary: types, ranges, SKU existence, key presence, quantity limits. Reject with a typed error.
- Rate-limit per buyer using the injected clock. The rejection carries a retry-after value.
- The page holds no business logic and no authority. It only calls the engine and renders results.
- No secret, credential or personal data is stored in the repository or the ledger. Buyer identifiers are opaque test values.
- Error messages shown to users do not expose internal state, stack traces or other buyers' data.

---

## 5. Agentic Workflow Governance

### 5.1 Roles
| Role | Responsibility |
|---|---|
| Human Lead (Technical PM) | Owns scope, approves milestones, dependencies and deviations, signs off on the Definition of Done. |
| Implementation Agent | Writes code and tests against `TASK_DECOMPOSITION.md`. Cannot mark its own milestone complete. |
| Review Agent / Human | Reviews each diff against §2, §3 and §7 before it is accepted. |

### 5.2 Work Protocol
1. **Read first.** Every session begins by reading this file, `TASK_DECOMPOSITION.md`, and the latest entries of `PROMPT_LOG.md` and `AI_FAILURE_AUDIT.md`.
2. **Check the tree before editing.** Files may change outside an agent session. List the project files and compare them with the last `PROMPT_LOG.md` entry. Record any unexplained difference as a failure entry.
3. **One milestone at a time.** Do not start M(n+1) until M(n) exit criteria are met and recorded.
4. **Invariants and tests first** for any change to stock, reservation, idempotency, admission or ledger logic.
5. **Small diffs.** One module and one concern per change. Target under 300 changed lines per commit.
6. **No silent scope changes.** A required task missing from the decomposition is added to `TASK_DECOMPOSITION.md` with a note, not implemented silently.
7. **Stop on ambiguity.** When a request conflicts with a rule here, the agent stops and asks the Human Lead.
8. **Verify transformations.** A conversion, formatting or refactoring pass is checked against its source: comments, JSDoc and exported declarations are compared, not only syntax and tests.
9. **Evidence, not assertion.** A claim of "passes" or "done" is backed by the command run and its actual output. Anything not run is listed as not verified.
10. **Fix the cause.** When a test fails, find out whether the code or the test is wrong, and say which. Do not weaken an assertion to make it pass.

### 5.3 Human Gates (the agent must not proceed without approval)
- Adding any dependency, runtime or development.
- Changing the language or the build model.
- Changing a public API signature defined at M1.
- Weakening, removing or reinterpreting an invariant.
- Relaxing a concurrency, integrity or audit rule.
- Accepting a deviation or an open P0 or P1 finding.
- Marking a milestone complete.
- Any commit, push, history rewrite, or deletion of logs or source files.

### 5.4 Logging Obligations
- Every substantive prompt is logged in `PROMPT_LOG.md`: intent, files changed, verification output, what was not verified, and the Human decision.
- Every agent error, wrong assumption, rule violation or rework is logged in `AI_FAILURE_AUDIT.md` in the same session it is found.
- Logs are append-only. A correction is a new entry that references the original.
- A change to a rule or a status in these documents is itself logged.

---

## 6. Deviations, Decisions and Gates

### 6.1 Deviations
A deviation is a place where the code or documents differ from a rule. It gets an ID (`D-n`), a reason, an owner and a status. It stays open until the Human Lead accepts it or orders a fix.

### 6.2 Decisions
Open decisions are tracked in the open-decisions register in `PROMPT_LOG.md` (`OD-n`) with the entry that raised them.

### 6.3 Gates
The list in §5.3 is exhaustive of what needs prior approval. Everything else is within the agent's remit but must be logged.

---

## 7. Audit Framework

Audits are repeatable checks with fixed evidence. An audit **passes** only when its output is attached to the log and shows no violation.

| ID | Audit | What it does | Trigger | Pass criterion |
|---|---|---|---|---|
| A1 | Invariant audit | Runs `checkInvariants` and `reconcile` after each scenario and at the end of each run | Every test scenario; every simulation | Zero violations |
| A2 | Interleaving audit | Runs the deterministic scheduler over exhaustive interleavings (small N) and seeded samples (large N) | Any change to inventory, reservation, idempotency or admission code | I-1 to I-9 hold for every explored schedule |
| A3 | Mutation audit | Applies a planted defect (for example an `await` between check and decrement, a skipped release, a missing idempotency check) | Each milestone, M2 onward | Every planted defect makes at least one test fail |
| A4 | Replay audit | Rebuilds state from the ledger and compares it with the live state | M7 onward; every simulation | Exact equality (I-10) |
| A5 | Tamper audit | Edits, removes or reorders one entry in a copy and runs `verifyChain` | M7 onward | The change is detected and the first bad sequence number is named (I-11) |
| A6 | Load audit | Runs seeded profiles, including demand at 100 times stock | M8 onward | Oversell count = 0 for every seed; all invariants hold; metrics recorded |
| A7 | Governance audit | Checks that every milestone has log entries, verification output, closed or accepted failures, and a matching traceability row | End of each milestone | No gaps |
| A8 | Accessibility audit | Lighthouse plus a manual keyboard and contrast pass | M9 onward | Accessibility and Best Practices at 100; contrast at least 4.5:1 |

### 7.1 Findings
| Severity | Definition | Required response |
|---|---|---|
| **P0** | Oversell, lost or duplicated order, held stock lost, ledger break, an `await` inside an atomic section, a permit or reservation leak | Stop work. Find the cause in the same session. Add a regression test before continuing. |
| **P1** | An invariant fails under a reachable schedule, a missed audit, or a rule broken without a safe failure | Fix before the milestone closes. Record the guard added. |
| **P2** | A defect caught by a test, a documentation gap, a style or naming violation | Fix in the same change. |
| **P3** | Cosmetic or wording issue with no runtime effect | Note only. |

### 7.2 Finding lifecycle
`open` → `fixed` (with the commit or log reference and the test that now covers it) → `verified` (the audit that found it passes) → `closed`. A finding can be `accepted` only by the Human Lead.

### 7.3 Mutation audit rule
For each guard in the engine there is a planted defect that removes it. If a planted defect is not caught, the test suite is incomplete, and that is a P1 finding against the suite.

### 7.4 Evidence retention
Audit output is pasted into the `PROMPT_LOG.md` entry that ran it. Reproduction needs the command, the seed list and the Node version.

---

## 8. Code Quality & Accessibility

- **Naming:** `camelCase` for values and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants. Names state intent (`reservedUnits`, not `r`).
- **Comments:** Explain *why*. Document each atomic section and each invariant at the place it is enforced.
- **Types:** Public contracts (options, outcomes, entries, errors) are documented with JSDoc `@typedef` or `@param` where defined.
- **Errors:** Throw or return typed errors (`OutOfStockError`, `ReservationExpiredError`, `QueueFullError`, `RateLimitedError`, `InvariantViolationError`). Never throw strings.
- **Accessibility:** WCAG 2.2 AA. Contrast of at least 4.5:1. All controls keyboard-operable with visible focus. `prefers-reduced-motion` respected. Live status uses `aria-live="polite"`.

---

## 9. Definition of Done

A task is done only when all of the following are true:
1. Its acceptance criteria in `TASK_DECOMPOSITION.md` are met.
2. The invariants it touches are named and each has a test.
3. `npm test` passes, and `checkInvariants` passes at the end of each state-changing scenario.
4. §2 and §3 are satisfied, including no `await` inside an atomic section.
5. The audits required by its trigger in §7 have run and passed, with output attached to the log.
6. No dependency was added without approval.
7. Public contracts carry JSDoc.
8. A `PROMPT_LOG.md` entry is written with executed verification output; any failure is recorded in `AI_FAILURE_AUDIT.md`.
9. The traceability row is filled in.
10. The Human Lead has reviewed and approved the change.

---

## 10. Project Layout and Version Control

### 10.1 Layout (`Hw_3/`)

| Path | Purpose |
|---|---|
| `docs/` | Governance: task decomposition, project rules, prompt log, failure and audit log. |
| `js/` | Engine modules (store, reservations, idempotency, admission, ledger, audits, simulation). Browser- and Node-safe. |
| `css/` | Styles for the demo page. |
| `test/` | `node --test` suites, including the deterministic scheduler and mutation harness. |
| `index.html` | Demo page, served by Live Server. No business logic. |
| `package.json` | `"type": "module"` and the `test` script. No dependencies. |

### 10.2 Version control
- Work on the current branch until the Human Lead names another.
- Commit only when the Human Lead asks. Commit messages follow `type(scope): summary` with type one of `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`. Scope examples: `inventory`, `reservation`, `idempotency`, `admission`, `ledger`, `audit`, `sim`, `ui`, `docs`.
- A `.gitignore` is added before the first commit of `Hw_3/`.
