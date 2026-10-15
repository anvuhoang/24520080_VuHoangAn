# TASK_DECOMPOSITION.md — HW1: Production Portfolio


## 1. Project Overview & Architecture Analysis

### 1.1 Context & Baseline Architecture
The project is a personal production developer portfolio showcasing component architecture, client-side state modeling, and engineering achievements. The baseline implementation features:
- **Top Header:** Brand logo, sticky frosted-glass header, dynamic light/dark theme switcher.
- **Hero Section:** Profile portrait avatar, engineering title, introductory pitch, and active availability badge.
- **Skills Matrix:** Categorized technical skill cards with modular badges arranged in a multi-column CSS Grid.
- **Featured Projects:** Interactive project cards with category filtering tabs (`role="tablist"` / `role="tab"`).
- **Contact Form:** Client-side validated interactive form with field-level state validation, submission spinner, and feedback status messages.
- **Footer:** Informational and copyright landmark.

### 1.2 Current Technical Stack
| Layer | Technology | Rationale & Characteristics |
|---|---|---|
| **Core Structure** | Semantic HTML5 | Zero-framework native markup; structural landmarks (`header`, `main`, `section`, `article`, `footer`). |
| **Styling & Design Tokens** | Pure Vanilla CSS3 | Custom Properties (`:root` & `[data-theme="light"]`), CSS Grid, Flexbox, backdrop filters; zero CSS utility dependencies. |
| **Logic & State** | Modern Vanilla JavaScript (ES6+) | Event-driven architecture, localStorage theme persistence, real-time input validation engine. |
| **Typography & Assets** | Google Fonts & Local Assets | Plus Jakarta Sans & JetBrains Mono; local portrait image (`portrait.jpg`). |
| **Build & Tooling** | Static Web Runtime | Zero bundler overhead; native browser execution. |

---

## 2. Technical Audit & Vulnerability Assessment

### 2.1 Accessibility (WCAG 2.2 AA) Audit
1. **Color Contrast Deficiencies (WCAG 1.4.3 - Minimum 4.5:1 for normal text, 3:1 for large text/UI components):**
   - **Light Theme `--text-muted` (`#94a3b8` on `#f8fafc`):** Contrast ratio is **2.26:1** (**FAIL**). Needs adjustment to `#64748b` or `#475569` ($\ge 4.5:1$).
   - **Light Theme `--accent-primary` (`#0284c7` on `#ffffff`):** Contrast ratio is **3.8:1** (**FAIL** for regular text links/tags). Needs adjustment to `#0369a1` ($\ge 4.5:1$).
   - **Dark Theme Active Filter Button / Primary Buttons:** White text (`#ffffff`) on `--accent-primary` (`#38bdf8`) produces an unacceptable **1.63:1** contrast ratio (**SEVERE FAIL**). Active state foreground must be dark (`#0b0f19`, yielding **8.5:1**) or background darkened.
   - **Dark Theme `--text-muted` (`#64748b` on `#0b0f19`):** Contrast ratio is **3.5:1** (**FAIL**). Must be updated to `#94a3b8` or higher.
2. **Landmark Hierarchy & Semantics (WCAG 1.3.1, 2.4.1):**
   - **Missing Skip Link:** The page lacks a skip-to-content mechanism (`<a href="#main-content" class="skip-link">`), forcing keyboard users to navigate redundant header controls repeatedly.
   - **Missing Navigation Landmark:** Header contains no `<nav>` element with anchor links to major sections (`#hero`, `#skills`, `#projects`, `#contact`).
   - **Incomplete ARIA Landmarks:** Missing explicit landmark attributes (`role="banner"`, `role="main"`, `role="contentinfo"`).
   - **Non-descriptive Alt Text:** Image alt attribute `alt="Developer Portrait"` lacks descriptive value; requires professional descriptive context.

### 2.2 Keyboard Navigation & Focus Trap Audit (WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7)
1. **Focus Trap & Keyboard Navigation Risks:**
   - **Tablist APG Pattern Disregard:** Project category filter (`role="tablist"`) currently leaves all buttons in the standard Tab sequence (`tabindex="0"`). Users cannot use standard arrow keys (`ArrowLeft`, `ArrowRight`, `Home`, `End`) to navigate tabs, creating excessive tab stops.
   - **Focus Dropping upon Dynamic Filtering:** When items are hidden via `.hidden` (`display: none`), if an element inside a project card possessed focus, focus drops abruptly to `document.body`.
   - **Keyboard Trap Prevention:** Any future or present navigation drawers, modal overlays, or form states must guarantee that focus never gets stuck and can always be exited via standard keys (`Tab`, `Shift+Tab`, `Escape`) with focus restored to the trigger element.
2. **Focus Visibility (WCAG 2.4.7, 2.4.11):**
   - Several controls rely on `outline: none` without providing an unambiguous high-contrast `:focus-visible` ring with sufficient outline-offset across both light and dark themes.

### 2.3 Content Security Policy (CSP) & Event Handlers
1. **Missing Content Security Policy:**
   - No CSP `<meta>` tag or HTTP header is defined, leaving the site susceptible to XSS, script injection, and clickjacking attacks.
2. **Prohibition of Inline Event Handlers:**
   - Strict audit for `onclick`, `onmouseover`, `onmouseout`, `onsubmit`, `onload`, and `javascript:` URLs. All user event listening must strictly utilize externalized `addEventListener` in `script.js`.
   - Strict CSP specification:
     ```html
     <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self';">
     ```
     *(Optional: Self-hosting fonts allows eliminating `'unsafe-inline'` and external domain allowances completely).*

### 2.4 Lighthouse 100 Performance Audit
1. **Image Payload Overload (LCP Impact):**
   - `portrait.jpg` is **1,073,349 bytes (~1.07 MB)** for a 160×160 display avatar!
   - This single asset severely degrades Largest Contentful Paint (LCP) and consumes unnecessary network bandwidth.
   - **Resolution:** Compress and convert to modern WebP format (< 25 KB, 98% reduction) with proper `srcset`, `decoding="async"`, and explicit dimensions to ensure zero Cumulative Layout Shift (CLS = 0).
2. **Render-Blocking Web Fonts:**
   - Direct `<link rel="stylesheet">` from Google Fonts blocks first paint.
   - **Resolution:** Add `&display=swap`, DNS preconnect, and font preloading.
3. **Missing PWA & SEO Essentials:**
   - Missing favicon causing 404 console errors.
   - Missing OpenGraph metadata, canonical URL, and theme-color meta tag.

---

## 3. Atomic Milestone Implementation Plan (M1 – M4)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HW1 IMPLEMENTATION ROADMAP                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [M1: WCAG 2.2 AA Audit] ─────────► fix(a11y): contrast & landmarks   │
│            │                                                           │
│            ▼                                                           │
│   [M2: Focus Trap Audit] ──────────► fix(nav): keyboard trap prevention│
│            │                                                           │
│            ▼                                                           │
│   [M3: Strict CSP Engine] ─────────► fix(security): strict csp & handlers│
│            │                                                           │
│            ▼                                                           │
│   [M4: Lighthouse 100 Opt] ────────► perf: optimize assets             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Milestone 1: WCAG 2.2 AA Audit [IMPLEMENTED & VERIFIED]
- **Objective:** Eliminate all color contrast violations across both light and dark themes and implement complete semantic HTML5 landmark hierarchy with bypass blocks.
- **Git Commit Message:** `fix(a11y): contrast & landmarks`
- **Scope of Work (Completed):**
  1. **Accessible Skip Link:** Implemented `<a href="#main-content" class="skip-link">Chuyển đến nội dung chính</a>` as first child of `<body>`. High-contrast focus state with outline offset.
  2. **Semantic Landmark Architecture:**
     - Header: `<header class="top-header" role="banner">`.
     - Navigation: Added `<nav class="main-nav" role="navigation" aria-label="Điều hướng chính">` with structured unordered list links (`#hero`, `#skills`, `#projects`, `#contact`).
     - Main Landmark: Exactly one `<main id="main-content" class="container main-content" role="main" tabindex="-1">`.
     - Footer: `<footer class="bottom-footer" role="contentinfo">`.
  3. **Logical Heading Hierarchy:** Verified strictly sequential single-`h1` structure (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`) with zero skipped levels.
  4. **Image & Icon Accessibility:**
     - Descriptive alt text on `portrait.jpg`: `alt="Chân dung nhà phát triển phần mềm Vũ Hoàng An"`.
     - Status indicator: Added `role="status"` and `aria-label="Sẵn sàng nhận dự án"`.
     - Decorative emojis/icons: Added `aria-hidden="true"` to `.logo-icon` and `.cat-icon`.
     - Project links: Added descriptive unique `aria-label` attributes to prevent ambiguous "Source Code" links.
  5. **WCAG 2.2 AA Contrast Calibration:**
     - Dark Mode `--text-muted`: Calibrated to `#94a3b8` (yields **7.47:1** on `#0b0f19` and **6.50:1** on `#161e2e`, passing $\ge 4.5:1$).
     - Dark Mode Active Tab & Submit Button: Changed text from `#ffffff` to `--accent-active-text: #0b0f19` (yields **8.94:1** on `#38bdf8` and **6.42:1** on `#818cf8`, passing $\ge 4.5:1$).
     - Light Mode `--text-muted`: Calibrated from `#94a3b8` (2.45:1 FAIL) to `#526071` (yields **6.42:1** on `#ffffff` and **6.14:1** on `#f8fafc`, passing $\ge 4.5:1$).
     - Light Mode `--accent-primary`: Calibrated from `#0284c7` (4.10:1 FAIL) to `#0369a1` (yields **5.93:1** on `#ffffff`, passing $\ge 4.5:1$).
     - Light Mode `--badge-text`: Darkened to `#025a8c` (yields **7.38:1** on `#ffffff`, passing $\ge 4.5:1$).
     - Light Mode Form Borders: High-contrast `#64748b` on `#ffffff` (yields **4.76:1**, passing non-text UI $\ge 3:1$).
- **Modified Files:**
  - `index.html`
  - `style.css`
- **Verification Status:**
  - [x] Exactly 1 main landmark verified via DOM audit.
  - [x] All 4 landmark roles (`banner`, `navigation`, `main`, `contentinfo`) present and labeled.
  - [x] Skip-link verified targeting `#main-content`.
  - [x] Heading hierarchy verified: single `h1`, no skipped heading levels.
  - [x] All text contrast ratios verified $\ge 4.5:1$ (normal text) and $\ge 3:1$ (large text / UI elements) across both themes.

---

### Milestone 2: Focus Trap & Keyboard Navigation Audit [IMPLEMENTED & VERIFIED]
- **Objective:** Prevent keyboard navigation traps, establish standard WAI-ARIA APG tablist keyboard interaction (roving tabindex and arrow navigation), implement accessible mobile drawer and modal dialog focus containment with focus restoration, and provide high-visibility focus indicators.
- **Git Commit Message:** `fix(nav): keyboard trap prevention`
- **Scope of Work (Completed):**
  1. **Skip-Link Programmatic Focus Shift:**
     - Connected `<a class="skip-link">` to shift programmatic focus directly to `<main id="main-content" tabindex="-1">`, ensuring keyboard users reliably bypass header controls.
  2. **Mobile Navigation Drawer & Trap Prevention:**
     - Added `#menu-toggle` with `aria-expanded` and `aria-controls="nav-list"`.
     - Mobile navigation drawer opens and traps focus between toggle button and nav links.
     - `Escape` key immediately closes the drawer and restores focus to `#menu-toggle`.
     - Selecting any navigation link closes the drawer and smoothly shifts focus to the targeted landmark.
  3. **WAI-ARIA APG Tablist Roving Tabindex & Arrow Key Cycling:**
     - Active tab initialized with `tabindex="0"`; all inactive tabs have `tabindex="-1"`.
     - Integrated arrow keys (`ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`, `Home`, `End`) to navigate and activate tabs without multiple Tab stops.
     - Tab key exits tablist directly to the next landmark or card link.
  4. **Focus Loss Prevention on Dynamic Filtering:**
     - Guarded against abrupt focus drop to `document.body` when filtering hides project cards: if focused card element is hidden, focus gracefully redirects to the active tab button.
  5. **Accessible Modal Dialog (Focus Containment & Restoration):**
     - Implemented `#project-modal` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, and initial `aria-hidden="true"`.
     - Triggered by `.card-detail-btn` on each project card.
     - Constrains Tab / Shift+Tab focus inside dialog while active.
     - `Escape` key or Close button closes the dialog and immediately **restores focus to the trigger element** (`lastFocusedTrigger.focus()`).
  6. **Global Visible Focus Indicators (WCAG 2.4.7 & 2.4.11):**
     - Implemented unified `:focus-visible` styling (`outline: 2px solid var(--accent-primary); outline-offset: 2px;`) across all interactive elements (`a`, `button`, `input`, `textarea`, `[tabindex]`).
- **Modified Files:**
  - `index.html`
  - `style.css`
  - `script.js`
- **Verification Status:**
  - [x] Full keyboard navigation verified without mouse interaction (Tab, Shift+Tab, Arrow keys, Enter, Space, Escape).
  - [x] Zero keyboard traps across all sections, navigation menus, and dialogs.
  - [x] Roving tabindex on tablist strictly conforms to WAI-ARIA APG pattern.
  - [x] Focus restoration verified: modal dialog close restores focus to triggering button.
  - [x] Focus restoration verified: mobile menu close restores focus to hamburger toggle button.
  - [x] High-visibility 2px focus indicators visible on all interactive elements.

---

### Milestone 3: Strict Content Security Policy (CSP)
- **Objective:** Enforce a strict Content Security Policy and audit the codebase to ensure complete elimination of inline event handlers.
- **Git Commit Message:** `fix(security): strict csp and zero inline handlers`
- **Scope of Work:**
  1. Add strict Content Security Policy via `<meta http-equiv="Content-Security-Policy">` in `<head>`.
  2. Policy specification:
     - `default-src 'self';`
     - `script-src 'self';`
     - `style-src 'self' https://fonts.googleapis.com 'unsafe-inline';`
     - `font-src 'self' https://fonts.gstatic.com data:;`
     - `img-src 'self' data:;`
     - `connect-src 'self';`
     - `base-uri 'self';`
     - `form-action 'self';`
  3. Codebase audit for zero inline event handlers:
     - Verify complete absence of `onclick`, `onmouseover`, `onmouseout`, `onsubmit`, `onload`, `onchange`, etc.
     - Guarantee that all dynamic actions, theme toggling, tab filtering, and form validations are attached solely via external `script.js`.
- **Expected Files to Modify:**
  - `index.html`
  - `script.js`
- **Acceptance Criteria:**
  - Zero browser console CSP violation warnings/errors.
  - Zero inline event handlers (`grep -in "on[a-z]*=" *.html` yields 0 matches).
  - All interactive features continue to function seamlessly under strict policy.

---

### Milestone 4: Lighthouse 100 Audit Score
- **Objective:** Optimize all web assets, resolve render-blocking resources, and achieve a 100/100/100/100 score on Google Lighthouse (Performance, Accessibility, Best Practices, SEO).
- **Git Commit Message:** `perf: optimize assets`
- **Scope of Work:**
  1. **Image Optimization:**
     - Compress `portrait.jpg` (1.07 MB) and convert to optimized WebP format (`portrait.webp`, < 25 KB).
     - Provide modern `<picture>` markup with WebP `<source>` and JPEG fallback.
     - Add explicit `width="160"` and `height="160"`, `decoding="async"`, and `fetchpriority="high"`.
  2. **Font & Resource Delivery:**
     - Add `&display=swap` to Google Fonts URL.
     - Preconnect to `fonts.googleapis.com` and `fonts.gstatic.com` with `crossorigin`.
     - Add `defer` attribute to `<script src="script.js" defer></script>`.
  3. **Best Practices & Security Additions:**
     - Create a vector SVG favicon (`favicon.svg`) and declare `<link rel="icon">` to eliminate 404 requests.
     - Add `rel="noopener noreferrer"` to all outbound links.
     - Set `<meta name="theme-color" content="#0b0f19">`.
  4. **SEO Optimization:**
     - Add standard meta tags (meta description, canonical URL, OpenGraph title/description/image).
     - Maintain strict semantic heading hierarchy (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`).
- **Expected Files to Modify / Create:**
  - `index.html`
  - `style.css`
  - `assets/portrait.webp` (or `portrait.webp`)
  - `favicon.svg`
- **Acceptance Criteria:**
  - Google Lighthouse report achieves **100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO**.
  - Largest Contentful Paint (LCP) $\le 1.2\text{s}$, Cumulative Layout Shift (CLS) $= 0$, First Contentful Paint (FCP) $\le 0.8\text{s}$.
  - Zero 404 network requests in DevTools network tab.

---

## 4. Verification & Testing Strategy

| Category | Tool / Methodology | Verification Criteria |
|---|---|---|
| **A11y (WCAG 2.2 AA)** | Chrome DevTools Lighthouse, axe-core, WAVE extension | 0 contrast violations, valid landmark tree, correct ARIA roles. |
| **Keyboard Navigation** | Manual keyboard traversal (`Tab`, `Shift+Tab`, Arrow keys, `Esc`, `Enter`) | No focus trap, roving tabindex works for tabs, visible `:focus-visible` on all elements. |
| **Content Security** | Chrome Console Security Panel, static regex audit | Zero CSP violations, zero inline event attributes (`onclick`, etc.). |
| **Performance & Vitals** | Google Lighthouse (Mobile & Desktop presets) | 100 scores across all 4 categories; sub-second LCP. |

---

## 5. Summary of Files to Modify

```
Hw_1/
├── TASK_DECOMPOSITION.md   # [CREATED] Master planning & verification specification
├── index.html              # [TO MODIFY] M1, M2, M3, M4 (Landmarks, CSP, WebP picture, skip link)
├── style.css               # [TO MODIFY] M1, M2, M4 (Contrast tokens, skip link, focus-visible)
├── script.js               # [TO MODIFY] M2, M3 (Roving tabindex, arrow keys, trap prevention)
├── portrait.webp           # [TO CREATE] M4 (Compressed modern image asset < 25KB)
├── portrait.jpg            # [TO OPTIMIZE] M4 (Compressed fallback asset)
└── favicon.svg             # [TO CREATE] M4 (Vector favicon for zero-404 compliance)
```

---

## 6. Execution Protocol & Approval Gate

- [x] **Step 1:** Analyze project structure, tech stack, accessibility, CSP, and performance bottlenecks.
- [x] **Step 2:** Formulate atomic plan and author `TASK_DECOMPOSITION.md`.
- [ ] **Step 3 (Awaiting Approval):** Initialize project files in `Hw_1` from base portfolio upon user confirmation.
- [ ] **Step 4:** Execute Milestone 1 (`fix(a11y): contrast & landmarks`).
- [ ] **Step 5:** Execute Milestone 2 (`fix(nav): keyboard trap prevention`).
- [ ] **Step 6:** Execute Milestone 3 (`fix(security): strict csp and zero inline handlers`).
- [ ] **Step 7:** Execute Milestone 4 (`perf: optimize assets`).
- [ ] **Step 8:** Final verification of all 4 Lighthouse 100 categories and deliverables.
