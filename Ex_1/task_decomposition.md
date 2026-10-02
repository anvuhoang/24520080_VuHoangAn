# WBS Task T-01: Semantic DOM Architecture & A11y Contract

## 📌 Task Overview
- **Task ID:** WBS T-01
- **Task Name:** Semantic DOM Architecture & A11y Contract
- **Objective:** Establish the core HTML document structure adhering strictly to WCAG 2.1 accessibility guidelines and semantic HTML5 standards without using any `<div>` elements or CSS styles.
- **Atomic Commit Message:** `feat(html): semantic landmark tree`

---

## 🎯 Verification Gate Constraints
1. **$0$ `<div>` Elements:** Complete prohibition of `<div>` tags across the entire HTML document.
2. **Accessible Skip-Link:** Direct skip link pointing to `#main-content` positioned as the first child of `<body>`.
3. **Complete Landmark Hierarchy:** Valid structural landmarks (`header`, `nav`, `main`) properly defined with explicit ARIA roles.
4. **Zero-CSS Rule:** Absolute omission of inline styles, `<style>` blocks, or external CSS references to avoid the 'One-shot prompt penalty'.

---

## 📋 Work Breakdown Structure (WBS Checklist)

### Phase 1: Planning & Contract Definition
- [ ] **T-01.1:** Document task scope, constraints, and acceptance criteria in `TASK_DECOMPOSITION.md`.

### Phase 2: Core Document & Accessibility Setup
- [ ] **T-01.2:** Declare standard HTML5 document skeleton (`<!DOCTYPE html>`, `<html lang="en">`, `<head>`, `<body>`).
- [ ] **T-01.3:** Insert accessible skip-link directly after `<body>`: `<a href="#main-content" class="skip-link">Skip to main content</a>`.

### Phase 3: Semantic Landmark Construction
- [ ] **T-01.4:** Construct header landmark: `<header role="banner">` containing primary heading `<h1>`.
- [ ] **T-01.5:** Construct navigation landmark: `<nav role="navigation" aria-label="Primary">` with unordered list structure (`<ul>`, `<li>`, `<a>`).
- [ ] **T-01.6:** Construct main content landmark: `<main id="main-content" role="main">` matching skip-link target.

### Phase 4: Structural Content Segmentation
- [ ] **T-01.7:** Create `<section id="about">` inside `<main>` with heading `<h2>` and bio text.
- [ ] **T-01.8:** Create `<section id="projects">` inside `<main>` containing independent `<article>` components.
- [ ] **T-01.9:** Append `<footer role="contentinfo">` with copyright notice.

### Phase 5: Verification Gate & Atomic Commit
- [ ] **T-01.10:** Audit DOM via Chrome DevTools $\rightarrow$ Accessibility panel to verify full Landmark Tree presence.
- [ ] **T-01.11:** Verify zero occurrences of `<div>` tags ($0$ `<div>` elements).
- [ ] **T-01.12:** Confirm complete absence of CSS code.
- [ ] **T-01.13:** Execute atomic commit: `git commit -m "feat(html): semantic landmark tree"`.