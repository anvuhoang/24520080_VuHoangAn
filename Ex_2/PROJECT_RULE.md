# Project Rules — Lab 2, Exercise 2 (Reactive Engine & Task Manager)

## 1. Scope & Stack
- Build a custom reactive state management engine (`useState`, `stateStore`, `resetCursor`) and an interactive Task Manager using semantic HTML5, Vanilla JavaScript (ES6+), native DOM APIs, and ES Modules.
- Strictly forbidden: React, Redux, third-party frameworks, bundlers, external runtime dependencies, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `eval`.

## 2. Reactive Engine Architecture
- **State Store & Cursor:** Centralized `stateStore` array retains state items across render cycles. A cursor index tracks the current hook call and must be reset via `resetCursor()` at the start of each render pass.
- **`useState` Closure:** Each `useState(initialValue)` call captures its slot index in a closure. Calling `setState(newValue)` updates the slot in `stateStore` and triggers a top-down re-render.
- **Unidirectional Data Flow:** State flows downwards from components; user interactions trigger state updates via setters, driving re-rendering.

## 3. Root Event Delegation
- Attach event listeners (e.g. `click`, `submit`, `input`) strictly to the root application container rather than individual child elements.
- Intercept user actions via event delegation (e.g., using `event.target.closest('[data-action]')` or semantic element inspection).

## 4. Security & Sanitization
- Treat all task titles, descriptions, and user inputs as inert text. Never evaluate strings or interpret them as markup.
- All user text must be mounted via `document.createTextNode()` or safe native property assignment (`textContent`).
