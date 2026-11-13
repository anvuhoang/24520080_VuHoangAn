# TASK_DECOMPOSITION.md — Lab 4 · Exercise 1 (WBS)

> Goal: one multi-route single-page app with three sprints: a React Router v7 master-detail directory (Sprint 1), a Context form engine with synchronous validation (Sprint 2), and a forum with channel switching on top of an Express REST API (Sprint 3).
> Stack: React 19 · Vite 7 · React Router 7 · Express 5 · plain JSX. All work follows [project-rules.md](project-rules.md) (sections 12–14 are new for Lab 4).
> Source: Lab 4 deck, slides 9–17 (exercises), 22–27 (code contracts), 29 (AI hallucinations).
> Working rule: one file per step. The student was away during the build, so the steps were generated in **batches per sprint** by the assistant; [PROMPT_LOG.md](PROMPT_LOG.md) says what was actually done, in order.

---

## Layout

```
Ex_1/
  docs/                    project-rules.md · TASK_DECOMPOSITION.md · PROMPT_LOG.md · AI_FAILURE_AUDIT.md
  client/                  Vite app (own package.json, `npm test`, `npm run dev`, `npm run build`)
    src/
      sprint1-router/      PeopleLayout · PersonDetail · NoSelection · NotFoundState · DetailSkeleton · people.js
      sprint2-form/        SimpleForm · FormContext · InputField · ShowData · validateForm
      sprint3-forum/       ForumPage · ChannelSwitcher · MessageList · MessageForm · useForumMessages · forumApi · channels · messageRules
      App.jsx · AppNav.jsx · main.jsx · index.css
    tests/                 one flat folder
  server/                  Express API (own package.json, `npm start`, `npm test`)
    src/                   app.js · store.js · index.js
    tests/                 one flat folder
```

The server imports `messageRules.js` from `client/src/sprint3-forum`, so the form in the browser and the API apply the same rules (one source, no copy to keep in step).

---

## Block 1 — Setup

| ID  | Task | Output |
| --- | ---- | ------ |
| 0.1 | Project with the Lab 3 toolchain (Vite 7, Vitest 5, jsdom, Testing Library) plus `react-router@7`; later split into `client/` and `server/`. | `client/package.json`, `client/vite.config.js` (proxy `/api` to port 3001), `server/package.json`, `server/vitest.config.js` |
| 0.2 | Design tokens and mounting (`createRoot` + `StrictMode` + `BrowserRouter`). | `client/src/index.css`, `client/src/main.jsx`, `client/tests/setup.js` |
| 0.3 | Rules of the generation: the Lab 3 rules plus routing, forms/context and data/API (sections 12–14). | `docs/project-rules.md` |

---

## Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
// Routes (client/src/App.jsx): one <main>, one <h1>, a main <nav aria-label="Main">
/                         -> redirect to /people
/people                   -> PeopleLayout (nav of people + <Outlet/>)
  index                   -> NoSelection
  :id                     -> PersonDetail, lazy (React.lazy + Suspense fallback DetailSkeleton)
/form                     -> SimpleForm
/forum                    -> redirect to /forum/nasa
/forum/:channelId         -> ForumPage
*                         -> NotFoundState (role="alert")

// sprint1-router
PersonDetail({ people = PEOPLE }): reads `id` with useParams(); unknown id -> NotFoundState, never throws
PeopleLayout({ people = PEOPLE }): NavLink per person (key = person.id), className callback for the open one

// sprint2-form (no useEffect anywhere)
validateForm(values): { [field]: message }         // pure; fields name, email, password, confirmPassword
//   name >= 2 chars (trimmed) · email pattern · password >= 8 chars · confirmPassword equals password (cross-field)
FormContext value: { values, errors, touched, setValue(name, v), touch(name) }
useFormContext(): throws outside a provider
InputField({ name, label, type, autoComplete }): label htmlFor (useId), aria-invalid, aria-describedby -> its error
// an error is shown once the field was left or the form was submitted
ShowData({ data, title }): <dl>, passwords masked

// sprint3-forum + server
GET  /api/messages/:forum   -> 200 [{ id, author, text, timestamp }] | 404 { error }
POST /api/messages/:forum   -> 201 message | 400 { error, details } | 404 | 413
//   body { author <= 40, text <= 280 }, trimmed; the server makes id (crypto.randomUUID) and timestamp
//   CORS: one explicit origin (CLIENT_ORIGIN); express.json({ limit: '10kb' }); one error handler, no stack in answers
messageRules.validateMessage(body): { author?, text? }  // used by MessageForm AND the server
useForumMessages(forum, refreshKey): { status: 'loading' | 'success' | 'error', messages, error }
//   AbortController per request; only the hook's own abort is ignored; messages of another forum are never shown
```

---

## Block 2 — Sprint 1: router (`client/src/sprint1-router/`)

| ID  | Task | Output |
| --- | ---- | ------ |
| 1.1 | Sample people with fixed ids (frozen). | `people.js` |
| 1.2 | Not-found state (`role="alert"`, link back) and its style. | `NotFoundState.jsx`, `.module.css` |
| 1.3 | Detail card from `useParams()` with a description list, and its style. | `PersonDetail.jsx`, `.module.css` |
| 1.4 | "Nothing selected" view. | `NoSelection.jsx` |
| 1.5 | Skeleton of the same size as the card (`aria-busy`, `aria-live`), reduced-motion aware. | `DetailSkeleton.jsx`, `.module.css` |
| 1.6 | Nested layout: NavLink list + `<Outlet/>`, grid `minmax(280px, 1fr) 2fr` from 48rem. | `PeopleLayout.jsx`, `.module.css` |

## Block 3 — Sprint 2: form (`client/src/sprint2-form/`)

| ID  | Task | Output |
| --- | ---- | ------ |
| 2.1 | Pure validation. | `validateForm.js` |
| 2.2 | Context and hook. | `FormContext.js` |
| 2.3 | Accessible field and its style. | `InputField.jsx`, `.module.css` |
| 2.4 | Semantic inspector with masked passwords and its style. | `ShowData.jsx`, `.module.css` |
| 2.5 | Form container: state, derived errors, submit, reset, status line; and its style. | `SimpleForm.jsx`, `.module.css` |

## Block 4 — Sprint 3: server and forum

| ID  | Task | Output |
| --- | ---- | ------ |
| 3.1 | Message rules shared by browser and server. | `client/src/sprint3-forum/messageRules.js` |
| 3.2 | In-memory store behind an async interface (a Mongoose store replaces it in the homework). | `server/src/store.js` |
| 3.3 | Express app: CORS, JSON limit, GET, POST with validation, 404, error handler. | `server/src/app.js` |
| 3.4 | Entry point (`PORT`, clean shutdown) and the template of its settings. | `server/src/index.js`, `server/.env.example` |
| 3.5 | Channels, fetch client with `ApiError`, and the hook with `AbortController`. | `channels.js`, `forumApi.js`, `useForumMessages.js` |
| 3.6 | Channel switcher (NavLinks), message list (`<dl>`, `<time>`), message form (same rules as the server). | `ChannelSwitcher.jsx`, `MessageList.jsx`, `MessageForm.jsx` + styles |
| 3.7 | The page that joins them. | `ForumPage.jsx`, `.module.css` |

## Block 5 — Assembly

| ID  | Task | Output |
| --- | ---- | ------ |
| 4.1 | Main navigation and the route tree with the lazy detail route. | `AppNav.jsx`, `App.jsx`, `.module.css` |

## Block 6 — Tests (one flat `tests/` folder in each package)

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 5.1 | `client/tests/DetailSkeleton`, `PersonDetail`, `PeopleLayout`, `App` | Skeleton as a Suspense fallback, `useParams`, 404, NavLink current and style, deep link, lazy loading, catch-all. |
| 5.2 | `client/tests/validateForm`, `formParts`, `SimpleForm` | Every rule and its border, context hook, field ARIA, masked inspector, one render per keystroke, no `useEffect` in the form files. |
| 5.3 | `client/tests/messageRules`, `useForumMessages` | Limits 40/280, abort on switch and unmount, out-of-order answers, refresh without flashing, StrictMode. |
| 5.4 | `client/tests/forumParts`, `ForumPage`, `appRoutes` | Switcher, list states, message form (sending, refused, network failure, unmount), channel switching with cancelled requests, post then reload, main navigation, `/form` and `/forum`. |
| 5.5 | `client/tests/deckReference`, `server/tests/deckReference` | The reference code of slides 22, 25, 26 and 27 copied as it is, to show its defects (see AI_FAILURE_AUDIT). |
| 5.6 | `server/tests/server` | GET/POST, 400/404/413, CORS, forged fields, errors without a leak, store copies. |

## Checkpoint (after each step)

- `grep` for banned things: `<div`, `<span`, `keyCode`, `alert(`, `console.`, `style={`, `<Switch`, `<Redirect`, `activeClassName`, `defaultProps`, `Math.random`.
- Run it: Vitest (jsdom) for components and hooks, supertest for the API, headless Chrome with the API running for the whole page.
- `npm run build`; no sideways scroll at 375, 768 and 1440 px.
- Break the source on purpose and check that a test fails (mutation run); restore and `diff`.
- Slow 3G (DevTools preset: 400 ms, 500 kbit/s) with quick channel switching: the old requests must end `net::ERR_ABORTED` (log in `SLOW_3G_VERIFICATION.log`).

## Commit plan

| Commit | Hash | Scope |
| ------ | ---- | ----- |
| 1 | `9298d47` | `chore: add root gitignore` |
| 2 | `2a56f33` | `chore(ex1)` scaffold with test tooling and project rules (flat layout) |
| 3 | `de42a57` | `docs(ex1)` first task decomposition and prompt log (replaced by this version) |
| 4 | `6b40c17` | `feat(ex1)` Sprint 1 router layout and master-detail view |
| 5 | `ad4d90a` | `feat(ex1)` Sprint 2 context form engine |
| 6 | `9c2ef4e` | `feat(ex1)` Sprint 3 Express API and channels |
| 7 | `7557af2` | `feat(ex1)` Sprint 3 hook, forum UI, navigation and root app |
| 8 | `183af87` | `test(ex1)` first test suite (100 tests) |
| 9 | `1835241` | `refactor(ex1)` split into `client/` (sprint1-router, sprint2-form, sprint3-forum) and `server/`; keeps a free row for each field error |
| 10 | `99ebdcb` | `test(ex1)` forum UI, routes, deck reference code, known defects as expected failures |
| 11 | `7adabac` | `docs(ex1)` rewritten task decomposition, prompt log, failure audit and lessons learned |
| 12 | `cba9288` | `chore` remove the root `.gitignore` |
| 13 | `TODO` | `chore(ex1)` add the server `.env.example` and let `npm start` read `.env` |
| 14 | `TODO` | `docs(ex1)` Slow 3G verification log, updated audit, prompt log and task decomposition |
