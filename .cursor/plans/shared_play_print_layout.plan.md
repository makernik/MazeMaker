---
name: Shared Play and Print layout
overview: Give Print and Play one page frame, keep phone controls next to the maze, and lighten the freehand path.
todos: []
isProject: false
---

# Plan: Shared Play and Print layout

**Status:** done
**Last updated:** 2026-11-27
**Owner:** agent
**Related:** `docs/DECISIONS.md#D-025`, `.cursor/rules/ui_rules.mdc`

---

## Overview

The owner’s phone review: Play and Print should share a layout, Print keeps its own step order, and on a phone the maze may fill the screen as long as level, Hint, and Start over stay with it. The sample preview must sit above the footer. The freehand path should be a lighter blue. Maze generation and PDF output stay as they are.

## Scope

**In scope:**

- One grid for Print and Play (controls left / maze right when wide; title, maze, controls, footer when narrow)
- Play step order: level, Hint and Start over, style. Print step order unchanged: level, style, quantity, Generate
- Compact level menu on narrow screens, still writing the existing age-range radios
- Line forgiveness moved into a closed disclosure
- Play ink `#2563EB` at full opacity
- Contrast check for that ink

**Out of scope:**

- Maze generation, solvers, PDF drawing, seeds
- Palette, type, or a new visual system
- Theme controls, debug behavior, forgiveness math

---

## Architecture (optional)

**Files touched:**

- `src/index.html`
- `src/styles/main.css`
- `src/main.js`
- `src/play/view.js`
- `tests/play.test.js`
- `docs/DECISIONS.md`

**Key interfaces / contracts:**

- Form values still come from `input[name="age-range"]`. The phone menu only checks that radio.
- `drawPlayInk` is canvas-only. PDF drawers are untouched.

---

## Checkpoints

- **C0** — Capture the current Print and Play frames at 1280×800 and 412×915.
- **C1** — Shared frame, step order, phone level menu, forgiveness disclosure, play ink.
- **C2** — `npm ci`, `npm test`, `npm run build`, and the same screenshots after the change.

---

## Validation

**Tests to add/update:**

- Play ink is `#2563EB`, lighter than `#1E293B`, and at least 4.5:1 on `#FAFAF8`.

**Commands to run:**

```bash
npm ci
npm test
npm run build
```

**Pass criteria:**

- At 412×915, Hint, Start over, the level menu, and every style chip are fully on screen in Play. The sample maze is above the footer in Print.
- Wide screens still show controls on the left and the maze on the right.
- `npm test` and `npm run build` succeed. The known-flaky organic PDF test may be rerun up to three times.

---

## Notes / Risks

- Narrow layout puts the maze above the controls. That is the owner’s requested exception to the v0 “controls above preview” note.
- A short phone (well under 915px tall) can scroll the control dock. The maze stays put, and level plus Hint stay at the top of that dock.

---

## Retrospective (fill after checkpoints)

**What worked:**

- One grid for both modes. On a phone the maze sits between the title and the controls, so Hint, the level menu, and the sample stay on screen.
- Wide screens keep level then style for Play, with Hint directly under the style chips.

**What didn't work:**

- The first phone preview used the canvas’s intrinsic height, so the sample was cropped. Giving the stage the leftover height fixed it.

**Gaps identified:**

- At 1280×800 the Print quantity slider and Generate button still sit in the scrolling panel, below the footer line. That matches the previous desktop panel.

**Lessons learned:**

- Phone overrides have to come after the shared padding rules or the shared rules win.

---

**Next review:** after C2
