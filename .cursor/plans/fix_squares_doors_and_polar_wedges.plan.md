---
name: Fix squares doors and polar wedges
overview: Stop Squares room sub-mazes from inheriting the printable entrance and exit, and keep polar wedge counts on integer multiples when the 64-wedge cap applies.
todos: []
isProject: false
---

# Fix Squares extra doors and polar wedge cap

**Status:** done  
**Last updated:** 2026-10-11  
**Owner:** agent  
**Related:** `docs/DECISIONS.md#D-020`

---

## Overview

Two confirmed print bugs:

1. Squares room sub-mazes are built with `generateMaze()`, which always opens the grid entrance (top of `(0,0)`) and exit (bottom of the last cell). Those holes are drawn as extra doorways into neighboring passages.
2. Circular Medium (`6-8`) and Hard (`9-11`) wedge counts hit `MAX_WEDGES` (64) on a 48-wedge ring. 64 is not a multiple of 48, so outward neighbors become fractional, the solver treats a missing wall slot as open, and Kruskal/Wilson’s throw.

---

## Scope

**In scope:**

- Sub-mazes keep a sealed outer border except the two intended room doors.
- Formula-based polar wedge counts stay an integer multiple of the previous ring, including after the 64 cap.
- Outward neighbors are integer cell indexes that match outward wall slots.
- A missing outward wall slot counts as a wall. `getCell` rejects non-integer indexes. `removeWallBetween` ignores a missing cell.

**Out of scope:**

- PDF metadata / determinism of `pdfDoc.save()`.
- Debug ingest `fetch` calls, preview-seed listener, and debug “1 of each” pack size.
- Changing the polar wedge-multiplier clamp of 4 (Epic’s stored multiplier of 5). That sequence already lands on valid multiples (8 → 32 → 64).

---

## Expected file tree

- `src/maze/generator.js` — optional `openBorder` (default true)
- `src/maze/rooms-generator.js` — sub-mazes pass `openBorder: false`
- `src/maze/polarGrid.js` — cap snap, integer neighbors, safe wall/cell lookup
- `src/maze/polarGenerator.js` — skip a missing cell when carving
- `tests/rooms-generator.test.js`
- `tests/polarGrid.test.js`
- `tests/polarGenerator.test.js`
- `docs/DECISIONS.md` — D-020

---

## Checkpoints

- **C0** — Plan + D-020
- **C1** — Squares: seal sub-maze borders; test that perimeter openings match the two doors
- **C2** — Polar: integer-multiple cap, neighbor/wall safety; tests for 6-8 and 9-11 across algorithms

Both checkpoints run in this pass because both fixes were requested together.

---

## Validation

**Commands:**

```bash
npm test
```

**Pass criteria:**

- Every Squares room’s sub-maze border is open only at the two intended doors (all age presets, seed 42).
- Every difficulty preset’s polar ring counts are positive integers, each a multiple of the previous ring, and ≤ 64.
- Medium and Hard circular mazes generate with recursive-backtracker, Kruskal, and Wilson’s. The solver path steps only through walls that are actually open.
- Existing unit tests still pass.

---

## Notes / Risks

- Medium and Hard circular mazes for a given seed change, because the outer ring stays at 48 wedges instead of jumping to 64.
- Squares room interiors for a given seed change only at the two accidental border holes; the carved tree is unchanged.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Sealing the sub-maze border at generation, then opening only the two doors, removed every extra hole (0 of 140 rooms across five seeds and all levels).
- Snapping the 64 cap to a multiple of the previous ring made Medium and Hard counts 48→48. Kruskal and Wilson’s generate, and the solver path stays on open walls.

**What didn't work:**

- Nothing in this pass.

**Gaps identified:**

- PDF save metadata and the debug ingest calls are still open.

**Lessons learned:**

- `hasWall` must return a boolean. `undefined` was treated as an open passage by the solver and as a wall by generation.

---

**Validation results (2026-10-11):** `npm test` — 202 passed. Diagnostic: 140 Squares rooms, 0 extra border holes. Circular 6-8 and 9-11 (recursive-backtracker, Kruskal, Wilson’s, seed 1) solve with 0 path steps through a closed wall. Preview checked for Squares Medium and Circular Hard; no page errors.
