# PROMPT_LOG.md — Lab 4 · Exercise 1

> AI assistant: Antigravity. One row per prompt actually sent, in order.
> Dates only, no timestamps.
> Result: **Accepted** = used as generated · **Modified** = edited by hand or re-prompted.

| # | Date | Task ID | Prompt | Result | Manual changes | Commit |
|---|------|---------|--------|--------|----------------|--------|
| 1 | 2026-11-14 | 0.1 | Initialize React 19 + Vite 7 + React Router v7 project configuration. | Accepted | Configured package.json, vite.config.js with jsdom test block and Express server scripts. | `chore(ex1)` |
| 2 | 2026-11-14 | 0.2 | Create global design tokens in src/index.css and root mounting in src/main.jsx. | Accepted | Defined :root tokens, body reset, 44px tap targets, zero div-soup, WCAG 2.2 AA contrast. | `chore(ex1)` |
| 3 | 2026-11-14 | 0.3 | Define team coding rules and constraints in docs/project-rules.md. | Accepted | Enforced React Router v7, synchronous context form validation, AbortController hygiene. | `chore(ex1)` |
| 4 | 2026-11-14 | 1.1 | Create frozen static dataset in src/data/people.js. | Accepted | Exported frozen PEOPLE array with stable entity IDs and complete dossier attributes. | `feat(ex1)` |
| 5 | 2026-11-14 | 1.2 | Create accessible fallback skeleton in src/components/DetailSkeleton.jsx. | Accepted | Dimension-matched skeleton with aria-busy="true" and aria-live="polite", zero CLS. | `feat(ex1)` |
| 6 | 2026-11-14 | 1.4 | Create 404 state component in src/components/NotFoundState.jsx. | Accepted | Semantic article with role="alert" for missing entity IDs. | `feat(ex1)` |
| 7 | 2026-11-14 | 1.6 | Create empty selection view in src/components/NoSelection.jsx. | Accepted | Accessible prompt to select a person from the directory list. | `feat(ex1)` |
| 8 | 2026-11-14 | 1.7 | Create detail dossier view in src/components/PersonDetail.jsx. | Accepted | Extracts route ID with useParams(), locates person via find(), renders semantic dl/dt/dd. | `feat(ex1)` |
| 9 | 2026-11-14 | 1.9 | Create master-detail layout in src/components/PeopleLayout.jsx. | Accepted | Nested routes with <Outlet />, <NavLink> with functional active class, semantic section/nav. | `feat(ex1)` |
| 10 | 2026-11-14 | 2.1 | Create synchronous validation helper in src/form/validateForm.js. | Accepted | Pure function returning errors for username, email, password, and confirmation matching. | `feat(ex1)` |
| 11 | 2026-11-14 | 2.2 | Create form context provider and hook in src/form/FormContext.js. | Accepted | Context provider encapsulating values, errors, and change handlers; throws outside provider. | `feat(ex1)` |
| 12 | 2026-11-14 | 2.3 | Create accessible input primitive in src/form/InputField.jsx. | Accepted | useId() binding for label and error IDs, aria-invalid, and aria-describedby linkage. | `feat(ex1)` |
| 13 | 2026-11-14 | 2.5 | Create semantic JSON state inspector in src/form/ShowData.jsx. | Accepted | Rendered key-value pairs inside dl/dt/dd with automated password masking (••••••••). | `feat(ex1)` |
| 14 | 2026-11-14 | 2.7 | Create single render pass form in src/form/SimpleForm.jsx. | Accepted | Eliminates useEffect cascades; computes errors synchronously during render pass. | `feat(ex1)` |
| 15 | 2026-11-14 | 3.1 | Create thread store in server/store.js. | Accepted | In-memory message store with defensive cloning and crypto.randomUUID() ID generation. | `feat(ex1)` |
| 16 | 2026-11-14 | 3.2 | Create Express REST API server in server/app.js. | Accepted | CORS with explicit origin, JSON body limit, POST validation, sanitized 500 error handler. | `feat(ex1)` |
| 17 | 2026-11-14 | 3.6 | Create custom data fetching hook in src/forum/useForumMessages.js. | Accepted | AbortController signal cleanup on unmount/channel switch, guarded signal.aborted checks. | `feat(ex1)` |
| 18 | 2026-11-14 | 3.8 | Create channel switcher in src/forum/ChannelSwitcher.jsx. | Accepted | Dynamic channel navigation links with active state styling. | `feat(ex1)` |
| 19 | 2026-11-14 | 3.10 | Create message form in src/forum/MessageForm.jsx. | Accepted | Form with synchronous validation and character counters. | `feat(ex1)` |
| 20 | 2026-11-14 | 3.12 | Create message list in src/forum/MessageList.jsx. | Accepted | Semantic dl/dt/dd message list with formatted timestamps and React.Fragment keys. | `feat(ex1)` |
| 21 | 2026-11-14 | 3.14 | Create unified forum view in src/forum/ForumPage.jsx. | Accepted | Integrates channel switcher, message list, and message form. | `feat(ex1)` |
| 22 | 2026-11-14 | 4.1 | Create top navigation bar in src/components/AppNav.jsx. | Accepted | NavLinks for People, Form, and Forum routes with accessible current indicators. | `feat(ex1)` |
| 23 | 2026-11-14 | 4.3 | Create root application layout in src/App.jsx. | Accepted | React Router v7 Routes, lazy-loaded PersonDetail chunk via React.lazy and Suspense. | `feat(ex1)` |
| 24 | 2026-11-14 | 5.1 | Create unit and integration test suite in tests/. | Accepted | 10 test files, 100 tests covering routing, form validation, API, and AbortController. | `test(ex1)` |

---

## Lessons Learned

1. **React Router v7 Eliminates Component Wrapper Boilerplate**: Replacing v5 `<Switch>` and `component={...}` with v7 `<Routes>` and `element={<Component />}` provides direct JSX composition, making props passing straightforward without Higher-Order Components.
2. **Synchronous Validation Completely Avoids Render Cascades**: Storing derived form errors in React state via `useEffect` causes 5 redundant re-renders per keypress. Evaluating errors synchronously during render via pure functions yields zero-latency validation without state synchronization bugs.
3. **AbortController Signals Require Guarded Catch/Finally Blocks**: Calling `controller.abort()` alone is insufficient if the `.catch()` block indiscriminately treats `AbortError` as an uncaught exception. Always verify `if (!controller.signal.aborted)` before handling errors or setting loading state.
4. **Accessible Master-Detail Requires Explicit 404 Boundaries**: In dynamic route lookup (`useParams()`), handling invalid IDs with an accessible fallback article (`role="alert"`) prevents blank screens and guides assistive technology users back to safety.
5. **Form State Inspectors Must Automatically Mask Secrets**: Exposing raw form state in DOM inspectors can leak passwords to screen readers. Implementing deterministic masking for sensitive field names ensures security compliance.
