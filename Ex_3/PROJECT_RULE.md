# Project Rules — Lab 2, Exercise 3 (Resilient State Machine & Skeleton Loader)

## 1. Scope & Stack
- Build a resilient 4-state asynchronous state machine (`ViewState<T>`) and animated skeleton loader using semantic HTML5, Vanilla JavaScript (ES6+) with TypeScript types/JSDoc, native DOM APIs, and CSS.
- Strictly forbidden: React, third-party state libraries, external CSS frameworks, and dangerous DOM APIs (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`).

## 2. State Machine Specification
- Model view state as a TypeScript discriminated union:
  - `IDLE`: Initial un-triggered state.
  - `LOADING`: Active background fetch; display animated CSS skeleton loader.
  - `SUCCESS`: Successfully retrieved payload; render live content cards.
  - `ERROR`: Failure state; display human-readable error with "Retry Connection" button.
- Transitions must be deterministic:
  - `IDLE -> LOADING`
  - `LOADING -> SUCCESS` or `LOADING -> ERROR`
  - `ERROR -> LOADING` (via user retry trigger)

## 3. Race-Condition Protection
- Asynchronous data operations must be guarded against out-of-order execution and race conditions.
- Implement generation/sequence tracking or `AbortController` so older in-flight requests cannot overwrite newer state transitions.

## 4. UI & Accessibility Conventions
- **Skeleton Screens:** Pure CSS linear-gradient shimmer animation matching the dimensions of live content cards to prevent Cumulative Layout Shift (CLS). Include `@media (prefers-reduced-motion)` fallback.
- **Error Presentation:** Semantic alert container with `role="alert"` and `aria-live="polite"`. The "Retry Connection" button must have an accessible name and keyboard focus indicator.
- **Security:** Mount dynamic text using native text nodes or `textContent`; never inject unsanitized HTML.
