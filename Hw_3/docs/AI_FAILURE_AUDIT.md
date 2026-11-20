# AI_FAILURE_AUDIT.md — Lab 4 · Homework 3 (Fair-Play Appeal Tribunal)

> Defects in AI-generated code and in the deck's reference code (slide 33), checked against [project-rules.md](project-rules.md) and the Lab 4 deck (slides 21, 28, 29, 33).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** Vitest in both packages (the server tests start a real MongoDB with `mongodb-memory-server` and talk to it through Mongoose 8.24, with a clock the test controls), a script in real Chrome 157 against the real stack (log in [BROWSER_VERIFICATION.log](BROWSER_VERIFICATION.log)), axe-core, and a mutation run in each package.
> **Status:** Fixed = corrected before it was committed or in the commit named · Avoided = the deck's code, or the usual generated code, has the defect and this project does not copy it.
> **Test suite:** client `npm test` 10 files, **237 tests**; server `npm test` 2 files, **50 tests**; all passing. The client builds (`npm run build`).
> **Do the tests catch real breakage?** Client: 73 deliberate breakages, one at a time: first run 64 caught, 9 survived; after 12 tests were added and one wrong mutant was corrected, **71 of 73 caught**, the 2 left are equivalent (entry #07). Server: **27 of 27 caught**.

---

## Failure #01: The slide 33 routes are one route per player, and any other player is a blank screen

- **Prompt**: row 6 — "the slide 33 reference code".
- **AI Code** (deck, slide 33):
  ```jsx
  <Route path="/dossier/himass" element={<DossierView user="Himass" />} />
  <Route path="/dossier/tanvuu" element={<DossierView user="TanVuu" />} />
  ```
- **Bug**: the homework asks for `/dossier/:playerID`. With one route per player, a third player needs a new route and a new line of code; the player is a prop that the code decides, not something read from the URL; and an address that matches nothing renders nothing at all, with only a console warning. There is no overview page and no not-found page.
- **DevTools Proof**: `deckReference.test.jsx`: `/dossier/himass` renders; `/dossier/someone-else` gives an **empty container** and one warning `No routes matched location "/dossier/someone-else"`; `/dossier` itself is empty too.
- **Engineering Fix**: one route `:playerID` read with `useParams()`, an index route, a nested layout with `<Outlet context>`, a catch-all, and an unknown player is a `role="alert"` with a link back inside the layout. Chrome, real server: `/dossier/nobody` shows the alert (1 h1, links still there), `/no/such/page` shows the alert, `/` redirects to `/dossier` (`BROWSER_VERIFICATION.log`, section 8). Tests: `App.test.jsx` › `an unknown player "%s" is an alert…` (5 ids, including `HIMASS`, `__proto__` and `constructor`). `sourceHygiene.test.js` › `the page reads the player from the URL … and has no route per player`. Mutations "route per player", "no index route", "no catch-all", "unknown player crashes" are all caught.
- **Status**: Avoided.

---

## Failure #02: The slide 33 timer listener is added on every render, never removed, and calls a function that does not exist

- **Prompt**: row 6.
- **AI Code** (deck, slide 33, `useAppealSlaTimer.js`):
  ```js
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resyncTimerWithServer();
  }); // Recalculates remaining time against absolute system clock timestamps
  ```
- **Bug**: (a) written in the body of a hook, it adds a new listener on every render and nothing removes any of them; (b) `resyncTimerWithServer` is not defined anywhere, so the first time the tab becomes visible the listener throws a `ReferenceError`; (c) it reacts only to "visible" and holds no deadline, no offset and no state: the comment about absolute timestamps has no code behind it; the slide shows no countdown at all.
- **DevTools Proof**: `deckReference.test.jsx`: calling the handler throws `ReferenceError: resyncTimerWithServer is not defined`; a component that renders 5 times has **5 listeners**, and when the tab becomes visible all 5 run although the component is gone; the handler takes nothing and returns nothing.
- **Engineering Fix**: the listeners are in an effect, and its cleanup removes the same functions; the hook holds the deadline, the offset and the sync state, and computes everything from them. Tests: `useAppealSlaTimer.test.jsx` › `listeners and timers are cleaned up` (one listener and the same one removed; re-render adds none; Strict Mode leaves exactly one and none after unmount; after unmount nothing runs); `sourceHygiene.test.js` › `removes every listener it adds, with the same function`. Mutations "visibility listener not removed", "online listener not removed", "request not aborted on cleanup", "timeout not cleared" are all caught.
- **Status**: Avoided.

---

## Failure #03: `useMemo(() => computeMatrix(dossierData), [dossierData])` saves nothing when the data is rebuilt, and a countdown renders every second

- **Prompt**: row 6.
- **AI Code** (deck, slide 33): `const matrix = useMemo(() => computeMatrix(dossierData), [dossierData]);`
- **Bug**: a memo helps only while its dependency keeps its identity. `dossierData` built with `.map`, `.filter` or `?? []` in the same component is a new array on every render, and a page with a countdown renders every second, so the matrix would be computed every second.
- **DevTools Proof**: `deckReference.test.jsx`: with a stable array 5 re-renders call `computeMatrix` once; with the data rebuilt on every render the same 5 re-renders call it **6 times**.
- **Engineering Fix**: the dependency is the array held in state by `useDossiers` (stable), the countdown lives in its own component (`AppealSection`) so that a tick does not render the page, and the form is `memo`. Tests: `App.test.jsx` › `the countdown does not re-render the matrix or the form every second` (5 ticks, 0 more calls of `validateAppeal`), `matrixMemo.test.jsx` › `is computed once while the dossiers keep their identity, although the page renders again` (4 renders, 1 call) and `is computed again when the dossiers are a new array`. Mutations "matrix recomputed every render" and "form re-renders with the countdown" are caught.
- **Status**: Avoided.

---

## Failure #04: The countdown that most generated code contains loses time when a tick is late (the zero-drift requirement)

- **Prompt**: rows 3 and 9.
- **AI Code** (not from the deck; the usual shape, written as a stand-in):
  ```js
  const id = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
  ```
- **Bug**: it counts ticks, not time. Whenever a tick is late (a busy main thread, a throttled background tab, a sleeping laptop) the lost seconds are never recovered, and it knows nothing about the server's clock or the device clock being wrong.
- **DevTools Proof**: `deckReference.test.jsx` › `loses time for good when a tick is late`: after a 10 s freeze and one tick it shows **89** where the clock says **80**. For the implementation of this project, Chrome 157 against the real server: with the main thread blocked for 3 s the display dropped **4 s** and the difference from the server's truth was **0 s**; with the page told that the device clock is **one hour ahead** and **one hour behind** the difference was **0 s** in both cases (a count from the device clock would have been off by 3600 s each way); four samples of the countdown against `GET /api/clock` and the deadline all had a difference of 0 s.
- **Engineering Fix**: `remaining = deadline − (Date.now() + offset)` on every render; `offset` is measured with `GET /api/clock`, assuming the middle of the round trip; there is one `setTimeout` at a time, planned from the clock to the moment the displayed second changes; none while the tab is hidden. Tests: `useAppealSlaTimer.test.jsx` › `zero drift` (a late timer shows 00:01:20 where a counter would show 00:01:29; a freeze of 61 s; 10 000 s in steps ends at exactly 0), `the device clock is wrong` (±1 h, and the round-trip midpoint is exact). Mutations "offset not applied" (both places), "round trip: used the start", "round trip: used the end", "wakes every second, not at the change", "rounds down" are all caught. Source rule: no `setInterval` anywhere in `src`.
- **Status**: Avoided.

---

## Failure #05: My email rule accepted `a@b..`, and I first left the case out of the tests

- **Prompt**: row 2.
- **AI Code** (first draft of `appealRules.js`): `const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;`
- **Bug**: a domain with an empty label (`a@b..`, `a@.b.co`, `a@b..co`) passes. This is a real defect, and it is also a mistake of method: when I wrote the list of addresses that must be rejected, `a@b..` did not fail, and I took it out of the list instead of asking why.
- **DevTools Proof**: in the first test list `a@b..` was among the addresses to reject; it did not fail, and I removed it from the list. I noticed this while writing the next test, changed the regex and put the case back together with `a@.b.co`, `a@b..co` and `a@b.`. The old regex put back (the mutation "email with empty label") fails the tests. (The server uses the same rule, so it was wrong in both places.)
- **Engineering Fix (commit `de67d37`, same commit as the rules)**: `/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/` — at least two labels, none empty. Mutation "email with empty label" (the old regex put back) is caught.
- **Status**: Fixed.

---

## Failure #06: The page wrote a 404 in the console of every visitor on every visit

- **Prompt**: row 7.
- **AI Code** (first draft of the API and of `fetchAppeal`): `GET /api/appeals/:playerId` answered `404 { error: 'No appeal has been filed.' }`, and the client turned that 404 into "none".
- **Bug**: "has an appeal been filed?" is a question whose normal answer is "no". A 404 for it is handled correctly by the code and still printed by the browser as `Failed to load resource: 404` on every visit to a dossier. jsdom cannot show it.
- **DevTools Proof**: the first Chrome run printed `Console errors, warnings: error: Failed to load resource: the server responded with a status of 404 (Not Found) | …` once for every dossier page that was opened. After the fix the same run prints exactly 4 lines, and each one is an answer that the script asks for on purpose (409, 400, 403, 403).
- **Engineering Fix (commit `910fd59`)**: the API answers `200` with `null` when nothing was filed, and `404` only for a player that does not exist; `fetchAppeal` no longer maps a status. Tests: `server.test.js` › `answers 200 with null when nothing was filed (not a 404)…` and `… 404 for a player that does not exist`; mutations "get appeal: a no is a 404" and "get appeal: unknown player not 404" are caught.
- **Status**: Fixed.

---

## Failure #07: The first tests missed 5 real regressions, and 3 more were hidden by a second layer (found by the mutation run)

- **Prompt**: row 8.
- **AI Code**: the survivors of the first run, each a one-line change of `src/`:
  1. `useAppealSlaTimer.js`: delete `setNow(Date.now())` when the tab becomes visible (the display would wait for the answer of the server).
  2. the same file: delete `invalid ||` (a deadline that is not a date would be "open" until the server answers).
  3. the same file: call the fetch function the hook was mounted with, not the newest one.
  4. `DossierView.jsx`: delete the `useMemo` of the matrix.
  5. `DossierLayout.jsx`: the link of the open player loses its style (the attribute `aria-current` is added by the router by itself, so the tests did not notice).
  6. a mutant of mine that replaced `role="timer"` **in a comment** (it never touched the code); corrected to name the element, then caught.
  7–9. `useAppeal.js`: show the previous player's receipt for the next player; do not ignore a late answer; `DossierView.jsx`: remove `key={dossier.playerId}`.
- **Bug**: 1 to 5 were real holes: the suite passed with each change. 7 to 9 were hidden by a second layer: the receipt is keyed by the player inside the hook, and `AppealSection` is also remounted by its `key`, so removing one layer changed nothing that a page test could see.
- **DevTools Proof**: the mutation script printed `SURVIVED` for these (client first run 9 of 73; server 0 of 27).
- **Engineering Fix (commit `00d8df9`)**: 12 tests: `useAppealSlaTimer.test.jsx` (`when shown again it recomputes AT ONCE…`, `uses the newest fetch function…`, `a deadline that is not a date is closed at once…`), `App.test.jsx` (`styles the link of the open player as the open one`), `matrixMemo.test.jsx` (2), and `useAppeal.test.jsx` (6, testing the hook on its own: it never shows the previous player's answer, aborts, ignores a late answer from a fetch that does not honour the abort signal). Second run of these 9: 7 caught.
- **The 2 that remain are equivalent**, not holes: "late appeal answer not ignored" removes the `aborted` check of the success branch, but the answer is also stored with its player id, and an answer for another player is not shown; "form state follows to the next player" removes the `key`, but the hook returns "loading" for the new player, which removes the form and mounts a fresh one. Each layer is kept as a second line of defence; the hook is tested on its own for the first.
- **Status**: Fixed.

---

## Failure #08: Three of my own tests were wrong, not the code

- **Prompt**: rows 3 and 4.
- **AI Code** (my tests): (a) simulated a late timer with `vi.setSystemTime(...)` and then advanced 1 ms; (b) expected `00:01:29` after 400 ms of a 90 s countdown; (c) typed `x` after an address in a field of type email and expected the error of the server to be gone.
- **Bug**: (a) `setSystemTime` also moves the pending timers, so the timer was never due; (b) 89.6 s is shown as 90 because the display rounds UP (that is the rule); (c) the browser (and jsdom) trims the value of an email field, so the React state and the typed text disagreed, and the new text `…com x` was an invalid address.
- **DevTools Proof**: first run of the hook tests: 4 of 55 failed (`a timer that fires LATE…`, `a long freeze…`, `ten thousand small steps…`, `assumes the server stamped its answer in the middle…`); first run of the form tests: 3 of 35 failed (the 400 case, and two that expected a name without the spaces that the test itself had typed).
- **Engineering Fix**: the device clock became a variable of the test (only `setTimeout` is faked) and the late timer is made to fire after the clock moved; the expectation of (b) is `remainingMs === 89 600`; (c) uses `fireEvent.change`; the others expect the text as typed. No source file was changed for any of these.
- **Status**: Fixed (the tests were wrong).

---

## What was avoided without being run

- **Slide 29 #03 (a connection string in the source):** `readConfig()` reads `MONGODB_URI` from the environment and throws without it (`config.test.js`); `server/.env.example` has the name and an empty value; a run of `node src/index.js` without the variable stopped with `MONGODB_URI is missing`.
- **Slide 29 #05 (icon-only buttons without a name):** there is no icon-only button; `sourceHygiene.test.js` › `every <button> has visible text`; axe-core passed on seven states.
- **A link taken from the user:** the evidence link is never rendered as a link or as HTML (`sourceHygiene.test.js` › `never renders text from a user as HTML or as a link target`), and the API refuses anything that is not `https://` (`javascript:` and `http:` tested in the unit tests, in the server tests and in Chrome).

---

## Not verified

- **A real MongoDB server.** The tests and the browser run used `mongodb-memory-server` (a real `mongod`, in memory, local). MongoDB Atlas, replica sets, authentication and TLS were not tried; the connection string is only read from the environment.
- **No sign-in.** Anyone can file the appeal of any player, and anyone can see that an appeal exists (the receipt has no name, email or statement). That is a decision of this homework, not something the slides ask for. There is no rate limit.
- **The clock offset is an estimate.** It assumes that the server stamped its answer in the middle of the round trip, so on a very uneven line it can be off by up to half of the difference between the two ways. The server's deadline check does not depend on it.
- **A real sleeping laptop and a real phone.** The main thread was blocked for 3 s, the page was told a different `Date.now()`, and a second tab hid the first one; a laptop that really sleeps, a frozen tab (`Page lifecycle`) and a throttled phone were not used.
- **Screen readers.** NVDA, JAWS, VoiceOver and TalkBack were not used. "Accessible" here means: axe-core 0 violations on seven states (index, form, form with every error, unknown player, unknown address, window closed, receipt), labels, `aria-invalid`, `aria-describedby`, focus on the first invalid field, a silent timer, and the key behaviours above. Nothing was measured with a screen reader or at 200 % or 400 % zoom, and `prefers-reduced-motion` was not exercised (the page has no animation).
- **Only Chrome 157 (headless).** Not Safari or Firefox; their `visibilitychange` and timer throttling differ.
- **No Lighthouse run** for this homework (the slides do not ask for one).
- **The time zone.** Dates are shown in UTC on purpose; a local time was not tried.
- **Not in the repository:** the Chrome check script and the mutation scripts. Only their output is kept.
