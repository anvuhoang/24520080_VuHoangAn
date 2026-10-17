# AI Interaction & Prompt Engineering Trajectory — Lab 2, Exercise 2

## 1. Overview & Architectural Principles

This document records the prompt engineering trajectory, design decisions, verification evidence, and human-in-the-loop governance for **Lab 2, Exercise 2 (Reactive Engine & Task Manager)**.

### Core Architecture & Constraints:
- **Stack:** Semantic HTML5, Vanilla JavaScript (ES6+), Native DOM APIs, and ES Modules.
- **State Architecture:** Custom closure-based `useState` hook powered by a centralized `stateStore` array, pointer cursor management, and `resetCursor()` resetting prior to each render cycle.
- **Unidirectional Reactive Loop:** Top-down re-render cycle triggered by state setters (`setState(val)` and `setState(prev => next)`), preserving state across re-renders without unintended resets.
- **Root Event Delegation:** Single set of delegated listeners attached strictly to the root `#app` container, resolving actions via event bubbling and WeakMap-backed handler registry; zero per-element listeners on child elements or buttons.
- **Strict Prohibition:** Zero external runtime dependencies, zero React runtime, zero JSX parsing runtime, zero build tools, and zero usage of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `eval`.

---

## 2. Prompt Trajectory & Milestone History

### Phase 0: Planning & Architectural Scaffolding

#### User Prompt
> "Read project-rule.md and task-decomposition.md.
>
> Initialize Exercise 2 in Ex_2/:
> - index.html
> - reactive-engine.js
> - checkpoint2-verify.js
>
> Use the exact verification code from the assignment.
> If unavailable, ask me for it.
>
> Requirements:
> - Custom useState closure engine.
> - Centralized stateStore and resetCursor.
> - Root event delegation.
> - Reactive Task Manager with dynamic filters.
> - Unidirectional data flow.
> - Vanilla JS, no React or external dependencies.
>
> Update task-decomposition.md for Exercise 2.
> Preserve Exercise 1 and existing project rules.
>
> Do not implement or commit yet.
> Keep responses concise."

#### AI Action & Engineering Decisions
1. Created [`Ex_2/TASK_DECOMPOSITION.md`](file:///c:/Users/VU%20HOANG%20AN/Desktop/Deadline/Lab_Web/Ex_2/TASK_DECOMPOSITION.md) breaking Exercise 2 down into 4 clear phases (State Store, useState Dispatcher, Event Delegation, Reactive UI & Verification).
2. Created [`Ex_2/PROJECT_RULE.md`](file:///c:/Users/VU%20HOANG%20AN/Desktop/Deadline/Lab_Web/Ex_2/PROJECT_RULE.md) defining strict constraints for state management, unidirectional flow, root event delegation, and security.
3. Scaffolded initial skeleton files (`index.html`, `reactive-engine.js`, `checkpoint2-verify.js`).
4. Preserved `Ex_1/` without modifications and prompted the user for the authoritative Checkpoint 2 verification snippet.

---

### Phase 1: Centralized State Store & Cursor Management

#### User Prompt
> "Implement Exercise 2 - Phase 1.
>
> Tasks:
> - Create centralized stateStore.
> - Implement resetCursor().
> - Maintain stable hook call order.
> - Support multiple state slots.
> - Preserve state between renders.
> - Prevent unintended state resets.
>
> Follow project rules.
> Use Vanilla JavaScript only.
> Add minimal tests and run them.
>
> Do not implement useState dispatcher or UI yet.
>
> Please do not commit"

#### AI Action & Engineering Decisions
1. **Centralized Store & Cursor (`Ex_2/reactive-engine.js`):**
   - Implemented `export const stateStore = []` to retain state items across render passes.
   - Implemented `let cursor = 0` with `resetCursor()` resetting the cursor to `0` prior to renders while preserving stored data.
2. **Hook Allocation Foundation (`allocateSlot`):**
   - Bound slot index `cursor` sequentially.
   - Initialized slots only on first allocation (`stateStore[currentSlot] === undefined`).
   - Prevented unintended state resets: subsequent render passes do not overwrite stored state with initial values.
3. **Verification Harness (`Ex_2/test-reactive-engine.js`):**
   - Created test suite with 6 targeted tests covering array store, cursor resets, independent multi-slot tracking, and simulated render persistence.

#### Verification
- Ran `node Ex_2/test-reactive-engine.js`: **6/6 passed, 0 failed**.

#### Commit (User Executed)
- **Hash:** `714859e`
- **Message:** `feat(state): implement stateStore and resetCursor engine`

---

### Phase 2: Closure-Based `useState` Hook & Reactive Dispatcher

#### User Prompt
> "Implement Exercise 2 - Phase 2.
>
> Tasks:
> - Implement useState(initialValue) using closures.
> - Return [state, setState].
> - Support functional state updates.
> - Preserve state across re-renders.
> - Trigger re-render after state changes.
> - Reset hook cursor before each render.
> - Ensure predictable state transitions.
>
> Follow existing architecture and project rules.
> Add focused tests and fix failures.
>
> Do not implement event delegation or Task Manager yet.
> Do not commit"

#### AI Action & Engineering Decisions
1. **`useState(initialValue)` Hook Implementation:**
   - Captured `const slotIndex = cursor;` in a closure.
   - Evaluated initial state lazily if passed as a factory function (`typeof initialValue === 'function' ? initialValue() : initialValue`).
   - Guarded uninitialized slots via membership check (`!(slotIndex in stateStore)`), preserving `null`, `false`, and `undefined` states correctly.
2. **Predictable Setter & Functional Updates:**
   - `setState(newValue)` accepts direct values or functional updaters (`newValue(stateStore[slotIndex])`).
   - Updates `stateStore[slotIndex]` and immediately triggers `triggerReRender()`.
3. **Re-render Loop & Cursor Reset:**
   - `triggerReRender()` calls `resetCursor()` before invoking the active component renderer.
   - Mounts the updated VNode tree to the container via `replaceChildren(renderToDOM(vdom))`.
4. **Test Suite Expansion:**
   - Added tests for `useState`, functional updates (`prev => prev + 5`), automatic re-render triggers, cursor reset at render start, and multi-hook independence.

#### Verification
- Ran `node Ex_2/test-reactive-engine.js`: **10/10 passed, 0 failed**.

#### Commit (User Executed)
- **Hash:** `ae74c1f`
- **Message:** `feat(state): implement reactive useState dispatcher`

---

### Phase 3: Centralized Root Event Delegation Engine

#### User Prompt
> "Implement Exercise 2 - Phase 3.
>
> Tasks:
> - Implement centralized root event delegation.
> - Attach event listeners to the root container.
> - Dispatch events to correct VNode handlers.
> - Support dynamically rendered buttons.
> - Avoid attaching listeners to button children.
> - Prevent duplicate and orphan listeners.
> - Preserve event handling after re-renders.
>
> Reuse Exercise 1 concepts where appropriate.
> Do not modify ex_1/.
>
> Run event delegation tests and fix failures.
>
> Do not commit"

#### AI Action & Engineering Decisions
1. **Root Delegation Architecture (`setupEventDelegation`):**
   - Attached listeners for `click`, `input`, `change`, `submit`, `keydown`, `keyup` strictly to the root container.
   - Used a `WeakSet` (`delegatedContainers`) and `_hasRootDelegation` flag to guarantee listeners are attached only once, preventing duplicates across re-renders.
2. **WeakMap Handler Registry (`eventRegistry`):**
   - Replaced direct `domElement.addEventListener()` calls with registration in `eventRegistry.set(domElement, handlers)`.
   - Prevented orphan listeners and memory leaks by allowing unmounted elements to be automatically garbage collected.
3. **Bubbling & Inner Element Resolution:**
   - The delegated container listener traverses upward from `event.target` to `container` (`current = current.parentElement || current.parentNode`).
   - Clicking an inner child (e.g. `<span class="icon">` inside `<button>`) bubbles up to the button and dispatches to the button's registered VNode handler.
   - Child elements have zero direct DOM event listeners attached.
4. **Headless Node.js DOM Mock with Event Bubbling:**
   - Updated mock DOM in `test-reactive-engine.js` with `parentElement` tracking and bubbling dispatch simulation.

#### Verification
- Ran `node Ex_2/test-reactive-engine.js`: **8/8 test suites passed, 0 failed**.

#### Commit (User Executed)
- **Hash:** `b28cdff`
- **Message:** `feat(events): attach root event delegation listener`

---

### Phase 4: Reactive Task Manager & Checkpoint 2 Verification

#### User Prompt
> "Implement Exercise 2 - Phase 4.
>
> Build a reactive Task Manager using the custom useState.
>
> Requirements:
> - Display task list.
> - Add tasks dynamically.
> - Show current task count.
> - Implement dynamic filter toggles.
> - Update UI automatically after state changes.
> - Use semantic HTML.
> - Preserve unidirectional data flow.
> - Use root event delegation.
>
> Integrate the provided checkpoint2-verify.js.
> Ensure its TaskApp example works.
>
> Use Vanilla JavaScript only.
> No React, JSX, or external dependencies.
>
> Do not commit"

#### AI Action & Engineering Decisions
1. **Instructor Checkpoint 2 Integration (`Ex_2/checkpoint2-verify.js`):**
   - Converted the instructor's `TaskApp` specification from JSX pseudo-code into Vanilla JavaScript `createElement` calls:
     ```javascript
     function TaskApp() {
       const [tasks, setTasks] = useState(['Review PR', 'VerifyAST']);
       const [filter, setFilter] = useState('ALL');
       ...
     }
     ```
   - Exported `renderApp(Component, container)` from `reactive-engine.js` matching the exact import signature (`import { useState, renderApp } from './reactive-engine.js'`).
2. **Task Manager UI Capabilities:**
   - **Dynamic Task List:** Displays tasks in an accessible `<ul class="task-list">`.
   - **Dynamic Addition:** Clicking `<button id="add-task-btn">` appends a new task and triggers an automatic UI re-render.
   - **Dynamic Filter Toggles:** Added `ALL`, `ACTIVE`, and `COMPLETED` filter buttons, dynamically updating visible task items.
   - **Live Task Count:** Updates `<header><h2>Tasks: {tasks.length}</h2></header>` on every state change.
3. **Semantic Styling (`Ex_2/index.html`):**
   - Styled `.app-container`, `.filter-btn`, `.primary-btn`, and `.task-item` with accessible dark-mode tokens and responsive layout.
4. **Automated Verification:**
   - Step 1: Initial mount verified (`Tasks: 2`, 2 list items).
   - Step 2: Button click triggered state mutation and automatic re-render (`Tasks: 3`).
   - Step 3: Filter toggle to `ACTIVE` verified.
   - Respected user constraint: **No git commit executed**.

#### Verification
- Ran `node Ex_2/checkpoint2-verify.js`: **ALL PASSED**.
- Ran `node Ex_2/test-reactive-engine.js`: **8/8 test suites passed**.

---

## 3. Human-in-the-Loop & Governance Summary

| Checkpoint | Scope | Automated Verification | Commit Hash | Authorized By |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | Planning & Scaffolding (`TASK_DECOMPOSITION`, `PROJECT_RULE`) | Spec Audit | — | Planning Phase |
| **P1** | `stateStore` & `resetCursor()` Engine | 6 Unit Tests | `714859e` | User |
| **P2** | Closure-Based `useState` & Re-render Loop | 10 Unit Tests | `ae74c1f` | User |
| **P3** | Centralized Root Event Delegation | 8 Unit & Bubbling Tests | `b28cdff` | User |
| **P4** | Reactive Task Manager & Checkpoint 2 Integration | 4 Checkpoint 2 Tests + 8 Engine Tests | Staged / Held | User ("Do not commit") |

All implementations strictly conform to vanilla web standards, preserve modular separation between exercises, and enforce end-to-end reactivity and security without external dependencies.
