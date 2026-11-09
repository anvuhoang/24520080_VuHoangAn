# TASK_DECOMPOSITION.md — Lab 3 · Homework 3 (WBS)

> Goal: a "PUBG Vietnam Series Finals Ticket & G-Coin Crate Arena": a zero-drift airdrop countdown, crate and ticket claims with optimistic stock and an automatic rollback on 409 Conflict, and a filterable, sortable squad leaderboard.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md) (section 12 is new for this homework).
> Source: Lab 3 deck, slides 29–30 (HW3 spec, domain contract, `usePubgAirdropTimer` contract).
> Working rule (slide 8): **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).
> All squad and crate numbers are invented **sample data**, shown as such in the page.

---

## Block 1 — Setup

Reuses the Homework 2 toolchain; no new dependencies. Done by copying config files, not by prompting.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Hw_3/` with `package.json` (name `lab3-hw3`), `vite.config.js` (with the `test` block), `index.html` (empty `data:` favicon) and `.gitignore` copied from `Hw_2/`. |
| 0.2 | Copy `src/main.jsx`, `tests/setup.js` and `docs/project-rules.md`; add rules 12.1–12.9. |
| 0.3 | Add placeholder `src/App.jsx` and `src/index.css` so the project builds before any feature exists. |
| 0.4 | Run `npm install` and `npm run build`. |

---

## Contract

Documentation only. The project uses plain JSX, so this block is not compiled. The two interfaces of the slide are kept as they are.

```ts
// src/arena/arenaData.js
type DropPhase = 'WARMUP' | 'AIRDROP_LIVE' | 'LOOTED_OUT' | 'EXPIRED';
interface PubgCrateDrop {
  readonly id: string;             // stable id, also the React key
  readonly title: string;          // 'PVS Finals VIP Pass + 5,000 G-Coin'
  readonly priceVnd: number;       // integer VND
  readonly remainingStock: number; // integer >= 0
  readonly dropEpochMs: number;    // when the airdrop opens
}
interface PubgVnSquadStanding {
  readonly squadId: string;        // 'te' | 'ces' | 'roy' | 'agg'
  readonly squadName: string;
  readonly wwcdCount: number;      // Winner Winner Chicken Dinner
  readonly placementPts: number;
  readonly killPts: number;
}
// The slide's comment lists 'te' | 'ces' | 'ge' | 'agg' but its text lists Roy Esports; the text is followed ('roy').
// CRATES / STANDINGS: frozen arrays of the shapes above. The drop times are offsets from "now",
// computed when the page loads (module load), never a fixed date.

// src/arena/format.js
formatVnd(amount: number): string          // Intl.NumberFormat('vi-VN', currency VND)  ->  '1.200.000 ₫'
formatCountdown(ms: number): string        // 'HH:MM:SS', rounded UP to whole seconds, never negative

// src/arena/dropPhase.js  (pure)
getDropPhase({ nowMs, dropEpochMs, remainingStock, openWindowMs }): DropPhase
//  now < drop                                 -> WARMUP
//  drop <= now < drop + window, stock > 0     -> AIRDROP_LIVE
//  drop <= now,                  stock = 0    -> LOOTED_OUT   (sold out wins over expired)
//  now >= drop + window,         stock > 0    -> EXPIRED

// src/arena/leaderboard.js  (pure)
SORT_KEYS: 'wwcd' | 'placement' | 'kills' | 'total'
totalPts(standing): number                      // placementPts + killPts
selectStandings(standings, { query, minTotal, sortBy }): PubgVnSquadStanding[]
// case-insensitive name filter, minimum total points, immutable sort (toSorted), highest first, ties by name

// src/hooks/usePubgAirdropTimer.js
usePubgAirdropTimer(targetEpochMs: number, serverOffsetMs = 0): { remainingMs: number; isLive: boolean }
// - remaining = max(0, target - (Date.now() + offset)), computed from the clock every time, never decremented
// - re-computed on every tick (200 ms) AND at once when the tab becomes visible again
// - interval and listener removed on cleanup and when the target or the offset changes

// src/arena/mockServer.js
createArenaServer({ crates, latencyMs = 400 }): {
  claim(crateId, { signal }): Promise<{ crateId, remainingStock }>   // rejects ClaimError { status: 409 | 404 } or AbortError
  stockOf(crateId): number
}
// - a claim takes `latencyMs`, honours the AbortSignal, and only changes the server stock when it succeeds
// - 409 Conflict ("looted out") when the server stock is 0

// src/arena/claimReducer.js  (pure)
state: { stock: Record<crateId, number>, inFlight: Record<crateId, claimId>, notice: { kind: 'idle' | 'ok' | 'conflict' | 'error', crateId?: string } }
actions: CLAIM_START { crateId, claimId } | CLAIM_OK { crateId, claimId, remainingStock } | CLAIM_CONFLICT { crateId, claimId } | CLAIM_FAILED { crateId, claimId }
// - CLAIM_START: ignored when that crate is already in flight or its stock is 0; otherwise stock - 1 (optimistic) and the claim is locked
// - CLAIM_OK: stock := the server's number; lock released
// - CLAIM_CONFLICT: the optimistic unit is given back, then the server is the truth (stock 0); lock released
// - CLAIM_FAILED: the optimistic unit is given back; lock released
// - an action whose claimId is not the current one for that crate is ignored (stale answer)

// src/hooks/useCrateClaims.js
useCrateClaims(crates, server): { stock, inFlight, notice, claim(crateId) }
// - claim() creates a claimId with crypto.randomUUID() in the handler, dispatches CLAIM_START, calls server.claim with an AbortSignal
// - an unmount aborts every request in flight; an aborted request changes nothing and shows no error
```

---

## Block 2 — Domain logic (pure functions)

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 1.1 | P1 | `formatVnd` and `formatCountdown` | `src/arena/format.js` |
| 1.2 | P2 | Crates, standings (frozen, with stable ids) | `src/arena/arenaData.js` |
| 1.3 | P3 | `getDropPhase`, the four phases | `src/arena/dropPhase.js` |
| 1.4 | P4 | `totalPts`, `selectStandings` | `src/arena/leaderboard.js` |

## Block 3 — Zero-drift timer

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 2.1 | P5 | `usePubgAirdropTimer` with `visibilitychange` resync | `src/hooks/usePubgAirdropTimer.js` |

## Block 4 — Optimistic claim and 409 rollback

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 3.1 | P6 | Mock server with latency, abort and 409 | `src/arena/mockServer.js` |
| 3.2 | P7 | Claim reducer with the in-flight lock and the rollback | `src/arena/claimReducer.js` |
| 3.3 | P8 | `useCrateClaims` hook | `src/hooks/useCrateClaims.js` |

## Block 5 — Interface

| ID  | Prompt | Task | Output |
| --- | ------ | ---- | ------ |
| 4.1 | P9 | Design tokens | `src/index.css` |
| 4.2 | P10 | `CrateCard` (countdown, phase, price, stock, claim button) | `src/components/CrateCard.jsx` |
| 4.3 | P11 | Style `CrateCard` | `src/components/CrateCard.module.css` |
| 4.4 | P12 | `CrateArena` (list of cards, claim notice) | `src/components/CrateArena.jsx` |
| 4.5 | P13 | Style `CrateArena` | `src/components/CrateArena.module.css` |
| 4.6 | P14 | `Leaderboard` (search, minimum points, sort, live count) | `src/components/Leaderboard.jsx` |
| 4.7 | P15 | Style `Leaderboard` | `src/components/Leaderboard.module.css` |
| 4.8 | P16 | `App` (one `<main>`, `<h1>`, the two sections, a "sample data" note) | `src/App.jsx` |
| 4.9 | P17 | Style `App` | `src/App.module.css` |

## Block 6 — Tests (after the code, one flat `tests/` folder)

| ID  | Task | Output |
| --- | ---- | ------ |
| 5.1 | `formatVnd`, `formatCountdown`, `getDropPhase` | `tests/format.test.js`, `tests/dropPhase.test.js` |
| 5.2 | `selectStandings` (filter, sort, no mutation) | `tests/leaderboard.test.js` |
| 5.3 | Timer: no drift when ticks are late, resync on `visibilitychange`, cleanup | `tests/usePubgAirdropTimer.test.jsx` |
| 5.4 | Mock server: latency, abort, 409 | `tests/mockServer.test.js` |
| 5.5 | Reducer: optimistic deduction, lock, rollback, stale answers | `tests/claimReducer.test.js` |
| 5.6 | Hook and `CrateArena`: double click, 409 rollback, unmount abort | `tests/useCrateClaims.test.jsx`, `tests/CrateArena.test.jsx` |
| 5.7 | `CrateCard`, `Leaderboard`, `App` (landmarks, labels, no `<div>`) | `tests/CrateCard.test.jsx`, `tests/Leaderboard.test.jsx`, `tests/App.test.jsx` |

## Checkpoint (after each prompt)

- `grep` the file for banned things: `<div`, `<span`, `keyCode`, `alert(`, `console.`, `http://`, hex colours in modules, `setInterval` without `clearInterval`.
- Run it in headless Chrome and read the real output (DOM, accessibility tree, timers, calls to the mock server).
- `npm run build` passes; Lighthouse Accessibility 100 at the end; 375px with no sideways scroll.
- Write the row in PROMPT_LOG.md with the date only, and the commit hash after committing.

## Commit plan

| Commit | Content |
| ------ | ------- |
| 1 | `chore(hw3): scaffold project and add docs rules and decomposition` |
| 2 | `feat(hw3): add arena data, formatting, drop phase and leaderboard logic` |
| 3 | `feat(hw3): add zero-drift airdrop timer hook` |
| 4 | `feat(hw3): add optimistic claim with in-flight lock and 409 rollback` |
| 5 | `feat(hw3): add design tokens and crate card` |
| 6 | `feat(hw3): add crate arena, leaderboard and app` |
| 7 | `test(hw3): add unit and integration tests` |
| 8 | `docs(hw3): add prompt log, failure audit and lessons learned` |
