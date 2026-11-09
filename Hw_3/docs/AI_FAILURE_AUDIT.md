# AI_FAILURE_AUDIT.md — Lab 3 · Homework 3

> Defects in AI-generated code (and in the deck's reference code), checked against [project-rules.md](project-rules.md) and the Lab 3 deck (slides 25 and 29–30).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** after every prompt a `grep` check, a Vitest run in jsdom with fake timers, and, from the first component on, a run in headless Chrome (`puppeteer-core`) with the real CSS and real pointer and key events; the finished page was served from the production build and audited with Lighthouse 13.6.0. The numbers below are what those runs printed. Entries marked **no jsdom test** are visual and were measured in Chrome only.
> **Lighthouse Accessibility scored 100 on mobile and 100 on desktop, with all 29 automated audits passing.** Entries #08, #09, #12 and #13 are defects that Lighthouse does not detect.
> **Status:** Fixed = corrected in the code before it was committed or in the commit named · Avoided = the deck's reference code has the defect and this project does not copy it · Open = reproduced and left in the code on purpose; the ones with a test are written as `it.fails` (it passes the suite while the defect exists and starts failing once it is fixed; then change `it.fails` to `it`).
> **Test suite:** `npm test` runs 12 files, 145 tests: 143 pass and 2 are those expected failures. **Do the tests catch real breakage?** 32 deliberate breakages of the source were made one at a time (a wrong operator, a removed guard, a removed cleanup, the original draft of a fixed bug put back): **31 were caught** by at least one test; the one that was not is an *equivalent* change (see the end of this file).

---

## Failure #01: An interval that never stops for a countdown that is already over

- **Prompt**: P5 — "The interval and the listener are removed on cleanup" and "It never goes below zero, and isLive is true when it reaches zero."
- **AI Code** (first draft of `src/hooks/usePubgAirdropTimer.js`):
  ```js
  const syncClock = () => {
    const now = Date.now();
    setNowMs(now);
    if (targetEpochMs - (now + offsetMs) <= 0) stopTicking(); // stops the interval...
  };
  syncClock();                                                // ...but it runs BEFORE the interval exists
  timerId = window.setInterval(syncClock, TICK_MS);           // so this one is created and never stopped
  ```
- **Bug**: For a target that is already in the past, `syncClock()` tries to stop an interval that has not been created yet (`timerId` is still `null`), so nothing is stopped, and the line after it creates an interval that ticks every 200 ms for ever. The countdown shows `00:00:00` correctly, so nothing looks wrong on the screen.
- **DevTools Proof**: Found by reading the draft before running it. Put back on purpose, the check `with a target in the past it is 0 and live, and never starts an interval` fails (`expect(set).not.toHaveBeenCalled()` on a spy of `window.setInterval` fails): in the mutation run this is the entry "timer: interval also starts for a target in the past (the first draft)" → 1 test failed. Test: `usePubgAirdropTimer.test.jsx`.
- **Engineering Fix (Commit `c886b83`)**: `syncClock` returns whether the target was reached, and the interval is only created when it was not:
  ```js
  if (!syncClock()) timerId = window.setInterval(syncClock, TICK_MS);
  ```
- **Status**: Fixed.

---

## Failure #02: A stuck lock when the server aborts a claim by itself

- **Prompt**: P8 — "An aborted request dispatches nothing and shows no error."
- **AI Code** (first draft of `src/hooks/useCrateClaims.js`):
  ```js
  (error) => {
    if (error?.name === 'AbortError') return;   // "the request was aborted, so do nothing"
    finish({ type: error?.status === 409 ? CLAIM_ACTIONS.CONFLICT : CLAIM_ACTIONS.FAILED });
  }
  ```
- **Bug**: The code decides "this was our own abort" from the error's name. An `AbortError` that this hook did **not** cause (a server or a proxy that gives up) returns early too, so no action is dispatched: the unit taken optimistically is never given back, the crate stays locked in `inFlight`, the button says `Claiming…` for ever and a retry is refused.
- **DevTools Proof**: Test `useCrateClaims.test.jsx` (`an AbortError that the hook did not cause is a failure, not a stuck lock`). With the early return put back it fails with `expected { Object (b) } to deeply equal {}`: `inFlight` still holds the claim of crate `b`.
- **Engineering Fix (Commit `f444bd0`)**: Ignore only what this hook itself aborted, by looking at its own signal (`if (controller.signal.aborted) return;` inside `finish`), and treat any other `AbortError` like any other failure.
- **Status**: Fixed. (The `controller.signal.aborted` line itself is covered by no test: after an unmount an extra dispatch into the unmounted hook has no visible effect in React 19. It stays for correctness.)

---

## Failure #03: A stronger selector silently left every number left-aligned

- **Prompt**: P15 — "Numbers are aligned."
- **AI Code** (first version of `src/components/Leaderboard.module.css`):
  ```css
  .table th, .table td { text-align: start; }   /* element + class: specificity 0,1,1 */
  .num { text-align: end; }                      /* one class: specificity 0,1,0 — loses */
  ```
  The same mistake made `.empty` (the "no squad matches" message) lose its centring and padding.
- **Bug**: The rule meant for numbers is weaker than the general rule for cells, so it never applies. Digits of different length ended on different edges. The same file did apply `text-align: end` to the header cells through a stronger selector, so header and numbers did not even line up.
- **DevTools Proof**: Chrome, computed style of a number cell: `text-align: start` (the script printed `cells: start tabular-nums nowrap | header: end`). My first alignment check compared the edges of the *cells*, which are always equal, and proved nothing; it was redone on the right edge of the text of each cell (`Range` boxes). After the fix: in each of the 4 numeric columns all rows share one right edge (distinct edges per column: 1, 1, 1, 1) at 375 and 1440 px; 1, 2 and 3 digits are 8.9, 17.8 and 26.7 px wide. **No jsdom test** (jsdom does not compute the cascade).
- **Engineering Fix (Commit `f235ba7`)**: `.table .num { text-align: end; … }` and `.table td.empty { … }`.
- **Status**: Fixed.

---

## Failure #04: A header word spilled into its neighbour

- **Prompt**: P15 — "A table that fits a phone."
- **AI Code**:
  ```css
  .table { table-layout: fixed; min-inline-size: 28rem; }
  .table th, .table td { padding: var(--space-sm); }  /* 8 px */
  .table th:first-child { inline-size: 34%; }
  ```
- **Bug**: With a fixed layout every numeric column is about 70 px wide. The header `Placement` is 68.7 px of text, and its cell had 53.9 px of room, so the word ran 14.8 px into the next header (`Kills`). A scroll region hides it on a phone until the table is scrolled; at 768 px it was fine, which is why it was easy to miss.
- **DevTools Proof**: Chrome, `Range` width of each header against the cell's content width: `Placement: text 68.7px in 53.9px of room (OVER by 14.8)` at 375 and 480 px. After the first fix (4 px padding and a 13 px header on phones) a sweep of 11 widths still found `Placement: text 68.7px in 66px of room (OVER by 2.7)` at exactly 640 px, where the padding grows again; after the second fix no width from 320 to 1440 px has a header wider than its room. **No jsdom test.**
- **Engineering Fix (Commit `f235ba7`)**: 4 px of horizontal padding and a 13 px header below 40rem, 8 px from 40rem and 16 px only from 64rem; first column 30 %.
- **Status**: Fixed.

---

## Failure #05: The notice reserved room for three lines, one short

- **Prompt**: P13 — "Nothing scrolls sideways at 375px" (and the page must not jump when the claim notice appears).
- **AI Code**:
  ```css
  .notice { min-block-size: calc(3 * 1.5em + 2 * var(--space-md) + 4px); }  /* room for 3 lines */
  ```
- **Bug**: The longest message (the 409 notice, 107 characters) needs 4 lines at 320 px. The box grew from 108 to 132 px when it appeared and pushed the whole list of cards 24 px down while the user was about to press a button.
- **DevTools Proof**: Chrome at 320 px: notice box `108 → 132 px`, list top `207 → 231 px`. The first fix counted lines from `scrollHeight`, which can never be smaller than the box and so reported "4 lines at 375 px" wrongly; the figures that settled it come from the height of the text itself (`Range`): lines needed / reserved, from 320 to 1440 px: 4/4 (320–350), 3/3 (360–414, which includes the 375 px of the brief), 2/2 (480–768), 1/2 (1024+), and the list top never moved at any width from 320 up. 280 px needs a 5th line; it is below the supported 375–1440 px range and was left. **No jsdom test.**
- **Engineering Fix (Commit `f235ba7`)**: reserve 4 lines by default, 3 from 22.5rem, 2 from 30rem.
- **Status**: Fixed.

---

## Failure #06: Sample data in which three of four sort keys gave the same order

- **Prompt**: P2 — "The numbers are invented sample data" and P4 — "Four sort keys: wins, placement points, kill points and total".
- **AI Code** (first numbers in `src/arena/arenaData.js`): wins `5, 3, 2, 1`, placement `142, 118, 96, 88`, kills `188, 201, 154, 132` for `te, ces, roy, agg`.
- **Bug**: Every squad that had more wins also had more placement points and a higher total, so sorting by wins, by placement and by total all produced `te, ces, roy, agg`; only the kill points differed. Three of the four sort choices could not be told apart, so a broken sort would have passed every manual check. My own log note for P2 said "each sort key gives a different order", which was false.
- **DevTools Proof**: the P4 check printed `wwcd te,ces,roy,agg | placement te,ces,roy,agg | kills ces,te,roy,agg | total te,ces,roy,agg`. After the change the four orders are `te,roy,ces,agg`, `te,agg,ces,roy`, `ces,te,roy,agg`, `te,ces,roy,agg`. Test: `arenaData.test.js` (`gives the four sort keys four different orders`) and `leaderboard.test.js`.
- **Engineering Fix (Commit `e80ac35`)**: new numbers for Cerberus, Roy and AGG; the log note of P2 was corrected.
- **Status**: Fixed.

---

## Failure #07: The deck's timer hook paints the old target's time first

- **Prompt**: P5 (the contract is the hook of slide 30, `usePubgAirdropTimer`).
- **Reference Code** (slide 30, copied into `usePubgAirdropTimer.test.jsx` unchanged):
  ```js
  const calcRemaining = () => Math.max(0, targetEpochMs - (Date.now() + serverOffsetMs));
  const [remainingMs, setRemainingMs] = useState(calcRemaining);        // computed once
  useEffect(() => { const syncClock = () => setRemainingMs(calcRemaining()); syncClock(); … },
            [targetEpochMs, serverOffsetMs]);                           // calcRemaining is used but not listed
  ```
- **Bug**: The remaining time is stored in state and only refreshed by the effect, which runs after the render. When the target changes, the first render still returns the **old** target's remaining time, and the effect corrects it one frame later. A countdown that moves to a new drop shows the wrong time (here 40 s too little) for a frame, and `isLive` can be wrong for that frame. The function used in the effect is also missing from the dependency list, against rule 8.6.
- **DevTools Proof**: Test `usePubgAirdropTimer.test.jsx` (`the frame right after the target changes`), target 10 s away changed to 50 s away: the slide's version renders `10000` first and `50000` after the effect; this project's hook renders `50000` in every frame (`new Set(seen)` is `{ 50000 }`).
- **Engineering Fix (Commit `c886b83`)**: keep only the last clock reading in state and derive the remaining time during render from the current target and offset; the effect only refreshes the reading.
- **Status**: Avoided (the deck's code was not copied).

---

## Failure #08: Two claims that end together, and only the last one is announced

- **Prompt**: P12 — "A notice area that announces politely: claimed, looted out (409, stock rolled back) or error."
- **AI Code**:
  ```jsx
  // src/hooks/useCrateClaims.js reducer: one notice for the whole arena, replaced by every answer
  notice: { kind: 'conflict', crateId }          // CLAIM_CONFLICT
  notice: { kind: 'ok', crateId }                // CLAIM_OK, a moment later, replaces it
  ```
- **Bug**: There is one notice for all crates. When two claims end at the same moment (a 409 for one crate and a success for another), React renders only the last message, so the polite live region reads `Claimed: PVS Gold Contraband Crate. 29 left.` and never says that the other claim was lost to another player. The card of the lost crate does change to `Looted out`, but a screen-reader user is not told where to look.
- **DevTools Proof**: Test `CrateArena.test.jsx` (`it.fails`): the G-Coin crate (409) and the gold crate (success) are clicked in the same moment and both answer at 600 ms; the card says `Looted out` but the notice is `Claimed: PVS Gold Contraband Crate. 29 left.`, so `expect(notice().textContent).toMatch(/Looted out/)` fails with `expected 'Claimed: PVS Gold Contraband Crate. 2…' to match /Looted out/`.
- **Engineering Fix**: Proposed, not applied. Keep a short list of recent results in the state (each with its crate id) and render them all in the same `<output>`, or one notice per card.
- **Status**: Open.

---

## Failure #09: A new list of crates is ignored

- **Prompt**: P8 — "Connect the reducer to the server."
- **AI Code**:
  ```js
  const [state, dispatch] = useReducer(claimReducer, crates, createInitialClaimState); // crates is read once
  ```
- **Bug**: The stock is built from `crates` when the hook mounts and never again. If a parent passes a different list later (for instance a page that reloads the drops), the hook keeps showing and checking the old crates; claims for a crate that is not in the old list are refused silently.
- **DevTools Proof**: Test `useCrateClaims.test.jsx` (`it.fails`): re-rendering with `[{ id: 'b', remainingStock: 7 }]` still gives `{ a: 1, b: 3, z: 0 }` (`expected { a: 1, b: 3, z: +0 } to deeply equal { b: 7 }`). The page passes a constant list, so the app is not affected today.
- **Engineering Fix**: Proposed, not applied. Re-create the hook's state when the list changes (give `CrateArena` a `key` made from the crate ids), or dispatch a reset action in an effect that depends on `crates`.
- **Status**: Open.

---

## Failure #10: The deck's `disabled` button loses the keyboard focus

- **Prompt**: P10 — "The button is disabled while claiming, when the stock is 0 and when the card is not open, and its label says why."
- **Reference pattern** (slide 11, `ActionButton`, and the wording of the prompt): `<button disabled={…}>`.
- **Bug**: The claim button becomes unavailable at the moment it is pressed (it turns into `Claiming…`). A button that gets the `disabled` attribute while it has the focus loses it, and the keyboard or screen-reader user is left with no focused control. This is the failure that Homework 2 recorded for the Record button.
- **DevTools Proof**: Headless Chrome, production CSS: pressing Enter on the open card's button left `document.activeElement` on `BUTTON` (label `Claiming…`); for comparison, setting a real `disabled` on a focused button moved it to `BODY` (`{"was":"BUTTON","afterRealDisabled":"BODY"}`). jsdom keeps the focus on a disabled button, so the Vitest checks read `aria-disabled` instead: with a real `disabled` 8 tests fail in the mutation run.
- **Engineering Fix (Commit `e824b65`)**: `aria-disabled="true"` plus a click guard instead of `disabled`; the button stays focusable, can be read ("dimmed"), and its label says why.
- **Status**: Avoided (a deliberate difference from the wording of the prompt, recorded in row 10 of the log).

---

## Failure #11: The deck's number box can never be emptied

- **Prompt**: P14 — "The minimum points use valueAsNumber and a number that is not valid means no minimum."
- **Reference Code** (slides 17 and 19):
  ```jsx
  onChange={(e) => setMinIq(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
  ```
- **Bug**: An empty or half-typed number box has `valueAsNumber` `NaN`; the deck turns that into `0` and stores it, so the controlled field shows `0` again at once. The user cannot clear the field to say "no minimum", and `0` is stored as a real minimum.
- **DevTools Proof**: A temporary test with the deck's component: after `fireEvent.change(box, { target: { value: '' } })` the box holds `"0"` (`SLIDE after clearing the number box, its value is: "0"`). This project's leaderboard keeps `null` for an empty or invalid number and shows an empty field again (`Leaderboard.test.jsx`, `reads the minimum with valueAsNumber…`).
- **Engineering Fix (Commit `f235ba7`)**: `setMinTotal(Number.isNaN(value) ? null : value)` and `value={minTotal ?? ''}`.
- **Status**: Avoided.

---

## Failure #12: Columns that are off screen, with nothing to say so

- **Prompt**: P15 — "The table scrolls sideways only inside its own labelled region."
- **AI Code**:
  ```css
  .table { table-layout: fixed; min-inline-size: 28rem; }   /* 448 px, wider than a phone */
  ```
- **Bug**: At 375 px the region shows `Squad`, `WWCD` and `Placement`; `Kills` and `Total` are 107 px off to the right, and nothing (no shadow at the edge, no arrow) tells the user that the table goes on. The page opens sorted by `Total`, which is one of the hidden columns, so the column that explains the order is out of sight.
- **DevTools Proof**: Chrome at 375 px: region 341 px wide, content 448 px (`scrolls INSIDE the region`); the screenshot shows the table cut after `Placement`. With the region focused `ArrowRight` scrolls 40 px per press (40, 80, 120 at 320 px). **No jsdom test.**
- **Engineering Fix**: Proposed, not applied. An edge shadow that appears while there is more to scroll, or fewer columns on phones (for example total only).
- **Status**: Open.

---

## Failure #13: A band of empty space and cards whose buttons sit 4 px apart

- **Prompt**: P13 (the notice band) and P11 (the card layout).
- **AI Code**:
  ```css
  .notice:empty { border-color: transparent; background: transparent; }  /* still has min-block-size */
  .card { display: grid; gap: var(--space-md); }                          /* content is not pushed to the bottom */
  ```
- **Bug**: (a) The notice keeps its height while it has no message, so an empty band of about 84 px sits between the arena heading and the cards at 1440 px; it is the price of a list that never jumps (entry #05). (b) The cards of a row are equally tall as boxes, but their content is not pushed to the bottom, so a card with a three-line title has its button 4 px lower than its neighbour (399 px against 395 px at 1440 px).
- **DevTools Proof**: Chrome at 1440 px, screenshot of the arena and the measured positions of the claim buttons. **No jsdom test.**
- **Engineering Fix**: Proposed, not applied. `grid-template-rows: auto 1fr auto` on `.card`; for the band, show the notice below the list on wide screens or reserve less on them.
- **Status**: Open.

---

## Summary

| # | Failure | Rule / requirement | Commit / test |
|---|---------|--------------------|---------------|
| 01 | An interval that never stops for a countdown that is already over | 8.2 cleanup of timers | `c886b83` (Fixed) |
| 02 | A stuck lock when the server aborts a claim by itself | 12.5, 12.7 aborts and rollback | `f444bd0` (Fixed) |
| 03 | A stronger selector left every number left-aligned | P15 numbers aligned | `f235ba7` (Fixed) |
| 04 | A header word spilled into its neighbour | P15 table fits a phone | `f235ba7` (Fixed) |
| 05 | The notice reserved room for three lines, one short | P13 no jump | `f235ba7` (Fixed) |
| 06 | Sample data with three identical sort orders | P4 four sort keys | `e80ac35` (Fixed) |
| 07 | The deck's timer hook paints the old target first | 7.4, 8.6 derived state, honest dependencies | `c886b83` (Avoided) |
| 08 | Two claims end together, only the last is announced | P12 announce every outcome | — (Open, `it.fails`) |
| 09 | A new list of crates is ignored | P8 | — (Open, `it.fails`) |
| 10 | The deck's `disabled` button loses the focus | WCAG 2.4.3, P10 | `e824b65` (Avoided) |
| 11 | The deck's number box can never be emptied | P14 valid number rule | `f235ba7` (Avoided) |
| 12 | Columns off screen with no cue | P15 / WCAG usability | — (Open, no test) |
| 13 | An empty band and buttons 4 px apart | P11, P13 | — (Open, no test) |

## The breakage that the tests did not catch

Of the 32 deliberate breakages, one survived: changing `.toSorted(` to `.sort(` in `selectStandings`. It is an *equivalent* change: `.sort(` is applied to the array that `.filter(` has just returned, which is already a copy, so the input array is still never changed and every behavioural test still passes. The change does break the project rule 7.2 (never `sort`), and that rule is checked by `grep` over `src/`, not by a test. In the same way `key={index}` instead of the squad id (Leaderboard) and the `controller.signal.aborted` line of entry #02 cannot be seen by a behavioural test.
