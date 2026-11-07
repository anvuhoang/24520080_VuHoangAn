# AI_FAILURE_AUDIT.md — Lab 3 · Homework 1

> Defects in AI-generated code, checked against [project-rules.md](project-rules.md) and the Lab 3 deck (slide 26).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** every prompt was followed by a `grep` check and a run in headless Chrome (Chrome DevTools Protocol, `puppeteer-core`); the finished app was served from the production build and audited with Lighthouse 13.6.0; the accessibility tree was read directly from Chrome. The numbers below are what those runs printed. Lines marked **TODO screenshot** still need a manual DevTools capture for submission.
> **Lighthouse Accessibility scored 100 on mobile and on desktop, with no failed audit.** Entries #01–#05 are real defects that Lighthouse does not detect; they were found by using the app and reading the accessibility tree.
> **Status:** Fixed = corrected in the code · Open = reproduced and covered by a test written as `it.fails` (it passes the suite while the defect exists and starts failing once the defect is fixed; then change `it.fails` to `it`).

---

## Failure #01: Pad keys stop working while the checkbox has focus

- **Prompt**: P2 — "Stay out of the way while the user types in a form field." Seen in P11 — "A checkbox turns the keyboard shortcuts off (WCAG 2.1.4)."
- **AI Code**:
  ```js
  // src/hooks/useDrumKeyboard.js
  const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
  const isFormField = (target) =>
    target instanceof HTMLElement && (FORM_TAGS.has(target.tagName) || target.isContentEditable);
  // …in handleKeyDown: if (isFormField(event.target)) return;
  ```
- **Bug**: The hook ignores every `<input>`, including a checkbox, although only fields where text is typed should block the pads. After a user ticks the "Enable keyboard shortcuts" checkbox, focus stays on it, so `W A S D J K L` do nothing until they click or Tab somewhere else. This is the control that exists to satisfy WCAG 2.1.4, and the keyboard user who toggles it with `Space` is the one who gets stuck. The hook passed all of its own checks; the defect only appears with the checkbox next to it.
- **DevTools Proof**: Chrome, real key events. Focus on the checkbox, `W` pressed: hits **1 → 1** (nothing played). Focus on a pad button: **2 → 3**. Focus in the text field: **3 → 3** (correct). Same result in the finished app (hits 4 → 4). Tests: `useDrumKeyboard.test.jsx` and `DrumKit.test.jsx`, both `it.fails`. **TODO screenshot:** the session log in the page after pressing `W` with the checkbox focused.
- **Engineering Fix**: Proposed, not applied. Block only text entry:
  ```js
  const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
  const isTextEntry = (el) =>
    el instanceof HTMLElement &&
    ((el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(el.type)) ||
      el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  ```
- **Status**: Open.

---

## Failure #02: The level meter is announced to screen readers on every change

- **Prompt**: P9 — "The value is also shown as text."
- **AI Code**:
  ```jsx
  // src/components/LevelMeter.jsx
  <output className={styles.value} htmlFor={meterId}>{percent}%</output>
  ```
- **Bug**: An `<output>` is a live region by default (role `status`, `aria-live="polite"`). The meter decays about every 90 ms after each hit, so a screen reader is told "75%… 45%… 27%…" in a stream, which buries the one announcement that matters (the latest hit in the log). The prompt asked for the value as text, not for it to be announced.
- **DevTools Proof**: Accessibility tree of the finished app: two nodes with role `status`, both `live: polite`, `atomic: true`. The DOM shows `aria-live` only on the hit log's `<output>`, so the meter's is implicit. One hit changed the meter's text **9 times** (75% → 0%) against **2** for the hit log. Test: `LevelMeter.test.jsx` (`it.fails`). **TODO screenshot:** DevTools → Accessibility, the two `status` nodes.
- **Engineering Fix**: Proposed, not applied. Keep the text, stop the announcements:
  ```jsx
  <output className={styles.value} htmlFor={meterId} aria-live="off">{percent}%</output>
  ```
- **Status**: Open.

---

## Failure #03: The pad's accessible name runs the key into the label ("ASnare")

- **Prompt**: P5 — "One pad as a list item with a button that shows its key and its name … Its visible text is its accessible name."
- **AI Code**:
  ```jsx
  // src/components/DrumPad.jsx
  <kbd className={styles.key}>{keyLabel}</kbd>
  <strong className={styles.label}>{label}</strong>
  ```
- **Bug**: The two elements are adjacent with no text between them, so the accessible name is the two strings joined. CSS later puts a gap between them on screen, but the accessible name does not follow the layout.
- **DevTools Proof**: Accessibility tree: `button name = "ASnare"`, `"ZNo handler"` (and every pad: `WTom high`, `SKick` …). Test: `DrumPad.test.jsx` expects `A Snare` (`it.fails`). **TODO screenshot:** DevTools → Accessibility on one pad.
- **Engineering Fix**: Proposed, not applied. Put a space between them:
  ```jsx
  <kbd className={styles.key}>{keyLabel}</kbd>{' '}
  <strong className={styles.label}>{label}</strong>
  ```
- **Status**: Open.

---

## Failure #04: `play()` reports a level that the sound does not reach

- **Prompt**: P3 — "play() reports how loud the hit was, so the UI can show a meter."
- **AI Code**:
  ```js
  // src/audio/drumKit.js
  const MASTER_GAIN = 0.8;
  const VOICES = { kick: { peak: 1, … }, snare: { peak: 0.75, … }, … };
  // play(): return voice.peak;
  ```
- **Bug**: It returns the voice's nominal `peak` and ignores the 0.8 master gain and the way the layers add up, so the meter does not show what is played. The snare, reported quieter than the kick, is actually louder.
- **DevTools Proof**: Offline render of each voice at 48 kHz, largest sample against what `play()` reported: kick **0.78** vs 1.00; snare **0.86** vs 0.75; hi-hat closed 0.45 vs 0.40; hi-hat open 0.33 vs 0.35; tom high 0.61 vs 0.80; tom low 0.66 vs 0.85; crash 0.59 vs 0.50. Test: `drumKit.test.js` expects 0.8 for the kick (`it.fails`: it gets 1).
- **Engineering Fix**: Proposed, not applied. Report the level that is produced, for instance `Math.min(1, sum of layer levels) * MASTER_GAIN`, or measure it with an `AnalyserNode`. A formula is only approximate for layered voices such as the snare.
- **Status**: Open.

---

## Failure #05: The page title and the kit's heading say the same thing

- **Prompt**: P11 — the kit's `<h2>` copied the contract's text "Studio Drum Kit"; P14 — the page `<h1>` is also "Studio Drum Kit".
- **AI Code**:
  ```jsx
  // src/App.jsx:      <h1 className={styles.title}>Studio Drum Kit</h1>
  // src/components/DrumKit.jsx:  <h2 …>Studio Drum Kit</h2>
  ```
- **Bug**: A screen-reader user moving by headings hears the same heading twice in a row. The heading levels are correct (h1, h2, h2), the content is not useful.
- **DevTools Proof**: Headings of the finished page: `H1: Studio Drum Kit`, `H2: Studio Drum Kit`, `H2: Hit log`. Test: `App.test.jsx` (`it.fails`: 2 distinct texts for 3 headings).
- **Engineering Fix**: Proposed, not applied. Give the kit's heading its own meaning, for instance `Pads and settings`.
- **Status**: Open.

---

## Failure #06: A CSS token that does not exist, silently ignored

- **Prompt**: P10 — "Style the level meter … uses tokens only."
- **AI Code**:
  ```css
  /* src/components/LevelMeter.module.css (first version) */
  .meter { background: var(--color-field); }
  ```
- **Bug**: `--color-field` is not defined in `src/index.css` (the token there is `--color-bg-deep`). An undefined `var()` makes the declaration invalid, so the browser used no background and nobody got a warning: the build passed.
- **DevTools Proof**: Computed style of the meter in Chrome before the fix: `background-color: rgba(0, 0, 0, 0)`. After: `rgb(11, 17, 32)`. A script comparing every `var(--…)` in all `.module.css` files with the tokens in `index.css` then listed no other undefined token.
- **Engineering Fix (Commit `15c385c`)**: Used the defined token in both places.
  ```css
  .meter { background: var(--color-bg-deep); }
  .meter::-webkit-meter-bar { background: var(--color-bg-deep); }
  ```
- **Status**: Fixed.

---

## Failure #07: The log's card changes height when the first hit arrives

- **Prompt**: P8 — "The card keeps a steady height while hits arrive."
- **AI Code**:
  ```css
  /* src/components/HitLog.module.css (first version) */
  .history { gap: var(--space-xs); min-block-size: 18rem; } /* 8 rows × 2.25rem */
  ```
- **Bug**: The reserved height counted the 8 rows but not the 7 gaps between them, so the list grew by 28 px as soon as rows appeared. That is exactly the layout jump the prompt asked to prevent.
- **DevTools Proof**: Chrome at 375px, card height: empty **378 px** → 8 hits **406 px** (+28). After the fix: 406 → 406 → 406 (empty, 8 hits, 20 hits with the cap).
- **Engineering Fix (Commit `15c385c`)**: Count the gaps in the minimum height.
  ```css
  .history { min-block-size: calc(8 * 2.25rem + 7 * var(--space-xs)); }
  ```
- **Status**: Fixed.

---

## Summary

| # | Failure | Rule / requirement violated | Commit |
|---|---------|-----------------------------|--------|
| 01 | Pad keys stop working while the checkbox has focus | WCAG 2.1.4 control must be usable; P2 "typing" scope | — (Open) |
| 02 | Level meter announced to screen readers on every change | P9 / WCAG 4.1.3 status messages (noise) | — (Open) |
| 03 | Pad accessible name "ASnare" | P5 "visible text is its accessible name" | — (Open) |
| 04 | `play()` reports a level the sound does not reach | P3 "reports how loud the hit was" | — (Open) |
| 05 | Page `<h1>` and kit `<h2>` have the same text | Heading usefulness | — (Open) |
| 06 | A CSS token that does not exist, silently ignored | P10 "tokens only", Rule 9.2 | `15c385c` (Fixed) |
| 07 | Log card changes height when the first hit arrives | P8 "steady height" | `15c385c` (Fixed) |
