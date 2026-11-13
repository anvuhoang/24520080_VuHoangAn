# project-rules.md — Lab 4 · Homework 1 (Evidence Gallery)

> Stack: React 19 · Vite · ES2024 · plain JSX (no TypeScript).
> These rules are mandatory. Any generated code that breaks a rule is invalid and must be regenerated.

## 1. Banned Legacy APIs

1.1. Do not write class components. Use function components only.
1.2. Do not call `ReactDOM.render`.
1.3. Do not use `Component.defaultProps`. Use ES6 default parameters.
1.4. Do not write `import * as React from 'react'`. Use named imports (`import { useState } from 'react'`).
1.5. Do not read `event.keyCode`. Use `event.key`.
1.6. Do not call `window.alert`, `window.confirm`, or `window.prompt`. Render UI feedback in the DOM.
1.7. Do not import `antd/dist/antd.css` or any global vendor stylesheet.
1.8. Do not use `http://` URLs. Use `https://` only.

## 2. Zero Div-Soup

2.1. Do not use `<div>` or `<span>` for structure.
2.2. Use semantic tags only: `<main>`, `<section>`, `<article>`, `<header>`, `<hgroup>`, `<dl>`/`<dt>`/`<dd>`, `<ul>`/`<li>`, `<figure>`, `<output>`.
2.3. Use `<Fragment>` (or `<>`) when no wrapper element is needed.
2.4. Render exactly one `<main>` per page.
2.5. Give every `<section>` and `<article>` a heading.

## 3. Mounting

3.1. Import `createRoot` from `'react-dom/client'`.
3.2. Wrap the root `<App />` in `<StrictMode>`.
3.3. Mount once, in `src/main.jsx` only:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

## 4. Components

4.1. Write components as pure functions: same props → same output, no side effects during render.
4.2. Destructure props in the parameter list.
4.3. Set defaults with ES6 default parameters: `function Card({ title = 'Untitled', children }) {}`.
4.4. Compose with `children` instead of deep prop drilling or config objects.
4.5. Give every `<button>` an explicit `type` — `type="button"` unless it submits a form (`type="submit"`).
4.6. Use one default-exported component per file, named in PascalCase to match the filename.

## 5. Lists & Keys

5.1. Use stable entity IDs (`item.id`) as `key`.
5.2. Never use the array index as `key`.
5.3. Never use raw values (strings, numbers, labels) as `key`.
5.4. Generate IDs at data creation time with `crypto.randomUUID()`, never during render.
5.5. Iterate objects with `Object.entries(obj).map(([id, value]) => …)`, using the entry key as `key`.

## 6. Forms

6.1. Pair every `<input>`, `<select>`, and `<textarea>` with a `<label htmlFor>`.
6.2. Generate the `id`/`htmlFor` pair with `useId()`. Never hardcode IDs.
6.3. Handle submission with `onSubmit` on `<form>` and call `event.preventDefault()`.
6.4. Show computed or live results in `<output htmlFor>`.

## 7. State

7.1. Update state immutably: spread, `map`, `filter`, `toSorted`, `with`, `structuredClone`.
7.2. Never mutate state with `push`, `splice`, `sort`, `reverse`, or direct assignment.
7.3. Use functional updates when the next state depends on the previous: `setCount((c) => c + 1)`.
7.4. Compute derived data during render (`const total = items.reduce(…)`).
7.5. Never sync derived data into state with `useEffect`.
7.6. Store the minimal state; derive everything else.

## 8. Effects

8.1. Use `useEffect` only to sync with external systems (timers, listeners, network, DOM APIs).
8.2. Return a cleanup function from every effect that starts a timer: `clearTimeout` / `clearInterval`.
8.3. Return a cleanup function from every effect that adds a listener: `removeEventListener`.
8.4. Use an `AbortController` for every `fetch` and call `controller.abort()` in cleanup.
8.5. Ignore `AbortError` in fetch error handling.
8.6. List every reactive dependency. Never suppress the exhaustive-deps lint rule.

## 9. Styling

9.1. Use CSS Modules (`*.module.css`) for component styles.
9.2. Define colors, spacing, radii, and fonts as CSS Custom Properties on `:root`; reference them with `var(--token)`.
9.3. Do not use the inline `style` prop.
9.4. Do not hardcode color or spacing values inside component modules.
9.5. Design mobile-first; support every viewport from 375px to 1440px.
9.6. Ensure zero horizontal scroll at every width in that range.
9.7. Use fluid units (`rem`, `%`, `clamp()`, `minmax()`) and `min-width` media queries.

## 10. Media

10.1. Load images and media over HTTPS only.
10.2. Set explicit `width` and `height` on every `<img>`.
10.3. Provide meaningful `alt` text; use `alt=""` for decorative images.
10.4. Handle `onError` on every `<img>` by swapping to a local fallback image, guarding against infinite loops.
10.5. Wrap captioned images in `<figure>` with `<figcaption>`.
10.6. Add `loading="lazy"` to below-the-fold images.

## 11. AI Output Format

11.1. Output one file at a time.
11.2. Start each file with its path as a comment (e.g. `// src/components/Card.jsx`).
11.3. Output complete files only — no placeholders, no `// ...rest unchanged`.
11.4. Never output class components.
11.5. Give no explanations unless explicitly asked.
11.6. Self-check every file against rules 1–10 before output.

## 12. Lab 4: routing

12.1. Import routing from `'react-router'` (v7) only: `<Routes>`, `<Route element={…}>`, `<Outlet />`, `<NavLink className={({ isActive }) => …}>`, `useParams()`, `useSearchParams()`. Never `<Switch>`, `<Redirect>`, `exact`, `component={…}` or `activeClassName` (React Router v5).
12.2. Read route params with `useParams()` and look the record up with `find`. An unknown id renders an explicit not-found state (`role="alert"`); it never throws.
12.3. Lazy routes use `React.lazy` with a `<Suspense>` fallback that has the size of the content and `aria-busy="true"`.
12.4. A deep link must work on the first render: the route tree never depends on state that is set after mount.

## 13. Lab 4: forms and context

13.1. Validation errors are derived during render by a pure function. Never copy errors into state, and never set them from an effect.
13.2. Share form state through one Context and one `useFormContext()` hook that throws a clear error when used outside its provider.
13.3. Every field has a `<label htmlFor>` made with `useId()`, `aria-invalid`, and `aria-describedby` pointing at its error message.
13.4. An inspector never shows a secret: passwords are masked.

## 14. Lab 4: data and API

14.1. Every `fetch` gets an `AbortController` signal and the effect cleanup aborts it. An `AbortError` is never shown as an error, and the answer of an aborted or old request never changes state.
14.2. Check `response.ok` before `response.json()`; turn every failure into one error type with a status.
14.3. Express: CORS with an explicit origin from the environment (never `*`); `express.json({ limit })`; validate every POST body (type, length, trimmed) and answer 400 with JSON; answer 404 with JSON for unknown forums and routes; one error handler that never leaks a stack trace.
14.4. Server ids come from `crypto.randomUUID()`, never from `Date.now()` or `Math.random()`.
14.5. No secret in source: a connection string comes from `process.env`. (Exercise 3 uses an in-memory store; MongoDB belongs to the homework.)

## 15. Lab 4 Homework 1: gallery, URL state and the native dialog

15.1. The URL is the state of the filter and of the open photo. Read both with `useSearchParams()` during render. Never copy them into `useState`, and never sync them with `useEffect`.
15.2. A control that changes the view is a `<Link>` with a real `href` (it can be shared, opened in a new tab, and used with the keyboard), not a `<button onClick={navigate}>`.
15.3. Change one parameter at a time. Never write `setSearchParams({})` to clear one value: it clears all of them.
15.4. Opening a photo pushes a history entry. Moving between photos and closing replace it, so Back leaves the lightbox in one step.
15.5. A modal is a native `<dialog>` opened with `showModal()`. No `<div>` overlay, no hand-made focus trap, no `show()`. It has an accessible name (`aria-labelledby`), a visible Close button, closes with Esc and with a click on the backdrop, and the `close` event is its only exit to the URL. A `close` event of a dialog that is open again is not a user action and is ignored.
15.6. A ref callback must have a stable identity (declare it outside the component): React detaches and attaches again a ref callback whose identity changed, which would close and reopen the dialog on every render.
15.7. Every `<img>`: `width`, `height`, a description in `alt` that is not the visible title, an `onError` fallback that runs once, `loading="lazy"` except for the first row.
15.8. Targets are at least `var(--tap-target)` (2.75rem). The open or selected state is never shown by colour alone (`aria-current`, fill and weight). The focus ring shows on every surface.
15.9. An unknown id or category in the URL gives a visible `role="alert"` or a safe fallback, never an empty page or an exception. Ids from the URL are rendered as text only.
15.10. Ship a valid `robots.txt`. Measure the production build with Lighthouse (four categories, mobile and desktop) and axe-core in real Chrome. jsdom has no layout, no focus trap and no colour contrast, so it cannot be the evidence for those.
