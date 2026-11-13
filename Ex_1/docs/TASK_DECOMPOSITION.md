# TASK_DECOMPOSITION.md — Lab 4 · Exercise 1 (WBS)

> Goal: Multi-Route Single Page Application with React Router v7, Synchronous Context Form Validation Engine, and Full-Stack Express REST API.
> Stack: React 19 · Vite 7 · React Router 7 · Express 5 · plain JSX. All work follows [project-rules.md](project-rules.md).
> Source: Lab 4 deck, slides 7–17 & 22–27.
> Working rule: **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).

---

## Block 1 — Setup & Scaffolding

| ID  | Task | Output |
| --- | ---- | ------ |
| 0.1 | Initialize React 19 + Vite 7 + React Router v7 project with Vitest and Supertest tooling. | `package.json`, `vite.config.js`, `index.html` |
| 0.2 | Setup test harness and design tokens (:root tokens, zero div-soup, WCAG 2.2 AA). | `tests/setup.js`, `src/index.css`, `src/main.jsx` |
| 0.3 | Define team coding rules, accessibility standards, and Lab 4 constraints. | `docs/project-rules.md` |

---

## Block 2 — Sprint 1: React Router v7 & Master-Detail Dossier

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 1.1 | P1 | Frozen static dataset for dossier entities (`PEOPLE`). | `src/data/people.js` |
| 1.2 | P2 | Accessible dimension-matched skeleton fallback (`aria-busy="true"`, `aria-live="polite"`). | `src/components/DetailSkeleton.jsx` |
| 1.3 | P3 | Style for `DetailSkeleton` (CLS = 0). | `src/components/DetailSkeleton.module.css` |
| 1.4 | P4 | Explicit 404 error boundary state (`role="alert"`). | `src/components/NotFoundState.jsx` |
| 1.5 | P5 | Style for `NotFoundState`. | `src/components/NotFoundState.module.css` |
| 1.6 | P6 | Empty selection placeholder view. | `src/components/NoSelection.jsx` |
| 1.7 | P7 | Semantic detail dossier view using `useParams()` and `<dl>/<dt>/<dd>`. | `src/components/PersonDetail.jsx` |
| 1.8 | P8 | Responsive card styling for `PersonDetail`. | `src/components/PersonDetail.module.css` |
| 1.9 | P9 | Nested master-detail layout using React Router v7 `<Outlet />` and `<NavLink>`. | `src/components/PeopleLayout.jsx` |
| 1.10 | P10 | Responsive CSS Grid layout for `PeopleLayout` (`minmax(280px, 1fr) 2fr`). | `src/components/PeopleLayout.module.css` |

---

## Block 3 — Sprint 2: Context Form Engine & Synchronous Validation

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 2.1 | P11 | Pure synchronous validation function for form inputs (zero `useEffect`). | `src/form/validateForm.js` |
| 2.2 | P12 | Form context provider and strict `useFormContext()` hook. | `src/form/FormContext.js` |
| 2.3 | P13 | Accessible input primitive with `useId()` binding, `aria-invalid`, and `aria-describedby`. | `src/form/InputField.jsx` |
| 2.4 | P14 | Responsive styling for `InputField`. | `src/form/InputField.module.css` |
| 2.5 | P15 | Semantic `<dl>` JSON state inspector with masked passwords. | `src/form/ShowData.jsx` |
| 2.6 | P16 | Responsive styling for `ShowData`. | `src/form/ShowData.module.css` |
| 2.7 | P17 | Single render pass form container eliminating multi-layer `useEffect` cascades. | `src/form/SimpleForm.jsx` |
| 2.8 | P18 | Styling for `SimpleForm`. | `src/form/SimpleForm.module.css` |

---

## Block 4 — Sprint 3: Full-Stack Express REST API & Forum Custom Hook

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 3.1 | P19 | In-memory message store with `crypto.randomUUID()` and defensive copying. | `server/store.js` |
| 3.2 | P20 | Express REST API server with CORS, payload validation, and secure error handler. | `server/app.js` |
| 3.3 | P21 | Server entrypoint script. | `server/index.js` |
| 3.4 | P22 | Static forum channel definitions (`nasa`, `esports-tribunal`, `notNasa`). | `src/forum/channels.js` |
| 3.5 | P23 | Message validation rules and character length limits. | `src/forum/messageRules.js` |
| 3.6 | P24 | Fetch client wrapper with status-aware error extraction. | `src/forum/forumApi.js` |
| 3.7 | P25 | Custom data fetching hook `useForumMessages` with `AbortController` cancellation. | `src/forum/useForumMessages.js` |
| 3.8 | P26 | Channel navigation switcher with active link highlights. | `src/forum/ChannelSwitcher.jsx` |
| 3.9 | P27 | Styling for `ChannelSwitcher`. | `src/forum/ChannelSwitcher.module.css` |
| 3.10 | P28 | New message submission form with synchronous field validation. | `src/forum/MessageForm.jsx` |
| 3.11 | P29 | Styling for `MessageForm`. | `src/forum/MessageForm.module.css` |
| 3.12 | P30 | Accessible message timeline rendered inside semantic `<dl>` list. | `src/forum/MessageList.jsx` |
| 3.13 | P31 | Styling for `MessageList`. | `src/forum/MessageList.module.css` |
| 3.14 | P32 | Unified forum page combining channel switcher, message list, and message form. | `src/forum/ForumPage.jsx` |
| 3.15 | P33 | Styling for `ForumPage`. | `src/forum/ForumPage.module.css` |

---

## Block 5 — Root App Integration & Navigation

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 4.1 | P34 | Accessible top navigation header with active indicator. | `src/components/AppNav.jsx` |
| 4.2 | P35 | Styling for `AppNav`. | `src/components/AppNav.module.css` |
| 4.3 | P36 | Root `App` component with lazy-loaded `PersonDetail` route inside `<Suspense>`. | `src/App.jsx` |
| 4.4 | P37 | Page layout and container styling for `App`. | `src/App.module.css` |

---

## Block 6 — Automated Test Suite (Flat `tests/`)

| ID  | Test File | Verification Target |
| --- | --------- | ------------------- |
| 5.1 | `tests/DetailSkeleton.test.jsx` | Accessibility attributes (`aria-busy`, `aria-live`) and semantic elements. |
| 5.2 | `tests/PersonDetail.test.jsx` | Detail rendering, semantic `<dl>`, 404 state when ID not found. |
| 5.3 | `tests/PeopleLayout.test.jsx` | Master list navigation, active link classes, `<Outlet />` integration. |
| 5.4 | `tests/validateForm.test.js` | Pure validation logic, email format, password matching, required fields. |
| 5.5 | `tests/formParts.test.jsx` | Unique `useId()` binding, `aria-invalid`, `aria-describedby`, masked passwords in inspector. |
| 5.6 | `tests/SimpleForm.test.jsx` | Single render pass validation, blur-triggered error visibility, clean reset. |
| 5.7 | `tests/messageRules.test.js` | Message length constraints (40 chars author, 280 chars text). |
| 5.8 | `tests/useForumMessages.test.jsx` | `AbortController` cancellation on unmount and channel switch, error handling. |
| 5.9 | `tests/server.test.js` | Express endpoints (GET /api/messages/:forum, POST /api/messages/:forum, CORS, 400/404/413 handling). |
| 5.10 | `tests/App.test.jsx` | Deep linking, lazy route loading, 404 catch-all route, zero `<div>`/`<span>`. |

---

## Commit Plan

| Commit | Scope | Description |
| ------ | ----- | ----------- |
| 1 | `chore(ex1)` | scaffold react19 vite project with test tooling and project rules |
| 2 | `docs(ex1)` | add task decomposition and prompt log |
| 3 | `feat(ex1)` | add React Router v7 layout and people master-detail view |
| 4 | `feat(ex1)` | add context form engine with synchronous validation |
| 5 | `feat(ex1)` | add Express REST API server and forum channels |
| 6 | `feat(ex1)` | add useForumMessages hook and forum page UI |
| 7 | `test(ex1)` | add unit and integration test suite (100 tests passing) |
| 8 | `docs(ex1)` | add failure audit, lessons learned and record commit hashes |
