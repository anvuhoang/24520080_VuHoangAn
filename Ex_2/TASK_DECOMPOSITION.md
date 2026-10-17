# Task Decomposition — Lab 2, Exercise 2 (Reactive Engine & Task Manager)

## Phase 0 — Planning & Requirements Analysis (No commit)

| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **P0.1** | Define `PROJECT_RULE.md` for Ex_2 | None | Stack, conventions, unidirectional flow, security, and verification rules documented. |
| **P0.2** | Write `TASK_DECOMPOSITION.md` for Ex_2 | P0.1 | Phased task breakdown, state closure architecture, and acceptance criteria mapped. |
| **P0.3** | Obtain Checkpoint 2 verification code | None | Authoritative verification code acquired from instructor for exact test contract. |

---

## Phase 1 — Reactive Engine Architecture (useState & stateStore)

| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **R1.1** | Implement centralized `stateStore` & cursor management | P0.3 | `stateStore` array retains state across renders; `cursor` tracks hook invocation index; `resetCursor()` resets index before each render. |
| **R1.2** | Implement `useState(initialValue)` closure engine | R1.1 | Returns `[currentState, setState]`; calling `setState(newValue)` updates store at frozen index and triggers scheduleReRender. |
| **R1.3** | Implement batching / unidirectional render loop | R1.2 | State updates trigger clean top-down re-render without infinite loops or race conditions. |

---

## Phase 2 — Root Event Delegation & Reactive Task Manager

| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **E2.1** | Implement Root Event Delegation | R1.3 | Single event listener attached to root container; dispatches actions via `data-action` or target inspection without per-element listeners. |
| **E2.2** | Implement Reactive Task Manager Component | E2.1 | Renders task input, tasks list, dynamic filters (All, Active, Completed), and status toggle with immutable state updates. |
| **E2.3** | Security & DOM Sanitization | E2.2 | Task text is rendered as inert text nodes; zero `innerHTML`/`eval`; XSS injection attempts are completely neutralized. |

---

## Phase 3 — Verification & Integration

| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **V3.1** | Run `checkpoint2-verify.js` | E2.3 | Instructor Checkpoint 2 verification suite passes without modification or error. |
| **V3.2** | Comprehensive regression audit | V3.1 | Dual execution passes in both browser environment and headless Node.js CLI. |
