# TASK_DECOMPOSITION.md — Lab 3 · Exercise 1 (WBS)

> Goal: build `<DeveloperCard />` and `<SkillBadge />` as pure functional components.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md).

---

## Block 1 — Setup

**Commit:** `chore: init react19 vite & rules`

| ID  | Task |
| --- | ---- |
| 0.1 | Scaffold the project: `npm create vite@latest . -- --template react`, then `npm install`. |
| 0.2 | Confirm `react` and `react-dom` are `^19` in `package.json`. |
| 0.3 | Rewrite `src/main.jsx` to mount with `createRoot` from `'react-dom/client'` inside `<StrictMode>`. |
| 0.4 | Remove Vite boilerplate (`App.css`, demo counter, `<div>` wrappers in `App.jsx`). |
| 0.5 | Add `project-rules.md` to the repo root (and copy it to `.cursorrules`). |
| 0.6 | Run `npm run dev` and confirm a blank page with no console errors. |

---

## Props Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
type SkillTier = 'Core' | 'Awareness' | 'Later';   // gold / silver / bronze pill

interface Skill {
  id: string;        // stable entity ID, used as key
  name: string;
  tier: SkillTier;
}

interface DeveloperCardProps {
  fullName?: string;                         // default: 'Anonymous Developer'; rendered in <h2>, labels the <article>
  role?: string;                             // default: 'Developer'
  avatarUrl?: string;                        // default: ''; https:// or local /path, else initials fallback
  metrics?: Record<string, string | number>; // default: {}  → <dl> via Object.entries
  skills?: Skill[];                          // default: []  → <ul aria-label="Engineered Skills">
}

interface SkillBadgeProps {
  name?: string;                             // default: 'Unnamed Skill'
  tier?: SkillTier;                          // default: 'Core'
}
```

Defaults are set with ES6 default parameters in the destructured signature. `defaultProps` is banned.

---

## Sub-tasks

### Commit 1 — `feat(ex1): implement semantic DeveloperCard and SkillBadge`

| ID  | Task | Commit message |
| --- | ---- | -------------- |
| 1.1 | Create `src/components/SkillBadge.jsx`: pure function `({ name = 'Unnamed Skill', tier = 'Core' })` that returns an `<li>` showing `name (tier)`. Coerce with `String(tier ?? 'Core')` so `null` can't throw. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.2 | Create `src/components/DeveloperCard.jsx` with destructured props and ES6 defaults (`fullName = 'Anonymous Developer'`, `role = 'Developer'`, `avatarUrl = ''`, `metrics = {}`, `skills = []`). | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.3 | Build the skeleton: `<article aria-labelledby={headingId}>` → `<header>` → `<hgroup>` holding `<h2 id={headingId}>` (fullName) and `<p>` (role). Generate `headingId` with `useId()`. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.4 | Add the avatar inside `<header>`: `<figure>` → `<img src={avatarUrl} width="96" height="96" alt>`, rendered only if `avatarUrl` is `https://` or a local `/path`. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.5 | Add the initials fallback: `const [failedUrl, setFailedUrl] = useState(null)`. `onError` stores the failed URL, and the component renders `<abbr title={fullName}>` with up to 2 uppercase initials derived from `fullName` during render. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.6 | Render metrics: `<dl>` → `Object.entries(metrics).map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)`. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.7 | Render skills: `<ul aria-label="Engineered Skills">` → `skills.map(({ id, name, tier }) => <SkillBadge key={id} name={name} tier={tier} />)` (SkillBadge renders the `<li>`). | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.8 | Wire up `src/App.jsx`: `<main>` → `<h1>` + `<section aria-label>` grid rendering 4 football players from a `PLAYERS` array with stable string IDs (3 metrics, 3 skills each, one deliberately broken avatar URL). | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |
| 1.9 | Self-check: no `<div>`, no `<span>`, no index or raw-value keys, no `useEffect`, no inline `style`. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` |

### Commit 2 — `style(ex1): add responsive 375px CSS module`

| ID  | Task | Commit message |
| --- | ---- | -------------- |
| 2.1 | Declare design tokens as CSS Custom Properties on `:root` in `src/index.css` (`--color-*`, `--space-*`, `--radius-*`, `--font-*`) and import it in `main.jsx`. | `style(ex1): add responsive 375px CSS module` |
| 2.2 | Create `DeveloperCard.module.css`, `SkillBadge.module.css` and `App.module.css` using only `var(--token)` colors (no hex). Classes: `.card`, `.header`, `.avatarFrame`, `.avatar`, `.initials`, `.metrics`, `.skills`, `.badge`, `.core`, `.awareness`, `.later`, … | `style(ex1): add responsive 375px CSS module` |
| 2.3 | Lay out mobile-first at 375px: `.metrics` as label/value rows by default, `.skills` as `flex-wrap: wrap`, `.card { inline-size: 100%; max-inline-size: 24rem; }`. | `style(ex1): add responsive 375px CSS module` |
| 2.4 | Prevent overflow: `overflow-wrap: anywhere` on text, `min-inline-size: 0` on grid/flex children, and no fixed widths above 343px (375 − 2 × 16px gutter). | `style(ex1): add responsive 375px CSS module` |
| 2.5 | Style `.avatar` and `.initials` as the same 96px circle with a glow ring so the fallback doesn't shift the layout. | `style(ex1): add responsive 375px CSS module` |
| 2.6 | Style tier pills: `.core` = gold, `.awareness` = silver, `.later` = bronze. | `style(ex1): add responsive 375px CSS module` |
| 2.7 | Apply `className={styles.*}` in `DeveloperCard.jsx` and `SkillBadge.jsx`. No inline `style` prop. | `style(ex1): add responsive 375px CSS module` |
| 2.8 | Add `min-width` media queries only: 3-column metrics from 401px, larger spacing from 768px. Check the layout at 1440px. | `style(ex1): add responsive 375px CSS module` |

---

## Checkpoint 1 — Verification

Run from the repo root in Git Bash.

- [ ] **No `<div>` in the component:** `grep -c "<div" src/components/DeveloperCard.jsx` → `0`
- [ ] **No `<div>` anywhere in source:** `grep -rn "<div" src | wc -l` → `0`
- [ ] **No insecure URLs:** `grep -rn "http://" src index.html | wc -l` → `0`
- [ ] **Accessibility Tree** (Chrome DevTools → Elements → Accessibility pane): `article` (named by the `h2`) contains `header` → `hgroup`/heading, then `dl` (term/definition pairs), then `list` named "Engineered Skills" with `listitem` children.
- [ ] **No key warnings:** the console shows no "unique key" or StrictMode warnings.
- [ ] **Avatar fallback:** changing `avatarUrl` to a broken `https://` URL renders the initials, still 64×64.
- [ ] **375px:** DevTools device toolbar → iPhone SE (375×667). `document.documentElement.scrollWidth <= window.innerWidth` returns `true`, and there's no horizontal scrollbar.
- [ ] **1440px:** the layout is centered with no overflow.
- [ ] **Git history:** `git log --oneline` contains the three planned commits, plus follow-up commits for avatars, fixes and docs:
  ```
  style(ex1): add responsive 375px CSS module
  feat(ex1): implement semantic DeveloperCard and SkillBadge
  chore: init react19 vite & rules
  ```
