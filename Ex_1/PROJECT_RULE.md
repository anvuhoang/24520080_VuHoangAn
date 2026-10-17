# Project Rules — Lab 2, Exercise 1

## Scope and stack
- Build a minimal VNode factory and DOM mounting engine using semantic HTML5, vanilla JavaScript (ES6+), native DOM APIs, and ES Modules.
- Do not use React, frameworks, build tools, or external runtime dependencies.
- Implement only `createElement()`, `createTextElement()`, `renderToDOM()`, and the minimal supporting logic required by the exercise and provided tests.
- Treat the supplied exercise specification and `test-runner.js` as the authoritative API contract. Inspect them before deciding module paths, argument shapes, return values, or edge-case behavior; do not modify the provided runner.

## Coding conventions
- Use `const` by default and `let` only for reassignment; avoid `var`.
- Use named ES Module exports consistent with the provided tests.
- Keep functions small and responsibilities separate; use clear names and consistent formatting.
- Prefer explicit checks over truthiness for VNode validation; do not silently accept malformed nodes.
- Preserve child order and nesting. Do not introduce extra wrapper elements.
- Avoid unrelated refactoring, generated files, and speculative features.

## VNode correctness and security
- Establish a documented VNode shape based on the supplied test contract, including how text nodes are represented.
- Apply strict type guards before DOM operations: validate the VNode object, element/text discriminator, element tag, props shape, and children shape as required by the contract.
- Normalize or reject invalid children only as specified by the tests; never coerce arbitrary objects into HTML.
- Treat strings, including HTML-looking strings such as `<img onerror=...>`, as text by default. Mount text with `document.createTextNode()` or `textContent`, never `innerHTML`/`outerHTML`/`insertAdjacentHTML`.
- Never evaluate string input or turn string event-handler attributes into executable code. Handle attributes and event listeners only when required by the test contract, using safe native DOM APIs.
- Do not add unsanitized URL-based attributes or dangerous DOM properties beyond what the exercise explicitly requires.

## Semantic HTML and DOM fidelity
- Use meaningful elements (`main`, `section`, `article`, `header`, `footer`, `nav`, `button`, `p`, etc.) according to their purpose; avoid unnecessary `div` wrappers.
- Match the VNode tree exactly in element types, text content, child order, and nesting, subject to browser DOM normalization and the test contract.
- Do not inject layout wrappers, placeholder nodes, or extra text nodes.

## Verification and Git workflow
- Inspect `test-runner.js` before implementation; run it using the invocation appropriate to the provided repository.
- Verify factory behavior, text nodes, nested elements, invalid VNodes, HTML-like string escaping, and DOM tree fidelity.
- Fix failures within scope; do not weaken tests or edit the test runner.
- Make **exactly two required implementation commits**, in this order:
  1. `feat(core): implement createElement factory` — VNode factory, text-node factory, and necessary guards.
  2. `feat(core): implement renderToDOM` — DOM mounting engine and related fixes.
- Stage only files relevant to each commit; check `git diff --staged` and `git status` before committing.
- The planning phase creates only `project-rule.md` and `task-decomposition.md`: no application code, tests, other files, or commits yet.

## Minimal-change policy
- Reuse existing project structure and test infrastructure once supplied.
- Create or change the fewest files necessary to satisfy the test runner.
- Do not install packages, introduce configuration files, or change unrelated code unless a test-proven requirement makes it necessary.
