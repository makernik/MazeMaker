---
name: Play phone scale and pull-to-refresh
overview: Scale Play mazes to the phone canvas width and stop a drag above Start from reloading the page.
todos: []
isProject: false
---

# Plan: Play phone scale and pull-to-refresh

**Status:** done
**Last updated:** 2026-11-27
**Owner:** agent
**Related:** `docs/DECISIONS.md#D-027`, `docs/DECISIONS.md#D-025`

---

## Overview

On a phone, Play fits the maze into the short leftover viewport. Portrait mazes then sit as a narrow strip in a full-width canvas. A finger that starts just above Start, outside that canvas, triggers pull-to-refresh. This change grows the Play canvas on narrow screens so the maze is limited by width, and it treats a touch that begins in the margin above the canvas as the start of the stroke.

## Scope

**In scope:**

- Phone Play canvas height follows the maze aspect so the drawing fills the stage width
- Hit testing uses that same layout, including a point just outside the canvas
- Play-only `overscroll-behavior-y: contain`, `touch-action: none` on the play surface, and `preventDefault` for touches that begin near the canvas
- D-027 and vitest coverage for the fit and the coordinate map
- Before/after screenshots at 412×915 for Hard and Epic

**Out of scope:**

- A separate play-mode grid (fewer cells) for Epic density
- Print layout, PDF, seeds, and maze generation
- Desktop Play, which still letterboxes inside the right-hand stage

---

## Architecture (optional)

**Files touched:**

- `src/play/fit.js` (new)
- `src/play/ui.js`
- `src/play/view.js`
- `src/pdf/layout.js` (export the reserved bands the fit uses)
- `src/styles/main.css`
- `tests/play-fit.test.js` (new)
- `docs/DECISIONS.md`
- `.cursor/plans/play_phone_scale_and_pull.plan.md`

**Key interfaces / contracts:**

- `fitPlayCanvas(maze, cssWidth, cssHeight, dpr, { allowGrow })` returns the bitmap page size and the margin passed to `getLayoutForMaze`.
- `mapClientToMaze` is the pointer mapping. `clientToLocal` calls it.
- Narrow is `max-width: 768px`, the same breakpoint as D-025.

---

## Checkpoints

- **C0** — Screenshot Hard and Epic Play at 412×915 before the change.
- **C1** — Fit, touch guard, D-027, and tests.
- **C2** — `npm test`, `npm run build`, and the same screenshots after the change.

---

## Validation

**Tests to add/update:**

- A short phone stage letterboxes Hard; growing the page makes the drawn width meet the content width.
- Every preset aspect (grid, organic, polar, squares) fills the width when growth is allowed.
- A CSS point on the start cell maps back to that cell at dpr 1 and dpr 2. A point just above the canvas maps through the same function and still counts when it is within forgiveness.
- The capture region includes the margin above the canvas and does not include the controls below it.

**Commands to run:**

```bash
npm test
npm run build
```

**Pass criteria:**

- At 412×915, Hard classic fills the play canvas width. Level, Hint, and Start over stay under the maze.
- A drag that starts just above the canvas does not reload the page, and scrolling from the controls still works.
- `npm test` and `npm run build` succeed.

---

## Notes / Risks

- Epic classic is 36 columns. Filling a ~388px stage still leaves cells near 10px. A phone-only grid would make Play a different maze from Print. D-027 records that and does not add one.
- Narrow Play may scroll when the maze plus the control stack is taller than the screen. Print does not.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Sizing the phone page to the maze aspect fills the width. Hard classic ink went from about 185px to about 350px on a 412px screen. Level, Hint, and Start over stay under the maze.
- A touch that starts above the canvas draws, calls preventDefault, and does not scroll. Touches on the title and on Hint are left alone, so the page still scrolls.

**What didn't work:**

- Keeping the previous maze's page height made a circle sit in a tall empty canvas. The phone page is now the current maze's own height.

**Gaps identified:**

- Epic classic is still 36 columns, about 10px per cell once it fills a phone width. A play-only grid would be a different maze from Print. Not added.

**Lessons learned:**

- `overflow: auto` on a page that is already as tall as its content swallows the wheel and the document does not scroll. Phone Play uses the document scroller.

---

**Next review:** after C2
