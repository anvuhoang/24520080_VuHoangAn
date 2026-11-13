# AI_FAILURE_AUDIT.md — Lab 4 · Exercise 1

> Defects in AI-generated code and in the deck's reference code, checked against [project-rules.md](project-rules.md) and the Lab 4 deck (slides 5, 13, 16, 22, 25–27, 29).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** after each batch a `grep` check, a Vitest run (jsdom, fake `fetch`, supertest for the API), and a run of the whole app in headless Chrome (`puppeteer-core`) with the Express server running. The numbers below are what those runs printed. Where the evidence is the deck's code, that code is copied unchanged into a test (`client/tests/deckReference.test.jsx`, `server/tests/deckReference.test.js`) so that anybody can run it.
> **Status:** Fixed = corrected before it was committed or in the commit named · Avoided = the deck's reference code has the defect and this project does not copy it · Open = reproduced and left in the code on purpose, written as `it.fails` (it passes the suite while the defect exists and starts failing once it is fixed; then change `it.fails` to `it`).
> **Test suite:** client `npm test` 13 files, 126 tests (124 pass, 2 expected failures); server `npm test` 2 files, 25 tests. Together **15 files, 151 tests: 149 pass and 2 are those expected failures.**
> **Do the tests catch real breakage?** 32 deliberate breakages of the source, one at a time: **29 were caught** by the first run; 1 real hole was found (NavLink style, in 3 components) and closed with tests, so **those are caught too**; the last 2 are *equivalent* changes (see the end of this file).

---

## Failure #01: Every error called `AbortError` is ignored, so the screen can stay on "Loading…" for ever

- **Prompt**: row 6 — "Only the hook's own abort is ignored; any other failure is shown."
- **AI Code** (first draft of `sprint3-forum/useForumMessages.js` and `MessageForm.jsx`):
  ```js
  (error) => {
    if (controller.signal.aborted || error?.name === 'AbortError') return;   // "an abort is not an error"
    setState({ forum, status: 'error', messages: [], error: error.message });
  }
  ```
- **Bug**: Whether a request was cancelled by this code is decided from the *name* of the error. An `AbortError` that this code did not cause (a proxy or a server that gives up, a browser that cancels) returns early too: nothing is dispatched, the hook stays at `loading`, and the message form stays at `Sending…` and refuses further sends. This is the same mistake as audit #02 of Homework 3.
- **DevTools Proof**: Vitest. With the draft put back, exactly one test fails in each file: `useForumMessages.test.jsx` › `treats an AbortError that this hook did not cause as a failure, not as "loading" for ever`, and `forumParts.test.jsx` › `shows a network failure, and an AbortError that did not come from this form is a failure too` (the button would stay `aria-disabled`). Mutation run: "useForumMessages: the first draft → 1 failing", "MessageForm: the first draft → 1 failing".
- **Engineering Fix (Commit `7557af2`)**: only the code's own signal decides: `if (controller.signal.aborted) return;`. The draft never reached a commit.
- **Status**: Fixed. (The same `aborted` line in the success branch cannot be seen from a test, see the end of this file.)

---

## Failure #02: A test about the skeleton that depended on the order of the tests

- **Prompt**: row 3 — "Write tests for the Sprint 1 components and routes."
- **AI Code** (first version of `App.test.jsx`): asserted that `/people/alan` shows the skeleton (`getByRole('region', { name: 'Loading dossier' })`) right after rendering the whole app.
- **Bug**: `React.lazy` remembers its module for the whole file. The first test that opens a person sees the skeleton; every later test finds the module already loaded and renders the card at once. The test passed or failed depending on which test ran before it.
- **DevTools Proof**: Vitest, 1 of 21 tests failed: `Unable to find an accessible element with the role "region" and name "Loading dossier"`.
- **Engineering Fix (Commit `183af87`)**: the skeleton is tested on its own and as the fallback of a lazy view whose loading the test finishes by hand (`DetailSkeleton.test.jsx`); `App.test.jsx` only expects the card to appear.
- **Status**: Fixed.

---

## Failure #03: The deck's `InputField` never passes the value to its `<input>`

- **Prompt**: row 4 (the contract is `InputField.jsx` of slide 25).
- **Reference Code** (slide 25, copied into `deckReference.test.jsx` unchanged):
  ```jsx
  export const InputField = ({ label, error, ...props }) => {
    const id = useId();
    …
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />   // `props` is never used
      {error && (<span id={errorId} role="alert">{error}</span>)}
    </div>
  ```
- **Bug**: `...props` is collected and never spread, so `name`, `type`, `value` and `onChange` never reach the `<input>`: it ignores the value it is given and can never report what is typed. It is also built from `<div>` and `<span>`, which project rule 2.1 forbids.
- **DevTools Proof**: Vitest `slide 25: InputField`: rendered with `name="email" type="email" value="a@b.co" onChange={spy}`, the input has no `name`, no `type`, an empty value, and typing calls `onChange` **0** times; the markup has `<div>` and `<span>`.
- **Engineering Fix (Commit `ad4d90a`)**: the field reads and writes through the Context (`values[name]`, `setValue`, `touch`), sets `name` and `type` itself, and uses `<p>`, `<label>`, `<input>`, `<small>`.
- **Status**: Avoided.

---

## Failure #04: The deck's hook says "not loading" and shows another channel's messages after a switch

- **Prompt**: row 6 (the contract is `useForumMessages.js` of slide 26).
- **Reference Code** (slide 26, fetching part, copied into `deckReference.test.jsx`):
  ```js
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);     // set to false once, never set to true again
  useEffect(() => { … fetch(`/api/forums/${forumId}/messages`, { signal }) … }, [forumId]);
  ```
- **Bug**: `loading` starts as `true` and is only ever set to `false`; `data` is never cleared. When the channel changes, for as long as the new request takes, the hook reports `loading: false` and still returns the **previous channel's** messages, so the user reads NASA's messages under the "Not NASA" tab. (It also logs errors with `console.error`, which rule 1 of this project forbids.)
- **DevTools Proof**: Vitest `slide 26: useForumMessages`: forum `nasa` answers `['from nasa']`; after switching to `notNasa`, while its request is in flight, the deck's hook returns `loading false` and `['from nasa']`. This project's hook, in the same situation, returns `status: 'loading'` and `messages: []` (also in the very first render after the switch; `useForumMessages.test.jsx`).
- **Engineering Fix (Commit `7557af2`)**: the state records which forum it belongs to; the value returned is empty and `loading` while the state belongs to another forum; a refresh of the same forum keeps what is on screen.
- **Status**: Avoided.

---

## Failure #05: The deck's Express handler lets the client choose the id and stores anything

- **Prompt**: row 5 (the contract is `server.js` of slide 27).
- **Reference Code** (slide 27, copied into `server/tests/deckReference.test.js`, a plain array standing in for `db`):
  ```js
  if (!req.body.text || !req.body.author) return res.status(400).json({ error: 'Missing required fields' });
  const newMessage = { id: crypto.randomUUID(), ...req.body, timestamp: new Date() };
  ```
- **Bug**: `...req.body` comes after `id`, so a client that sends `id` replaces the server's id (and every other field the client sends is stored). The check is only "not empty": a text of three spaces passes, a text of 5000 characters passes, and any forum name is accepted, including ones that do not exist. (The time cannot be forged: `timestamp` comes after the spread. I first thought it could; the test showed otherwise.)
- **DevTools Proof**: supertest. `POST /api/messages/nasa` with `{ author, text, id: 'hacked', timestamp: '1999-…' }` → `201` with `id: 'hacked'` and a real timestamp; `{ author, text, role: 'admin', payload: 'x'×500 }` → both stored; `{ author: ' ', text: '   ' }` → 201; a text of 5000 characters → 201; `/api/messages/does-not-exist` → 201. This project's server answers `id` of its own and no `role` for the first, `400` for the next two and `404` for the last (`deckReference.test.js`, `server.test.js`).
- **Engineering Fix (Commit `9c2ef4e`)**: only `pickMessageFields(body)` is taken (trimmed `author` and `text`); the rules are the shared `validateMessage` (40/280 characters, strings only); unknown forums answer `404` before the body is looked at; the id is `crypto.randomUUID()`.
- **Status**: Avoided.

---

## Failure #06: Three slides use three different addresses for the same API

- **Prompt**: rows 5 and 6 (contracts of slides 16, 26 and 27).
- **Reference Code**: slide 16 fetches `/api/channels/${channelId}/messages`; slide 26 fetches `/api/forums/${forumId}/messages`; slide 27 serves `GET /api/messages/:forum` and `POST /api/messages/:forum`.
- **Bug**: Built literally from the slides, the client and the server never meet: every request of the client is a `404`. A contract-first design (the deck's own manifesto: "Strict contract-first API design") needs the address written once.
- **DevTools Proof**: supertest against this project's API (`deckReference.test.js`): `GET /api/channels/nasa/messages` → 404, `GET /api/forums/nasa/messages` → 404, `GET /api/messages/nasa` → 200. The client's `fetchMessages` (one function, `forumApi.js`) builds the only address the server has; the headless Chrome run with the API running loads the messages from it.
- **Engineering Fix (Commit `9c2ef4e`)**: one address, `/api/messages/:forum`, in the contract of `TASK_DECOMPOSITION.md` and in `forumApi.js`.
- **Status**: Avoided.

---

## Failure #07: The deck's `PeopleLayout` and `PersonDetail` nest two `<main>` and end in a dead end

- **Prompt**: row 2 (the contract is slide 22).
- **Reference Code** (slide 22, copied into `deckReference.test.jsx`): the layout is `<div className="people-frame">` with a `<main className="content-area">` around the `<Outlet/>`; the detail view returns `<div role="alert">404: Person Not Found</div>`.
- **Bug**: A page that has its own `<main>` (here the app's) now has two main landmarks, so a screen-reader user cannot tell which is the page; the layout is built from `<div>` (rule 2.1); a person is shown with no heading; and the 404 is a bare `<div>` with no heading and no link, so the user has no way out.
- **DevTools Proof**: Vitest `slide 22`: inside a `<main>`, the deck's layout gives **2** elements with the role `main`, and `<div>`; a person has **0** headings; `/people/nobody` gives `DIV` with `404: Person Not Found` and no link back. This project: one `<main>`, headings `h1`/`h2`, an `<article>` per person, and a not-found alert with a heading and a link back (`PersonDetail.test.jsx`, `App.test.jsx`); in headless Chrome 0 `<div>`/`<span>` and 1 `<main>` on all four routes.
- **Engineering Fix (Commit `6b40c17`)**: `<section>`/`<nav>` for the layout, `<article>` with a heading for the person, and `NotFoundState` (`<section role="alert">` with a heading and a link).
- **Status**: Avoided.

---

## Failure #08: The tests did not notice the loss of the open link's style

- **Prompt**: row 9 ("break the source on purpose").
- **AI Code**: `className={({ isActive }) => (isActive ? \`${styles.link} ${styles.active}\` : styles.link)}` in `PeopleLayout`, `ChannelSwitcher` and `AppNav`.
- **Bug**: The tests checked `aria-current="page"`, which NavLink adds by itself. Replacing the callback by a plain `styles.link` removed the visible marking of the open item (thick edge, bold, fill) and every test still passed.
- **DevTools Proof**: mutation run: "PeopleLayout: no NavLink active state → 118 passed" (survived). After adding one test per component that the open link's class matches `/active/` and the others' do not, the same three breakages fail 1 test each.
- **Engineering Fix (Commit `TODO`, test commit)**: `PeopleLayout.test.jsx`, `forumParts.test.jsx` (`ChannelSwitcher`) and `appRoutes.test.jsx` (`AppNav`).
- **Status**: Fixed.

---

## Failure #09: The forum page offers the message form for a channel that does not exist

- **Prompt**: row 6.
- **AI Code**: `ForumPage.jsx` always renders `<MessageForm forum={channelId} …/>`, also when the channel's request has failed with `404`.
- **Bug**: At `/forum/nowhere` the page shows the error and a form. A user can fill it in and press Send, and the server can only answer `404`. The form should not be offered when the channel is not there.
- **DevTools Proof**: `ForumPage.test.jsx` (`it.fails`): at `/forum/nowhere` the alert is shown and the heading `Post a message` is still on the page. Headless Chrome: `/forum/nowhere` shows `Unknown forum: nowhere` and `Try again`.
- **Engineering Fix**: Proposed, not applied. Render the form only when the channel is one of `CHANNELS` (or when the status is not an error with `404`).
- **Status**: Open.

---

## Failure #10: After a valid submit the inspector goes on showing values that are no longer in the form

- **Prompt**: row 4.
- **AI Code**: `SimpleForm.jsx` keeps `submitted` and the line `The form is valid and was submitted.` until `Reset`.
- **Bug**: After a submit, editing a field leaves the inspector (`Submitted data`) and the message unchanged. The screen says "valid and submitted" next to a form whose values differ from the ones shown.
- **DevTools Proof**: `SimpleForm.test.jsx` (`it.fails`): submit a valid form, change `Full name` to `Grace Hopper`; the text `Ada Lovelace` is still on the page.
- **Engineering Fix**: Proposed, not applied. Clear `submitted` (and the status) when a field changes, or compare the current values with the submitted ones and show the inspector as "last submission".
- **Status**: Open.

---

## Failure #11: Leaving a wrong field moves the Submit button, and the click on it is lost

- **Prompt**: row 4 — "An error appears after the field was left or the form was submitted."
- **AI Code** (`sprint2-form/InputField.jsx` with its first stylesheet): the error line `<small role="alert">` is only rendered while there is an error, in a grid whose rows are all `auto`.
  ```css
  .field { display: grid; gap: var(--space-xs); }   /* the error row exists only when there is an error */
  ```
- **Bug**: A user types in a field and then clicks "Submit" with the mouse. Pressing the button first takes the focus away from the field, so the field's error line appears and pushes everything under it down; the button has moved away from the pointer before the mouse is released, no click is made, and nothing is submitted. The user has to click again. jsdom has no layout, so no unit test can see it.
- **DevTools Proof**: headless Chrome at 375 px, the form at `/form`: type `ada` in Email, focus Password (Email's error appears), click Submit with the mouse. Before: the Submit button went from y = 552 to y = 576 (**24 px**), the status line stayed empty and there were **2** alerts. After: y = 634 → 634 (**0 px**), status `4 fields need attention.` and **4** alerts. Leaving one wrong field moved the button by 24 px before and by 0 px after. (I first read the empty status and `alerts 2` as a normal result; it was found by comparing with the unit test, which expects 4.)
- **Engineering Fix (Commit `TODO`)**: the field is a grid of three rows (label, input, one line kept free for the error): `grid-template-rows: auto auto minmax(1.4em, auto)`.
  ```css
  .field { display: grid; grid-template-rows: auto auto minmax(1.4em, auto); gap: var(--space-xs); }
  ```
- **Status**: Fixed. (**No jsdom test**; the evidence is the Chrome measurement above.)

---

## Summary

| # | Failure | Rule / requirement | Commit / test |
|---|---------|--------------------|---------------|
| 01 | Any error called `AbortError` is ignored: stuck loading | 14.1, Homework 3 audit #02 | `7557af2` (Fixed) |
| 02 | A skeleton test that depended on the order of the tests | 12.3 | `183af87` (Fixed) |
| 03 | Deck `InputField` never passes the value to the input | 13.3, 2.1 | `ad4d90a` (Avoided) |
| 04 | Deck hook says "not loading" with another channel's messages | 14.1 | `7557af2` (Avoided) |
| 05 | Deck Express handler: client chooses the id, anything is stored | 14.3, 14.4 | `9c2ef4e` (Avoided) |
| 06 | Three slides, three addresses for one API | contract first | `9c2ef4e` (Avoided) |
| 07 | Deck layout: two `<main>`, `<div>`s, a dead-end 404 | 2.1, 2.4, 12.2 | `6b40c17` (Avoided) |
| 08 | No test noticed the loss of the open link's style | tests must be able to fail | `TODO` (Fixed) |
| 09 | The message form is offered for a channel that does not exist | UX / contract | — (Open, `it.fails`) |
| 10 | The inspector keeps old values after an edit | UX | — (Open, `it.fails`) |
| 11 | Leaving a wrong field moves Submit and the click is lost | layout stability | `TODO` (Fixed) |

## The breakages that the tests did not catch, and what has not been verified

**Two equivalent changes.** In `useForumMessages` (a) keeping the previous forum's messages in the state when the forum changes and (b) accepting the answer of an old request leave every test green, because the hook protects itself twice: the state records which forum it belongs to, and the value returned is empty while the state belongs to another forum. Removing one layer cannot be seen from outside; both stay for correctness. (In a browser an aborted request rejects, so the `aborted` check of the success branch only matters for an answer that arrives in the very microtask of the abort.)

**Not verified (do not claim these):**
- No Lighthouse run for Lab 4 yet; no screenshots.
- The Slow 3G profile of DevTools was not used: slow answers were made by holding one request for 1.5 s with request interception, which shows the same cancellation (`net::ERR_ABORTED`).
- Only Chrome was used. The data of the API is in memory and is lost when the server stops; the MongoDB/Mongoose 8 part belongs to the homework.
