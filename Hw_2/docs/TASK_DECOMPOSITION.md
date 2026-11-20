# TASK_DECOMPOSITION.md — Lab 4 · Homework 2 (WBS)

> Goal: a full-stack card-swipe deck, "Hen Ho Nhung Khong Yeu" edition. A dual keyboard and pointer listener turns input into swipes, a last-in-first-out undo stack takes them back, an asymmetric score is derived from the history, and an Express 5 + Mongoose 8 API keeps the history in MongoDB.
> Stack: React 19 · Vite 7 · Express 5 · Mongoose 8 · plain JSX · CSS Modules. All work follows [project-rules.md](project-rules.md) (section 15 is new for this homework).
> Source: Lab 4 deck, slide 20 (the specification), slide 31 (SwipeDeck contract), slide 32 (Mongoose 8 server contract), slide 29 (hallucinations 03, 04 and 05).
> Working rule: one file per step. The student was away during the build, so the steps were generated in **batches** by the assistant; [PROMPT_LOG.md](PROMPT_LOG.md) says what was really done, in order.
> Numbering: the deck calls three tasks "Homework 1". This folder is the second one, the **swipe deck** (slide 20). The gallery is `Hw_1`; the appeal tribunal (slide 21) is next.

---

## Layout

```
Hw_2/
  docs/      project-rules.md · TASK_DECOMPOSITION.md · PROMPT_LOG.md · AI_FAILURE_AUDIT.md · BROWSER_VERIFICATION.log
  client/    Vite app (own package.json: `npm test`, `npm run dev`, `npm run build`; /api is proxied to port 3002)
    src/     main.jsx · App.jsx · SwipeDeck · SwipeCard · ScoreBoard · DeckControls (+ .module.css)
             deck.js · swipeStack.js · swipeApi.js · useDeck.js · index.css
    tests/   one flat folder
  server/    Express 5 + Mongoose 8 (own package.json: `npm start`, `npm run seed`, `npm test`)
    src/     app.js · models.js · config.js · index.js · seed.js · profilesSeed.js
    tests/   one flat folder; the tests start a real MongoDB in memory
    .env.example
```

---

## Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
// Actions: PASS (ArrowLeft, drag left, -5) · LIKE (ArrowRight, drag right, +10) · SUPER (ArrowUp, drag up, +25) · undo (Backspace)
// The point values and SUPER are this project's choice; the slide fixes only "like earns, the rest costs" and the keys.

// deck.js (pure)
scoreOf(history): number                       // reduce over the history; never stored
statsOf(history): { score, likes, passes, supers, swiped }
actionForKey(key): 'PASS' | 'LIKE' | 'SUPER' | null      // Object.hasOwn: "constructor" is null
actionForGesture(dx, dy): action | null        // 50 px threshold; the dominant axis wins; down and short drags are null
// swipeStack.js (pure, immutable): EMPTY_STACK · push(stack, x) · pop(stack) -> { stack, item } · peek · size

// useDeck(): { status: 'loading'|'success'|'error', profiles, history, current, stats, busy, notice, swipe(action), undo(), restart(), retry() }
//   load: GET /api/profiles + GET /api/swipes, one AbortController per attempt (only its own abort is ignored)
//   one action at a time (a ref lock); the screen changes after the server answered; 404/409 -> read the server history again

// REST (server)
GET    /api/profiles            -> 200 [{ id, name, age, bio }]  in deck order
GET    /api/swipes              -> 200 [{ id, profileId, action, createdAt }]  oldest first
POST   /api/swipes              -> 201 record | 400 { error, details } | 404 unknown profile | 409 not the next card / already swiped | 413
//   body { profileId: 24-hex string, action: PASS|LIKE|SUPER }; nothing else is read
DELETE /api/swipes/:id          -> 200 { id } | 400 | 404 | 409 only the latest swipe can be undone
DELETE /api/swipes              -> 204 (start over)
//   CORS: one explicit origin (CLIENT_ORIGIN); express.json({ limit: '10kb' }); one error handler without stack or database message

// Settings (config.js): MONGODB_URI required (the server refuses to start without it) · PORT (3002) · CLIENT_ORIGIN (dev default, required when NODE_ENV=production)
```

---

## Block 1 — Setup

| ID  | Task | Output |
| --- | ---- | ------ |
| 0.1 | Server project: Express 5, Mongoose 8, `mongodb-memory-server` for tests; checked start-up settings and the template of the environment. | `server/package.json`, `vitest.config.js`, `.gitignore`, `.env.example`, `src/config.js` |
| 0.2 | Client project with the Lab 4 toolchain, the design tokens and a proxy to the API. | `client/package.json`, `vite.config.js`, `index.html`, `src/index.css`, `src/main.jsx`, `tests/setup.js` |
| 0.3 | Rules of the generation: Lab 4 rules plus section 15. | `docs/project-rules.md` |

## Block 2 — Server

| ID  | Task | Output |
| --- | ---- | ------ |
| 1.1 | Models: `Profile` (ordered), `Swipe` (unique `profileId`, action enum, creation time). Seed data. | `models.js`, `profilesSeed.js` |
| 1.2 | The API: validation of every body, next-card rule, LIFO undo, start over, CORS, JSON limit, one error handler. | `app.js` |
| 1.3 | Start-up (`await mongoose.connect`, clean shutdown) and the seed command. | `index.js`, `seed.js` |

## Block 3 — Client logic

| ID  | Task | Output |
| --- | ---- | ------ |
| 2.1 | Immutable LIFO stack. | `swipeStack.js` |
| 2.2 | Score, stats, key and gesture mapping as pure functions. | `deck.js` |
| 2.3 | API client with one error type. | `swipeApi.js` |
| 2.4 | The hook: load with `AbortController`, swipe, undo, restart, retry, one action at a time, resync. | `useDeck.js` |

## Block 4 — Client UI

| ID  | Task | Output |
| --- | ---- | ------ |
| 3.1 | Card with Pointer Events (start in a ref, primary pointer, capture, cancel). | `SwipeCard.jsx` + style |
| 3.2 | Score board (`<dl>`) and controls (buttons for every action, `aria-disabled`, `aria-keyshortcuts`). | `ScoreBoard.jsx`, `DeckControls.jsx` + styles |
| 3.3 | Page: focusable deck with the key handler, empty state, error state with retry, live status. | `SwipeDeck.jsx` + style, `App.jsx` |

## Block 5 — Tests (one flat `tests/` folder in each package)

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 4.1 | `server/tests/server`, `config` | Every endpoint and status against a real MongoDB; forged fields; races; CORS; no leak; settings. |
| 4.2 | `server/tests/deckReference` | Slide 29 (callback) and slide 32 code as written. |
| 4.3 | `client/tests/deck`, `swipeApi` | Stack, score, keys, gestures with their borders; API calls and failures. |
| 4.4 | `client/tests/SwipeDeck`, `fakeApi` | Load, restore, keys, pointer, buttons, undo order, lock, failures, cross-tab resync, end of deck. |
| 4.5 | `client/tests/sourceHygiene`, `deckReference` | Rules as grep; slide 31 code as written. |

## Checkpoint (after each step)

- Banned things: `sourceHygiene.test.js` (client) is the grep.
- Vitest in both packages, then `npm run build` in the client.
- **Real stack in real Chrome**: MongoDB (in memory) → `npm run seed` → `npm start` → production build → the script that produced `BROWSER_VERIFICATION.log` (keys, held key, burst, double click, mouse drag, touch swipe, reload, two tabs, end of deck, three widths, axe-core).
- Break the source on purpose, one change at a time, in both packages; restore and compare.

## Commit plan

| Commit | Hash | Scope |
| ------ | ---- | ----- |
| 1 | `5974d87` | `chore(hw2)` scaffold the server with checked start-up settings and `.env.example` |
| 2 | `e302610` | `feat(hw2)` swipe API on Express 5 and Mongoose 8 with LIFO undo, validation and tests |
| 3 | `a359d21` | `test(hw2)` slide 29 and 32 reference code |
| 4 | `32e6885` | `chore(hw2)` scaffold the client |
| 5 | `c08b0ef` | `feat(hw2)` undo stack, derived score, key and gesture mapping, API client |
| 6 | `c7ba2e5` | `feat(hw2)` `useDeck` hook |
| 7 | `5e59ecb` | `feat(hw2)` card, key handling, score board, controls |
| 8 | `789b5ee` | `test(hw2)` deck page, source rules, slide 31 reference code |
