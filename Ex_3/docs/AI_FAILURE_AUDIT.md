# AI_FAILURE_AUDIT.md — Lab 3 · Exercise 3

> Defects in AI-generated code, checked against [project-rules.md](project-rules.md) and the Lab 3 deck (slides 22–24).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **How the evidence was collected:** after P1–P16 every static `grep` check passed, so the app was then run in headless Chrome (Chrome DevTools Protocol, driven by `puppeteer-core`) at 375px with Slow 3G emulation. The numbers below are what that run printed. Lines marked **TODO screenshot** still need a manual DevTools capture for submission.
> All four entries were found by running the app, not by reading the code. #01, #02 and #04 are fixed; #03 is documented but not fixed.

---

## Failure #01: Aborting during the artificial delay cancels nothing

- **Prompt**: P2 — "Wait `delayMs` using a promise that rejects … as soon as `signal` aborts … **Then** `fetch(…, { signal })`." The AI implemented exactly this order.
- **AI Code**:
  ```js
  // src/api/fetchKraftonPubgTelemetry.js
  await waitWithAbort(delayMs, signal);          // 1200 ms, no request exists yet
  const response = await fetch(`/telemetry/squads.json?squad=${…}`, { signal });
  ```
- **Bug**: The request is only sent after the 1.2 s delay. Switching squad inside that window aborts the delay, so `fetch` never runs. Slide 22 asks that rapid switching "abort stale requests cleanly via `AbortController`", and Checkpoint 3 expects `(canceled)` requests in the Network tab; with this order there are none to cancel. All static checks passed (`abort()` present, `AbortError` guard present).
- **DevTools Proof**: Chrome at 375px, Network = Slow 3G, then click CES → TE → GE with 150 ms between clicks. Requests seen for `squads.json`: `["squad=ge=finished"]`. Only one request existed; none was `(canceled)`. No alert flashed and the final view was "Genius Esports", so the user-visible behaviour was correct and only the cancellation was missing. **TODO screenshot:** Network tab after the same clicks.
- **Engineering Fix (Commit `135690d`)**: Start the request first and hold the result for the delay.
  ```js
  const [response] = await Promise.all([
    fetch(`/telemetry/squads.json?squad=${encodeURIComponent(squadId)}`, { signal }),
    waitWithAbort(delayMs, signal),
  ]);
  ```
  Re-run, same clicks: `["squad=ces=failed:net::ERR_ABORTED","squad=te=failed:net::ERR_ABORTED","squad=ge=finished"]`, 0 alerts, final view "Genius Esports". `Promise.all` also handles the rejection of the other promise, so no unhandled rejection appears when one side aborts.
- **Status**: Fixed.

---

## Failure #02: Skeleton is 220 px but the real card is 298–315 px

- **Prompt**: P13 — "`.skeleton` is exactly `block-size: 220px` …" and P11 — "`.region` … `min-block-size: 220px` so the loading, error and result views keep the same height (zero layout shift)."
- **AI Code**:
  ```css
  /* PubgMatchTelemetry.module.css */
  .region { min-block-size: 220px; }
  /* TelemetrySkeleton.module.css */
  .skeleton { block-size: 220px; }
  ```
- **Bug**: The prompts assumed the result would fit in 220 px. It does not, so the region still changes height when the card replaces the skeleton, which is the opposite of what P11 says it prevents.
- **DevTools Proof**: Measured with `getBoundingClientRect()` after load: skeleton **220 px**; `<article>` **298 px** at 375px, **315 px** at 480, 768 and 1440px. The Layout Shift API reported `CLS = 0`, because nothing is rendered below the region to be pushed; the region itself still changed height. **TODO screenshot:** Elements panel with the skeleton selected, then the card selected, showing the two heights.
- **Engineering Fix (Commit `3801bb3`)**: Reserve the tallest view in the region and keep the 220 px skeleton the slide asks for.
  ```css
  .region { min-block-size: 320px; }
  ```
  After the fix the region measures **320 px** whether it shows the skeleton, the alert or the card. If the card grows (longer text, larger font), this constant needs to grow with it.
- **Status**: Fixed.

---

## Failure #03: Missing favicon causes a 404 console error

- **Prompt**: Block 1 (setup) — `index.html` was copied from Exercise 2, which was copied from Exercise 1. The AI-written scaffold has no icon link.
- **AI Code**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lab 3 · Exercise 3 — PUBG VN Telemetry</title>
  ```
- **Bug**: The browser requests `/favicon.ico`, gets a 404 and logs a console error. Slide 24 (Step 2 of the live defense) checks for "zero Console warnings". The same file was copied into all three exercises, so all three were affected.
- **DevTools Proof**: Headless Chrome console output: `Failed to load resource: the server responded with a status of 404 (Not Found)`. Response log: `404 http://localhost:5199/favicon.ico`. **TODO screenshot:** DevTools → Console on a fresh load.
- **Engineering Fix**: Not applied. The one-line fix (an empty data-URL icon in each `index.html`) was written and then removed from the history, so the 404 is still present in `Ex_1`, `Ex_2` and `Ex_3`.
  ```html
  <link rel="icon" href="data:," />
  ```
  When it is applied, re-run the headless check: console errors/warnings and HTTP responses ≥ 400 should both be `none`.
- **Status**: Open.

---

## Failure #04: Component and stylesheet disagree on class names

- **Prompt**: P14 — "Render `<section role="alert" className={styles.alert}>` with `<p>…</p>` and `<button …>`" (no class on `<p>` or `<button>`); P15 — "Create `TelemetryAlert.module.css` with `.alert`, `.message`, `.retry`."
- **AI Code**:
  ```jsx
  // TelemetryAlert.jsx after P14: only styles.alert is used
  <p>Blue-Zone link lost: …</p>
  <button type="button" onClick={() => onRetry?.()}>Reconnect Satellite (Retry)</button>
  ```
- **Bug**: The stylesheet defined `.message` and `.retry`, but nothing used them. `npm run build` still passed, since an unused CSS Module class is not an error, so the retry button would have shipped unstyled (no 44 px tap target, no focus outline).
- **DevTools Proof**: Check after P15: classes in the CSS `.alert .message .retry`, classes used in the JSX `alert` only (from a `grep` of both files). **TODO screenshot:** Elements → the `<button>` showing no `_retry_…` class.
- **Engineering Fix (Commit `8582e30`)**: Wired the two classes into the component.
  ```jsx
  <p className={styles.message}>Blue-Zone link lost: …</p>
  <button className={styles.retry} type="button" onClick={() => onRetry?.()}>…</button>
  ```
  After the fix, the three classes in the CSS match the three used in the JSX.
- **Status**: Fixed.

---

## Summary

| # | Failure | Rule / requirement violated | Commit |
|---|---------|-----------------------------|--------|
| 01 | Aborting during the artificial delay cancels nothing | Slide 22: abort stale requests; Checkpoint 3 `(canceled)` | `135690d` (Fixed) |
| 02 | Skeleton 220 px vs card 298–315 px | Slide 22 / P11: same height, zero layout shift | `3801bb3` (Fixed) |
| 03 | Missing favicon → 404 console error | Slide 24: zero Console warnings | — (Open) |
| 04 | Component and stylesheet disagree on class names | Consistency (Rule 11.3: complete, working files) | `8582e30` (Fixed) |
