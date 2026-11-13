# TASK_DECOMPOSITION.md — Lab 4 · Homework 1 (WBS)

> Goal: a production photo and evidence gallery on React Router v7. The category filter and the open photo live in the URL (`useSearchParams`), the photo opens in a native `<dialog>`, and the page keeps WCAG 2.2 AA behaviour and a 100/100 Lighthouse score.
> Stack: React 19 · Vite 7 · React Router 7 · plain JSX · CSS Modules. All work follows [project-rules.md](project-rules.md) (section 15 is new for this homework).
> Source: Lab 4 deck, slide 19 (the Homework 1 specification), slide 30 (the `PhotoGalleryLayout` contract), slide 28 (URL search params challenge), slide 29 (hallucinations 01 and 05).
> Working rule: one file per step. The student was away during the build, so the steps were generated in **batches** by the assistant; [PROMPT_LOG.md](PROMPT_LOG.md) says what was really done, in order.
> Numbering: the deck calls three tasks "Homework 1". This folder is the **Photo & Evidence Gallery** (slide 19). The swipe deck (slide 20) and the appeal tribunal (slide 21) are the next two homeworks.

---

## Layout

```
Hw_1/
  docs/      project-rules.md · TASK_DECOMPOSITION.md · PROMPT_LOG.md · AI_FAILURE_AUDIT.md · LIGHTHOUSE.md · BROWSER_VERIFICATION.log
  public/    photos/*.svg (made by `npm run photos`) · robots.txt
  scripts/   make-photos.mjs
  src/       main.jsx · App.jsx · NotFoundState · index.css
    gallery/ PhotoGalleryLayout · CategoryFilter · PhotoGrid · Lightbox (+ .module.css) · photos.js · galleryParams.js · photoImage.js
  tests/     one flat folder; `npm test`
```

---

## Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
// Routes (src/App.jsx)
/            -> redirect to /gallery (replace)
/gallery     -> PhotoGalleryLayout
*            -> NotFoundState (role="alert", one h1, link back)

// The URL is the state:  /gallery?category=<match|chat|replay>&photoId=<id>
parseGalleryParams(searchParams): { category: 'all' | id, photoId: string | null }   // unknown category -> 'all'; '' -> null
galleryQuery({ category = 'all', photoId = null }): string                          // 'all' and no photo -> '' (a clean URL); values encoded
photosOf(photos, category): Photo[]
neighbours(list, index): { previous, next }                                          // wrap around; index -1 -> nulls

// Photo = { id, category, title, alt, caption, takenOn, src, width, height }       // frozen data in photos.js

PhotoGalleryLayout({ photos = PHOTOS })
//   visible = photosOf(...); selected = the photo with photoId INSIDE visible
//   photoId given but not in visible -> <p role="alert"> with a link that clears only photoId (no dialog)
//   close = remove ONLY photoId, { replace: true }
CategoryFilter({ category })    // <nav aria-label="Photo categories"> of <Link>, aria-current="true" on the open one
PhotoGrid({ photos, category }) // <ul> of <Link> > <figure>; first 3 images eager, the rest lazy; onError -> local fallback once
Lightbox({ photo, previous, next, category, onClose })
//   native <dialog> opened by a STABLE ref callback (showModal on attach, close on detach); no useEffect
//   named by its h2; Close button first in the DOM (it takes the first focus); Esc and backdrop click close it
//   Previous/Next are <Link replace>; ArrowLeft/ArrowRight navigate with replace
//   onClose from the `close` event only when the dialog is NOT open again (Strict Mode remount)
```

---

## Block 1 — Setup

| ID  | Task | Output |
| --- | ---- | ------ |
| 0.1 | Project with the Lab 4 toolchain (Vite 7, Vitest 5, jsdom, Testing Library, react-router 7) plus `axe-core` for the rules a browser cannot see in jsdom. | `package.json`, `vite.config.js`, `index.html` (description, theme colour) |
| 0.2 | Design tokens, global focus ring, reduced-motion rule, scroll lock behind an open dialog. | `src/index.css` |
| 0.3 | Rules of the generation: Lab 4 rules plus section 15 (gallery, URL state, native dialog). | `docs/project-rules.md` |
| 0.4 | Nine evidence pictures and a fallback, generated as small SVG (no network, no licence); `robots.txt`. | `scripts/make-photos.mjs`, `public/photos/*`, `public/robots.txt` |
| 0.5 | jsdom stand-in for `showModal()` and `close()` (jsdom has none), with the measured behaviour of Chrome 157. | `tests/setup.js` |

## Block 2 — Data and URL helpers

| ID  | Task | Output |
| --- | ---- | ------ |
| 1.1 | Frozen photo data with a real `alt` for each, categories. | `src/photos.js` |
| 1.2 | Pure helpers: parse and build the query, filter, neighbours with wrap. | `src/galleryParams.js` |
| 1.3 | Image fallback handler that runs once. | `src/photoImage.js` |

## Block 3 — Components

| ID  | Task | Output |
| --- | ---- | ------ |
| 2.1 | Category links with `aria-current`, 44 px targets. | `CategoryFilter.jsx` + style |
| 2.2 | Thumbnail grid: links, `<figure>`, reserved size, lazy loading, fallback. | `PhotoGrid.jsx` + style |
| 3.1 | Lightbox on the native dialog: stable ref callback, `close` guard, backdrop, arrows, pager. | `Lightbox.jsx` + style |
| 4.1 | Page: reads the URL, derives everything, reports a missing photo, closes by removing only `photoId`. | `PhotoGalleryLayout.jsx` + style |
| 4.2 | Catch-all route and the route tree; mounting. | `NotFoundState.jsx` + style, `App.jsx`, `main.jsx` |

## Block 4 — Tests (one flat `tests/` folder)

| ID  | File | What it covers |
| --- | ---- | -------------- |
| 5.1 | `galleryParams`, `photos` | Parse and build, encoding, wrap, unknown values; data integrity, files exist and are small, `robots.txt`. |
| 5.2 | `PhotoGalleryLayout` | Filter from the URL, links keep the category, deep link opens the dialog, missing photo, close keeps the category and replaces the entry, Esc, backdrop, Back and Forward, arrows, Strict Mode, image fallback. |
| 5.3 | `App`, `sourceHygiene` | Redirect, deep link, 404, landmarks; a grep of the rules (div/span, effect, inline style, hardcoded colour, `<img>` attributes, button names). |
| 5.4 | `deckReference` | The slide 30 code copied as written, to show where it fails. |

## Checkpoint (after each step)

- Banned things: see `sourceHygiene.test.js` (it is the grep).
- Vitest, then `npm run build`.
- **Real Chrome** (jsdom has no layout, no focus trap, no contrast): the script that produced `BROWSER_VERIFICATION.log` (deep link, Esc, focus order and return, backdrop, arrows, Back and Forward, three widths, axe-core on five pages) on the dev server (Strict Mode) and on the production build.
- Lighthouse on the production build, mobile and desktop, grid and lightbox (`LIGHTHOUSE.md`).
- Break the source on purpose (31 changes, one at a time) and check that a test fails; restore and compare.

## Commit plan

| Commit | Hash | Scope |
| ------ | ---- | ----- |
| 1 | pending | `chore(hw1)` scaffold, tokens, rules, generated pictures, `robots.txt` |
| 2 | pending | `feat(hw1)` photo data and URL helpers, with their tests |
| 3 | pending | `feat(hw1)` category filter and photo grid |
| 4 | pending | `feat(hw1)` lightbox on the native dialog |
| 5 | pending | `feat(hw1)` gallery page, routes and mounting |
| 6 | pending | `test(hw1)` gallery, routes, source hygiene and the slide 30 reference code |
| 7 | pending | `docs(hw1)` task decomposition, prompt log, failure audit, Lighthouse and browser logs |
