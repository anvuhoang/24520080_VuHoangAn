# PROJECT_RULE.md 

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
