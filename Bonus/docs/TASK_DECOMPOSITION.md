# TASK_DECOMPOSITION.md — Lab 3 · Bonus Exercise (WBS)

> Goal: A "Situationship Analyzer" implementing the "Hẹn Hò Nhưng Không Yêu" Finite State Machine inspired by Wendy Thảo's hit song. It solves "situationship boolean soup" (`isDating && !isLoved`) via a deterministic FSM (`FRIENDS`, `DATING_NO_LOVE`, `COMMITTED`, `GHOSTED_EXIT`, `SELF_RESPECT_EXIT`), calculates asymmetric effort ("Em cố trăm lần chẳng bằng ai đó một phần") purely during render as derived state, and enforces a leak-free 5-second "Seen không rep" ghosting timer governed by `AbortController`.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md) (section 12 is specific to this exercise).
> Source: Lab 3 deck, slides 31–32 (Bonus Exercise spec, domain contract, `SituationshipAnalyzer` reference contract).
> Working rule (slide 8): **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).
> All character metrics and effort logs are invented **domain simulation data**, presented as such in the page.

---

## Block 1 — Setup

Reuses the Lab 3 Vite + Vitest toolchain; no external UI library. Done by copying config files, not by prompting.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Bonus/` with `package.json` (name `lab3-bonus`), `vite.config.js` (with the `test` block), `index.html` (empty `data:` favicon) and `.gitignore` copied from `Hw_3/`. |
| 0.2 | Copy `src/main.jsx`, `tests/setup.js` and `docs/project-rules.md`; add rules 12.1–12.9. |
| 0.3 | Add placeholder `src/App.jsx` and `src/index.css` so the project builds before any feature exists. |
| 0.4 | Run `npm install` and `npm run build`. |

---

## Contract

Documentation only. Plain JSX project (not TypeScript). Reconciles slide 31 & slide 32 specifications into a unified, type-safe contract.

```ts
// src/situationship/constants.js
export type RelationshipPhase =
  | 'FRIENDS'           // Initial mutual connection
  | 'DATING_NO_LOVE'    // 'Hẹn hò nhưng không yêu' situationship
  | 'COMMITTED'         // Verified mutual commitment
  | 'GHOSTED_EXIT'      // Unreciprocated ping for >5s -> unmounted & memory freed
  | 'SELF_RESPECT_EXIT';// Em chủ động buông tay & unbind

export interface EffortSignal {
  readonly id: string;           // crypto.randomUUID()
  readonly actor: 'EM' | 'AI_DO';
  readonly label: string;        // 'Nấu cơm 100 lần', 'Gửi 1 tin nhắn', etc.
  readonly steps: number;        // integer >= 1
  readonly multiplier: number;   // 0.1 for EM vs 50.0 for AI_DO
  readonly timestamp: number;
}

// src/situationship/effortMetrics.js (pure)
calculateImpact(steps: number, multiplier: number): number
calculateEffortDerived({ myTries, rivalTries, phase }): {
  myImpact: number;              // myTries * 0.1
  rivalImpact: number;           // rivalTries * 50.0
  isRedFlag: boolean;            // phase === 'DATING_NO_LOVE' && myImpact < rivalImpact
  ratio: number;                 // rivalImpact / (myImpact || 1)
  alertMessage: string;          // WCAG announcement text
  phaseDescription: string;
}
createSignal({ actor, label, steps }): EffortSignal

// src/situationship/situationshipReducer.js (pure)
state: {
  phase: RelationshipPhase;
  myTries: number;
  rivalTries: number;
  signals: EffortSignal[];
  pendingMessage: { id: string; text: string; sentAt: number } | null;
  lastActionNotice: string;
}
actions:
  | { type: 'TRANSITION_PHASE'; payload: { nextPhase: RelationshipPhase } }
  | { type: 'ADD_EFFORT'; payload: { actor: 'EM' | 'AI_DO'; steps: number; label?: string } }
  | { type: 'START_MESSAGE'; payload: { messageId: string; text: string } }
  | { type: 'MESSAGE_REPLIED'; payload: { messageId: string } }
  | { type: 'MESSAGE_GHOSTED'; payload: { messageId: string } }
  | { type: 'ABORT_MESSAGE' }
  | { type: 'RESET' }

// src/situationship/messageService.js
sendSimulatedMessage({ text, latencyMs = 6000, signal }: { text: string; latencyMs?: number; signal?: AbortSignal }): Promise<{ reply: string }>
// - Resolves after latencyMs with a reply message if signal is not aborted
// - Rejects with AbortError if controller.abort() is called
// - Defaults to 6000ms latency so the 5000ms ghosting timer triggers naturally unless aborted

// src/hooks/useGhostingTimer.js
useGhostingTimer({
  phase: RelationshipPhase;
  pendingMessage: { id: string; text: string; sentAt: number } | null;
  onGhosted: (messageId: string) => void;
  timeoutMs?: number; // default 5000ms
}): {
  remainingMs: number;
  secondsLeft: number;
  isWaitingReply: boolean;
  cancelMessage: () => void;
}
// - Starts countdown only when phase === 'DATING_NO_LOVE' and pendingMessage is active
// - On 5000ms expiration, calls onGhosted(messageId) deterministically
// - Aborts pending promise and clears timeout on unmount, phase change, or manual cancel
```

---

## Block 2 — Domain logic (pure functions)

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 1.1 | P1 | Constants (`RELATIONSHIP_PHASES`, `ACTOR_CONFIG`, default initial state) | `src/situationship/constants.js` |
| 1.2 | P2 | Pure effort metrics & derived state calculations | `src/situationship/effortMetrics.js` |
| 1.3 | P3 | Situationship FSM reducer & transition invariants | `src/situationship/situationshipReducer.js` |
| 1.4 | P4 | Mock abortable messaging service with `AbortSignal` | `src/situationship/messageService.js` |

## Block 3 — Ghosting timer hook

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 2.1 | P5 | `useGhostingTimer` hook with 5s timeout & AbortController | `src/hooks/useGhostingTimer.js` |

## Block 4 — Interface & Components

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 3.1 | P6 | Global dark V-Pop design tokens & WCAG colors | `src/index.css` |
| 3.2 | P7 | `EffortCard` component (accessible inputs via `useId`, comparison `<dl>`) | `src/components/EffortCard.jsx` |
| 3.3 | P8 | Style `EffortCard` (mobile-first, 375px responsive, no div-soup) | `src/components/EffortCard.module.css` |
| 3.4 | P9 | `SituationshipAnalyzer` component (FSM banner, ping simulator, red-flag alert, unbind) | `src/components/SituationshipAnalyzer.jsx` |
| 3.5 | P10 | Style `SituationshipAnalyzer` | `src/components/SituationshipAnalyzer.module.css` |
| 3.6 | P11 | `App` root layout (one `<main>`, semantic `<section>`, sample data note) | `src/App.jsx` |
| 3.7 | P12 | Style `App` | `src/App.module.css` |

## Block 5 — Tests (after all code, flat `tests/` folder)

10 files covering all units, FSM transitions, abort signals, ghosting timer cleanup, and accessibility tree:

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 4.1 | `tests/constants.test.js` | Frozen constants, valid phases, actor weights (0.1 vs 50.0). |
| 4.2 | `tests/effortMetrics.test.js` | Pure impact math, derived red-flag flags, zero division safety, boundary conditions. |
| 4.3 | `tests/situationshipReducer.test.js` | Valid FSM transitions, rejection of invalid phase hops, immutable signal logging, reset integrity. |
| 4.4 | `tests/messageService.test.js` | Simulated latency, AbortSignal cancellation without hanging timers, resolution on valid responses. |
| 4.5 | `tests/useGhostingTimer.test.jsx` | 5s countdown, auto-trigger of `MESSAGE_GHOSTED`, immediate abort on unmount/cancel, StrictMode resilience. |
| 4.6 | `tests/EffortCard.test.jsx` | Numeric type safety (`valueAsNumber`), accessible `<label htmlFor>`, `<dl>/<dt>/<dd>` structure, zero `<div>`/`<span>`. |
| 4.7 | `tests/SituationshipAnalyzer.test.jsx` | Full Situationship lifecycle: DATING_NO_LOVE -> Red-Flag alert -> 5s Seen Không Rep -> GHOSTED_EXIT, unbind memory release, aria-live status polite announcement. |
| 4.8 | `tests/App.test.jsx` | Single `<main>`, heading hierarchy (`<h1>`, `<h2>`, `<h3>`), responsive layout, no div-soup. |

## Checkpoint (after each prompt)

- `grep` the file for banned patterns: `<div`, `<span`, `keyCode`, `alert(`, `console.`, `http://`, hex colors in modules, `setInterval`/`setTimeout` without cleanup.
- Test in jsdom with fake timers / Node pure checks / Chrome headless for CSS.
- `npm run build` passes; Lighthouse Accessibility 100; 375px zero horizontal scroll.
- Write row in `PROMPT_LOG.md` (date only, commit hash later).

## Commit plan

| Commit | Content |
| ------ | ------- |
| 1 | `chore(bonus): scaffold project and add docs rules and decomposition` |
| 2 | `feat(bonus): add constants, effort metrics and FSM reducer` |
| 3 | `feat(bonus): add abortable message service and ghosting timer hook` |
| 4 | `feat(bonus): add design tokens and effort card component` |
| 5 | `feat(bonus): add situationship analyzer and app` |
| 6 | `test(bonus): add unit and integration tests` |
| 7 | `docs(bonus): add prompt log, failure audit and lessons learned` |
| 8 | `docs(bonus): record commit hashes` |

