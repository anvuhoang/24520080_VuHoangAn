# AI Interaction & Prompt Engineering Log — HW3: Resilient Landing Page

**Course / Assignment:** HW3: Resilient Landing Page (Drift-Free Engine, State Machine, Security)  
**Project:** Aetheria Fault-Tolerant Platform Architecture  
**Repository Branch:** `lab-1`  
**Engineer:** Vũ Hoàng Ân (Student ID: 24520080)  
**AI Assistant:** Google Antigravity / Gemini Pair Programming Assistant  

---

## 1. Overview & Architectural Principles

This document provides a comprehensive chronological audit trail of all AI prompts, architectural design decisions, code changes, verification steps, and human oversight applied during the engineering of **HW3: Resilient Landing Page**.

The project strictly adhered to core resilience and defensive engineering principles:
- **Progressive Enhancement:** Fully accessible HTML structure that presents baseline semantics and content if JavaScript is disabled, stalls, or fails to execute.
- **Drift-Free Temporal Synchronization:** Computing countdown duration strictly via `(targetUtcMs - Date.now())` on every tick rather than decrementing counter variables (`counter--`), rendering the timer immune to browser tab throttling and system sleep.
- **Deterministic Finite State Machine:** Explicit form states (`idle`, `submitting`, `success`, `error`) with a strict transition table preventing invalid state jumps and race conditions.
- **Synchronous In-Flight Concurrency Guard:** Atomic boolean mutex (`inFlight = true`) preventing double-submissions and parallel request race conditions.
- **Strict Injection Rejection & XSS Immunity:** Complete prohibition of `innerHTML`; exclusive use of `textContent` DOM APIs; rigorous normalization and rejection of malicious injection payloads.
- **Human-in-the-Loop Commits:** Zero automated commits; all milestones were decomposed into atomic slices, tested, reviewed, and committed manually by the developer.

---

## 2. Milestone & Commit Audit Summary

| Milestone | Commit Hash | Conventional Commit Message | Focus Area |
|---|:---:|---|---|
| **Phase 0** | `39a8063` | `feat(ui): scaffold resilient landing page` | Semantic HTML5 structure, responsive vanilla CSS design system, placeholder UI, and audit template |
| **Slice 1** | `70ae621` | `feat(timer): implement drift-free UTC countdown` | UTC ISO 8601 target (`Z`), `Date.now()` delta, zero-clamping, memory leak prevention, 11 tests |
| **Slice 2** | `c8ee4d0` | `feat(form): implement submission state machine` | 4 explicit states (`idle`, `submitting`, `success`, `error`), validation pre-flight, async failure handling, 14 tests |
| **Slice 3A** | `1e81261` | `fix(form): prevent concurrent submissions` | Synchronous mutex lock, `aria-busy`/`aria-disabled`, rapid-click suppression, 6 double-submit tests |
| **Slice 3B** | `2c8e946` | `fix(security): sanitize input and prevent XSS` | `normalizeEmail()`, XSS character rejection, 254-char RFC limit, safe DOM `textContent`, 22 tests |
| **Audit** | *(Working)* | `docs: complete AI failure audit report` | Exhaustive analysis of real AI defects (`FL-02`, `FL-03`, `FL-04`) in `AI_FAILURE_AUDIT.md` |

---

## 3. Chronological Prompt & Engineering Trajectory

---

### Phase 0: Project Scaffolding & Responsive UI Design

#### User Prompt
```text
Create a standalone HW3 Resilient Landing Page using
HTML, CSS, and vanilla JavaScript.

For now:
- Create project structure.
- Build responsive landing page UI.
- Include countdown display and signup form UI.
- Create AI_FAILURE_AUDIT.md template.
- Do NOT implement countdown or form logic yet.

No frameworks. No auto-commit.
Keep output concise.
```

#### AI Architectural Response & Actions
1. **Directory Structure Established:**
   - `index.html`: Semantic HTML5 layout featuring header, hero section, countdown unit cards (`DAYS`, `HOURS`, `MINUTES`, `SECONDS`), priority cluster waitlist form, resilience pillar cards, and accessible footer.
   - `css/style.css`: Modern vanilla CSS design system with CSS custom properties, mesh glows, glassmorphism, responsive grid/flexbox layouts down to 320px mobile screens.
   - `js/app.js`: Clean bootstrap placeholder with deferred logic notice.
   - `AI_FAILURE_AUDIT.md`: Standardized failure taxonomy (`FL-01` to `FL-06`) and incident report schema.
2. **Verification:** Validated that markup adheres to progressive enhancement baseline and displays static placeholders without JavaScript.
3. **Commit Hash:** `39a8063` (`feat(ui): scaffold resilient landing page`).

---

### Phase 1: Slice 1 — Drift-Free UTC Countdown Engine

#### User Prompt
```text
Implement HW3 Slice 1 only: drift-free countdown.

Requirements:
- Use a UTC ISO 8601 target timestamp ending in Z.
- Calculate remaining time from target - Date.now().
- Never decrement a counter per interval tick.
- Display days, hours, minutes, seconds.
- Clamp at zero and stop timer on completion.
- Clean up interval to prevent memory leaks.
- Add focused tests.

Do not touch form logic.
No auto-commit. Concise output.
```

#### AI Architectural Response & Actions
1. **Target Specification & Strict Terminal 'Z' Validation:**
   - Declared default target UTC timestamp `2026-11-01T00:00:00Z` on `#countdown[data-target]`.
   - Built `isValidUtcIsoString()` and `calculateRemainingTime()` throwing error if target does not end in `'Z'`.
2. **Drift-Free Delta Engine:**
   - Evaluated `(targetMs - now)` on every tick instead of decrementing state variables.
   - Built mathematical time unit splitter (`Math.floor(remainingMs / 1000)`).
   - Clamped all units to `0` when `remainingMs <= 0` and stopped interval immediately.
3. **Memory Management:**
   - Cleared interval via `clearInterval(intervalId)` upon reaching completion or manual `stop()`.
   - Attached `beforeunload` cleanup listener to prevent background timer leaks upon navigation.
4. **Focused Unit Tests:** Created `tests/countdown.test.js` (11 tests covering validation, calculation, clock skew/tab throttling jumps, zero-clamping, and cleanup).
5. **Commit Hash:** `70ae621` (`feat(timer): implement drift-free UTC countdown`).

---

### Phase 2: Slice 1 Verification & Drift Audit

#### User Prompt
```text
Review Slice 1 for timezone bugs, interval drift,
and timer memory leaks.

Run tests and report only actual defects found.
Do not modify code yet.
Keep response short.
```

#### AI Architectural Response & Actions
1. **Audit Execution:** Ran `node --test tests/countdown.test.js` (11/11 tests passing in ~72ms).
2. **Finding:** Confirmed zero defects across the 3 critical failure vectors:
   - *Timezones:* Strict `Z` suffix parsed as UTC epoch milliseconds; no local timezone getters used.
   - *Interval Drift:* Directly derives time from `targetMs - Date.now()`, eliminating tab throttle drift.
   - *Memory Leaks:* Clear lifecycle teardown on completion, `stop()`, and `beforeunload`.

---

### Phase 3: Slice 2 — Signup Form State Machine

#### User Prompt
```text
Implement HW3 Slice 2 only: signup form state machine.

States: idle, submitting, success, error.

Requirements:
- Explicit state transitions.
- Validate input before submitting.
- Show loading, success, and error UI.
- Handle async submission failures.
- Avoid duplicate event listeners.
- Add state transition tests.

Do not implement Slice 3 security yet.
No auto-commit. Concise output.
```

#### AI Architectural Response & Actions
1. **Finite State Machine Architecture:**
   - Defined `FORM_STATES = { IDLE: 'idle', SUBMITTING: 'submitting', SUCCESS: 'success', ERROR: 'error' }`.
   - Defined `VALID_TRANSITIONS` transition table guarding against illegal state jumps.
2. **Client-Side Validation & Async Handling:**
   - Built preliminary `validateEmail()` to reject empty/malformed inputs before triggering network dispatch.
   - Built async submit handler catching network/cluster rejections and transitioning to `error`.
3. **UI Synchronization (`renderFormUi`):**
   - Managed loading buttons, focus, error alerts, and success messages with `aria-live="polite"`.
4. **Event Listener Hygiene:**
   - Built `initSignupForm()` utilizing `AbortController` and `form._stateMachine.destroy()` to ensure idempotent binding without listener duplication.
5. **Focused Unit Tests:** Created `tests/signup-machine.test.js` (14 tests covering state transitions, async errors, retry flow, and UI syncing).
6. **Commit Hash:** `c8ee4d0` (`feat(form): implement submission state machine`).

---

### Phase 4: Slice 3A — Double-Submit Prevention & Rapid-Click Suppression

#### User Prompt
```text
Implement HW3 Slice 3A: double-submit prevention.

Requirements:
- Reject submissions while state is submitting.
- Disable submit button during request.
- Re-enable after success or error as appropriate.
- Prevent concurrent requests.
- Add rapid-click tests.

Do not change countdown.
No auto-commit. Concise output.
```

#### AI Architectural Response & Actions
1. **Synchronous Mutex Lock (`inFlight`):**
   - Replaced loose asynchronous state checks with an atomic synchronous boolean `inFlight = true` wrapped in `try...finally`.
   - Excluded re-entrant promises or parallel `Promise.all` invocations immediately (`returns false`).
2. **Button Lifecycle & ARIA Compliance:**
   - In `SUBMITTING`: `submitBtn.disabled = true`, `aria-busy="true"`, `aria-disabled="true"`.
   - In `ERROR`: `submitBtn.disabled = false`, attributes cleared to permit immediate user retry.
   - In `SUCCESS`: `submitBtn.disabled = true`, `aria-disabled="true"` to prevent duplicate access tokens.
3. **DOM Rapid-Click Suppression:**
   - Added direct click event listener on submit button with `stopImmediatePropagation()`.
4. **Focused Unit Tests:** Created `tests/double-submit.test.js` (verifying 20 rapid clicks, parallel promises, and re-enable lifecycle).
5. **Commit Hash:** `1e81261` (`fix(form): prevent concurrent submissions`).

---

### Phase 5: Slice 3B — Safe Input Handling & XSS Defense

#### User Prompt
```text
Implement HW3 Slice 3B: safe input handling.

Requirements:
- Validate and normalize form inputs.
- Never render user input with innerHTML.
- Use textContent or safe DOM APIs.
- Reject invalid input.
- Add XSS tests using malicious input strings.
- Preserve existing form behavior.

No unrelated changes.
No auto-commit. Concise output.
```

#### AI Architectural Response & Actions
1. **Input Normalization (`normalizeEmail`):**
   - Stripped ASCII control characters (`0x00`-`0x1F`, `0x7F`) and null bytes.
   - Trimmed leading/trailing whitespace and lowercased email addresses.
2. **Strict Injection Rejection (`validateEmail`):**
   - Rejected strings containing `<, >, ", ', `, ;, \\` and control sequences.
   - Enforced RFC 5321 length limits (maximum 254 characters).
3. **Safe DOM API Guarantee:**
   - Confirmed 0 occurrences of `innerHTML` or `insertAdjacentHTML` in `js/app.js`.
   - Updated all dynamic error and success feedback exclusively using `.textContent`.
4. **Focused Unit Tests:** Created `tests/xss-security.test.js` (22 tests verifying rejection of 14 OWASP injection payloads, length limits, and zero `innerHTML` calls).
5. **Commit Hash:** `2c8e946` (`fix(security): sanitize input and prevent XSS`).

---

### Phase 6: Code Review & AI Failure Audit Report

#### User Prompt
```text
Review HW3 code and Git diffs for AI-induced defects.

Focus on:
1. Countdown drift/timezone/memory leaks.
2. Invalid form state transitions.
3. Double-submit and XSS vulnerabilities.

For each real defect found, document:
- Defect description
- Diagnostic method
- Refactored solution
- Verification evidence

Update AI_FAILURE_AUDIT.md.
Do not invent defects.
Do not modify code without approval.
Keep response concise.
```

#### AI Architectural Response & Actions
1. **Git Diff & Trajectory Inspection:**
   - Audited commits from `39a8063` through `2c8e946`.
   - Identified 3 real defects that surfaced during AI generation and test cycles:
     - `AUDIT-001` (`FL-04`): Concurrent submission race condition due to missing synchronous mutex in initial state machine.
     - `AUDIT-002` (`FL-03`): Naive email regex permitting XSS tags, SQL fragments, and unbounded string lengths.
     - `AUDIT-003` (`FL-02`): Unchecked DOM interface calls (`submitBtn.removeAttribute`, `elements.input.addEventListener`) causing fatal TypeErrors in mock/headless test environments.
2. **Documentation:** Populated `AI_FAILURE_AUDIT.md` with complete incident reports, diagnostic steps, refactored code diffs, verification evidence, and updated Resilience Scorecard matrix.
3. **Test Suite Verification:** Ran `node --test tests/*.test.js` (53 tests across 19 suites passing in ~143ms).

---

## 4. Prompt Engineering Insights & AI Collaboration Lessons

1. **Atomic Constraint Specification Prevents Scope Creep:**
   - Enforcing *"Do NOT implement countdown or form logic yet"* in Phase 0 successfully prevented the AI from coupling presentation markup with unfinished logic.
2. **Explicit Clock Contracts Prevent Timezone Skew:**
   - Demanding *"UTC ISO 8601 target timestamp ending in Z"* and *"Calculate from target - Date.now()"* eliminated standard AI hallucinations involving naive `new Date()` subtraction and system clock drift.
3. **Demand Synchronous Mutexes for Async Functions:**
   - Relying on `state === 'submitting'` inside async functions is inherently vulnerable to race conditions because JavaScript event loop yields on `await`. Prompting specifically for concurrency locks is essential.
4. **Negative Validation is as Important as Positive Validation:**
   - AIs frequently generate permissive regex patterns that match valid emails but fail to reject malicious injection payloads. Specific XSS negative test suites must be mandated.
5. **Defensive Duck-Typing Safeguards Testability:**
   - DOM manipulation code produced by AI assumes full browser prototype availability. Enforcing optional chaining (`?.`) ensures cross-environment compatibility between real browsers, JSDOM, and Node.js mock runners.
