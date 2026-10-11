---
name: Squares finer room paths
overview: Make each Squares room a mini-maze whose corridors are finer than the outer maze, age-scaled, and entered through the outer doorway.
todos: []
isProject: false
---

# Squares finer room paths

**Status:** done  
**Last updated:** 2026-10-11  
**Owner:** agent  
**Related:** `docs/DECISIONS.md#D-021`

---

## Overview

Squares rooms are already mini-mazes: a block of the outer grid holds a sub-maze. On several levels the interior grain matches the outer corridors, so the room does not read as a finer maze inside a maze. Raise interior resolution, keep a print floor, and put each sub-maze door in the outer opening it belongs to.

---

## Scope

**In scope:**

- Age-scaled interior detail: sub-cells per outer cell, so interior paths are finer than the outer maze.
- Print floor so a sub-cell does not drop below 7pt.
- Sub-maze doors sit inside the outer opening segment.
- Interior stroke stays a fraction of the sub-cell so fine paths do not ink shut.

**Out of scope:**

- New maze styles, Labyrinth, or a user control for detail.
- Changing room count or outer block size.
- PDF metadata and debug ingest calls.

---

## Expected file tree

- `src/utils/constants.js` — `roomDetail`, `MIN_ROOM_SUB_CELL_PT`, `roomInteriorLayout`
- `src/maze/rooms-generator.js` — computed sub-maze size; door aligned to the opening
- `src/pdf/drawers/draw-rooms.js` — stroke cap for fine cells
- `tests/rooms-generator.test.js`
- `docs/DECISIONS.md` — D-021

---

## Checkpoints

- **C0** — Decision and this plan
- **C1** — Interior sizing, aligned doors, stroke cap, tests
- **C2** — Preview of Intro, Medium, and Epic Squares

---

## Validation

**Commands:**

```bash
npm test
```

**Pass criteria:**

- Every preset’s interior cell is strictly smaller than its outer cell and at least 7pt.
- Sub-maze side length is an integer multiple of the outer block size, at least 2×.
- Each room’s two border openings lie in the outer doorway segments.
- Rooms stay solvable. Preview shows the finer interior on Intro, Medium, and Epic.

---

## Notes / Risks

- Same seed still places rooms in the same outer cells. The interior maze changes because it has more cells.
- A wide outer doorway still spans one outer cell. The carved passage is the sub-cell at the middle of that span.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Interior size is `roomOuterSize × detail`, so the mini-maze stays aligned to the outer cells. Detail 2 / 3 / 4 lands at 36pt down to 7pt.
- Putting the carved door in the middle of the outer opening keeps the fine path on the corridor that enters the room.

**What didn't work:**

- Nothing in this pass.

**Gaps identified:**

- The drawn doorway is still one outer cell wide, so the mouth is wider than one fine corridor. That is the join between the two scales.

**Lessons learned:**

- Finer interiors only read as a continuation of the outer maze when the door sits in the opening segment, not at the center of the whole wall.

---

**Validation results (2026-10-11):** `npm test` — 204 passed. Interior cells: Intro 36pt (2×), Medium 15pt (2×), Hard–Difficult 9.3pt (3×), Epic 7pt (4×). Preview of Intro, Medium, and Epic Squares shows the finer rooms; no page errors.
