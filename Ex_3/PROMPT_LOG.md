# AI Interaction & Prompt Engineering Trajectory — Lab 2, Exercise 3

## 1. Overview & Architectural Principles

This document records the prompt engineering trajectory, design decisions, verification evidence, and human-in-the-loop governance for **Lab 2, Exercise 3 (Resilient State Machine & Skeleton Loader)**.

### Core Architecture & Constraints:
- **Stack:** Semantic HTML5, Vanilla JavaScript (ES6+), TypeScript type definitions (`types.ts`), Native DOM APIs, and CSS.
- **State Machine Architecture:** Strictly enforced 4-state asynchronous lifecycle modeled as a TypeScript discriminated union (`ViewState<T>`: `IDLE`, `LOADING`, `SUCCESS`, `ERROR`).
- **Race-Condition Protection:** Monotonically increasing sequence tokens (`currentRequestId`) tracking asynchronous operations to identify and discard stale or out-of-order network responses and errors without external abort dependencies.
- **Duplicate Request Prevention:** Safe UI and engine guards preventing redundant concurrent fetches while an active operation is in `LOADING` status.
- **Accessible Semantic UI & Skeleton Screen:**
  - `IDLE`: Initial state presenting an accessible "Load Data" action.
  - `LOADING`: Hardware-accelerated CSS shimmer gradient and pulsing skeleton cards matching live card layout to eliminate Cumulative Layout Shift (CLS), with `role="status"` and `aria-busy="true"`. Full compliance with `@media (prefers-reduced-motion: reduce)`.
  - `SUCCESS`: Render fetched data safely into accessible card grid (`role="feed"`, `<article>`, `<header>`, `<footer>`).
  - `ERROR`: Clear human-readable error description with `role="alert"`, `aria-live="assertive"`, and an accessible "Retry Connection" action that re-initiates data loading.
- **Security & Hygiene:** Native DOM nodes only (`document.createElement`, `document.createTextNode`, `textContent`), strictly forbidding `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `eval`. Complete immunity to XSS injection payloads.
- **Zero Dependencies:** Pure Vanilla JavaScript and CSS; zero React, zero build tools, zero external npm packages.

---

## 2. Prompt Trajectory & Milestone History

### Phase 0: Planning & Architectural Scaffolding

#### User Prompt
> "Read project-rule.md and task-decomposition.md.
>
> Initialize Exercise 3 in ex_3/.
>
> Exercise: Resilient State Machine & Skeleton Loader.
>
> Requirements:
> - TypeScript discriminated union for ViewState<T>.
> - Four states: IDLE, LOADING, SUCCESS, ERROR.
> - Async data fetching with race-condition protection.
> - Animated CSS skeleton during LOADING.
> - Human-readable errors and Retry Connection button.
> - Semantic HTML and accessible UI.
>
> Inspect existing project conventions and reuse
> Exercise 2 architecture where appropriate.
>
> Update task-decomposition.md for Exercise 3.
> Do not modify ex_1/ or ex_2/.
> Do not implement or commit yet.
>
> Keep responses concise."

#### AI Action & Engineering Decisions
1. **Architectural Guidelines (`Ex_3/PROJECT_RULE.md`):**
   - Established strict rules for 4-state deterministic transitions (`IDLE -> LOADING -> SUCCESS | ERROR`, `ERROR -> LOADING`).
   - Defined race-condition protection requirements via monotonic sequence tracking.
   - Mandated zero-CLS CSS skeleton screens with `@media (prefers-reduced-motion)` fallbacks.
   - Enforced safe DOM construction rules (zero `innerHTML`).
2. **Task Breakdown (`Ex_3/TASK_DECOMPOSITION.md`):**
   - Formulated a 5-phase delivery roadmap (Phase 0 Planning, Phase 1 State Machine Engine, Phase 2 Animated Skeleton, Phase 3 Resilient Error & Success UI, Phase 4 Verification & Integration).
3. **Type Definitions & Scaffold (`Ex_3/types.ts`, `Ex_3/index.html`, `Ex_3/styles.css`, `Ex_3/app.js`):**
   - Defined `ViewState<T>` discriminated union type in TypeScript.
   - Scaffolded base HTML container `#app` and CSS custom design variables.
   - Confirmed isolation: no modifications made to `Ex_1/` or `Ex_2/`.

---

### Phase 1: State Machine & Async Engine with Race-Condition Guard

#### User Prompt
> "Implement Exercise 3 - Phase 1.
>
> Tasks:
> - Define ViewState<T> as a TypeScript discriminated union.
> - Restrict states to IDLE, LOADING, SUCCESS, ERROR.
> - Implement async loadData() and state transitions.
> - Prevent stale async responses from overwriting newer results.
> - Store data only in SUCCESS state.
> - Store error messages only in ERROR state.
> - Handle thrown errors safely.
>
> Follow project rules.
> Use the architecture approved in Phase 1.
> Do not modify previous exercises.
>
> Add focused tests for state transitions and race conditions.
> Run tests and fix failures.
>
> Do not commit yet.
> Report only changed files and test results."

#### AI Action & Engineering Decisions
1. **Runtime Discriminated Union & State Factories (`Ex_3/state-machine.js`):**
   - Implemented `StateStatus` enum (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`).
   - Implemented factory functions: `createIdleState()`, `createLoadingState()`, `createSuccessState(data)`, and `createErrorState(error)`.
   - Built `isValidState(state)` enforcing the discriminated union invariant:
     - `data` allowed strictly and only when `status === 'SUCCESS'`.
     - `error` allowed strictly and only when `status === 'ERROR'`.
     - Rejects any other keys or unknown states.
2. **Race-Condition Protected Async Engine (`createAsyncDataLoader`):**
   - Utilized monotonic sequence counter `currentRequestId`.
   - On each `loadData()` call, incremented `requestId = ++currentRequestId`.
   - When an asynchronous promise resolves or rejects, checked `if (requestId !== currentRequestId)`:
     - If mismatched, the result is flagged `{ stale: true }` and discarded without mutating the state machine.
     - If matched, state transitions deterministically to `SUCCESS` or `ERROR`.
3. **Resilient Error Extraction:**
   - Handled thrown `Error` instances, raw strings, objects with `.message`, and primitive values (`null`, `undefined`) into clear human-readable strings.
4. **Subscription Engine (`ResilientStateMachine`):**
   - Provided reactive observer pattern with `subscribe(listener)` and deterministic state distribution.
5. **Phase 1 Automated Test Suite (`Ex_3/test-state-machine.js`):**
   - Wrote 9 automated tests verifying strict state validation, transitions, safe error extraction, retry transitions, and race condition discards for both delayed success and delayed error responses.

#### Verification
- Ran `node Ex_3/test-state-machine.js`: **9/9 passed, 0 failed**.

#### Commit (User Executed)
- **Hash:** `d6bb158`
- **Message:** `feat(state): implement four-state async state machine`

---

### Phase 2: Semantic Data-Feed UI with Four States & Skeleton Loader

#### User Prompt
> "Implement Exercise 3 - Phase 2.
>
> Build a semantic data-feed UI with four states:
>
> IDLE:
> - Show a Load Data button.
>
> LOADING:
> - Display animated pulsing CSS skeleton placeholders.
> - Prevent duplicate requests where appropriate.
>
> SUCCESS:
> - Render fetched data safely.
>
> ERROR:
> - Display a human-readable error message.
> - Show a Retry Connection button.
>
> Requirements:
> - Retry must trigger a new request.
> - UI must reflect the current state.
> - Handle request failures without crashing.
> - Preserve race-condition protection.
> - Use accessible semantic HTML.
> - Respect prefers-reduced-motion.
> - Avoid unnecessary dependencies.
>
> Add tests for all four UI states.
> Run tests and fix failures.
>
> Do not commit yet.
> Report only changed files and test results."

#### AI Action & Engineering Decisions
1. **Pure CSS Shimmer & Pulsing Skeleton Screen (`Ex_3/styles.css`):**
   - Implemented `@keyframes shimmer` (linear gradient translation) and `@keyframes pulse` (opacity cycling) combined on `.skeleton` elements.
   - Built skeleton cards (`.skeleton-card`, `.skeleton-badge`, `.skeleton-title`, `.skeleton-line`) matching the dimensions and grid structure of live content cards (`.project-card`) to completely eliminate Cumulative Layout Shift (CLS).
   - Added accessible `@media (prefers-reduced-motion: reduce)` rule freezing all animations and transitions to static background fills for users with vestibular sensitivities.
2. **Semantic UI View Renderers (`Ex_3/app.js`):**
   - `createDOM(tag, attrs, ...children)`: Safe element factory strictly using `document.createElement`, `document.createTextNode`, and `addEventListener`. Safe against XSS; zero `innerHTML`.
   - `renderIdleView`: Renders `#idle-view` with accessible `#load-data-btn` button.
   - `renderLoadingView`: Renders `#loading-view` with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, hidden screen reader text, and 3 skeleton cards (`aria-hidden="true"`).
   - `renderSuccessView`: Renders `#success-view` with feed toolbar, item count, and `<article class="project-card">` cards inside a `<div class="project-grid" role="feed">`.
   - `renderErrorView`: Renders `#error-view` with `role="alert"`, `aria-live="assertive"`, `#error-message`, and accessible `#retry-btn` button.
   - `renderView(state, actions)`: Deterministic master dispatcher ensuring the UI always reflects the current `ViewState<T>`.
3. **Duplicate Request Prevention & Retry Flow:**
   - Updated `createAsyncDataLoader` in `Ex_3/state-machine.js` to track `inFlight` status and accept `{ preventDuplicate: true }`.
   - In `app.js`, both `handleLoad()` and `handleRetry()` guard against duplicate concurrent invocations if the state is currently in `LOADING`.
   - Clicking `#retry-btn` re-initiates `loadData()`, transitioning the state machine from `ERROR -> LOADING -> SUCCESS | ERROR`.
4. **Interactive Simulation Controls (`Ex_3/index.html`):**
   - Added an interactive simulation toggle (`#simulate-error-checkbox`) enabling users to simulate network failures (HTTP 504 / 503) directly in the browser to visually test the Error and Retry Connection flow.
5. **Comprehensive Headless Test Suite (`Ex_3/test-ui-states.js`):**
   - Built an in-memory headless DOM mock (`MockNode`, `MockElement`) enabling full automated test execution in Node.js with zero npm dependencies.
   - Handled `typeof Node !== 'undefined'` cross-environment compatibility in `createDOM`.
   - Added 9 exhaustive tests verifying all 4 UI states, duplicate request suppression, XSS safety, retry transitions, crash resilience on thrown errors, UI race condition protection, and CSS media query rules.

#### Verification
- Ran `node Ex_3/test-ui-states.js`: **9/9 passed, 0 failed**.
- Ran `node Ex_3/test-state-machine.js`: **9/9 passed, 0 failed**.
- Ran `node Ex_2/checkpoint2-verify.js`: **ALL PASSED** (confirmed zero regression across previous exercises).

---

## 3. Verification & Test Evidence Matrix

| Test Suite | Test Case | Target Requirement | Status |
| :--- | :--- | :--- | :--- |
| `test-ui-states.js` | IDLE State: Renders Load Data button with accessible labels | Show "Load Data" button in IDLE state | **PASSED** |
| `test-ui-states.js` | LOADING State: Displays animated skeleton with `role="status"` & `aria-busy="true"` | Accessible pulsing skeleton placeholders | **PASSED** |
| `test-ui-states.js` | LOADING State: Prevents duplicate requests when request is in flight | Suppress duplicate fetch invocations | **PASSED** |
| `test-ui-states.js` | SUCCESS State: Renders fetched data safely into semantic cards (zero `innerHTML`) | Safe data rendering; XSS injection payload immunity | **PASSED** |
| `test-ui-states.js` | ERROR State: Displays human-readable error message and Retry Connection button | Human-readable error description with `role="alert"` | **PASSED** |
| `test-ui-states.js` | RETRY Flow: Clicking Retry Connection triggers a new request and updates state | Retry triggers new fetch (`ERROR -> LOADING -> SUCCESS`) | **PASSED** |
| `test-ui-states.js` | Handles request failures gracefully without crashing | Robust error recovery on unexpected exceptions | **PASSED** |
| `test-ui-states.js` | Race-Condition Protection in UI: Stale slow response does not overwrite newer retry result | Sequence token guard preserves newest UI state | **PASSED** |
| `test-ui-states.js` | CSS Stylesheet respects `prefers-reduced-motion` | Accessible animation dampening in CSS | **PASSED** |
| `test-state-machine.js` | ViewState contract restricts states strictly to IDLE, LOADING, SUCCESS, ERROR | TypeScript discriminated union runtime contract | **PASSED** |
| `test-state-machine.js` | Data stored only in SUCCESS; error stored only in ERROR | Strict property boundary separation | **PASSED** |
| `test-state-machine.js` | Race-condition mitigation: Stale slow responses & errors safely discarded | Monotonic sequence token tracking | **PASSED** |

---

## 4. Key Engineering Takeaways

1. **Discriminated Union Runtime Enforcement:**
   In TypeScript, discriminated unions (`ViewState<T>`) provide compile-time guarantees, but runtime applications require matching validation functions (`isValidState`). Ensuring that properties like `data` or `error` cannot exist outside their corresponding state status eliminates undefined state combinations.
2. **Lightweight Race-Condition Mitigation:**
   Rather than relying on external libraries or complex abort chains, monotonic sequence counters (`currentRequestId`) provide an elegant, zero-dependency mechanism to ensure out-of-order asynchronous responses never corrupt state.
3. **Zero-CLS Skeleton Screens:**
   Structuring skeleton placeholder elements (`.skeleton-card`, `.skeleton-badge`, `.skeleton-line`) with identical dimensions, borders, and margins to live data cards eliminates Cumulative Layout Shift (CLS), ensuring smooth layout stability upon payload arrival.
4. **Defense-in-Depth against Duplicate Requests:**
   Preventing duplicate requests at both the UI event level (ignoring clicks when `status === LOADING`) and the data loader level (`options.preventDuplicate` returning in-flight promises) ensures robust protection regardless of how requests are dispatched.
