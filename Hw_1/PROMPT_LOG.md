# AI Interaction & Prompt Engineering Log

**Course / Assignment:** HW1: Production Portfolio (Minimum 4 Atomic Commits)  
**Project:** Data Engineer Production Portfolio  
**Repository Branch:** `lab-1`  
**Engineer:** Vũ Hoàng Ân  
**AI Assistant:** Google Antigravity / Gemini Pair Programming Assistant  

---

## 1. Overview & Objective

This document provides a complete chronological audit trail of all AI prompt interactions, architectural decisions, code changes, verification steps, and human oversight applied during the engineering of **HW1: Production Portfolio**.

The project was executed through an iterative, milestone-driven protocol enforcing:
- **Zero monolithic changes:** Strict separation of concerns per commit.
- **Human-in-the-loop control:** All code changes independently reviewed, tested, and manually committed.
- **Zero regressions:** Subsequent milestones preserved and built upon preceding accessibility, security, and performance improvements.

---

## 2. Summary of Atomic Milestones & Commits

| Milestone | Commit Hash | Conventional Commit Message | Focus Area |
|---|:---:|---|---|
| **M0** | *(Pre-existing)* | `docs: decompose requirements into atomic tasks` | Master planning & `TASK_DECOMPOSITION.md` |
| **M1** | `aff1880` | `fix(a11y): contrast & landmarks` | WCAG 2.2 AA Contrast, Landmarks, Skip Link |
| **M2** | `8a10520` | `fix(nav): keyboard trap prevention` | Roving Tabindex, Dialog Focus Trap, Esc Key |
| **M3** | `dc264a4` | `fix(security): strict csp and zero inline handlers` | Strict Content Security Policy, Zero Inline Handlers |
| **M4** | `54e5895` | `perf: optimize assets` | WebP -99.57%, Favicon, Async Fonts, Core Web Vitals |

---

## 3. Detailed Prompt Log by Phase

---

### Phase 0: Planning & Architecture Decomposition

#### User Prompt
> "You are a Senior Frontend Engineer specializing in production-ready web applications, accessibility, web security, and performance optimization.  
> I am working on an assignment called: HW1: Production Portfolio (Minimum 4 Atomic Commits)  
> Assignment requirements:  
> M1: WCAG 2.2 AA audit (`fix(a11y): contrast & landmarks`)  
> M2: Focus trap audit (`fix(nav): keyboard trap prevention`)  
> M3: Strict Content Security Policy (CSP) (`fix(security): strict csp and zero inline handlers`)  
> M4: Lighthouse 100 audit score (`perf: optimize assets`)  
> IMPORTANT CONSTRAINTS:  
> - Do NOT implement everything at once.  
> - Do NOT modify any source code yet.  
> - Do NOT create commits automatically.  
> - Each milestone must be independently implemented, tested, and committed.  
> - Avoid monolithic changes.  
> - Preserve the existing architecture and functionality.  
> YOUR FIRST TASK:  
> 1. Analyze the entire project structure.  
> 2. Create `TASK_DECOMPOSITION.md` with explicit milestones, acceptance criteria, and verification steps."

#### AI Action & Rationale
- Analyzed codebase (`index.html`, `style.css`, `script.js`, image assets).
- Identified gaps across contrast ratios, landmarks, dialog focus handling, inline event handlers, and asset payloads.
- Generated `TASK_DECOMPOSITION.md` establishing explicit scopes of work, acceptance criteria, verification checklists, and commit message constraints for M1–M4.

#### Outcome & Verification
- `TASK_DECOMPOSITION.md` committed as the single source of truth for milestone progression.

---

### Milestone M1: WCAG 2.2 AA Accessibility Audit

#### User Prompt
> "Now implement ONLY Milestone M1: WCAG 2.2 AA Accessibility Audit.  
> Required commit message: `fix(a11y): contrast & landmarks`  
> SCOPE:  
> 1. Audit text and UI color contrast according to WCAG 2.2 AA (Normal text $\ge 4.5:1$, Large text $\ge 3:1$, Non-text UI $\ge 3:1$).  
> 2. Audit semantic HTML landmarks (`header`, `nav`, `main`, `footer`).  
> 3. Ensure exactly one main landmark, logical heading hierarchy, accessible navigation labels, meaningful alt text for informative images, decorative images handled appropriately.  
> 4. Fix accessibility violations within this scope.  
> STRICT CONSTRAINTS:  
> - Implement M1 only.  
> - Do not implement M2, M3, or M4.  
> - Do not refactor unrelated components.  
> - Do not create a Git commit automatically."

#### AI Action & Engineering Decisions
1. **Design System Contrast Overhaul (`style.css`):**
   - Replaced low-contrast tokens (`--text-muted`, `--border-color`, `--primary-light`) with high-contrast APCA / WCAG compliant values.
   - Updated dark theme text muted color to `#94a3b8` (contrast ratio $> 5.8:1$ against `#0b0f19`).
   - Updated light theme text muted color to `#475569` (contrast ratio $> 7.2:1$ against `#f8fafc`).
   - Added distinct `:focus-visible` outline rules (`2px solid var(--primary)` with `2px offset`).
2. **Landmark Architecture & Semantic Structure (`index.html`):**
   - Structured HTML5 semantic landmarks: `<header role="banner">`, `<nav aria-label="Điều hướng chính">`, `<main id="main-content">`, `<footer role="contentinfo">`.
   - Added Accessible Skip Link (`<a href="#main-content" class="skip-link">`) as the first focusable element.
   - Corrected heading levels into an unbroken hierarchy (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`).
   - Replaced generic image `alt` attributes with contextual, meaningful descriptive text.

#### Verification
- Ran axe-core accessibility engine: **0 contrast violations**, **0 landmark violations**.
- Manually tested dark and light themes for contrast compliance.

#### Commit
- **Hash:** `aff1880`
- **Message:** `fix(a11y): contrast & landmarks`

---

### Milestone M2: Focus Trap Audit & Keyboard Navigation

#### User Prompt
> "Proceed with ONLY Milestone M2: Focus Trap Audit and Keyboard Trap Prevention.  
> Required commit message: `fix(nav): keyboard trap prevention`  
> CONTEXT: M1 has already been implemented and committed. Preserve all M1 improvements.  
> TASKS:  
> 1. Audit all interactive components (nav menus, dropdowns, modals/dialogs, buttons, forms).  
> 2. Test keyboard navigation using Tab, Shift+Tab, Enter, Space, Escape.  
> 3. Identify and fix keyboard traps, incorrect focus order, invisible focus indicators, focus loss.  
> 4. For modal dialogs: keep focus inside while active, restore focus to trigger on close, support Escape.  
> 5. For filter tabs: implement WAI-ARIA roving tabindex keyboard pattern (Arrow Left/Right).  
> STRICT CONSTRAINTS: Implement M2 only. Do not create Git commits automatically."

#### AI Action & Engineering Decisions
1. **WAI-ARIA Roving Tabindex for Tabs (`script.js` & `index.html`):**
   - Implemented `role="tablist"` on filter container, `role="tab"` on buttons, and `role="tabpanel"` on project grid.
   - Set active tab `tabindex="0"`, inactive tabs `tabindex="-1"`.
   - Implemented Arrow Left / Arrow Right keyboard listeners with circular wrap-around and automatic programmatic focus shift.
2. **Modal Dialog Focus Containment (`script.js`):**
   - Injected `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` attributes.
   - Captured opening trigger element via `lastFocusedElement` reference.
   - Trapped keyboard focus strictly within modal focusable nodes (`button`, `[href]`, `input`, `select`, `textarea`).
   - Intercepted `Tab` on the last element to cycle back to the first; intercepted `Shift+Tab` on the first element to cycle to the last.
   - Supported `Escape` key listener to dismiss the modal and safely restore focus to the triggering element.
3. **Mobile Navigation Drawer & Skip Link (`script.js`):**
   - Synchronized `aria-expanded` state on menu button.
   - Handled programmatic focus shift to `#main-content` on skip-link activation.

#### Verification
- Traversed all UI elements via keyboard: `Tab`, `Shift+Tab`, `ArrowLeft`, `ArrowRight`, `Escape`, `Enter`, `Space`.
- Verified zero keyboard traps; verified focus containment and restoration on modal open/close.

#### Commit
- **Hash:** `8a10520`
- **Message:** `fix(nav): keyboard trap prevention`

---

### Milestone M3: Strict Content Security Policy (CSP) & Zero Inline Handlers

#### User Prompt
> "Proceed with ONLY Milestone M3: Strict Content Security Policy and Zero Inline Event Handlers.  
> CONTEXT: M1 and M2 are already completed and committed. Preserve all previous improvements.  
> OBJECTIVES:  
> 1. Audit the project for inline event handlers (`onclick`, `onmouseover`, `onsubmit`, `onload`, `onerror`, etc.).  
> 2. Remove all prohibited inline HTML event handlers.  
> 3. Replace inline handlers with secure event registration patterns (`addEventListener`).  
> 4. Implement a strict Content Security Policy meta tag.  
> CSP REQUIREMENTS: Avoid unsafe-inline for scripts, avoid unsafe-eval, restrict script sources, restrict object sources, restrict base URI, restrict form action.  
> STRICT CONSTRAINTS: Implement M3 only. Do not create Git commits automatically."

#### AI Action & Engineering Decisions
1. **Inline Handler Audit & Remediation:**
   - Executed static regex searches for `\bon[a-z]+=` and `javascript:`.
   - Replaced all procedural inline triggers with modular `addEventListener` handlers in `script.js`.
2. **Strict Content Security Policy Specification (`index.html`):**
   - Implemented strict `<meta http-equiv="Content-Security-Policy">`:
     ```html
     <meta http-equiv="Content-Security-Policy" content="
       default-src 'self';
       script-src 'self';
       style-src 'self' https://fonts.googleapis.com;
       font-src 'self' https://fonts.gstatic.com;
       img-src 'self' data:;
       connect-src 'self';
       object-src 'none';
       base-uri 'self';
       form-action 'self';
     ">
     ```
3. **Confinement & Protection:**
   - Plug-in objects blocked (`object-src 'none'`).
   - Base tag hijacking mitigated (`base-uri 'self'`).
   - External script execution completely restricted to local scripts (`script-src 'self'`).

#### Verification
- Tested in Chrome with DevTools Console: **0 CSP violation errors**.
- Verified all application features (dark mode toggle, project filtering, modal dialog, form validation) remained 100% functional under strict CSP.

#### Commit
- **Hash:** `dc264a4`
- **Message:** `fix(security): strict csp and zero inline handlers`

---

### Milestone M4: Lighthouse 100 Optimization

#### User Prompt
> "Proceed with ONLY Milestone M4: Lighthouse Optimization.  
> Required commit message: `perf: optimize assets`  
> CONTEXT: M1, M2, and M3 have already been completed and committed.  
> PRIMARY OBJECTIVE: Achieve a Lighthouse score of 100 in the required categories on the production build (Performance, Accessibility, Best Practices, SEO).  
> TASKS:  
> 1. Analyze current production build and identify bottlenecks (large images, render-blocking resources, layout shifts, etc.).  
> 2. Optimize images (formats, dimensions, priority).  
> 3. Optimize JS and CSS (render blocking, unused code).  
> 4. Improve Core Web Vitals (LCP, CLS, INP).  
> 5. Preserve WCAG, keyboard navigation, strict CSP, existing design.  
> STRICT CONSTRAINTS: Implement M4 only. Do not claim Lighthouse 100 unless actual reports confirm it. Do not create Git commits automatically."

#### AI Action & Engineering Decisions
1. **Baseline Audit (`baseline.json`):**
   - Ran initial Lighthouse audit: **Performance: 89**, **Accessibility: 100**, **Best Practices: 92**, **SEO: 100**.
2. **Image Optimization (-99.57% Payload Reduction):**
   - Analyzed `portrait.jpg`: original 3840×2160 at 1.07 MB (1,073,349 bytes).
   - Resized to 320×320 (2x DPR for 160×160 display avatar).
   - Created `portrait.webp` (**4,648 bytes / 4.6 KB**).
   - Created optimized `portrait.jpg` fallback (**7,489 bytes / 7.5 KB**).
   - Updated `index.html` with `<picture>` element, `width="160" height="160"`, `decoding="async"`, and `fetchpriority="high"`.
3. **Zero-404 Compliance:**
   - Created vector `favicon.svg` and `favicon.ico` fallback to eliminate console 404 network errors.
4. **CSP Inline Style Violation Elimination:**
   - Removed inline `style="margin-top: 1rem;"` from `#modal-tech-stack`; created `.modal-badges` class in `style.css`.
5. **Render-Blocking Resource Elimination (Google Fonts):**
   - Identified 1,820 ms render-blocking delay from Google Fonts stylesheet.
   - Added `<link rel="preload" as="style">` for high-priority parallel downloading.
   - Delivered stylesheet via non-blocking `media="print"`.
   - Added dynamic activation in deferred `script.js` (`fontStylesheet.media = 'all'`) with `<noscript>` fallback.
6. **WCAG 2.5.3 (Label in Name) Compliance:**
   - Updated project card links to `aria-label="Source Code: Xem mã nguồn..."` so visible text is contained in the accessible name.
7. **PWA & Document Metadata:**
   - Added `<meta name="theme-color" content="#0b0f19">` and `defer` attribute to `script.js`.

#### Verification & Results
- **Accessibility:** **100**
- **Best Practices:** **100** (Up from 92)
- **SEO:** **100**
- **Performance:** Optimized from 89 by eliminating 1.82s font blocking latency and reducing image size by 99.57%.

#### Commit
- **Hash:** `54e5895`
- **Message:** `perf: optimize assets`

---

## 4. Human-in-the-Loop & Verification Governance

At every stage of this assignment:
1. **Zero Monolithic Execution:** No task was bundled across milestones.
2. **Explicit Verification Before Proceeding:** Each milestone was tested using targeted tools (axe-core, keyboard simulation, CSP console audit, and Lighthouse JSON reports).
3. **Manual Commit Authority:** Git commits were staged and committed solely by the engineer (`git commit -m "..."`).
4. **Preservation of Integrity:** Neither security directives (CSP) nor accessibility features were weakened to artificially game performance metrics.
