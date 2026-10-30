# PROMPT_LOG.md — Lab 3 · Exercise 1

> AI assistant: Claude Code (VS Code extension). All prompts were sent on 2026-10-30; exact times were not recorded.
> Task IDs refer to [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md). `—` = no matching task.
> Commit hashes are `TODO` until the three planned commits are made — fill them in from `git log --oneline`.

| # | Time | Task ID | Prompt | Result | Manual changes | Commit |
|---|------|---------|--------|--------|----------------|--------|
| 1 | 2026-10-30 | 0.5 | "Write a PROJECT_RULE.md (AI governance rules, used as .cursorrules)… 11 numbered sections… Output only the markdown file." | Accepted | Moved to `Ex_1/docs/`. | `chore: init react19 vite & rules` — `TODO` |
| 2 | 2026-10-30 | — (WBS) | "Write a TASK_DECOMPOSITION.md (WBS) for Lab 3 Exercise 1… Block 1 setup, props contract, sub-task table, Checkpoint 1." | Accepted | Moved to `Ex_1/docs/`. | `chore: init react19 vite & rules` — `TODO` |
| 3 | 2026-10-30 | 0.3 | "Write src/main.jsx that mounts `<App />` with createRoot… inside StrictMode, throwing an error if #root is missing." | Accepted | Moved into `Ex_1/src/`. | `chore: init react19 vite & rules` — `TODO` |
| 4 | 2026-10-30 | 1.1 | "Write src/components/SkillBadge.jsx… default params name = 'Unnamed Skill', tier = 'Core'. Render a `<span>`… class per tier (core, awareness, later)." | Accepted | None. Conflicts with Rule 2.1 and with task 1.1 (see Audit #02, #05). | `feat(ex1): implement semantic DeveloperCard and SkillBadge` — `TODO` |
| 5 | 2026-10-30 | 1.2–1.7 | "Write src/components/DeveloperCard.jsx. Zero `<div>`, `<article aria-labelledby>` with useId(), header + hgroup, `<dl>` via Object.entries + Fragment key, `<ul aria-label="Engineered Skills">`…" | Accepted | None. Prop named `fullName`, contract says `name` (see Audit #05). | `feat(ex1): implement semantic DeveloperCard and SkillBadge` — `TODO` |
| 6 | 2026-10-30 | 1.4–1.5 | "Add an avatar fallback… only render `<img>` if avatarUrl starts with https://… On onError, switch via useState to a `<span role="img" aria-label>`… up to 2 uppercase initials." | Accepted | None. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` — `TODO` |
| 7 | 2026-10-30 | 2.2–2.4 | "Write src/components/DeveloperCard.module.css… custom properties on .card, metrics 3-column grid, at max-width 400px switch to key-value rows, wrapping skills, zero horizontal scroll at 375px." | Accepted | None (see Audit #03, #06). | `style(ex1): add responsive 375px CSS module` — `TODO` |
| 8 | 2026-10-30 | 1.8 | "Write src/App.jsx: a `<main>` containing an `<h1>` and a `<section aria-label>` grid rendering 2 DeveloperCard instances… one profile with a deliberately broken avatar URL." | Accepted | Replaced by prompt #13. | `feat(ex1): implement semantic DeveloperCard and SkillBadge` — `TODO` |
| 9 | 2026-10-30 | — (docs) | "Create AI_FAILURE_AUDIT.md and PROMPT_LOG.md… Use ONLY the data I provide…" (data section left as the template placeholder) | Rejected | AI declined to write the files without real data; no commits existed yet. | — |
| 10 | 2026-10-30 | 0.1 | "In Ex_1/, create package.json, vite.config.js, index.html… react/react-dom ^19, vite ^7, @vitejs/plugin-react ^5…" | Accepted | Moved `main.jsx`, `App.jsx`, `components/` into `Ex_1/src/`; ran `npm install`. | `chore: init react19 vite & rules` — `TODO` |
| 11 | 2026-10-30 | 2.1–2.2 | Screenshot of the Vite overlay: "Failed to resolve import './App.module.css' from 'src/App.jsx'." | Accepted | None. AI created `App.module.css` and `SkillBadge.module.css` (see Audit #01). | `style(ex1): add responsive 375px CSS module` — `TODO` |
| 12 | 2026-10-30 | 0.1 | "create .gitignore" | Accepted | A copy also exists at the repo root. | `chore: init react19 vite & rules` — `TODO` |
| 13 | 2026-10-30 | 1.8, 2.2–2.6 | "Restyle Exercise 1 as football player cards… 4 players, DiceBear HTTPS avatars, one broken URL, FUT-style card, 96px avatar with glow ring, tier pills gold/silver/bronze, hover lift, 1→4 column grid." | Accepted | None. Stats in `App.jsx` are sample values, not real statistics. | `style(ex1): add responsive 375px CSS module` — `TODO` |
| 14 | 2026-10-30 | — (docs) | "next write PROMPT_LOG.md and AI_FAILURE_AUDIT.md" | Accepted | Fill in commit hashes and DevTools screenshots. | `TODO` |

> The question "what is the purpose of Ex_1\dist\" (asked between #12 and #13) produced no code and is not numbered.

## Lessons Learned

1. **The prompt beats the rules file unless someone checks.** Prompts #4, #6 and #7 asked for `<span>`, a `max-width` query and tokens on `.card`, all of which contradict PROJECT_RULE.md. The AI followed the prompt and only flagged the conflict in chat. Either the prompt or the rule has to change; otherwise the "rules" are documentation, not governance.
2. **Run the build after every generated file.** The AI wrote `import styles from './App.module.css'` without creating that file (Audit #01). Nothing caught it until the Vite overlay in the browser. `npm run build` after each step would have caught it immediately.
3. **Keep the plan in sync with the code.** The props contract still says `name` and tiers `beginner…expert`, while the code uses `fullName` and `Core / Awareness / Later` (Audit #05). Commit after each WBS block, and update TASK_DECOMPOSITION.md in the same commit when a prompt changes the contract.
