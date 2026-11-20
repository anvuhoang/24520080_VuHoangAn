# AI_FAILURE_AUDIT.md — Lab 4 · Homework 2 (Swipe Deck)

> Defects in AI-generated code and in the deck's reference code (slides 29, 31, 32), checked against [project-rules.md](project-rules.md) and the Lab 4 deck (slides 20, 29, 31, 32).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** Vitest in both packages (the server tests start a real MongoDB with `mongodb-memory-server` and talk to it through Mongoose 8.24), a Node probe, a script in real Chrome 157 against the real stack (log in [BROWSER_VERIFICATION.log](BROWSER_VERIFICATION.log)), axe-core, and a mutation run in each package.
> **Status:** Fixed = corrected before it was committed or in the commit named · Avoided = the deck's code has the defect and this project does not copy it.
> **Test suite:** client `npm test` 6 files, **118 tests**; server `npm test` 3 files, **44 tests**; all passing. The client builds (`npm run build`).
> **Do the tests catch real breakage?** Client: 43 deliberate breakages, one at a time: first run 38 caught, 5 survived; after 4 tests were added, **41 of 43 caught**; the 2 left are equivalent changes (entry #10). Server: 29 breakages: 28 caught, 1 survived; after one test, **29 of 29**.

---

## Failure #01: `Swipe.create(req.body)` lets the client choose the id, the time and the action (slide 32)

- **Prompt**: row 2 — "Run the slide 29 and slide 32 code as written."
- **AI Code** (deck, slide 32, step 4):
  ```js
  app.post('/api/swipe', async (req, res) => {
    try {
      const record = await Swipe.create(req.body);
      res.status(201).json(record);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  ```
- **Bug**: the whole body is the record (mass assignment). The client can set `_id` and `createdAt`, and any string is stored as the action; nothing checks that the profile exists or that the card is the next one.
- **DevTools Proof**: Mongoose 8.24 and a real MongoDB. Posting `{ profileId, action: 'LIKE', _id: 'ffff…', createdAt: '2000-01-01T00:00:00.000Z' }` answered 201 and the stored record had exactly that `_id` and that `createdAt`; `{ action: 'ANYTHING AT ALL' }` also answered 201. Tests: `server/tests/deckReference.test.js` › `lets the client choose the _id and the createdAt…`, `accepts any text as the action`.
- **Engineering Fix**: only `profileId` and `action` are read; `profileId` must match `/^[0-9a-f]{24}$/`, `action` must be in `PASS`, `LIKE`, `SUPER`; the profile must exist (404) and be the next card (409); a unique index on `profileId` makes a double click or a race a 409. Tests: `server.test.js` › `ignores fields the client has no right to set`, `rejects … with 400` (6 cases, including `{ $ne: null }` and an array), `refuses a card that is not the next one`, `two requests for the same card at once record it once`. Mutations "body passed to create", "no action check", "no profileId format check", "any card can be swiped" and "no unique swipe per profile" are all caught.
- **Status**: Avoided.

---

## Failure #02: The answer to a failed request is `err.message` (and a missing body parser says the wrong thing) (slide 32)

- **Prompt**: row 2.
- **AI Code**: `res.status(400).json({ error: err.message })`, and no `express.json()` anywhere in the slide.
- **Bug**: the client receives the text of the database error, which names the model and the driver's internal error type. With no body parser, Express 5 leaves `req.body` undefined, so a correct request is answered "profileId is required", which sends the developer to the wrong place.
- **DevTools Proof**: posting `{ profileId: 'abc', action: 'LIKE' }` answered 400 with `RefSwipe validation failed: profileId: Cast to ObjectId failed for value "abc" (type string) at path "profileId" because of "BSONError"`. Without `express.json()` a valid body answered 400 `Path \`profileId\` is required`. Tests: `deckReference.test.js` › `puts the model name and the driver error in the answer`, `without express.json() the body is undefined…`.
- **Engineering Fix**: our own messages with the field names (`details`), a limit of 10 kb (413), invalid JSON is a 400, and one error handler answers 500 with a fixed sentence. Test: `server.test.js` › `sends no stack trace and no database message when the database fails` (a fake error containing a host name and a port must not appear). Mutation "error handler leaks" is caught.
- **Status**: Avoided.

---

## Failure #03: A Mongoose 5 callback is not an error in Mongoose 8, it is an unhandled rejection (slide 29 #04)

- **Prompt**: row 2.
- **AI Code**: `Model.find().exec((err, docs) => { … })`.
- **Bug**: the slide says the pattern "was completely removed". It is rejected, but not by throwing: `exec` returns a rejected promise. Nobody awaits it, so Node ends the process.
- **DevTools Proof**: Mongoose 8.24: calling `exec(callback)` does not throw; awaiting the result rejects with `MongooseError: Query.prototype.exec() no longer accepts a callback`. A first probe that did not await it ended with that error as an unhandled rejection and the process stopped. Test: `deckReference.test.js` › `Query.exec(callback) is rejected by Mongoose 8, as a rejected promise`.
- **Engineering Fix**: every query is `await …exec()` or `await Model.method()`; no callback exists in `server/src`.
- **Status**: Avoided.

---

## Failure #04: The deprecated connect flags are a warning, not an error (slide 32 step 2, my wrong expectation)

- **Prompt**: row 2.
- **AI Code** (the flags the slide says Mongoose 8 removes): `mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })`.
- **Bug**: I expected the connection to fail. It does not.
- **DevTools Proof**: Mongoose 8.24 with the driver 6: the connection succeeds, and the driver prints `useNewUrlParser is a deprecated option` and `useUnifiedTopology is a deprecated option`. Test: `deckReference.test.js` › `useNewUrlParser and useUnifiedTopology still connect, but the driver warns`.
- **Engineering Fix**: `await mongoose.connect(process.env.MONGODB_URI)` with no options (`server/src/index.js`), after `readConfig()` has refused a missing value. Test: `config.test.js` › `refuses to start without MONGODB_URI`, and the run of `node src/index.js` without the variable stopped with `MONGODB_URI is missing`.
- **Status**: Avoided (and the audit says what the flags really do).

---

## Failure #05: The slide 31 input handlers throw, miss a gesture and fight the browser

- **Prompt**: row 6 — "the slide 31 reference code".
- **AI Code** (deck, slide 31):
  ```js
  const handlePointerUp = (e) => { const dx = e.clientX - startPos.x; if (dx > 50) swipe('right'); if (dx < -50) swipe('left'); };
  const handleKeyDown = (e) => { if (e.key === 'ArrowLeft') swipe('left'); … if (e.key === 'Backspace') undoLastSwipe(); };
  ```
- **Bug**: (a) `startPos` is `null` until a `pointerdown`, so a `pointerup` that arrives alone is a `TypeError`; (b) only `dx` is read: there is no upward swipe, and a drag that is mostly vertical still counts as sideways; (c) Alt+ArrowLeft, the browser's Back chord, also swipes; (d) the handler ignores `event.repeat`, so a held key throws the whole deck; (e) there is no `preventDefault`, so the arrows scroll the page and Backspace may leave it; (f) nothing handles `pointercancel` or a second finger.
- **DevTools Proof**: `client/tests/deckReference.test.js`: `throws a TypeError when a pointerup arrives without a pointerdown`; a drag of `(0, -200)` calls nothing; a drag of `(60, -300)` calls `swipe('right')`; `swipes on Alt+ArrowLeft`; 20 key events with `repeat: true` call `swipe` 20 times; `preventDefault` is never called.
- **Engineering Fix**: `SwipeCard.jsx` keeps the start in a ref, accepts only the primary pointer and the main button, checks that the `pointerup` has the same pointer id, handles `pointercancel`, captures the pointer, and `actionForGesture` takes the dominant axis. `SwipeDeck.jsx` ignores Alt, Ctrl and Meta, ignores `event.repeat`, and calls `preventDefault` only for the keys it handles. Chrome 157, real mouse and touch events: a drag of 120 px right, left and up saved `LIKE`, `PASS`, `SUPER`; down 150 px and a 20 px jitter saved nothing; the touch swipe left `scrollY` at 0; Alt+ArrowLeft saved nothing; a held key (7 key-down events) saved one swipe (`BROWSER_VERIFICATION.log`, sections 3 to 5). Mutations "second finger accepted", "right button accepted", "pointer id not checked", "no null guard on pointerup", "cancel not forgotten", "browser chords swipe", "no preventDefault", "axis dominance reversed" are all caught.
- **Status**: Avoided.

---

## Failure #06: The slide 31 score cannot score a third action, and its directions never match its types

- **Prompt**: row 6.
- **AI Code** (deck, slide 31):
  ```js
  const score = history.reduce((acc, action) => { if (action.type === 'LIKE') { return acc + 10; } else { return acc - 5; } }, 0);
  const undoLastSwipe = () => { setHistory(prev => prev.slice(0, -1)); };
  ```
- **Bug**: the `else` takes everything that is not `LIKE`, so a super like (the third key of the slide, ArrowUp) costs 5. The swipe is called with `'left'`, `'right'`, `'up'` and the score compares with `'LIKE'`; nothing in the slide turns one into the other, so a history of directions scores −5 for every swipe. Undo removes the entry from the local array only; the card and the server are not mentioned.
- **DevTools Proof**: `deckReference.test.js`: `[{ type: 'SUPER' }]` scores −5; `[{ type: 'right' }, { type: 'right' }]` scores −10; `slideUndo` returns a shorter array and nothing else.
- **Engineering Fix**: one action vocabulary (`PASS`, `LIKE`, `SUPER`) from the key to the database; `POINTS` is a table (`LIKE` +10, `PASS` −5, `SUPER` +25 — the values and the third action are this project's choice, the slide gives only the idea); `scoreOf` is derived on every render and is never stored; undo pops the immutable stack **and** deletes the swipe on the server, which accepts only the latest one (409 otherwise). Tests: `deck.test.js` (score, asymmetry, undo gives back the score), `SwipeDeck.test.jsx` › `undo is last in, first out: three swipes come back in reverse order`, `server.test.js` › `refuses to remove a swipe that is not the latest (409)`. Mutations "like worth 5", "pass costs nothing", "super worth 10", "undo is first in first out", "undo does not call the server", "any swipe can be undone" are all caught.
- **Status**: Avoided.

---

## Failure #07: My own lookup returned a function for the key "constructor" (first draft)

- **Prompt**: row 3.
- **AI Code** (first draft of `deck.js`):
  ```js
  export const actionForKey = (key) => KEY_ACTIONS[key] ?? null;
  export const scoreOf = (history) => history.reduce((total, swipe) => total + (POINTS[swipe.action] ?? 0), 0);
  ```
- **Bug**: `KEY_ACTIONS` and `POINTS` are objects, so `KEY_ACTIONS['constructor']` is `Object`, not `undefined`. `actionForKey` would return a function, and `scoreOf` would add a function to a number, which gives a **string**. The browser's `event.key` does not produce such a name, but an action from a server or a test can.
- **DevTools Proof**: Vitest, first run of `deck.test.js`: `× does not read inherited object keys such as "constructor" or "__proto__"` — `AssertionError: expected [Function Object] to be null`. 1 failed, 30 passed.
- **Engineering Fix (before the first commit)**: `Object.hasOwn(KEY_ACTIONS, key)` and `Object.hasOwn(POINTS, swipe.action)`; the score test now includes `{ action: 'constructor' }`. Mutations "keys read inherited names" and "score reads inherited keys" are caught.
- **Status**: Fixed.

---

## Failure #08: My first layout used `<div>` (rule 2.1), including inside a `<dl>`

- **Prompt**: row 5.
- **AI Code** (first draft): `<div className={styles.layout}>` around the deck and the side column in `SwipeDeck.jsx`, and a `<div>` per row inside the description list in `ScoreBoard.jsx` (the deck's own `ShowData` does this on slide 25).
- **Bug**: structure made of `<div>` is banned by rule 2.1; the `<div>` in a `<dl>` is valid HTML but does not follow the project rules.
- **DevTools Proof**: found by reading the files against the rules before the first run. Afterwards the guard was checked by breaking the code: the mutation "div soup" (`<div>` back in `ScoreBoard.jsx`) fails `sourceHygiene.test.js` › `no <div in src`. In Chrome, the three widths report `div: 0, span: 0` (`BROWSER_VERIFICATION.log`, section 8).
- **Engineering Fix**: the page is a CSS grid on `<main>` with named areas; the rows are keyed `<Fragment>` with `<dt>` and `<dd>`.
- **Status**: Fixed.

---

## Failure #09: The key hints would be read as "rightwards arrow", and axe could not measure them

- **Prompt**: rows 5 and 7.
- **AI Code** (first draft of `DeckControls.jsx`): `Like <kbd>→</kbd>` inside the button.
- **Bug**: the accessible name of the button became "Like rightwards arrow". axe-core also listed `color-contrast` as "needs manual review" for the three arrows (`Element content contains only non-text characters`).
- **DevTools Proof**: axe-core on the page with a card: 0 violations and `needs manual review: [color-contrast]`; the review nodes were the three `<kbd>` arrows.
- **Engineering Fix (commit `c53ec14`)**: the hints are `aria-hidden="true"` and each button has `aria-keyshortcuts` with the real key name. Test: `SwipeDeck.test.jsx` › `the key hints are hidden from screen readers and the same keys are declared with aria-keyshortcuts`. The review item remains in axe, because the glyphs are still visible; they inherit the colour of their button, so the ratio is that of the label next to them: 7.83:1 on the Like button and 16.55:1 on the others, computed from the tokens (see the notes at the end of `BROWSER_VERIFICATION.log`).
- **Status**: Fixed (the axe review item is explained, not removed).

---

## Failure #10: The first tests missed 4 real regressions (found by mutation runs)

- **Prompt**: row 8.
- **AI Code**: the survivors of the first run, each a one-line change of `src/`:
  1. `SwipeDeck.jsx`: delete `if (event.repeat) return;` (a held key).
  2. `SwipeCard.jsx`: ignore the `disabled` prop.
  3. `DeckControls.jsx`: call the handler even when the button is `aria-disabled`.
  4. `server/src/models.js`: delete `enum: ACTIONS` from the schema.
- **Bug**: 1 to 3 had the same cause: a second layer (the lock in `useDeck`, or the guards inside the handlers) hid the missing one. The lock stops a held key only while the first request is on its way; with a fast server the repeats arrive after the answer and would each swipe a card. Number 4 was hidden by the check in the route.
- **DevTools Proof**: the mutation scripts printed `SURVIVED` for these (client first run 5 survivors of 43, server 1 of 29).
- **Engineering Fix (commits `c53ec14`, `5b6fc2f`)**: `SwipeDeck.test.jsx` › `a held key stays one swipe even when the server answers fast`; `parts.test.jsx` (`SwipeCard` and `DeckControls` on their own); `server.test.js` › `the models themselves` (the enum, the unique index, the profile limits). Second run of the survivors: client 3 of 5 caught, server 29 of 29.
- **The 2 that remain are equivalent**, not holes: (a) "pop of empty throws" removes the early return of `pop` on an empty stack, but `slice(0, -1)` of an empty array is `[]` and `stack[-1]` is `undefined`, the same result; (b) "late success not ignored" removes the `aborted` check in the success branch, but a request that is aborted rejects, so that branch is never called after an abort, and a state update after unmount does nothing visible.
- **Status**: Fixed.

---

## Not verified

- **A real MongoDB server.** The tests and the browser run used `mongodb-memory-server` (a real `mongod`, in memory, local). MongoDB Atlas, replica sets, authentication and TLS were not tried; the connection string is only read from the environment.
- **One shared deck.** There are no users: every visitor sees and changes the same history. That is a decision of this homework, not something the slides ask for. Two tabs were tested (the stale tab is corrected by the server), two people were not.
- **A lock that drops input.** While one action is on its way, another key is ignored on purpose. On a slow network a fast player loses presses (they are not queued). The screen is not optimistic either: it changes after the answer. Slow 3G was not run for this page.
- **Screen readers.** NVDA, JAWS, VoiceOver and TalkBack were not used. "Accessible" here means: axe-core 0 violations on the deck with a card, after a swipe, and in the error state; every action has a labelled button; focus is kept on `aria-disabled` buttons. The end-of-deck state was also checked with axe (0 violations). Nothing was measured with a screen reader or at 200 % or 400 % zoom, and `prefers-reduced-motion` was not exercised (the page has no animation).
- **Touch on a real phone.** Touch was emulated with Chrome's DevTools protocol; the page did not scroll and the swipes were saved, but no physical device was used. Pointer events were not run in Safari or Firefox.
- **No swipe animation and no drag feedback.** The card does not follow the finger; the result of a swipe is shown by the next card and the live message.
- **No Lighthouse run** for this homework (the slides do not ask for one).
- **Not in the repository:** the Chrome check script and the mutation scripts. Only their output is kept.
