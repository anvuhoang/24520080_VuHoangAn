# AI_FAILURE_AUDIT.md — Lab 4 · Homework 1 (Evidence Gallery)

> Defects in AI-generated code and in the deck's reference code (slide 30), checked against [project-rules.md](project-rules.md) and the Lab 4 deck (slides 19, 28, 29, 30).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** Vitest (jsdom, real `react-router` with `MemoryRouter`), a script in real Chrome 157 (`puppeteer-core`, log in [BROWSER_VERIFICATION.log](BROWSER_VERIFICATION.log)) on the dev server with React Strict Mode and on the production build, axe-core on five pages, Lighthouse 13.6.0 ([LIGHTHOUSE.md](LIGHTHOUSE.md)), and a mutation run.
> **Status:** Fixed = corrected before it was committed · Avoided = the deck's code has the defect and this project does not copy it.
> **Test suite:** `npm test` 6 files, **81 tests, all passing**. `npm run build` passes.
> **Do the tests catch real breakage?** 31 deliberate breakages of `src/`, one at a time: first run **27 caught, 4 survived**. One survivor was a wrong mutant of mine; three were real holes. After 3 tests were added and the wrong mutant was replaced: **31 of 31 caught** (entry #06).

---

## Failure #01: Closing the lightbox throws away the category filter and adds a history entry

- **Prompt**: row 7 — "Run the slide 30 code as written in real Chrome with Strict Mode."
- **AI Code** (deck, slide 30, step 5):
  ```jsx
  <dialog ref={dialogRef} onClose={() => setSearchParams({})}>
  ```
- **Bug**: `setSearchParams({})` replaces the whole query string, so the filter goes with the photo. It also pushes a new history entry for every close.
- **DevTools Proof**: Chrome 157, the slide code in a scratch page with Strict Mode, opened at `?category=chat&photoId=1` and closed with the Close button: the URL lost its whole query string (it became the bare page path) and `history.length` went from 2 to 3. A user who filtered by Chat sees "All" again. Test: `deckReference.test.jsx` › `loses the category filter when the lightbox is closed`.
- **Engineering Fix**: close removes only `photoId` and replaces the entry (`PhotoGalleryLayout.jsx`, `closeLightbox`). Tests: `PhotoGalleryLayout.test.jsx` › `the Close button closes the dialog and removes only photoId`, `closing replaces the history entry instead of adding one`, and `sourceHygiene.test.js` › `no setSearchParams({}) in src`. Mutation "close drops every parameter" and "close pushes an entry" are both caught.
- **Status**: Avoided.

---

## Failure #02: With the slide code, Back from an open photo writes to the URL again and loses the filter

- **Prompt**: row 7.
- **AI Code** (deck, slide 30, steps 4 and 5):
  ```jsx
  useEffect(() => {
    if (selectedPhotoId) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selectedPhotoId]);
  // ...
  <dialog ref={dialogRef} onClose={() => setSearchParams({})}>
  ```
- **Bug**: the dialog is driven by the URL (effect) and the URL is driven by the dialog (`onClose`). When the user presses Back, the URL loses `photoId`, the effect calls `close()`, and the `close` event then writes to the URL again. Nothing here is the user closing the dialog, but the code treats it as one.
- **DevTools Proof**: Chrome 157, Strict Mode. Open `?category=chat` → click a photo → press Back. The URL ends as the bare page path (not `?category=chat`), the log shows `onClose` ran with `?category=chat`, and Forward no longer reopens the photo (the forward entry was replaced by the late write). Test: `deckReference.test.jsx` › `Back to the grid still writes to the URL`.
- **Engineering Fix**: no effect. The dialog opens from a ref callback with a stable identity (module-level `openModal`), closes when it leaves the page, and `onClose` is ignored when the dialog is open again (`Lightbox.jsx`). Chrome, same steps, on the dev server and on the build: Back gives `?category=match`, Forward opens the photo again, and 3 arrow presses add 0 history entries (`BROWSER_VERIFICATION.log`, section 5). Tests: `the Back button closes the lightbox and does not leave a stale dialog or push a new entry`, `closes the native dialog when it leaves the page`, `Strict Mode … does not close the lightbox through the URL`. Mutations "close guard removed", "ref callback unstable" and "no close on unmount" are caught.
- **Status**: Avoided.

---

## Failure #03: My own claim that `showModal()` throws on an open dialog was wrong

- **Prompt**: rows 1 and 4.
- **AI Code** (my first comment in `Lightbox.jsx` and my first `tests/setup.js`):
  ```js
  // showModal() throws on an open one
  if (this.hasAttribute('open')) throw new DOMException('The dialog is already open.', 'InvalidStateError');
  ```
- **Bug**: not a bug in the app but a false statement that shaped a test double. In Chrome 157 the slide's effect runs twice in Strict Mode and calls `showModal()` on a dialog that is already modal; nothing is thrown and the dialog stays open and modal.
- **DevTools Proof**: Chrome 157, the slide code in Strict Mode, opened at `?category=chat&photoId=1`: `open: true`, `modal: true`, no page error, no console message (`pageerror` and `console` listeners were attached).
- **Engineering Fix**: the stand-in in `tests/setup.js` now does nothing on a dialog that is already open, as measured, and the comment in `Lightbox.jsx` says what is true: a repeated `showModal()` on a modal dialog is a no-op, and it throws only on a dialog opened without `showModal()`. The `if (!dialog.open)` check stays because it is harmless. What matters for Strict Mode is the **close event** after the ref is detached and attached again, which entry #02 covers.
- **Status**: Fixed.

---

## Failure #04: First draft broke three project rules (found by reading, before any test)

- **Prompt**: rows 3 and 4.
- **AI Code** (first draft):
  ```jsx
  <span className={styles.title}>{photo.title}</span>       // PhotoGrid.jsx — rule 2.1 (no span)
  <img … decoding="async" />                                // no onError — rule 10.4
  .dialog::backdrop { background: rgb(4 8 16 / 0.85); }     // hard-coded colour — rule 9.4
  ```
- **Bug**: `<span>` instead of a semantic element; a broken image would show a broken-image icon and no fallback; a colour that does not come from the tokens.
- **DevTools Proof**: grep of the files against `project-rules.md` before the first test run. Afterwards the guards were added and checked by breaking the code: "div soup" (`<div>` back in the caption), "hardcoded colour in a module" and "no onError in grid" each fail a test in `sourceHygiene.test.js`; "fallback loops" fails `swaps a broken image to the local fallback once, never in a loop`.
- **Engineering Fix**: `<strong>` and `<small>`, `onError={swapToFallback}` (runs once, marker on the element), `--color-backdrop` in `index.css`.
- **Status**: Fixed.

---

## Failure #05: SEO 91–92 because `/robots.txt` answers with the app's HTML

- **Prompt**: row 8.
- **AI Code**: none. The first batch had no `public/robots.txt`.
- **Bug**: a single-page app answers every unknown address with `index.html`, so `/robots.txt` returned `<!doctype html>`, which Lighthouse reports as "robots.txt is not valid".
- **DevTools Proof**: Lighthouse 13.6.0, mobile, `/gallery`: SEO 92, failing audit `robots-txt` with the lines `<!doctype html>` and `<html lang="en">`; with the lightbox open, 91. After the fix, 100 on all four runs (mobile and desktop, grid and lightbox).
- **Engineering Fix**: `public/robots.txt` (`User-agent: *` / `Allow: /`), and a test that it exists and is not HTML (`photos.test.js` › `serves a valid robots.txt`).
- **Status**: Fixed.

---

## Failure #06: The first test suite missed 3 real regressions (found by a mutation run)

- **Prompt**: row 9.
- **AI Code** (the survivors, each a one-line change of `src/`):
  1. `Lightbox.jsx`: `navigate(to(next), { replace: true })` → `navigate(to(next))` (the arrow keys push entries).
  2. `Lightbox.jsx`: delete `if (dialog.open) dialog.close();` from the ref cleanup (focus would not return to the opener on Back).
  3. `PhotoGalleryLayout.jsx`: the count text `1 photo` / `N photos` → always `photos`.
  4. `CategoryFilter.jsx`: a mutant that read the real `window.location`.
- **Bug**: 1, 2 and 3 were real holes: the suite passed with each change. 4 was **not** a hole: a `MemoryRouter` does not use `window.location`, so that mutant could not change what a test sees.
- **DevTools Proof**: the mutation script printed `SURVIVED` for those four of 31, and `KILLED` for the other 27.
- **Engineering Fix**: three tests (`arrow navigation replaces the entry in both directions`, `closes the native dialog when it leaves the page`, `count › says "1 photo"`), and mutant 4 was replaced by a meaningful one (the filter link keeps a fixed `photoId`). Second run: **31 of 31 caught, 0 survived**. `src/` was restored after the run and the suite and build passed again.
- **Status**: Fixed.

---

## Failure #07: A browser check that reported a "leak" that was not one

- **Prompt**: row 7.
- **AI Code** (my check script): "12 × Tab: focus stayed inside the dialog" with `inside = dialog.contains(document.activeElement)`.
- **Bug**: the script printed `false`. Reading it as "the modal does not trap focus" would have been wrong.
- **DevTools Proof**: printing every stop gave the cycle Close → Previous photo → Next photo → `BODY` → Close (and the reverse with Shift+Tab). The `BODY` stop is where Chrome moves focus to its own UI. No link or button of the page behind was ever focused.
- **Engineering Fix**: the check now fails only if a page element outside the dialog gets focus; it reports `3 stops on BODY` as the browser-UI slot. Result on the build: `true` (`BROWSER_VERIFICATION.log`, section 3).
- **Status**: Fixed (the check was wrong, not the app).

---

## What was avoided without being run

- **Slide 29 #01 (Router v5 `<Switch>`, `component=`):** `sourceHygiene.test.js` checks the source for `<Switch`, `<Redirect`, `activeClassName` and `react-router-dom`.
- **Slide 29 #05 (icon buttons without a name):** the only buttons are "Close" with visible text; `sourceHygiene.test.js` › `every <button> has visible text`. axe-core passed on the lightbox page.
- **Slide 30 has no accessible name for the `<dialog>`** (no `aria-labelledby`). Found by reading the slide; it was **not** run through axe. This project names the dialog by its heading (`getByRole('dialog', { name })` is used by 4 tests).

---

## Not verified

- **Screen readers.** NVDA, JAWS, VoiceOver and TalkBack were not used. "WCAG 2.2 AA" is claimed here only for what axe-core (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, including `target-size` and colour contrast) and the keyboard checks above can show: 0 violations on 5 pages, and the focus behaviour of section 3. Automated tools find only part of the problems; this is not a conformance audit.
- **Zoom and reflow.** 375, 768 and 1440 px were checked (no sideways scroll, the dialog fits). 320 px, 200 % and 400 % browser zoom, and text-only zoom were not.
- **`prefers-reduced-motion` and Windows high-contrast mode.** The reduced-motion rule exists in `index.css`; neither was exercised. The gallery has no animation of its own besides a 0.15 s border change.
- **Other browsers.** Only Chrome 157 (headless). Safari does not focus a link on mouse click, so focus return after a mouse-opened lightbox may differ there.
- **Real photos.** The nine pictures are generated SVG of 0.6 kB each. A gallery of real JPEG or WebP files would need `srcset`, sizes and a new Lighthouse run; the 100 does not carry over.
- **Lighthouse variance.** One run per row; a different machine can shift Performance by a few points.
- **Not in the repository:** the Chrome check script and the mutation script. Only their output is kept (`BROWSER_VERIFICATION.log` and the numbers above).
