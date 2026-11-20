# Lab 4 — Multi-route SPA, context forms and full-stack React 19 (UIT)

**Student:** Vũ Hoàng An (24520080) · **Course:** Web programming, University of Information Technology, VNUHCM · **Branch:** `lab-4`

Deliverables of Lab 4 (React 19 + Vite, plain JSX, React Router 7, Express 5, Mongoose 8): the exercise and three homeworks. Each one is its own project with its own `package.json`, so each can be installed, run and tested on its own. The exercise and the two full-stack homeworks have a `client/` and a `server/`.

## Where is what

| Folder | Slide | What it is | Tests |
| ------ | ----- | ---------- | ----- |
| [`Ex_1/`](Ex_1) | Exercise (Sprints 1–3, slides 9–17) | One app with three sprints. **Router:** master-detail directory, nested layout, `useParams`, lazy detail route with a same-size skeleton. **Form:** Context engine with validation derived while rendering (no `useEffect`) and an inspector that masks passwords. **Forum:** channel switcher on an Express API, `AbortController` on every request. | client 126 + server 25 (2 expected failures) |
| [`Hw_1/`](Hw_1) | Homework: photo and evidence gallery (slide 19, 30) | Category filter and the open photo in the URL with `useSearchParams`; the lightbox is a native `<dialog>`; keyboard, Back and Forward behave; WCAG 2.2 AA checked with axe-core; Lighthouse 100 / 100 / 100 / 100. | 81 |
| [`Hw_2/`](Hw_2) | Homework: full-stack card-swipe deck (slide 20, 31, 32) | Dual keyboard and Pointer Events listener, immutable LIFO undo stack, asymmetric score derived from the history, Express 5 + Mongoose 8 persistence with a server-side LIFO undo. | client 118 + server 44 |
| [`Hw_3/`](Hw_3) | Homework: full-stack appeal tribunal (slide 21, 33) | Dossiers on `/dossier/:playerID`, a context form with real-time validation and a cross-field rule, `useAppealSlaTimer()` that computes the time left from an absolute deadline and the server's clock, a derived disproportionality matrix, and an API that judges the deadline itself. | client 237 + server 50 |

The deck calls all three homeworks "Homework 1". They are numbered here in the order of the slides: gallery, swipe deck, tribunal. The slide for the final submission draws one repository with a few documents at its root; here each project keeps its own `docs/`, so that its prompts, audit and history stay together.

## Run a project

**Hw_1** (no server):

```bash
cd Hw_1
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm test           # Vitest + Testing Library, jsdom
```

**Ex_1** (client and API, in two terminals; the API keeps its data in memory):

```bash
cd Ex_1/server && npm install && npm start     # API on port 3001; `.env` is optional (see .env.example)
cd Ex_1/client && npm install && npm run dev   # the browser talks to /api, which Vite forwards to port 3001
```

**Hw_2** and **Hw_3** (they need MongoDB):

```bash
cd Hw_2/server            # or Hw_3/server
cp .env.example .env      # then set MONGODB_URI (a local MongoDB or Atlas)
npm install
npm run seed              # fills the collections (Hw_3: each appeal window starts now)
npm start                 # Hw_2 on port 3002, Hw_3 on port 3003

cd Hw_2/client            # or Hw_3/client, in a second terminal
npm install
npm run dev               # the browser talks to /api, which Vite forwards to the API
```

The server refuses to start without `MONGODB_URI`, and the connection string is never in the source. The tests of the servers do **not** need your MongoDB: they start their own in memory with `mongodb-memory-server`, which downloads a `mongod` binary the first time (so the first run needs the internet).

```bash
cd <project>/client && npm test     # client tests
cd <project>/server && npm test     # server tests (Ex_1, Hw_2, Hw_3)
```

Node 22.12 or newer (Vitest 5 needs it; Vite 7 alone needs 20.19). Stack: React 19, Vite 7, React Router 7 (Ex_1 and Hw_3), Express 5, Mongoose 8, CSS Modules, no UI library.

## Documents (in each project's `docs/`)

| File | Content |
| ---- | ------- |
| `project-rules.md` | The rules the code was generated under: the Lab 3 rules (no class components, `defaultProps`, `keyCode`, `alert()`, `<div>`/`<span>`, tokens only in CSS …) plus the Lab 4 rules (routing with v7 only, derived form errors, `AbortController`, CORS with one origin, no secrets in source). Each homework adds a section 15 for what it is about: URL state and the native dialog (Hw_1), input handling and Mongoose 8 (Hw_2), time and the server clock (Hw_3). |
| `TASK_DECOMPOSITION.md` | The work broken into blocks, the contract (routes, props, functions, REST answers), the checkpoint and the commit plan with the hash of every commit. |
| `PROMPT_LOG.md` | One row per batch that was run: the prompt, the result (accepted or modified), what was changed by hand, and the commit. Dates only. Ends with Lessons Learned. |
| `AI_FAILURE_AUDIT.md` | The defects found in AI-generated code and in the deck's own reference code, each with the code, the proof (a test, a browser run or a measurement) and the fix or its status. Ends with what was **not** verified. |
| `BROWSER_VERIFICATION.log` (Hw_1, Hw_2, Hw_3), `LIGHTHOUSE.md` (Hw_1), `SLOW_3G_VERIFICATION.log` (Ex_1) | The output of the checks in a real browser, kept as text. |

| Project | Batches logged | Audit entries |
| ------- | -------------- | ------------- |
| Ex_1 | 13 | 11 |
| Hw_1 | 10 | 7 |
| Hw_2 | 9 | 10 |
| Hw_3 | 10 | 8 |

**How the prompts were written.** The student gave the deck and left, so the prompts in the logs were written by the assistant and the files were generated in batches, not one file per prompt as in Lab 3. Each log says so at its top. An earlier version of the `Ex_1` documents, written by another assistant working in the same folder at the same time, claimed things that the code did not do; it was rewritten from measurements.

## How the work was checked

- **Tests.** Every check that was run by hand is kept as a permanent test in a flat `tests/` folder. The deck's reference code (slides 22, 25–27, 29, 30–33) was copied **as written** into `deckReference` tests to show where it fails; those tests state what was measured. Known defects left open on purpose are `it.fails` (Ex_1: 2).
- **Real browser, real stack.** Headless Chrome 157 (`puppeteer-core`) against the production build and the real API: keyboard, mouse and emulated touch, history, three widths (375, 768, 1440 px), focus order, two tabs, hidden tabs, a device clock one hour wrong, a server that closes a window under an open page. Hw_2 and Hw_3 run on a real `mongod` (in memory).
- **Accessibility.** axe-core with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`: 0 violations on every state that was checked (Hw_1: 5 pages, Hw_2: 4, Hw_3: 7). Hw_1 has Lighthouse 100 / 100 / 100 / 100 (Performance, Accessibility, Best Practices, SEO) on mobile and desktop, for the grid and for the open lightbox.
- **Mutation checks.** The source was broken on purpose, one change at a time, and the tests had to fail. Hw_1 31 of 31 caught; Hw_2 client 41 of 43 and server 29 of 29; Hw_3 client 71 of 73 and server 27 of 27; Ex_1 30 of 32. The few that survive are equivalent changes (a guard that another guard already makes redundant), explained in each audit. The survivors of the first runs were real holes, and tests were added for them.
- **Not hidden.** Every audit ends with what was not verified: screen readers were never used, only Chrome was run, touch was emulated, the databases were local and in memory, and the Hw_2 and Hw_3 APIs have no sign-in.

## Git

- Work is on the `lab-4` branch, in small commits that follow each project's `TASK_DECOMPOSITION.md` (`feat(hw2): …`, `test(hw3): …`, `docs(ex1): …`).
- The commits are authored by the student only.
- The commit hash of each batch is in the last column of its `PROMPT_LOG.md`, and the commit plan of each project lists every commit.
- Lab 3 is on its own branch, `lab-3`.

## Data

The people, forum messages, photos, profiles and players in these projects are invented sample data (the gallery pictures are generated SVG; the Hw_2 profiles are fictional adults; the Himass and TanVuu dossiers in Hw_3 are fictional). They are not real records of anybody.
