# AI_FAILURE_AUDIT.md — Lab 3 · Homework 2

> Defects in AI-generated code, checked against [project-rules.md](project-rules.md) and the Lab 3 deck (slides 27–28).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** after every prompt a `grep` check and a run in headless Chrome (Chrome DevTools Protocol, `puppeteer-core`) with real pointer and key events, instrumented audio, timers and render counts; the finished app was served from the production build and audited with Lighthouse 13.6.0, and its accessibility tree was read directly from Chrome. The numbers below are what those runs printed. Lines marked **TODO screenshot** still need a manual DevTools capture for submission.
> **Lighthouse Accessibility scored 100 on mobile and on desktop, with no failed audit.** Entries #01–#05 are real defects that Lighthouse does not detect.
> **Status:** Fixed = corrected in the code · Open = reproduced and covered by a test written as `it.fails` (it passes the suite while the defect exists and starts failing once the defect is fixed; then change `it.fails` to `it`). The suite is `npm test`: 10 files, 149 tests, 144 pass and 5 are these expected failures.

---

## Failure #01: A key whose voice was taken over keeps looking pressed

- **Prompt**: P2 — "A 9th note takes over the oldest sounding note (first in, first out)" and P12 — "Replaying makes the keys look pressed in time with the sound."
- **AI Code**:
  ```js
  // src/audio/polyphonicSynth.js: the oldest voice is stopped and forgotten
  const oldestMidi = voices.keys().next().value;
  release(voices.get(oldestMidi));
  voices.delete(oldestMidi);
  // src/components/GrandPiano.jsx: the pressed keys are its own state, set on key down and cleared on key up
  setPressedNotes((notes) => withNote(notes, midi));
  ```
- **Bug**: The synth and the component each keep their own idea of what is sounding, and the synth never tells the component that it took a voice over. With nine keys held, the first key's sound has stopped while the key still shows `aria-pressed="true"`, so what is shown and what is heard disagree.
- **DevTools Proof**: Production build in Chrome, nine keys (C3 … D4) held at once: oscillator 0 (C3, 130.81 Hz) has been stopped (`stops = 1`), and the key `C3` still has `aria-pressed="true"` (9 keys shown pressed, 8 voices sounding). Test: `GrandPiano.test.jsx` (`it.fails`: expects C3 not to be shown pressed). **TODO screenshot:** DevTools → Elements, the `C3` button after the nine presses.
- **Engineering Fix**: Proposed, not applied. Let the synth report voices it ended (an `onVoiceEnd(midi)` callback in `createPolyphonicSynth`) and clear that key from `pressedNotes` in `GrandPiano`.
- **Status**: Open.

---

## Failure #02: Focus is lost when the focused button becomes disabled

- **Prompt**: P10 — "A control is disabled when it makes no sense (for instance, play with nothing recorded)."
- **AI Code**:
  ```jsx
  // src/components/Transport.jsx
  <button type="button" disabled={busy} onClick={() => onRecord?.()}>Record</button>
  ```
- **Bug**: Pressing Record starts the recording, which disables Record itself while it has the focus. A keyboard or screen-reader user is left with no focused control at the moment of the action. The control that makes sense next, Stop, is a Tab press away.
- **DevTools Proof**: Chrome, Record focused, recording starts: `document.activeElement` goes from `BUTTON "Record"` to `BODY`; the next Tab lands on `Stop`. Test: `Transport.test.jsx` (`it.fails`): jsdom keeps the focus on the now-disabled button instead of dropping it to `<body>`, and the test checks that the focus is on a control that is not disabled, which fails either way. **TODO screenshot:** DevTools console showing `document.activeElement` after pressing Record.
- **Engineering Fix**: Proposed, not applied. Move the focus to the Stop button when the mode changes, or keep Record focusable with `aria-disabled="true"`:
  ```jsx
  useEffect(() => { if (mode !== 'idle') stopRef.current?.focus(); }, [mode]);
  ```
- **Status**: Open.

---

## Failure #03: The keyboard has 88 tab stops

- **Prompt**: P6 and P8 — "The keyboard can scroll sideways inside its own region, and that region is labelled and reachable with the keyboard."
- **AI Code**:
  ```jsx
  // src/components/PianoKey.jsx: every key is an ordinary button, so every key is a tab stop
  <button type="button" … aria-pressed={isPressed}>
  ```
- **Bug**: A keyboard user has to press Tab 88 times to get past the piano. A composite widget with many parts normally has one tab stop and moves between its parts with the arrow keys (a roving `tabindex`). The region is also reachable, but with the region focused the arrow keys scroll only 40 px per press and `End` does nothing, because the browser maps `Home`/`End` to vertical scrolling.
- **DevTools Proof**: Chrome: 89 tab stops on the piano (88 keys and the region), 92 enabled tab stops on the whole page in the idle state. Test: `Piano.test.jsx` expects at most one tab stop among the keys (`it.fails`: 88). **TODO screenshot:** DevTools → Accessibility, or a count of `button` elements with `tabindex` ≥ 0 inside the region.
- **Engineering Fix**: Proposed, not applied. `tabIndex={isActive ? 0 : -1}` on each key with one active key, arrow keys that move it (and scroll it into view), `Home`/`End` for the first and last key.
- **Status**: Open.

---

## Failure #04: Stop and the end of a replay release keys the user is holding

- **Prompt**: P12 — "Stop cancels the replay at once and silences the notes."
- **AI Code**:
  ```jsx
  // src/components/GrandPiano.jsx
  const silenceEverything = () => {
    synthRef.current?.stopAll();
    setPressedNotes(NO_NOTES);
  };
  ```
- **Bug**: The replay and the user play on the same synth and the same pressed-key state, but Stop (and the moment a replay finishes) clears all of it. A key the user is holding by hand is silenced and looks released while the finger is still down.
- **DevTools Proof**: Test `GrandPiano.test.jsx` (`it.fails`): the user holds A4 while a replay runs and presses Stop; the pressed keys are then `[]` instead of containing `A4`. **TODO screenshot:** none possible without a physical hold; reproduce with a held mouse button on a key while pressing Stop with the keyboard.
- **Engineering Fix**: Proposed, not applied. Release only the notes that the replay started: keep them in a set and call `endNote` for those, instead of `stopAll()` and an empty pressed set.
- **Status**: Open.

---

## Failure #05: A key rendered without a note name is a button with no name

- **Prompt**: P6 — "It exposes its pressed state to assistive tech, and its note name is its accessible name."
- **AI Code**:
  ```jsx
  // src/components/PianoKey.jsx
  const PianoKey = memo(function PianoKey({ midi, noteName = '', … }) {
  ```
- **Bug**: The default for `noteName` is an empty string, so a key rendered without its name has an empty accessible name. The piano always passes the name, so the app is not affected today, but the default hides a missing prop instead of exposing it.
- **DevTools Proof**: Accessibility tree of a key rendered with only `midi={60}`: `name: ""`. Test: `PianoKey.test.jsx` (`it.fails`): the text is `''`.
- **Engineering Fix**: Proposed, not applied. Default the name to something that is read out, such as `String(midi)`, or make `noteName` required.
- **Status**: Open.

---

## Failure #06: A focused white key was painted over the black keys

- **Prompt**: P7 — "Keyboard focus is clearly visible."
- **AI Code**:
  ```css
  /* src/components/PianoKey.module.css (first version) */
  .black { z-index: 1; }
  .key:focus-visible { z-index: 2; outline: 3px solid var(--color-focus); }
  ```
- **Bug**: The rule that lifts a focused key above its neighbours gave a focused white key a higher `z-index` than the black keys, so the white key covered the half of the neighbouring black keys that lies over it.
- **DevTools Proof**: `document.elementFromPoint` on the part of the black key C#4 that lies over the white key D4: nothing focused → `C#4`; D4 focused → `D4` (the black key was covered); C4 focused → `C4` at the point over C4. After the fix the point returns `C#4` in all three cases. **TODO screenshot:** the keyboard with a white key focused, before and after.
- **Engineering Fix (Commit `244f523`)**: Black keys above white keys even when a white key is focused.
  ```css
  .black { z-index: 2; }
  .white:focus-visible { z-index: 1; }
  .black:focus-visible { z-index: 3; }
  ```
- **Status**: Fixed. (CSS layering cannot be seen in jsdom, so no test covers it; the evidence is the probe above.)

---

## Summary

| # | Failure | Rule / requirement violated | Commit |
|---|---------|-----------------------------|--------|
| 01 | A key whose voice was taken over keeps looking pressed | P12: keys pressed in time with the sound | — (Open) |
| 02 | Focus is lost when the focused button becomes disabled | WCAG 2.4.3 focus order / keyboard use | — (Open) |
| 03 | The keyboard has 88 tab stops | P8: keyboard-reachable; composite widget pattern | — (Open) |
| 04 | Stop and the end of a replay release keys the user holds | P12: silence the notes (of the replay) | — (Open) |
| 05 | A key without a note name is an unnamed button | P6: note name is the accessible name | — (Open) |
| 06 | A focused white key was painted over the black keys | P7: focus clearly visible | `244f523` (Fixed) |
