# Task Decomposition — Lab 2, Exercise 3 (Resilient State Machine & Skeleton Loader)

## 1. State Machine Architecture (ViewState<T>)

The component is modeled as a strictly typed 4-state state machine:

```
               ┌──────────┐
               │   IDLE   │
               └────┬─────┘
                    │ Fetch Trigger
                    ▼
               ┌──────────┐
      ┌───────>│ LOADING  │<───────┐
      │        └────┬─────┘        │
      │ Retry       │              │ Retry
      │ Trigger     ├──────────────┼────────┐
      │             ▼              ▼        │
┌─────┴─────┐ ┌───────────┐  ┌───────────┐  │
│   ERROR   │ │  SUCCESS  │  │   EMPTY   │  │
└───────────┘ └───────────┘  └───────────┘  │
```

### TypeScript Discriminated Union:
```typescript
export type ViewState<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | { status: 'SUCCESS'; data: T }
  | { status: 'ERROR'; error: string };
```

---

## 2. Implementation Pipeline & Phased Tasks

### Phase 0 — Planning & Requirements Analysis (No commit)
| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **P0.1** | Define `PROJECT_RULE.md` for Ex_3 | None | State machine contract, race condition handling, skeleton CSS rules, and accessibility guidelines documented. |
| **P0.2** | Write `TASK_DECOMPOSITION.md` for Ex_3 | P0.1 | Phased task breakdown, 4-state transitions, and verification criteria established. |

---

### Phase 1 — State Machine & Async Fetch Engine with Race-Condition Guard
| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **S1.1** | Define `ViewState<T>` discriminated union | P0.2 | Explicit `{ status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' }` shape with type guards. |
| **S1.2** | Implement state machine reducer / transitions | S1.1 | Deterministic transitions: `IDLE -> LOADING -> SUCCESS | ERROR`, and `ERROR -> LOADING` on retry. |
| **S1.3** | Implement async fetch engine with race-condition guard | S1.2 | Request sequence tokens or `AbortController` ensure stale/out-of-order responses are discarded. |

---

### Phase 2 — Animated CSS Skeleton Loader
| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **K2.1** | Implement skeleton wireframe layout | S1.3 | Semantic skeleton cards mirroring final content layout to eliminate Cumulative Layout Shift (CLS). |
| **K2.2** | Implement shimmer gradient animation | K2.1 | Pure CSS shimmer gradient with infinite keyframe sweep; respects `prefers-reduced-motion`. |

---

### Phase 3 — Resilient Error State, Accessible Retry & Success UI
| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **U3.1** | Implement Error State with Retry Connection | S1.3, K2.2 | Human-readable error description, `role="alert"`, `aria-live="polite"`, and accessible "Retry Connection" button. |
| **U3.2** | Implement Success State UI | U3.1 | Renders loaded data items into accessible semantic card layout using Exercise 2 reactive engine concepts. |

---

### Phase 4 — Verification & Integration
| ID | Task | Depends on | Acceptance criteria |
| :--- | :--- | :--- | :--- |
| **V4.1** | Automated test suite execution | U3.2 | Unit tests verify all 4 states, race condition mitigation, and retry transitions. |
| **V4.2** | Browser interactive verification | V4.1 | Visual confirmation of shimmer animation, error display, and retry reconnection in `index.html`. |
