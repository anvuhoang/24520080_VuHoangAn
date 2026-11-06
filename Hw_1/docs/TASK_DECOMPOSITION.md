# TASK_DECOMPOSITION.md — Lab 3 · Homework 1 (WBS)

> Goal: a production Studio Drum Kit — 7 pads played from the keyboard (`W A S D J K L`) or the mouse, with synthesized Web Audio sounds, an accessible hit log and a level meter. Target: WCAG 2.2 AA and a Lighthouse Accessibility score of 100.
> Stack: React 19 · Vite · ES2024 · plain JSX. All work follows [project-rules.md](project-rules.md).
> Source: Lab 3 deck, slide 26 (HW1 spec and `useDrumKeyboard` contract).
> Working rule (slide 8): **one prompt per row, one file per prompt**. Each prompt and its result is recorded in [PROMPT_LOG.md](PROMPT_LOG.md).

---

## Block 1 — Setup

Reuses the Exercise 3 toolchain; no new dependencies. Done by copying config files, not by prompting.

| ID  | Task |
| --- | ---- |
| 0.1 | Create `Hw_1/` with `package.json` (name `lab3-hw1`), `vite.config.js`, `index.html` (with an empty `data:` favicon so the console stays clean) and `.gitignore` copied from `Ex_3/`. |
| 0.2 | Copy `src/main.jsx` (`createRoot` + `<StrictMode>`, throws if `#root` is missing) and `docs/project-rules.md`. |
| 0.3 | Add placeholder `src/App.jsx` and `src/index.css` so the project builds before any feature exists. |
| 0.4 | Run `npm install` and `npm run build`. |

---

## Props Contract

Documentation only. The project uses plain JSX, so this block is not compiled.

```ts
type PadId = 'tomHigh' | 'snare' | 'kick' | 'hatClosed' | 'tomLow' | 'hatOpen' | 'crash';

interface Pad {
  id: PadId;                 // stable id, used as key
  label: string;             // 'Tom high'
  keyLabel: string;          // 'W'
  code: 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' | 'KeyJ' | 'KeyK' | 'KeyL';   // KeyboardEvent.code, never keyCode
}

// Key → pad mapping (hands: left W A S D, right J K L)
//   W Tom high · A Snare · S Kick · D Hi-hat closed · J Tom low · K Hi-hat open · L Crash

// useDrumKeyboard(padMap, { onPress, onRelease } = {}, isEnabled = true): void
//   padMap: Map<string, Pad> keyed by KeyboardEvent.code
//   - ignores e.repeat, ignores events from INPUT / TEXTAREA / SELECT / contenteditable,
//     ignores combos with Ctrl / Meta / Alt, preventDefault only for a mapped key
//   - removes both window listeners in its cleanup

// createDrumKit(): { play(padId: PadId): number; dispose(): void }
//   - AudioContext is created lazily on the first play (autoplay policy) and resumed if suspended
//   - play returns the voice's peak level 0..1 (0 for an unknown id)
//   - dispose closes the context and is safe to call twice

interface DrumPadProps {
  label?: string;            // default: 'Pad'
  keyLabel?: string;         // default: ''
  isActive?: boolean;        // default: false → aria-pressed
  onTrigger(): void;
}

interface Hit { id: string; label: string }   // id from crypto.randomUUID()

interface HitLogProps {
  hits?: Hit[];              // default: [], oldest first
  limit?: number;            // default: 8 history rows
}

interface LevelMeterProps {
  level?: number;            // default: 0, clamped to 0..1
}

// DrumKit owns the state: activeIds, hits, level, shortcutsEnabled, sessionName (raw inputs only)
```

Defaults are set with ES6 default parameters in the destructured signature. `defaultProps` is banned.

---

## Sub-tasks

Each row is one prompt and one file. `P` numbers are the prompt order used in [PROMPT_LOG.md](PROMPT_LOG.md).

### Commit 1 — `feat(hw1): add drum pads, keyboard hook and Web Audio kit`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 1.1 | P1 | `src/data/pads.js` | The 7 pads with `KeyboardEvent.code` values, frozen, plus a `PAD_BY_CODE` map. | `feat(hw1): add drum pads, keyboard hook and Web Audio kit` |
| 1.2 | P2 | `src/hooks/useDrumKeyboard.js` | Window `keydown`/`keyup` listeners with the repeat guard, input isolation and cleanup. | `feat(hw1): add drum pads, keyboard hook and Web Audio kit` |
| 1.3 | P3 | `src/audio/drumKit.js` | Synthesized drum voices with a lazy `AudioContext`, click-free envelopes and `dispose()`. | `feat(hw1): add drum pads, keyboard hook and Web Audio kit` |

### Commit 2 — `feat(hw1): add accessible pad, hit log and level meter components`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 2.1 | P4 | `src/index.css` | `:root` design tokens; every text/background pair ≥ 4.5:1, control borders ≥ 3:1. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.2 | P5 | `src/components/DrumPad.jsx` | `<li>` with a `<button type="button" aria-pressed>` showing `<kbd>` + label. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.3 | P6 | `src/components/DrumPad.module.css` | 44px tap target, pressed state not shown by color alone, visible focus ring. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.4 | P7 | `src/components/HitLog.jsx` | `<output aria-live="polite">` with the last hit, plus a non-live history `<ol>`. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.5 | P8 | `src/components/HitLog.module.css` | History list styling. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.6 | P9 | `src/components/LevelMeter.jsx` | Labeled `<meter>` showing the decaying output level. | `feat(hw1): add accessible pad, hit log and level meter components` |
| 2.7 | P10 | `src/components/LevelMeter.module.css` | Meter styling that stays visible in forced-colors mode. | `feat(hw1): add accessible pad, hit log and level meter components` |

### Commit 3 — `feat(hw1): assemble the drum kit with shortcut toggle and responsive layout`

| ID  | Prompt | File | Task | Commit message |
| --- | ------ | ---- | ---- | -------------- |
| 3.1 | P11 | `src/components/DrumKit.jsx` | State, hook wiring, kit cleanup, level decay, shortcut checkbox (WCAG 2.1.4), session-name input. | `feat(hw1): assemble the drum kit with shortcut toggle and responsive layout` |
| 3.2 | P12 | `src/components/DrumKit.module.css` | Mobile-first layout of settings, pads, meter and log. | `feat(hw1): assemble the drum kit with shortcut toggle and responsive layout` |
| 3.3 | P13 | `src/App.module.css` | Page column, title, gutters. | `feat(hw1): assemble the drum kit with shortcut toggle and responsive layout` |
| 3.4 | P14 | `src/App.jsx` | Replace the placeholder: `<main>` → `<h1>` → `<DrumKit />`. | `feat(hw1): assemble the drum kit with shortcut toggle and responsive layout` |

---

## Checkpoint HW1 — Verification

Run from `Hw_1/` in Git Bash, with `npm run dev` for the browser checks.

- [ ] **Build passes:** `npm run build` → no errors.
- [ ] **No legacy keys:** `grep -rn "keyCode\|\.which" src | wc -l` → `0`; `grep -rn "e.code\|event.code" src` → hits in the hook.
- [ ] **Guards present:** `grep -n "e.repeat\|event.repeat" src/hooks/useDrumKeyboard.js` → 1 hit; `grep -n "removeEventListener" src/hooks/useDrumKeyboard.js` → keydown and keyup.
- [ ] **No `<div>` / `<span>` / `alert(` / inline `style=` / `http://`:** each `grep -rn … src | wc -l` → `0`.
- [ ] **No hex in modules:** `grep -n "#[0-9a-fA-F]\{3,6\}" src/*.module.css src/components/*.css | wc -l` → `0`.
- [ ] **Keyboard play:** press `W`, `A`, `S`, `D`, `J`, `K`, `L` → each pad shows pressed, the hit log changes, a sound plays.
- [ ] **Repeat guard:** hold `A` for 2 s → exactly one hit.
- [ ] **Input isolation:** click the session-name box and type `wasd` → no hits.
- [ ] **Shortcut toggle (WCAG 2.1.4):** untick "Enable keyboard shortcuts" → pressing `W` does nothing; the pads still work with mouse, `Enter` and `Space`.
- [ ] **Cleanup:** navigating away or StrictMode remount leaves no duplicate listeners (one hit per keypress after a remount).
- [ ] **Live region:** DevTools → Accessibility: the `output` shows `live: polite` and changes on each hit; the history list is not live.
- [ ] **Lighthouse:** Accessibility = **100** (desktop and mobile).
- [ ] **375px:** `document.documentElement.scrollWidth <= window.innerWidth` → `true`; 1440px has no overflow.
- [ ] **Console:** no errors or warnings.
- [ ] **Git history:** `git log --oneline` shows the three HW1 commits above.
