---
name: Impeccable site polish
overview: Correct verified contrast, touch-target, and focus issues on the existing page without changing the pinned visual system.
todos: []
isProject: false
---

# Plan: Impeccable site polish

**Status:** done
**Last updated:** 2026-10-18
**Owner:** agent
**Related:** `.cursor/rules/ui_rules.mdc`

---

## Overview

Impeccable flagged one real contrast failure and two font warnings. The fonts stay (Fraunces and Inter are required). This pass fixes the contrast bug and the related touch and focus issues on the same controls.

## Scope

**In scope:**

- Age-label contrast (`opacity: 0.85` on muted text)
- 44px targets for level rows, style toggles, and range sliders
- Disabled buttons that stay readable without opacity
- Selection, caret, and scrollbar matching the existing palette
- Removing the 0.1s transitions (v0 has no animation)
- Solved overlay type that fits a narrow screen

**Out of scope:**

- Font changes
- Palette or layout redesign
- Play behavior, maze generation, PDF output
- New motion, PRODUCT.md, or DESIGN.md
- The faint maze background pattern

---

## Architecture (optional)

**Files touched:**

- `src/styles/main.css`

**Key interfaces / contracts:**

- Tokens in `:root` stay as specified in `ui_rules.mdc`.

---

## Checkpoints

- **C0** — Confirm the age-label opacity is the `#7b889b` contrast failure.
- **C1** — Apply the CSS corrections above.
- **C2** — Re-run the detector and check print and play at desktop and phone width.

---

## Validation

**Tests to add/update:**

- None. This is presentation only.

**Commands to run:**

```bash
.cursor/skills/impeccable/scripts/impeccable detect --json src/index.html src/styles/main.css
```

**Pass criteria:**

- Low-contrast finding is gone.
- Font warnings remain and are waived.
- Level rows, toggles, and sliders meet a 44px hit area.
- Disabled controls no longer use opacity on text.

---

## Notes / Risks

- `#64748B` on `#FAFAF8` is 4.55:1. It passes only when opacity is 1.
- Range thumbs stay visually small; the input box is the 44px target.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Removing the age-label opacity cleared the only contrast finding.
- A 44px slider box with a 6px track kept the thin track and a real finger target.
- On desktop the control panel scrolls inside the viewport, so Generate and Hint stay reachable and the maze stays put.

**What didn't work:**

- The detector still warns that Fraunces and Inter are overused. Those faces are required by the UI rules, so they stay.

**Gaps identified:**

- `.control-group.topology-disabled` still fades a whole group. Nothing applies that class in the current page.

**Lessons learned:**

- Raising tap targets made the panel taller than a laptop window. The scroll belongs on the panel.

---

**Next review:** after C2
