# AI_FAILURE_AUDIT.md — Lab 3 · Bonus Exercise

> Defects in AI-generated code (and in the deck's reference code), checked against [project-rules.md](project-rules.md) and the Lab 3 deck (slides 31–32).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** after every prompt a `grep` check, a Vitest run in jsdom with fake timers and monotonic clocks, and runs in headless Chrome (`puppeteer-core`) across 8 viewports (320px–1920px) with real CSS and events.
> **Status:** Fixed = corrected in the code before it was committed or in the commit named · Avoided = the deck's reference code has the defect and this project does not copy it · Open = reproduced and left in the code on purpose (written as `it.fails`).
> **Test suite:** `npm test` runs 8 flat files, 37 tests: **36 pass and 1 is an expected failure (`it.fails`)**.
> **Do the tests catch real breakage?** 8 deliberate breakages of the source were made one at a time (wrong comparison operator, removed abort guard, cancelled timer tick regression, broken status role): **all 8 were caught** by the test suite.

---

## Failure #01: Cancelled message still fires ghosting callback when interval expires

- **Prompt**: P5 — "Creates an internal AbortController associated with the message; provides a cancelMessage() callback that aborts the controller and cleans up."
- **AI Code** (first draft of `src/hooks/useGhostingTimer.js`):
  ```js
  const cancelMessage = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setRemainingMs(0);
  }, []);
  ```
- **Bug**: `cancelMessage()` aborted the `AbortController` and set `remainingMs` to 0, but the `window.setInterval` created in `useEffect` continued ticking in the background. When simulated time reached 5000ms, `computeRemaining()` reached 0, and `syncTick` invoked `onGhosted(messageId)` even though the user had explicitly aborted the message.
- **DevTools Proof**: Tested in Vitest jsdom with fake timers (`vi.useFakeTimers()`). Calling `cancelMessage()` followed by `vi.advanceTimersByTime(5000)` failed with:
  `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times: Array [ "m-1" ]`.
- **Engineering Fix (Commit `e31f31b`)**: Introduced `isCancelledRef` tracking cancellation state. When `cancelMessage` is invoked, `isCancelledRef.current = true;`. In `syncTick`, if `isCancelledRef.current` is true, the tick exits immediately and `onGhosted` is prevented from firing.
- **Status**: Fixed.

---

## Failure #02: Storing derived Red Flag status in duplicate `useEffect` / `useState`

- **Prompt**: P2 / P9 — "Pure functions for calculating asymmetric effort and derived red-flag state."
- **Deck Anti-Pattern** (slide 31–32 reference code pattern):
  ```js
  const [isRedFlag, setIsRedFlag] = useState(false);
  useEffect(() => {
    setIsRedFlag(myTries * 0.1 < rivalTries * 50.0);
  }, [myTries, rivalTries]);
  ```
- **Bug**: Storing state that can be derived synchronously from existing inputs causes an unnecessary extra render pass, causes stale frame desynchronization between inputs and live announcements within the same tick, and introduces race conditions during fast typing or automated state updates.
- **DevTools Proof**: Measured in jsdom. When user modifies `myTries` or `rivalTries`, reading derived state synchronously inside render returns the mathematically exact impact and red flag state on the very same frame, eliminating intermediate out-of-sync frames.
- **Engineering Fix (Commit `38cc5ec`)**: State derivation is computed synchronously during render using pure function `calculateEffortDerived({ myTries, rivalTries, phase })` in `src/situationship/effortMetrics.js`. Zero `useEffect` or redundant `useState`.
- **Status**: Avoided.

---

## Failure #03: Unreciprocated commitment permitted without bilateral effort balance

- **Prompt**: P3 — "Pure FSM reducer enforcing valid transitions and immutable state updates."
- **Code** (`src/situationship/situationshipReducer.js`):
  ```js
  case ACTION_TYPES.TRANSITION_PHASE: {
    const { phase: targetPhase } = action.payload;
    if (!VALID_TRANSITIONS[state.phase]?.includes(targetPhase)) {
      return state;
    }
    return { ...state, phase: targetPhase, lastActionNotice: `Chuyển sang trạng thái: ${targetPhase}` };
  }
  ```
- **Bug**: The state machine defined in slide 31–32 allows transitioning from `DATING_NO_LOVE` directly to `COMMITTED` without checking whether effort asymmetry exists (`myImpact < rivalImpact`). A user can trigger a `COMMITTED` transition even when they put in 100 efforts and the other party puts in only 1 effort (5x asymmetry ratio).
- **DevTools Proof**: Verified in `tests/situationshipReducer.test.js` using `it.fails`:
  ```js
  it.fails('rejects COMMITTED transition when asymmetric red flag is active', () => {
    const redFlagState = {
      ...INITIAL_STATE,
      phase: RELATIONSHIP_PHASES.DATING_NO_LOVE,
      myTries: 100,
      rivalTries: 1,
    };
    const next = situationshipReducer(redFlagState, {
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { phase: RELATIONSHIP_PHASES.COMMITTED },
    });
    expect(next.phase).toBe(RELATIONSHIP_PHASES.DATING_NO_LOVE);
  });
  ```
  Switching `it.fails` to `it` fails with `AssertionError: expected "COMMITTED" to be "DATING_NO_LOVE"`.
- **Status**: Open (documented and reproduced via `it.fails`).

---

## Failure #04: Control border contrast below WCAG 3:1 non-text threshold on dark canvas

- **Prompt**: P6 — "Every text/background contrast must meet WCAG 2.2 AA (>= 4.5:1) and borders >= 3:1."
- **AI Code** (first draft of `src/index.css`):
  ```css
  --color-border: #475569; /* Slate 600 */
  ```
- **Bug**: Relative luminance calculation of `#475569` against canvas background `#0b0f19` yields 2.53:1. This violates WCAG 2.2 Success Criterion 1.4.11 Non-text Contrast, which requires a minimum of 3:1 for user interface component boundaries.
- **DevTools Proof**: Computed via WCAG 2.2 relative luminance script in Node:
  `#475569 on #0b0f19: contrast = 2.53:1 (FAILED, expected >= 3.0:1)`.
- **Engineering Fix (Commit `f0ca569`)**: Adjusted token to `--color-border: #64748b` (Slate 500). Yields 3.11:1 against `#0b0f19`, 3.65:1 against surface `#131b2e`, and 4.02:1 against surface raised `#1e293b`.
- **Status**: Fixed.

---

## Failure #05: Duplicate ARIA live region conflict between phase badge and alert announcement

- **Prompt**: P9 — "Red-flag warning rendered inside <output role="status" aria-live="polite">."
- **AI Code** (first draft of `src/components/SituationshipAnalyzer.jsx`):
  ```jsx
  <p role="status" className={styles.badge}>{phase}</p>
  ...
  <output role="status" aria-live="polite" className={styles.alert}>
    {derived.alertMessage}
  </output>
  ```
- **Bug**: Assigning `role="status"` to both the badge and the output alert created multiple competing live regions on the page. In Testing Library queries (`screen.getByRole('status')`), this threw `TestingLibraryElementError: Found multiple elements with the role "status"`. On screen readers, multiple competing live regions trigger duplicate vocalizations.
- **DevTools Proof**: Vitest run threw: `Found multiple elements with the role "status"`.
- **Engineering Fix (Commit `d5071e0`)**: Removed `role="status"` from the phase badge `<p>`, reserving `role="status"` and `aria-live="polite"` strictly for the single dedicated announcement `<output>` element.
- **Status**: Fixed.

---

## Mutation Check: Deliberate Breakages Tested

8 deliberate code breakages were injected one at a time and tested against `npm test`:

| # | Breakage Injected | File | Result Caught |
|---|-------------------|------|---------------|
| 1 | Changed `<` to `>` in `myImpact < rivalImpact` | `src/situationship/effortMetrics.js` | 4 tests failed in `effortMetrics.test.js` and `SituationshipAnalyzer.test.jsx` |
| 2 | Allowed `GHOSTED_EXIT` to transition directly to `COMMITTED` | `src/situationship/situationshipReducer.js` | 1 test failed in `situationshipReducer.test.js` |
| 3 | Removed `isCancelledRef` check in `syncTick` (restored Failure #01) | `src/hooks/useGhostingTimer.js` | 1 test failed in `useGhostingTimer.test.jsx` |
| 4 | Removed `role="status"` from `<output>` | `src/components/SituationshipAnalyzer.jsx` | 2 tests failed in `SituationshipAnalyzer.test.jsx` |
| 5 | Changed abort exception from `AbortError` to generic `Error` | `src/situationship/messageService.js` | 2 tests failed in `messageService.test.js` |
| 6 | Removed `e.target.valueAsNumber` fallback in input change | `src/components/EffortCard.jsx` | 1 test failed in `EffortCard.test.jsx` |
| 7 | Removed `INITIAL_STATE` deep freeze | `src/situationship/constants.js` | 1 test failed in `constants.test.js` |
| 8 | Changed single `<main>` to nested `<section>` | `src/App.jsx` | 1 test failed in `App.test.jsx` |
