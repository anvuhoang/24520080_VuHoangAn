# Lab 3 — Production React 19 (UIT)

**Student:** Vũ Hoàng An (24520080) · **Course:** Web programming, University of Information Technology, VNUHCM · **Branch:** `lab-3`

Deliverables of Lab 3 (React 19 + Vite, plain JSX): three in-class exercises and three homeworks. Each one is its own small Vite project, so each can be installed, run and tested on its own.

## Where is what

| Folder | Slide | What it is | Tests |
| ------ | ----- | ---------- | ----- |
| [`Ex_1/`](Ex_1) | Exercise 1 (Sprint 1) | `DeveloperCard` and `SkillBadge`: semantic `<article>`/`<dl>`, no `<div>`, HTTPS avatar with a fallback | — |
| [`Ex_2/`](Ex_2) | Exercise 2 (Sprint 2) | Pioneer directory: search, minimum IQ, `toSorted`, delete and reset, derived state with no `useEffect` | — |
| [`Ex_3/`](Ex_3) | Exercise 3 (Sprint 3) | PUBG VN match telemetry: four-state machine, skeleton, `AbortController`, retry alert | — |
| [`Hw_1/`](Hw_1) | Homework 1 | Studio drum kit: `e.code` keys, hit log, level meter | 99 (93 pass, 6 expected failures) |
| [`Hw_2/`](Hw_2) | Homework 2 | 88-key piano: generated keys, 8-voice synth with FIFO voice stealing, recorder and replay on the Lab 2 `AudioTaskQueue` | 149 (144 pass, 5 expected failures) |
| [`Hw_3/`](Hw_3) | Homework 3 | PUBG VN arena: zero-drift airdrop countdown, optimistic claim with rollback on 409, filterable leaderboard | 145 (143 pass, 2 expected failures) |

The slide for the final submission draws one project with `src/homeworks/…`. Here every exercise and homework is a separate project with the same toolchain instead, so that each one builds and runs alone and keeps its own documents and history.

## Run a project

```bash
cd Hw_3            # or Ex_1, Ex_2, Ex_3, Hw_1, Hw_2
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm test           # Hw_1, Hw_2 and Hw_3 only (Vitest + Testing Library, jsdom)
```

Node 22.12 or newer (Vitest 5 needs it; Vite 7 alone needs 20.19). Stack: React 19, Vite 7, CSS Modules, no UI library.

## Documents (in each project's `docs/`)

| File | Content |
| ---- | ------- |
| `project-rules.md` | The rules the code was generated under: no class components, `ReactDOM.render`, `defaultProps`, `keyCode` or `alert()`; no `<div>`/`<span>`; `useId` labels; immutable state; cleanup for every effect; tokens only in CSS. Hw_3 adds rules for the clock, money and network. |
| `TASK_DECOMPOSITION.md` | The work broken into tasks, one prompt and one file per row, the contract (props, state, functions) and the checkpoint. |
| `PROMPT_LOG.md` | One row per prompt that was sent: the prompt, the result, what was changed by hand, what was measured, and the commit. Dates only. Ends with Lessons Learned (homeworks). |
| `AI_FAILURE_AUDIT.md` | The defects found in AI-generated code, each with the code, the proof (a DevTools or test result) and the fix or its status. |

| Project | Prompts logged | Audit entries |
| ------- | -------------- | ------------- |
| Ex_1 | 15 | 6 |
| Ex_2 | 3 | 3 |
| Ex_3 | 17 | 4 |
| Hw_1 | 15 | 7 |
| Hw_2 | 17 | 6 |
| Hw_3 | 18 | 13 |

## How the work was checked

- **Tests** (homeworks): the checks that were run by hand after each prompt are kept as permanent tests in a single flat `tests/` folder per project. Known defects that were left open on purpose are written as `it.fails`: the test passes while the defect exists and starts failing when it is fixed, then it is changed to a normal `it`. That is what the "expected failures" in the table are.
- **Real browser:** from the first component on, each piece was also run in headless Chrome with the real CSS at several widths (375, 768 and 1440 px among them), reading computed styles, the accessibility tree, focus and timers.
- **Lighthouse 13.6.0, Accessibility:** 100 on mobile and on desktop for Hw_1, Hw_2 and Hw_3 (Hw_3 also scores 100 for Best Practices and 97 / 100 for Performance).
- **Mutation check (Hw_3):** the source was broken 32 ways, one at a time; 31 were caught by the tests. The one that was not is an equivalent change, explained at the end of `Hw_3/docs/AI_FAILURE_AUDIT.md`.
- **Not hidden:** every audit lists what is still open, and a Lighthouse score of 100 is not treated as proof that a page works (see Lessons Learned in the three homework logs).

## Git

- Work is on the `lab-3` branch, in small commits that follow each project's `TASK_DECOMPOSITION.md` (`feat(hw3): …`, `test(hw3): …`, `docs(hw3): …`).
- The commits are authored by the student only.
- The commit hash of each prompt is in the last column of its `PROMPT_LOG.md`.

## Data

The crates, prices, stock and squad scores in Hw_3 are invented sample data, not official PUBG Vietnam Series results or offers; the page says so in a visible note and in the table caption.
