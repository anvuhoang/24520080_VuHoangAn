# PROMPT_LOG.md — Lab 3 · Exercise 2

> AI assistant: Claude Code (VS Code extension). All prompts were sent on 2026-11-01; exact times were not recorded.
> **Wording:** the original messages were short Vietnamese instructions. They are restated below in full sentences, keeping the same intent and scope, so the log is readable. Nothing was added to what was asked.
> Task IDs refer to [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md). `—` = no matching task.
> Commit hashes are `TODO` until the three Exercise 2 commits are made — fill them in from `git log --oneline`.

| # | Time | Task ID | Prompt | Result | Manual changes | Commit |
|---|------|---------|--------|--------|----------------|--------|
| 1 | 2026-11-01 | 0.1–0.4, 1.1–1.4, 2.1–2.5, 3.1–3.4 | "Build Exercise 2 (Scientist & Pioneer Directory, slides 18–19 of the Lab 3 deck) in a new `Ex_2/` folder, following the same stack and rules as Exercise 1." | Modified | I interrupted the run while the CSS files were being written, so only the JSX, data and `index.css` existed. I asked for a recheck of what was on disk before resuming. | `TODO` |
| 2 | 2026-11-01 | 1.4, 2.5, 0.4 | "Continue Exercise 2: write the remaining CSS modules, install dependencies and run the build." | Accepted | None. AI also reworded one code comment so the zero-`useEffect` grep returns 0 (Audit #01). | `TODO` |
| 3 | 2026-11-01 | — (docs) | "Write the Exercise 2 docs (`TASK_DECOMPOSITION.md`, `PROMPT_LOG.md`, `AI_FAILURE_AUDIT.md`) in the same format as Exercise 1, and restate my prompts correctly in the log." | Accepted | Fill in commit hashes and DevTools screenshots. AI also fixed `aria-label` → `aria-labelledby` on `PioneerItem` while checking (Audit #02). | `TODO` |

> Prompt #1 was a single request for the whole exercise. Slide 8 of the deck asks for atomic, per-task prompts, so for the next exercises each WBS row (1.1, 1.2, …) should be its own prompt and its own commit.

## Lessons Learned

1. **Search for forbidden words, including in comments.** A comment saying "no useEffect" made `grep -rn useEffect src` return 1 (Audit #01). Checkpoint greps cannot tell comments from code, so keep rule keywords out of comments.
2. **Check the disk after an interrupted run.** Stopping the run left a half-written project. Listing the files first showed exactly which ones were missing, so nothing was rewritten twice.
3. **Follow the lab's own accessibility convention.** The reference `DeveloperCard` binds `<article>` to its heading with `aria-labelledby`, but the first draft of `PioneerItem` used a duplicate `aria-label` (Audit #02). Reading the reference contract against the generated code catches this.
