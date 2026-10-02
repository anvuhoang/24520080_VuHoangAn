# TASK_DECOMPOSITION.md - Exercise 4: Resilient Component Architecture

## 1. Component State Machine Specification
The 4-State Resilient Component manages data fetching lifecycle for project items cleanly and predictably:

```
           ┌───────────────┐
           │    LOADING    │
           └───────┬───────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌───────────┐┌───────────┐┌───────────┐
│   LIVE    ││   EMPTY   ││   ERROR   │
└───────────┘└───────────┘└─────┬─────┘
                                │ Retry Trigger
                                ▼
                         ┌───────────┐
                         │  LOADING  │
                         └───────────┘
```

### State Definitions:
1. **LOADING (T-03A)**: Pure CSS Shimmer Gradient Skeleton screens indicating background loading without layout shifts.
2. **LIVE (T-03B)**: Active grid rendering filled content cards with flexbox metadata badges, category tags, and stats.
3. **EMPTY (T-03C)**: Fallback state when data response is an empty list, presenting user-friendly action guidance.
4. **ERROR (T-03C)**: Failure state triggered by network or API exceptions, featuring accessible retry button with keyboard focus and `aria-live` announcement.

---

## 2. Implementation Pipeline & Sub-Task Breakdown

- **SUB-TASK T-03A: Loading Skeleton**
  - Implement `.skeleton-item`, `.skeleton-card`, `.skeleton-badge`, `.skeleton-title`
  - Apply pure CSS shimmer gradient background with 1.5s infinite keyframe animation
  - `git commit -m 'feat(css): skeleton'`

- **SUB-TASK T-03B: Live Data State**
  - Flexbox metadata badges (`.badge`, tags, status dots)
  - Grid list container (`.projects-grid` with `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`)
  - Rich interactive portfolio cards with hover glassmorphism
  - `git commit -m 'feat(components): live data grid and badges'`

- **SUB-TASK T-03C: Empty & Error States with Accessible Retry**
  - Empty state container with visual icon indicator
  - Error state with `role="alert"` and accessible retry trigger button (`aria-label="Retry loading data"`)
  - Simulated async fetch API engine with interactive state switchers
  - `git commit -m 'feat(state): empty and error resilient states'`
