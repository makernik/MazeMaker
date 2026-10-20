---
name: Polar outer ring spacing
overview: Taper circular maze rings so higher difficulties are coarser at the finish and finer at the outer edge, strongest on Epic.
todos: []
isProject: false
---

# Plan: Polar outer ring spacing

**Status:** done
**Last updated:** 2026-10-19
**Owner:** agent
**Related:** `docs/DECISIONS.md#D-021`

---

## Overview

Circular mazes use equal radial steps. On the higher levels, especially Epic, that makes the finish fine and the outer rings coarse. Each maze ring outward should be a fixed fraction of the previous ring, with a slightly wider center room. Intro through Medium stay even.

## Scope

**In scope:**

- Shared radial boundary fractions for layout, drawing, solution overlay, and play hit-testing
- Preset taper for Hard, Challenging, Difficult, and Epic Adventure
- Tests for the width curve and for solving an Epic circular maze along corridor centers

**Out of scope:**

- Wedge counts, carve weights, and algorithms
- Intro, Easy, and Medium spacing
- New UI controls

---

## Architecture

`polarBoundaryFractions(maxRing, ratio, roomScale)` returns normalized radii. Ratio `1` keeps the historical even rings. Layout stores absolute `ringRadii`. The drawer and play model read those same boundaries.

**Files touched:**

- `src/maze/polarRadii.js`
- `src/utils/constants.js`
- `src/pdf/layout.js`
- `src/pdf/drawers/draw-polar.js`
- `src/play/model.js`
- `src/play/locate.js`
- `tests/polarRadii.test.js`
- `tests/layout.test.js`
- `tests/play.test.js`
- `docs/DECISIONS.md`

**Key interfaces / contracts:**

- `ringRadii[0] = 0`, `ringRadii[1]` = center-room edge, `ringRadii[r + 1]` = outer edge of maze ring `r`, last value = `maxRadius`
- Same preset + `maxRing` → same fractions

---

## Checkpoints

- **C0** — Taper higher-level circular rings and keep drawing, PDF, and play on the same boundaries

---

## Validation

**Tests to add/update:**

- Even spacing unchanged when ratio is omitted
- Higher levels: maze-ring widths strictly decrease, Epic outer ring narrower than Challenging's relative to its even width
- Epic circular play walk along solution centers still solves

**Commands to run:**

```bash
npm test
```

**Pass criteria:**

- Tests pass
- Letter-size previews of Challenging, Difficult, and Epic show a wider finish and tighter outer rings than even spacing

---

## Notes / Risks

- Epic's outermost ring is about 7pt on US Letter with a 1pt stroke. Narrower than that starts to close the corridor.
- Play forgiveness uses the local ring width so a thin outer ring cannot be skipped.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Comparing even spacing, a power curve, and a geometric taper on the same maze. The geometric taper keeps narrowing through the outer rings. Epic at ratio 0.94 and room scale 1.8 stayed printable (outer ring about 7pt on US Letter).
- Drawing, the solution line, and play tracing share `polarBoundaryFractions`.

**What didn't work:**

- A power curve spent most of the extra width on the center room, so the outer rings stayed close to each other.

**Gaps identified:**

- Epic's wedge count still hits the 64 cap a few rings in. This change is radial width only.

**Lessons learned:**

- The same ratio gets finer at the rim when the level has more rings, so Epic can share Difficult's 0.94 ratio.

---

**Next review:** after C0 validation
