# Task Decomposition — Lab 2, Exercise 1

## Phase 0 — Planning (now; no commit)

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| P0.1 | Write `project-rule.md` | None | Stack, conventions, security, semantic HTML, testing, Git, and minimal-change constraints documented. |
| P0.2 | Write `task-decomposition.md` | P0.1 | Small tasks, dependencies, acceptance criteria, and exactly two implementation commits mapped. |

**Stop after Phase 0.** Do not implement, create other files, or commit.

## Phase 1 — VNode factory (commit 1)

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| F1.1 | Inspect exercise specification, repository, and `test-runner.js` | P0.2; supplied files | Confirm exact imports/exports, VNode schema, arguments, normalization rules, and expected errors without editing the runner. |
| F1.2 | Define strict VNode validation and text-node representation | F1.1 | Invalid node types and malformed shapes are rejected or handled exactly as required by tests. |
| F1.3 | Implement `createTextElement()` | F1.2 | Produces the expected text VNode for supported primitive values; preserves literal HTML-like text. |
| F1.4 | Implement `createElement()` | F1.2, F1.3 | Produces expected element VNodes with correct tag, props, ordered/nested children, and supported normalization behavior. |
| F1.5 | Run relevant factory tests and review diff | F1.4 | Factory-related assertions pass; no unrelated files changed. |
| F1.6 | Create first commit | F1.5 | Commit message is exactly `feat(core): implement createElement factory`; stage only factory-related implementation files. |

**Note:** If the runner only tests both stages together, perform available targeted checks for Phase 1 and run the complete runner after Phase 2. Do not add speculative files to make tests run.

## Phase 2 — DOM mounting (commit 2)

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| M2.1 | Validate input VNodes and mounting contract | F1.6 | Invalid VNodes and container arguments follow the expected error/return behavior. |
| M2.2 | Implement text-node mounting | M2.1 | Text uses native text nodes; HTML-like strings remain inert and visible as text. |
| M2.3 | Implement element creation and supported props | M2.1 | Native DOM elements and allowed attributes/properties match the contract; no unsafe HTML insertion. |
| M2.4 | Mount children recursively in order | M2.2, M2.3 | DOM hierarchy mirrors VNode hierarchy without extra wrappers. |
| M2.5 | Run `test-runner.js` and review semantics/security | M2.4 | All provided tests pass; XSS-like text does not execute; DOM fidelity and semantic markup are confirmed. |
| M2.6 | Create second commit | M2.5 | Commit message is exactly `feat(core): implement renderToDOM`; stage only relevant implementation changes. |

## Completion checklist
- [ ] Factory and mounting APIs match the supplied test runner.
- [ ] Strict VNode guards behave as specified.
- [ ] HTML-looking strings render as inert text.
- [ ] Rendered DOM matches the VNode tree without extra wrappers.
- [ ] Provided tests pass without modification.
- [ ] Exactly two required implementation commits exist, in the specified order.

## Scope controls
- Do not assume filenames or APIs until the provided test runner is inspected.
- No React, external dependencies, virtual DOM diffing, reconciliation, hooks, state machines, or unrelated features in Exercise 1.
- No commits during planning.
