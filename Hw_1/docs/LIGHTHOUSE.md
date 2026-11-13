# LIGHTHOUSE.md — Lab 4 · Homework 1

Lighthouse 13.6.0 (CLI), Chrome 157, headless, production build served by `vite preview` (`npm run build`, then `npx vite preview --port 4174`). One run per row, default settings (mobile = simulated Slow 4G and 4x CPU slowdown; desktop = `--preset=desktop`).

| Page | Form factor | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
| ---- | ----------- | ----------- | ------------- | -------------- | --- | --- | --- | --- | --- | ----------- |
| `/gallery` | mobile | 100 | 100 | 100 | 100 | 0.8 s | 1.7 s | 0 ms | 0 | 0.8 s |
| `/gallery?photoId=m2` (lightbox open) | mobile | 100 | 100 | 100 | 100 | 0.8 s | 1.5 s | 10 ms | 0 | 0.9 s |
| `/gallery` | desktop | 100 | 100 | 100 | 100 | 0.2 s | 0.5 s | 0 ms | 0 | 0.2 s |
| `/gallery?photoId=m2` (lightbox open) | desktop | 100 | 100 | 100 | 100 | 0.2 s | 0.4 s | 0 ms | 0 | 0.3 s |

- **SEO was 91-92 on the first run.** `/robots.txt` was answered with `index.html` (the single-page fallback), and Lighthouse reported "robots.txt is not valid". A real `public/robots.txt` fixed it (see AI_FAILURE_AUDIT #05).
- **Not part of the four scores:** Lighthouse 13 also reports an "Agentic Browsing" category (50 here: no `llms.txt`, no ARD manifest). The assignment asks for performance and accessibility, so those two optional files were not added.
- **A score is one measurement.** Another machine or another run can differ by a few points in Performance. The page is small by design (JS 269 kB, 86 kB gzipped; nine images of about 0.6 kB each), so the margin to 100 is wide, but the number is not a guarantee.
- Lighthouse and axe-core find only a part of the accessibility problems. What they cannot see (a real screen reader, 200 % and 400 % zoom, Windows high-contrast mode, `prefers-reduced-motion`) was **not** tested; see the end of AI_FAILURE_AUDIT.md.
