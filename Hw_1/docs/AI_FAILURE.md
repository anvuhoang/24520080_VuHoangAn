# AI Failure & Correction Log - HW 1

## Incident 1: Div-Soup Layout Suggestion for Grid Alignment
- **AI Suggested:** The AI initially recommended using CSS Grid with multiple nested `<div>` containers instead of native table elements to simplify custom styling.
- **Why it failed / Violation:** It directly violated the core project requirement: *"Zero div-soup: Must use native <table>, <thead>, <tbody>..."* and completely broke screen reader semantics[cite: 1].
- **Correction:** Instructed the AI to completely discard the `div` layout and rebuild the structure using standard semantic table tags combined with CSS flex/grid properties applied directly to table components.

## Incident 2: Missing Focus Coordinates Tracking in Keyboard Navigation
- **AI Suggested:** The AI provided a generic event listener checking for arrow keys without tracking the active `rowIndex` and `colIndex`.
- **Why it failed / Violation:** Pressing the Left or Right arrow keys caused erratic behavior or lost focus because the browser did not know which adjacent `gridcell` to target next.
- **Correction:** Manually designed and updated `keyboard-nav.js` to explicitly track row and column index states, ensuring seamless two-dimensional grid navigation via arrow keys[cite: 1].

## Incident 3: Inadequate Contrast Ratio in Default Theme Tokens
- **AI Suggested:** Suggested a muted dark-gray text color on a dark slate background for secondary labels.
- **Why it failed / Violation:** Failed the WCAG 2.2 AA requirement specifying a minimum contrast ratio of `4.5:1`[cite: 1].
- **Correction:** Adjusted the CSS custom properties (`variables.css`) to enforce higher text brightness and tested with an accessibility checker to guarantee compliance.