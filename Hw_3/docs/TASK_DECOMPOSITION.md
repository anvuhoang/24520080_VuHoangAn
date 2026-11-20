# TASK_DECOMPOSITION.md — Lab 4 · Homework 3 (WBS)

> Goal: a full-stack fair-play appeal tribunal for the Himass and TanVuu case. Dossiers are served on `/dossier/:playerID`, a context-driven form with real-time validation files the appeal, and `useAppealSlaTimer()` counts down to a deadline that is synchronized with the server's clock. An Express 5 + Mongoose 8 API keeps the dossiers and the appeals.
> Stack: React 19 · Vite 7 · React Router 7 · Express 5 · Mongoose 8 · plain JSX · CSS Modules. All work follows [project-rules.md](project-rules.md) (section 15 is new for this homework).
> Source: Lab 4 deck, slide 21 (the specification), slide 33 (`FairPlayAppealPortal` and `useAppealSlaTimer` contract), slide 28 (cross-field validation), slide 29 (hallucinations 03 and 05), slide 34 (repository files).
> Working rule: one file per step. The student was away during the build, so the steps were generated in **batches** by the assistant; [PROMPT_LOG.md](PROMPT_LOG.md) says what was really done, in order.
> Numbering: the deck calls three tasks "Homework 1". This folder is the third one, the **appeal tribunal** (slide 21). The gallery is `Hw_1`, the swipe deck `Hw_2`.
> Choices that the slides do not make (they are mine): the deadline is set by the server and compared on the server; the offset between the clocks is measured with `GET /api/clock`; the matrix is "penalty minutes per point of severity, against the mean of all players".

---

## Layout

```
Hw_3/
  docs/      project-rules.md · TASK_DECOMPOSITION.md · PROMPT_LOG.md · AI_FAILURE_AUDIT.md · BROWSER_VERIFICATION.log
  client/    Vite app (own package.json: `npm test`, `npm run dev`, `npm run build`; /api is proxied to port 3003)
    src/     main.jsx · App.jsx · api.js · NotFoundState · index.css
      dossier/   DossierLayout · DossierView · DossierIndex · MatrixTable · computeMatrix · useDossiers · dossierApi
      appeal/    AppealSection · AppealForm · FormField · FormContext · appealRules · useAppeal · appealApi
      sla/       useAppealSlaTimer · SlaCountdown · formatRemaining · clockApi
    tests/   one flat folder
  server/    Express 5 + Mongoose 8 (own package.json: `npm start`, `npm run seed`, `npm test`)
    src/     app.js · models.js · config.js · index.js · seed.js · dossiersSeed.js
    tests/   one flat folder; the tests start a real MongoDB in memory
    .env.example
```

The server imports `appealRules.js` from `client/src/appeal`, so the form in the browser and the API apply the same rules (one source, no copy to keep in step).

---

## Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
// Routes (client/src/App.jsx)
/                        -> redirect to /dossier
/dossier                 -> DossierLayout (title, player links, <Outlet context={{ dossiers }}/>)
  index                  -> DossierIndex (the matrix of all players)
  :playerID              -> DossierView; an unknown id -> NotFoundState (role="alert"), never throws
*                        -> NotFoundState

// computeMatrix(dossiers): { mean, rows: [{ playerId, name, infractions, severity, minutes, rate, index, verdict }] }   (pure)
//   rate = minutes / severity points (null without severity) · index = rate / mean of the rates
//   verdict: harsher (index >= 1.25) · lighter (<= 0.8) · proportionate · no-data

// useAppealSlaTimer(deadline, { fetchServerNow }): { remainingMs, expired, level, text, iso, parts, sync, offsetMs }
//   remaining = deadline - (Date.now() + offset); offset = server time - device time (midpoint of the round trip)
//   resync at start, on visibilitychange (visible) and on online; one setTimeout at a time, none while hidden
//   expired only after the first answer of the server (or its failure); level: ok > 1 h > urgent > 5 min > critical > 0 > expired

// appealRules (shared by the browser and the server)
validateAppeal(values): { [field]: message }     // pure; name 2-60 · email · category in the list · statement 50-1000 (100 for "Other") · evidence https only (optional) · confirm === true
normalizeAppeal(values): the known fields, trimmed, email in lower case

// REST (server)
GET  /api/clock                 -> 200 { now }  (Cache-Control: no-store)
GET  /api/dossiers              -> 200 [{ playerId, name, team, matchesPlayed, reportsReceived, infractions: [...], appealDeadline }]
GET  /api/dossiers/:playerId    -> 200 | 400 | 404
GET  /api/appeals/:playerId     -> 200 receipt | 200 null (none filed) | 400 | 404 unknown player
POST /api/appeals/:playerId     -> 201 receipt | 400 { error, details } | 403 window closed | 404 | 409 already filed | 413
//   order of checks: id, player, DEADLINE (server clock), body, unique index. The receipt has no name, email or statement.
//   CORS: one explicit origin; express.json({ limit: '10kb' }); one error handler without stack or database message

// Settings (config.js): MONGODB_URI required (the server refuses to start without it) · PORT (3003) · CLIENT_ORIGIN (dev default, required when NODE_ENV=production)
```

---

## Block 1 — Setup

| ID  | Task | Output |
| --- | ---- | ------ |
| 0.1 | Server project: Express 5, Mongoose 8, `mongodb-memory-server` for tests; checked start-up settings and the template of the environment. | `server/package.json`, `vitest.config.js`, `.gitignore`, `.env.example`, `src/config.js` |
| 0.2 | Client project with the Lab 4 toolchain, `react-router@7`, the design tokens and a proxy to the API. | `client/package.json`, `vite.config.js`, `index.html`, `src/index.css`, `tests/setup.js` |
| 0.3 | Rules of the generation: Lab 4 rules plus section 15. | `docs/project-rules.md` |

## Block 2 — Appeal rules and server

| ID  | Task | Output |
| --- | ---- | ------ |
| 1.1 | The rules of an appeal as pure functions, shared. | `client/src/appeal/appealRules.js` |
| 1.2 | Models: `Dossier` (absolute deadline, infractions), `Appeal` (unique per player). Seed data. | `models.js`, `dossiersSeed.js`, `seed.js` |
| 1.3 | The API: clock, dossiers, appeals; deadline judged by the server's clock; whitelist; receipt without personal data; CORS, JSON limit, one error handler. | `app.js`, `index.js` |

## Block 3 — The countdown (the core of the homework)

| ID  | Task | Output |
| --- | ---- | ------ |
| 2.1 | Formatting as pure functions: parts, text, ISO duration, levels and their messages. | `sla/formatRemaining.js` |
| 2.2 | The call that asks the server what time it is. | `sla/clockApi.js` |
| 2.3 | The hook: offset, one timeout at a time, visibility and network resync, stale answers, cleanup. | `sla/useAppealSlaTimer.js` |
| 2.4 | The view: a silent timer, a status that is announced only when the level changes, the sync state. | `sla/SlaCountdown.jsx` + style |

## Block 4 — Dossiers

| ID  | Task | Output |
| --- | ---- | ------ |
| 3.1 | The matrix as a pure function. | `dossier/computeMatrix.js` |
| 3.2 | Loading with `AbortController`. | `dossier/useDossiers.js`, `dossierApi.js`, `api.js` |
| 3.3 | Layout with player links and `<Outlet context>`; the page of one player; the overview; the matrix table. | `DossierLayout`, `DossierView`, `DossierIndex`, `MatrixTable` + styles |
| 3.4 | Not-found state and the route tree. | `NotFoundState.jsx`, `App.jsx`, `main.jsx` |

## Block 5 — The appeal form engine

| ID  | Task | Output |
| --- | ---- | ------ |
| 4.1 | Context and the hook that throws outside a provider. | `appeal/FormContext.js` |
| 4.2 | One field component: label, control, hint, error, ARIA. | `appeal/FormField.jsx` + style |
| 4.3 | The form: values, touched, submitted, server errors, a lock against double sending, focus on the first error, 400/403/409/network handling. | `appeal/AppealForm.jsx` + style |
| 4.4 | Has an appeal been filed? and the section that joins the countdown, the receipt and the form. | `appeal/useAppeal.js`, `appealApi.js`, `AppealSection.jsx` + style |

## Block 6 — Tests (one flat `tests/` folder in each package)

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 5.1 | `server/tests/server`, `config` | Every endpoint and status against a real MongoDB with a clock the test controls; the deadline border; races; forged fields; receipt without personal data; CORS; no leak. |
| 5.2 | `client/tests/appealRules`, `computeMatrix`, `formatRemaining` | Every rule and its border; the matrix; the format. |
| 5.3 | `client/tests/useAppealSlaTimer` | Counting, late timers, a wrong device clock, round-trip midpoint, hidden tab, listeners and timers cleaned up, Strict Mode, stale and failed answers, expiry, a changed deadline. |
| 5.4 | `client/tests/App`, `AppealForm`, `fakeApi` | Routes, layout, pages; real-time validation, the cross-field rule, focus, submit, 400/403/409, double click, closed window, switching player; the countdown does not re-render the form. |
| 5.5 | `client/tests/sourceHygiene`, `deckReference` | Rules as grep; slide 33 code as written. |

## Checkpoint (after each step)

- Banned things: `sourceHygiene.test.js` (client) is the grep.
- Vitest in both packages, then `npm run build` in the client.
- **Real stack in real Chrome**: MongoDB (in memory) → `npm run seed` → `npm start` → production build → the script behind `BROWSER_VERIFICATION.log`: the countdown against the server, a device clock one hour wrong, a blocked main thread, a hidden tab, the form, a window closed by the server under an open page, the routes, three widths, axe-core on seven states.
- Break the source on purpose, one change at a time, in both packages; restore and compare.

## Commit plan

| Commit | Hash | Scope |
| ------ | ---- | ----- |
| 1 | `fc96134` | `chore(hw3)` scaffold the server with checked start-up settings and `.env.example` |
| 2 | `de67d37` | `feat(hw3)` appeal rules shared by the form and the API, with the client scaffold |
| 3 | `5e9d229` | `feat(hw3)` dossier and appeal API with a server-side appeal deadline |
| 4 | `c48d201` | `feat(hw3)` `useAppealSlaTimer`, countdown view and tests |
| 5 | `306b362` | `feat(hw3)` appeal form engine and appeal section |
| 6 | `fba873e` | `feat(hw3)` `/dossier/:playerID` routes, matrix and dossier pages |
| 7 | `919216e` | `test(hw3)` matrix, routes, form engine, source rules, slide 33 reference code |
| 8 | `910fd59` | `fix(hw3)` the appeal check answers 200 with null instead of a 404 in every console |
| 9 | `00d8df9` | `test(hw3)` `useAppeal` on its own, the matrix memo, the style of the open link, the timer when shown again |
| 10 | `c5e03d8` | `test(hw3)` a counter that subtracts one per tick loses time |
| 11 | `a5f9b18` | `docs(hw3)` rules, decomposition, prompt log, failure audit, browser log |
| 12 | — | `docs(hw3)` record the last commit hashes |
