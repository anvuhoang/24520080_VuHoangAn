# AI_FAILURE_AUDIT.md — Lab 3 · Exercise 2

> Defects in AI-generated code, checked against [project-rules.md](project-rules.md) and the Lab 3 deck.
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **Status:** Fixed = corrected in the code · Unverified = suspected, not yet reproduced in a browser.
> Commit hashes are `TODO` until the Exercise 2 commits exist. Lines marked **TODO screenshot** need a DevTools capture before submission.
> Entries #01 and #02 were confirmed with `grep` on the source. Entry #03 was **not** reproduced — see its status line.

---

## Failure #01: Forbidden-API keyword left in a code comment

- **Prompt**: #1 — "Build Exercise 2 (Scientist & Pioneer Directory…) with filtering and sorting computed during render."
- **AI Code**:
  ```jsx
  // src/components/ScientistDirectory.jsx:20
  // Derived data: computed during render in one pass, no useEffect, no extra state
  const visible = people.filter(…).toSorted(compare);
  ```
- **Bug**: The code is correct, but Checkpoint 2 and the grading rubric use a zero-`useEffect` check on derived state (**Rule 7.5**). A plain-text search cannot tell a comment from a hook, so the comment makes a correct file fail the check.
- **DevTools Proof**: Console (Git Bash), before the fix: `grep -rn "useEffect" src` → `src/components/ScientistDirectory.jsx:20:  // Derived data: … no useEffect, no extra state` (1 hit). **TODO screenshot:** the same command in the VS Code terminal.
- **Engineering Fix (Commit `TODO`)**: Reworded the comment so no rule keyword appears. After the fix, `grep -rn "useEffect" src | wc -l` → `0`.
  ```jsx
  // Derived data: computed during render in one pass, with no effect and no extra state
  ```
- **Status**: Fixed.

---

## Failure #02: `aria-label` duplicating the heading instead of `aria-labelledby`

- **Prompt**: #1 — same request; the lab's reference `DeveloperCard` (slide 14) names its `<article>` from the `<h2>` with `aria-labelledby`.
- **AI Code**:
  ```jsx
  // src/components/PioneerItem.jsx (first draft)
  <article className={styles.card} aria-label={name}>
    <h3 className={styles.name}>{name}</h3>
  ```
- **Bug**: The same text is written twice. The `aria-label` can fall out of sync with the visible `<h3>` if only one is edited, and it breaks the lab's own convention (an `<article>` named by its heading through `aria-labelledby` and `useId()`, see Exercise 1).
- **DevTools Proof**: Static check before the fix: `grep -rn "<article[^>]*aria-label=" src` → 1 hit. **TODO screenshot:** Chrome DevTools → Accessibility pane on one card, showing the name coming from `aria-label` instead of "Labeled by".
- **Engineering Fix (Commit `TODO`)**: Bound the article to its heading with an id from `useId()`.
  ```jsx
  const headingId = useId();
  <article className={styles.card} aria-labelledby={headingId}>
    <h3 id={headingId} className={styles.name}>{name}</h3>
  ```
  After the fix: `grep -rn "<article[^>]*aria-label=" src | wc -l` → `0`, `grep -rn "aria-labelledby" src | wc -l` → `2`.
- **Status**: Fixed.

---

## Failure #03: Clearing the Min IQ field snaps back to `0` (candidate)

- **Prompt**: #1 — the deck's reference code (slide 19) is `setMinIq(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)`. The AI reproduced that pattern in `FilterControls.jsx`.
- **AI Code**:
  ```jsx
  // src/components/FilterControls.jsx
  const handleMinIq = (event) => {
    const value = event.target.valueAsNumber;
    onMinIqChange?.(Number.isNaN(value) ? 0 : value);
  };
  <input type="number" value={minIq} onChange={handleMinIq} />
  ```
- **Bug (suspected)**: An empty number input has `valueAsNumber === NaN`, which this code turns into `0` and writes back into the controlled `value`. The user may not be able to delete the field's contents to type a new number. Nothing here has been run in a browser. I tried to reproduce it with jsdom, but that script did not finish, so the behaviour is **unconfirmed**.
- **DevTools Proof**: **TODO screenshot:** in the page, click the Min IQ field, select all, press Backspace, and watch whether the box shows `0` again and the count changes. If it does not reproduce, delete this entry.
- **Engineering Fix (Commit `TODO`)**: Not applied. If confirmed, keep the raw text in state and derive the number during render:
  ```jsx
  const [minIqText, setMinIqText] = useState('160');
  const minIq = Number.isNaN(Number(minIqText)) || minIqText === '' ? 0 : Number(minIqText);
  ```
- **Status**: Unverified.

---

## Summary

| # | Failure | Rule violated | Commit |
|---|---------|---------------|--------|
| 01 | Forbidden-API keyword left in a code comment | 7.5 (grep check) | `TODO` (Fixed) |
| 02 | `aria-label` duplicating the heading instead of `aria-labelledby` | Lab convention (slide 14) | `TODO` (Fixed) |
| 03 | Clearing the Min IQ field snaps back to `0` | 6.x (form usability) — suspected | `TODO` (Unverified) |
