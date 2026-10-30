# AI_FAILURE_AUDIT.md — Lab 3 · Exercise 1

> Defects in AI-generated code, checked against [PROJECT_RULE.md](PROJECT_RULE.md).
> Prompt numbers refer to [PROMPT_LOG.md](PROMPT_LOG.md).
> **Status:** Fixed = corrected in the code · Open = still in the code, fix proposed.
> Commit hashes are `TODO` until the commits exist. Lines marked **TODO screenshot** need a DevTools capture before submission.

---

## Failure #01: Import of a CSS Module that was never created

- **Prompt**: #8 — "Write src/App.jsx: a `<main>` containing an `<h1>` and a `<section aria-label>` grid rendering 2 DeveloperCard instances… Output only the file."
- **AI Code**:
  ```jsx
  // src/App.jsx
  import DeveloperCard from './components/DeveloperCard.jsx';
  import styles from './App.module.css'; // file did not exist
  ```
  The same happened with `import styles from './SkillBadge.module.css'` in prompt #4.
- **Bug**: The AI imported a stylesheet it had not written, so the app could not start. This breaks **Rule 11.3** (complete files only), because the file depends on a file that was never produced. The AI mentioned the missing file in chat but still shipped code that would not build.
- **DevTools Proof**: The browser showed the Vite error overlay:
  `[plugin:vite:import-analysis] Failed to resolve import "./App.module.css" from "src/App.jsx". Does the file exist?` at `src/App.jsx:3:19`. Nothing rendered.
- **Engineering Fix (Commit `TODO`)**: Created both missing modules, then confirmed with `npm run build` (✓ 33 modules transformed).
  ```css
  /* src/App.module.css */
  .page  { /* tokens, gutter, background */ }
  .title { /* heading */ }
  .grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); }
  ```
  Process fix: run `npm run build` after every generated file.
- **Status**: Fixed.

---

## Failure #02: `<span>` used for the badge and the initials fallback

- **Prompt**: #4 — "…Render a `<span>` showing the name and "(tier)"…" and #6 — "…switch via useState to a `<span role="img" aria-label>`…"
- **AI Code**:
  ```jsx
  // src/components/SkillBadge.jsx:8
  <span className={`${styles.badge} ${tierClass}`}>

  // src/components/DeveloperCard.jsx:39
  <span className={styles.initials} role="img" aria-label={`Avatar of ${fullName}`}>
  ```
- **Bug**: **Rule 2.1** says "Do not use `<div>` or `<span>` for structure". `<span>` is also not in the allowed-tag list (Rule 2.2). The AI followed the prompt over the rules file and only warned about it in chat. The Checkpoint 1 `grep '<div'` passes, so this check does not catch it.
- **DevTools Proof**: Static check: `grep -rn "<span" src` → 2 hits (lines above). **TODO screenshot:** Elements panel showing `<li><span class="_badge_…">` and the Accessibility pane showing the initials node as role `img`.
- **Engineering Fix (Commit `TODO`)**: Proposed.
  ```jsx
  // SkillBadge returns the list item itself (as planned in task 1.1)
  export default function SkillBadge({ name = 'Unnamed Skill', tier = 'Core' }) {
    const tierClass = styles[String(tier).toLowerCase()] ?? styles.core;
    return <li className={`${styles.badge} ${tierClass}`}>{name} ({tier})</li>;
  }
  // DeveloperCard: <SkillBadge key={id} … /> directly inside <ul>

  // Initials fallback: semantic abbreviation instead of a generic span
  <abbr className={styles.initials} title={fullName}>{getInitials(fullName)}</abbr>
  ```
- **Status**: Open.

---

## Failure #03: Desktop-first `max-width` media query

- **Prompt**: #7 — "…At max-width 400px, switch metrics to two-column key-value rows…"
- **AI Code**:
  ```css
  /* src/components/DeveloperCard.module.css:193 */
  @media (max-width: 400px) {
    .metrics { grid-template-columns: minmax(0, 1fr) auto; }
  }
  ```
- **Bug**: **Rule 9.7** requires mobile-first `min-width` media queries. Here the 3-column layout is the default, and the 375px layout is an override layered on top.
- **DevTools Proof**: Static check: `grep -rn "max-width" src` → 1 hit. **TODO screenshot:** Device Toolbar at 375px with the Styles pane showing the `@media (max-width: 400px)` override applied.
- **Engineering Fix (Commit `TODO`)**: Proposed. Make key-value rows the default and add the 3-column grid from 401px. The visual result is the same and the query becomes mobile-first.
  ```css
  .metrics { grid-template-columns: minmax(0, 1fr) auto; }   /* base = 375px */

  @media (min-width: 401px) {
    .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    /* nth-of-type column pinning moves here */
  }
  ```
- **Status**: Open.

---

## Failure #04: Default parameters do not guard against `null` props

- **Prompt**: #4 and #5 — "…a pure function component with default params…"
- **AI Code**:
  ```jsx
  // src/components/SkillBadge.jsx:5
  const tierClass = styles[tier.toLowerCase()] ?? styles.core;

  // src/components/DeveloperCard.jsx:7, :23
  const words = fullName.trim().split(/\s+/);
  const showAvatar = avatarUrl.startsWith('https://') && failedUrl !== avatarUrl;
  ```
- **Bug**: ES6 defaults (**Rule 4.3**) only apply when a prop is `undefined`. With `tier={null}`, `fullName={null}` or `avatarUrl={null}` (common when data comes from an API), the component throws during render and the whole tree unmounts.
- **DevTools Proof**: **TODO screenshot:** temporarily set `tier: null` on one skill in `App.jsx`. The Console should show `TypeError: Cannot read properties of null (reading 'toLowerCase')`, and the page goes blank.
- **Engineering Fix (Commit `TODO`)**: Proposed. Coerce before calling string methods.
  ```jsx
  const tierClass = styles[String(tier ?? 'Core').toLowerCase()] ?? styles.core;
  const words = String(fullName ?? '').trim().split(/\s+/);
  const showAvatar = String(avatarUrl ?? '').startsWith('https://') && failedUrl !== avatarUrl;
  ```
- **Status**: Open.

---

## Failure #05: Code drifted away from the props contract

- **Prompt**: #4 (tiers `Core / Awareness / Later`, `<span>`) and #5 ("h2 fullName")
- **AI Code**:
  ```jsx
  // DeveloperCard.jsx
  export default function DeveloperCard({ fullName = 'Anonymous Developer', … })
  ```
  ```ts
  // docs/TASK_DECOMPOSITION.md:28, :37, :60
  type SkillTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
  name: string;   // rendered in <h2>
  // task 1.1: SkillBadge "returns an <li>"
  ```
- **Bug**: The code and the contract no longer match on three points: the prop name (`fullName` vs `name`), the tier values, and which component renders the `<li>`. The AI pointed out each mismatch in chat but never updated the contract. This breaks **Rule 11.6** (self-check before output), and anyone reading TASK_DECOMPOSITION.md would pass props that do nothing.
- **DevTools Proof**: **TODO screenshot:** React DevTools → Components → `DeveloperCard` props panel showing `fullName`, not `name`.
- **Engineering Fix (Commit `TODO`)**: Proposed. Update the contract to match the shipped code.
  ```ts
  type SkillTier = 'Core' | 'Awareness' | 'Later';
  interface DeveloperCardProps { fullName: string; role?: string; avatarUrl: string; … }
  ```
- **Status**: Open.

---

## Failure #06: Hardcoded colors inside component CSS Modules

- **Prompt**: #7 — "…Define colors, radius and gap as CSS Custom Properties on .card…" and #13 (FUT restyle)
- **AI Code**:
  ```css
  /* src/components/DeveloperCard.module.css */
  .card {
    --card-gold: #d4af37;
    --card-bg: linear-gradient(160deg, #1f2a44 0%, #0f172a 55%, #05080f 100%);
  }
  .initials { color: #2b1d00; }
  ```
- **Bug**: **Rule 9.2** puts design tokens on `:root`, and **Rule 9.4** forbids hardcoded colors in component modules. The two component modules contain 18 hex literals, and `.initials` uses `#2b1d00` directly instead of a token.
- **DevTools Proof**: Static check: `grep -n "#[0-9a-fA-F]\{6\}" src/components/*.css | wc -l` → `18`. **TODO screenshot:** Elements → `:root` showing no custom properties in the Computed pane.
- **Engineering Fix (Commit `TODO`)**: Proposed. Move the palette to a global `src/index.css` on `:root`, import it in `main.jsx`, and keep only `var(--…)` references in the modules.
  ```css
  /* src/index.css */
  :root { --gold: #d4af37; --gold-light: #f5d77a; --ink-on-gold: #2b1d00; /* … */ }

  /* DeveloperCard.module.css */
  .initials { color: var(--ink-on-gold); }
  ```
- **Status**: Open.

---

## Summary

| # | Failure | Rule violated | Commit |
|---|---------|---------------|--------|
| 01 | Import of a CSS Module that was never created | 11.3 | `TODO` (Fixed) |
| 02 | `<span>` used for badge and initials fallback | 2.1, 2.2 | `TODO` (Open) |
| 03 | Desktop-first `max-width` media query | 9.7 | `TODO` (Open) |
| 04 | Default parameters don't guard `null` props | 4.3 | `TODO` (Open) |
| 05 | Code drifted away from the props contract | 11.6 | `TODO` (Open) |
| 06 | Hardcoded colors inside component CSS Modules | 9.2, 9.4 | `TODO` (Open) |
