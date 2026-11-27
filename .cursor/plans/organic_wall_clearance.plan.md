---
name: Organic wall clearance
overview: Keep Jagged and Curvy wall strokes a stroke width apart without changing the other styles or the solvable graph.
todos: []
isProject: false
---

# Plan: Organic wall clearance

**Status:** done
**Last updated:** 2026-11-27
**Owner:** agent
**Related:** `docs/DECISIONS.md#D-026`, PR #10

---

## Overview

Jagged overlaps come from decorative filler corridors crossing the main maze. Curvy overlaps come from the bow swinging a corridor into a neighbor. Drop filler edges that cannot keep their walls clear, and shorten the bow on a segment when the full bow would land inside that clearance. The main spanning tree stays put, so the maze stays solvable and Jagged stays straight.

## Scope

**In scope:**

- Filler edge pruning for organic mazes
- Per-edge Curvy bow cap, shared by the walls, the solution line, and play
- Overlap tests updated so clean seeds are required

**Out of scope:**

- Classic, Circular, and Squares
- UI layout
- Merging either PR

---

## Checkpoints

- **C0** — Clearance fix, timings, and a draft PR stacked on #10

---

## Validation

**Commands to run:**

```bash
npm test
npm run build
```

**Pass criteria:**

- Overlap sweep is clean, or any leftover seed is still an expected failure with a reason
- Epic generation time stays in the same range as before the change
- Classic, Circular, and Squares tests still pass

---

## Notes / Risks

- A bow cap that assumes the neighbor may also take its full bow can straighten a tight Curvy segment. Open segments keep the PR #8 bow.
- Filler is decorative. Dropping a colliding filler edge does not change the solution.

---

## Retrospective (fill after checkpoints)

**What worked:**

- Filler edges and junction arcs were the Jagged crossings. Dropping the ones that cannot keep a stroke of clearance fixes Jagged without touching the spanning tree.
- Curvy stays bowed where there is room. The bow is scaled down only where a full bow would land on a neighbor or the border.

**What didn't work:**

- Checking centerline distance alone missed angled walls and arc chords. The check has to use the offset wall strokes.

**Gaps identified:**

- None in the 21-seed sweep. A sharp miter can leave a slightly open joint, covered by the round cap.

**Lessons learned:**

- The old 45% trim cap drew walls through their miter. The trim has to reach the intersection.

---

**Next review:** after the overlap sweep
