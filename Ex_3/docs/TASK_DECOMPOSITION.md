# TASK_DECOMPOSITION.md — Lab 3 · Exercise 3 (WBS)

> Goal: build `<PubgMatchTelemetry />`, a fault-tolerant live radar for Vietnamese PUBG squads (CES, TE, GE) with a 4-state machine, a skeleton loader, simulated packet loss and race-condition-proof fetching.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md).
> Source: Lab 3 deck, slides 20–23 (effect cleanup, abortable state machine, Sprint 3 spec and reference contract).
> Working rule (slide 8): **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).

---

## Block 1 — Setup

Reuses the Exercise 2 toolchain; no new dependencies. Done by copying config files, not by prompting.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Ex_3/` with `package.json` (name `lab3-ex3`), `vite.config.js`, `index.html`, `.gitignore` copied from `Ex_2/`. |
| 0.2 | Create `src/main.jsx` (`createRoot` + `<StrictMode>`, throws if `#root` is missing). |
| 0.3 | Run `npm install` and `npm run build`. |

---

## Props Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
type SquadId = 'ces' | 'te' | 'ge';

interface Squad {
  id: SquadId;
  name: string;          // 'Cerberus Esports' | 'The Expendables' | 'Genius Esports'
  map: 'Erangel' | 'Miramar' | 'Taego';
  phase: string;         // 'Phase 6'
  alive: number;
  kills: number;
  wwcdProb: string;      // '68%'
  status: string;        // 'In Safe Zone'
}

// 4-state machine — one status at a time, never boolean soup
type TelemetryView =
  | { status: 'IDLE';    data: null;  error: null }
  | { status: 'LOADING'; data: null;  error: null }
  | { status: 'SUCCESS'; data: Squad; error: null }
  | { status: 'ERROR';   data: null;  error: string };

interface PubgMatchTelemetryProps {
  squadId?: SquadId;     // default: 'te'
}

interface SquadSelectorProps {
  squads?: readonly { id: SquadId; name: string }[];   // default: []
  selectedId?: SquadId;                                // default: 'te'
  onSelect(id: SquadId): void;
}

interface TelemetryCardProps { squad: Squad }
interface TelemetryAlertProps { message?: string; onRetry(): void }   // default message: 'Satellite link lost.'

// fetchKraftonPubgTelemetry(squadId, { signal, delayMs = 1200, lossRate = 0.35 }): Promise<Squad>
//   - rejects with a DOMException named 'AbortError' when `signal` aborts (during the delay or the fetch)
//   - rejects with Error('Satellite packet lost') with probability `lossRate`, for Erangel / Miramar squads only
```

Defaults are set with ES6 default parameters in the destructured signature. `defaultProps` is banned.

---

## Sub-tasks

Each row is one prompt and one file. `P` numbers are the prompt order used in [PROMPT_LOG.md](PROMPT_LOG.md).

### Commit 1 — `feat(ex3): implement PUBG VN 4-state telemetry & AbortController`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 1.1 | P1 | `public/telemetry/squads.json` | Dataset of the 3 squads from slide 22, served statically so every request shows in the Network tab. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.2 | P2 | `src/api/fetchKraftonPubgTelemetry.js` | Abortable delay + `fetch` with `signal`, 35% packet loss for Erangel/Miramar. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.3 | P3 | `src/components/SquadSelector.jsx` | `<fieldset>` + `<legend>` with one `<button type="button" aria-pressed>` per squad. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.4 | P4 | `src/components/TelemetryCard.jsx` | SUCCESS view: `<article aria-labelledby>`, `<h3>`, `<dl>` for map/phase/alive/kills/win chance. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.5 | P5 | `src/components/PubgMatchTelemetry.jsx` | 4-state machine, `useEffect` with `AbortController`, `AbortError` guard, `retryTick`; plain-text LOADING/ERROR placeholders. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.6 | P6 | `src/App.jsx` | `<main>` → `<h1>` → `SquadSelector` + `PubgMatchTelemetry`, with `selectedId` state. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.7 | P7 | `src/index.css` | `:root` design tokens (colors, space, radius, font). | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.8 | P8 | `src/App.module.css` | Page layout, mobile-first. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.9 | P9 | `src/components/SquadSelector.module.css` | Selector buttons, 44px tap targets, wraps at 375px. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.10 | P10 | `src/components/TelemetryCard.module.css` | Stat grid, label above number. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 1.11 | P11 | `src/components/PubgMatchTelemetry.module.css` | Fixed-height result region so loading and result don't shift the layout. | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |

### Commit 2 — `feat(ex3): add skeleton UI & retry alert`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 2.1 | P12 | `src/components/TelemetrySkeleton.jsx` | `<section aria-busy="true">` with accessible "Syncing KRAFTON radar…" text. | `feat(ex3): add skeleton UI & retry alert` |
| 2.2 | P13 | `src/components/TelemetrySkeleton.module.css` | 220px pulsing Blue-Zone card, same footprint as `TelemetryCard`, reduced-motion safe. | `feat(ex3): add skeleton UI & retry alert` |
| 2.3 | P14 | `src/components/TelemetryAlert.jsx` | `<section role="alert">` with message and a `<button type="button">` "Reconnect Satellite (Retry)". No `window.alert`. | `feat(ex3): add skeleton UI & retry alert` |
| 2.4 | P15 | `src/components/TelemetryAlert.module.css` | Alert styling with danger tokens, focus ring. | `feat(ex3): add skeleton UI & retry alert` |
| 2.5 | P16 | `src/components/PubgMatchTelemetry.jsx` | Replace the LOADING/ERROR placeholders with `TelemetrySkeleton` and `TelemetryAlert`. | `feat(ex3): add skeleton UI & retry alert` |

---

## Checkpoint 3 — Verification

Run from `Ex_3/` in Git Bash, with `npm run dev` for the browser checks.

- [ ] **Build passes:** `npm run build` → no errors.
- [ ] **No `<div>` / `<span>`:** `grep -rn "<div\|<span" src | wc -l` → `0`
- [ ] **No `window.alert`:** `grep -rn "alert(" src | wc -l` → `0`
- [ ] **No insecure URLs:** `grep -rn "http://" src index.html | wc -l` → `0`
- [ ] **No inline style / hex in modules:** `grep -rn "style=" src | wc -l` → `0`; `grep -n "#[0-9a-fA-F]\{3,6\}" src/*.module.css src/components/*.css | wc -l` → `0`
- [ ] **Cleanup present:** `grep -n "abort()" src/components/PubgMatchTelemetry.jsx` → 1 hit inside the effect cleanup.
- [ ] **Slow 3G, 0 CLS:** DevTools → Network → Slow 3G, click a squad. The skeleton appears and the result replaces it with no layout jump (Performance → Layout Shift = 0.00).
- [ ] **Abort test:** click CES → TE → GE quickly. Network shows the first two `squads.json` requests as `(canceled)`, and only GE's result is shown.
- [ ] **No false error on abort:** during the rapid switching above, no alert flashes.
- [ ] **Packet loss and retry:** pick TE or CES (Miramar/Erangel) several times until the alert appears; clicking "Reconnect Satellite (Retry)" re-runs the request and eventually shows the card.
- [ ] **Alert semantics:** DevTools → Accessibility: the error region has role `alert`; the skeleton region reports `busy`.
- [ ] **StrictMode:** no duplicate-request storm or console warnings in dev.
- [ ] **375px:** iPhone SE: `document.documentElement.scrollWidth <= window.innerWidth` → `true`; 1440px has no overflow.
- [ ] **Git history:** `git log --oneline` shows the two Exercise 3 commits above.

---

## Live-defense prep (not part of this exercise)

Slide 24, challenge B asks for a 5-second auto-poll with a Pause toggle and proper cleanup. Nothing here prevents it: `useEffect` already owns an `AbortController` and `retryTick`, so a `setInterval` plus an `isPaused` flag fits into the same effect.
