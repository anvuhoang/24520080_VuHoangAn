# AI Interaction & Prompt Engineering Trajectory — Lab 2, Exercise 1

## 1. Overview & Architectural Principles

This document records the prompt engineering trajectory, design decisions, verification evidence, and human-in-the-loop governance for **Lab 2, Exercise 1 (Mini-React Engine)**.

### Core Architecture & Constraints:
- **Stack:** Semantic HTML5, Vanilla JavaScript (ES6+), Native DOM APIs, and ES Modules.
- **Strict Prohibition:** Zero external runtime dependencies, zero build tools, zero React runtime, and zero usage of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `eval`.
- **Security Posture:** Inert rendering of string inputs (including XSS payloads such as `<script>` and `<img>` injection strings), strict type validation on all VNodes and properties, and complete prevention of inline string event handlers.
- **Governance:** Step-by-step milestone execution with automated verification before every commit.

---

## 2. Prompt Trajectory & Milestone History

### Phase 1: Virtual DOM Factory (`createElement` & `createTextElement`)

#### User Prompt
> "Read project-rule.md and task-decomposition.md.
>
> Initialize Exercise 1 in ex_1/:
> - index.html
> - mini-react.js
> - test-runner.js
>
> Use the exact test-runner.js from the assignment.
> If its source is unavailable, ask me for it.
>
> Implement Phase 1:
> - createElement(type, props, ...children)
> - createTextElement(text)
> - Strict VNode type guards.
> - Nested children normalization.
> - Null props handling.
> - No input mutation.
>
> Use Vanilla JavaScript only.
> No React, innerHTML, or external dependencies.
>
> Add and run minimal Phase 1 tests.
> Fix failures before proceeding.
>
> Commit only Phase 1 files:
> 'feat(core): implement createElement factory'
>
> Do not implement renderToDOM yet.
> Report files changed, tests, and commit hash."

#### User Follow-Up / Clarification
> "tự tạo đi" *(Authorize generating a standalone test runner conforming to project rules when external file was unavailable)*

#### AI Action & Engineering Decisions
1. **VNode Schema & Type Guards (`mini-react.js`):**
   - Established strict schema: `{ type, props: { ...props, children }, children }`.
   - Implemented `isValidVNode(node)` enforcing non-empty string tags, valid props object, and array children.
   - For `TEXT_ELEMENT`, enforced `props.nodeValue` string type constraint.
2. **Text Element Factory (`createTextElement`):**
   - Wrapped string/number primitives into `{ type: "TEXT_ELEMENT", props: { nodeValue: String(text), children: [] } }`.
   - Preserved literal HTML-like strings (`<script>alert(1)</script>`, `<img onerror=alert(1)>`) as safe text.
   - Threw `TypeError` on `null`, `undefined`, or non-primitive objects.
3. **Element Factory (`createElement`):**
   - Validated `type` string; rejected non-string or whitespace-only tags with `TypeError`.
   - Handled `null` and `undefined` props gracefully by defaulting to an isolated `{}`.
   - **Zero Input Mutation:** Cloned props to prevent mutation of the caller's objects (verified via `Object.freeze()`).
   - **Nested Children Normalization:** Recursively flattened arbitrary nested child arrays; filtered `null`, `undefined`, and boolean values for conditional rendering support; converted string/number primitives to text VNodes; rejected non-VNode objects with `TypeError`.
4. **Test Suite Construction (`test-runner.js` & `index.html`):**
   - Built an initial 19-test suite.
   - Detected a defect in the props mutation assertion (`assertThrows` on dummy function) during verification; fixed the assertion to test against frozen objects.

#### Verification
- Ran `node Ex_1/test-runner.js`: **19/19 passed, 0 failed**.

#### Commit
- **Hash:** `f79beb6`
- **Message:** `feat(core): implement createElement factory`

---

### Phase 2: Recursive DOM Mounting Engine (`renderToDOM`)

#### User Prompt
> "Read project-rule.md and task-decomposition.md.
>
> Implement Phase 2 in ex_1/mini-react.js:
>
> - Implement renderToDOM(vnode) recursively.
> - Use document.createElement() for elements.
> - Use document.createTextNode() for text.
> - Handle id, role, className and onClick.
> - Register events using addEventListener().
> - Preserve semantic HTML without extra wrappers.
> - Validate VNodes before rendering.
>
> Security:
> - '<script>alert(1)</script>' must remain text.
> - '<img onerror=alert(1)>' must remain text.
> - Reject unsafe attributes and event injection.
> - Never use innerHTML or eval.
>
> Run the provided test-runner.js.
> Add focused security and DOM tests.
> Fix all failures.
>
> Please do not commit"

#### AI Action & Engineering Decisions
1. **Recursive Mounting Pipeline (`renderToDOM` in `mini-react.js`):**
   - Validated input using `isValidVNode()`; threw `TypeError` on invalid or malformed VNodes.
   - For `TEXT_ELEMENT`: Mounted via `document.createTextNode(vnode.props.nodeValue)`, guaranteeing literal text preservation.
   - For Elements: Created element with `document.createElement(vnode.type)`.
   - Mounted children recursively via `domElement.appendChild(renderToDOM(child))` in exact order.
   - Preserved semantic hierarchy without adding extraneous container/layout wrappers.
   - Supported optional `container` parameter via `container.appendChild(domNode)`.
2. **Safe Property & Event Application (`applyProps`):**
   - Handled `id`, `className` (and `class`), and `role` with explicit type checks.
   - Handled `onClick` (and general `on*` events) strictly via `addEventListener(eventName, handler)`.
   - **Security Protections:**
     - Rejected inline string handlers (`onClick: "alert(1)"`) with `TypeError`.
     - Rejected `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `dangerouslySetInnerHTML` with `TypeError`.
     - Rejected `javascript:` pseudo-protocol URIs with `Error`.
3. **Headless Node.js DOM Mock & Test Suite Expansion:**
   - Injected a lightweight DOM mock into `test-runner.js` when `typeof document === "undefined"` to allow dual execution (Node.js terminal + browser).
   - Expanded test suite to 39 assertions covering DOM validation, props, event listeners, and XSS safety.
   - Respected user constraint: **No git commit executed**.

#### Verification
- Ran `node Ex_1/test-runner.js`: **39/39 passed, 0 failed**.

---

### Phase 3: Instructor Test Suite Integration & Browser Bug Resolution

#### User Prompt 1 (Instructor Verification Test Suite)
> "The teacher provide this 
> test-runner.js
> // Checkpoint 1 Verification Test Suite:
> import { createElement, renderToDOM } from './mini-react.js';
> const vApp = createElement('main', { id: 'root-view', role: 'main' },
> createElement('header', { className: 'hero' },
> createElement('h1', null, 'Mini React Engine'),
> createElement('p', null, '<img onerror=alert(1)> Safe Text')
> ),
> createElement('button', { onClick: () => console.log('Ping') }, 'Click')
> );
> const root = document.getElementById('app');
> root.replaceChildren(renderToDOM(vApp));
> console.assert(root.querySelector('button') !== null, 'Mount"

#### AI Action & Engineering Decisions
1. Added `<div id="app"></div>` and corresponding CSS styling to `Ex_1/index.html`.
2. Augmented the headless DOM mock in `test-runner.js` with `replaceChildren` and `querySelector` methods.
3. Placed the instructor's exact Checkpoint 1 Verification Test Suite at the entry of `test-runner.js`.
4. Verified that `root.replaceChildren(renderToDOM(vApp))` mounts cleanly and `root.querySelector('button') !== null` passes.

#### Commit (User Executed)
- **Hash:** `18b97d0`
- **Message:** `feat(refactor): modify test-runner`

---

#### User Prompt 2 (Browser DOM EventTarget Error)
> "i have got an error  
>   ✓ PASS: should set className property and class attribute correctly
> test-runner.js:657   ✓ PASS: should set role attribute for accessible semantic HTML
> test-runner.js:661   ✗ FAIL: should register onClick handler with addEventListener and trigger on click
> runTests @ test-runner.js:661
> test-runner.js:662     Failed to execute 'dispatchEvent' on 'EventTarget': parameter 1 is not of type 'Event'.
> runTests @ test-runner.js:662
> test-runner.js:661   ✗ FAIL: should handle multiple props simultaneously (id, className, role, onClick)
> runTests @ test-runner.js:661
> test-runner.js:662     Failed to execute 'dispatchEvent' on 'EventTarget': parameter 1 is not of type 'Event'."

#### Root Cause Analysis
In native browser DOM implementations, `EventTarget.prototype.dispatchEvent()` requires an actual instance of `window.Event`. Calling `dom.dispatchEvent({ type: "click" })` or `dom.dispatchEvent("click")` worked in the simplified headless mock but threw `TypeError` in browser DevTools.

#### AI Action & Engineering Decisions
1. Refactored test triggers in `test-runner.js` to prioritize native `dom.click()` on HTML buttons:
   ```javascript
   if (typeof dom.click === "function") {
     dom.click();
   } else if (typeof Event !== "undefined") {
     dom.dispatchEvent(new Event("click"));
   } else {
     dom.dispatchEvent({ type: "click" });
   }
   ```
2. Added `.click()` helper to `MockElement` in the mock DOM to preserve Node.js CLI test compatibility.

#### Verification
- Browser test dashboard: **39/39 passed, 0 failed**.
- Node.js terminal: **39/39 passed, 0 failed**.

#### Commit (User Executed)
- **Hash:** `d273a4d`
- **Message:** `fix(tests): use native click trigger for browser DOM compatibility`

---

## 3. Human-in-the-Loop & Governance Summary

| Checkpoint | Scope | Automated Verification | Commit Hash | Authorized By |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | `createElement` & `createTextElement` Factory | 19 Unit Tests | `f79beb6` | Agent & User |
| **P2** | `renderToDOM` Recursive Mounting Engine | 39 Unit & Security Tests | Staged / Held | User ("do not commit") |
| **P3.1** | Instructor Checkpoint 1 Test Harness | DOM Checkpoint Query | `18b97d0` | User |
| **P3.2** | Browser DOM Dispatch Fix | 39 Browser & Node Tests | `d273a4d` | User |

All code strictly respects the minimal-change policy, utilizes semantic native DOM APIs, and enforces end-to-end XSS prevention.
