# TASK_DECOMPOSITION.md — Lab 3 · Exercise 2 (WBS)

> Goal: turn the static `smartPeople` array into a reactive "Scientist & Pioneer Directory" (search, min-IQ filter, sort, delete, reset).
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md).
> Source: Lab 3 deck, slides 16–19 (derived state, accessible forms, Sprint 2 spec and reference contract).

---

## Block 1 — Setup

Reuses the toolchain from Exercise 1; no new dependencies.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Ex_2/` with `package.json` (react/react-dom `^19`, vite `^7`, `@vitejs/plugin-react` `^5`), `vite.config.js`, `index.html` and `.gitignore`. |
| 0.2 | Mount with `createRoot` from `'react-dom/client'` inside `<StrictMode>` in `src/main.jsx`, throwing if `#root` is missing. |
| 0.3 | Copy `project-rules.md` to `Ex_2/docs/`. |
| 0.4 | Run `npm install` and `npm run build`; confirm it builds before writing components. |

---

## Props Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
interface Person {
  id: string;     // stable entity ID ('sp-1' … 'sp-6'), used as React key
  name: string;
  age: number;
  iq: number;
}

type SortId = 'iq-desc' | 'iq-asc' | 'age-asc' | 'age-desc';

interface ScientistDirectoryProps {
  initialData?: readonly Person[];   // default: SMART_PEOPLE
}

// State owned by ScientistDirectory (raw inputs only — nothing derived):
//   people: Person[]   query: string   minIq: number (default 160)   sortBy: SortId (default 'iq-desc')
// Derived during render: visible = people.filter(name + iq).toSorted(compare)

interface FilterControlsProps {
  query?: string;                    // default: ''
  minIq?: number;                    // default: 0
  sortBy?: SortId;                   // default: 'iq-desc'
  resultCount?: number;              // default: 0 → <output role="status">
  onQueryChange(value: string): void;
  onMinIqChange(value: number): void;     // receives valueAsNumber, NaN → 0
  onSortChange(value: SortId): void;
  onReset(): void;
}

interface PioneerItemProps extends Person {   // name, age, iq default to 'Unknown', 0, 0
  onDelete(id: string): void;
}
```

Defaults are set with ES6 default parameters in the destructured signature. `defaultProps` is banned.

---

## Sub-tasks

### Commit 1 — `feat(ex2): normalize smartPeople schema with stable IDs`

| ID  | Task | Commit message |
| --- | ---- | -------------- |
| 1.1 | Create `src/data/smartPeople.js`: frozen array of 6 people (`sp-1` … `sp-6`) with `{ id, name, age, iq }` matching slide 18. | `feat(ex2): normalize smartPeople schema with stable IDs` |
| 1.2 | Create `src/components/PioneerItem.jsx`: `<li>` → `<article aria-labelledby={headingId}>` (id from `useId()`) → `<h3>`, `<dl>` with IQ and Age as `<dt>`/`<dd>`. | `feat(ex2): normalize smartPeople schema with stable IDs` |
| 1.3 | Create `src/components/ScientistDirectory.jsx`: `<section aria-labelledby>` with an `<h2>` and a `<ul>` rendering `key={person.id}`. | `feat(ex2): normalize smartPeople schema with stable IDs` |
| 1.4 | Wire `src/App.jsx` (`<main>` → `<h1>` → `<ScientistDirectory />`), add tokens in `src/index.css` and the CSS modules for the list and cards (mobile-first, 1 column at 375px). | `feat(ex2): normalize smartPeople schema with stable IDs` |

### Commit 2 — `feat(ex2): add search, IQ filter & toSorted`

| ID  | Task | Commit message |
| --- | ---- | -------------- |
| 2.1 | Create `src/data/sortOptions.js`: one array of `{ id, label, compare }` for IQ and Age, ascending and descending. | `feat(ex2): add search, IQ filter & toSorted` |
| 2.2 | Create `src/components/FilterControls.jsx`: `<form role="search">` with name search, min-IQ number input and sort `<select>`. Each control gets `<label htmlFor>` with an id from `useId()`. | `feat(ex2): add search, IQ filter & toSorted` |
| 2.3 | Min-IQ handler reads `event.target.valueAsNumber`; `Number.isNaN` falls back to `0`. | `feat(ex2): add search, IQ filter & toSorted` |
| 2.4 | In `ScientistDirectory` add state `query`, `minIq` (160), `sortBy`. Compute `visible = people.filter(…).toSorted(compare)` during render. **No `useEffect`, no `filteredPeople` state.** | `feat(ex2): add search, IQ filter & toSorted` |
| 2.5 | Style the form: stacked fields at 375px, 3-column grid from 768px (`min-width` queries only), focus rings, 44px tap targets. | `feat(ex2): add search, IQ filter & toSorted` |

### Commit 3 — `feat(ex2): add delete/reset & live status`

| ID  | Task | Commit message |
| --- | ---- | -------------- |
| 3.1 | Add `handleDelete(id)`: `setPeople((prev) => prev.filter((p) => p.id !== id))`, wired to a `<button type="button">` in each `PioneerItem`. | `feat(ex2): add delete/reset & live status` |
| 3.2 | Add `handleReset`: restore `initialData` and reset `query`, `minIq`, `sortBy` to their defaults. Render it as `<button type="button">`. | `feat(ex2): add delete/reset & live status` |
| 3.3 | Add `<output role="status" aria-live="polite" htmlFor="…ids">` announcing "Found N pioneers" (singular for 1). | `feat(ex2): add delete/reset & live status` |
| 3.4 | Add the empty state `<p>` "No pioneers match the current filters." when `visible.length === 0`. | `feat(ex2): add delete/reset & live status` |
| 3.5 | Self-check: no `<div>`/`<span>`, no index keys, no `useEffect`, no inline `style`, no hardcoded hex in CSS modules. | `feat(ex2): add delete/reset & live status` |

---

## Checkpoint 2 — Verification

Run from `Ex_2/` in Git Bash.

- [ ] **Build passes:** `npm run build` → no errors.
- [ ] **No `<div>` / `<span>`:** `grep -rn "<div\|<span" src | wc -l` → `0`
- [ ] **No `useEffect` for filtering:** `grep -rn "useEffect" src | wc -l` → `0`
- [ ] **No insecure URLs:** `grep -rn "http://" src index.html | wc -l` → `0`
- [ ] **No inline styles / hex in modules:** `grep -rn "style=" src | wc -l` → `0`; `grep -n "#[0-9a-fA-F]\{3,6\}" src/*.module.css src/components/*.css | wc -l` → `0`
- [ ] **Labels:** DevTools → Accessibility → each of the 3 controls reports a name from its `<label>`; clicking a label focuses its control.
- [ ] **Live region:** DevTools → Accessibility: the `output` shows `role: status`, `live: polite`, and its text changes while typing.
- [ ] **Filtering:** type `ein` → only Einstein; set Min IQ to `200` → Goethe, Einstein, Sidis; clearing filters shows all 6.
- [ ] **Sorting:** each sort option reorders the list; the `people` array order is unchanged (`.toSorted` does not mutate).
- [ ] **Delete / Reset:** deleting Goethe leaves 5 items with the same keys; Reset brings back 6 and restores the default filters.
- [ ] **React Profiler:** record, type 1 character in the search box → 1 commit per keystroke (StrictMode doubles renders in dev, not commits).
- [ ] **375px:** DevTools device toolbar → iPhone SE: `document.documentElement.scrollWidth <= window.innerWidth` → `true`; 1440px layout has no overflow.
- [ ] **Git history:** `git log --oneline` shows the three Exercise 2 commits above.
