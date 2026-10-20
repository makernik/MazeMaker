---
name: Difficulty curve and curvy bow
overview: Retune Classic, Squares, and organic difficulty so the steps keep rising, and draw Curvy as a bowed version of the same organic paths.
todos: []
isProject: false
---

# Plan: Difficulty curve and curvy bow

**Status:** done
**Last updated:** 2026-10-20
**Owner:** agent
**Related:** `docs/DECISIONS.md#D-022`

---

## Overview

Classic Challenging grows so it sits between Hard and Difficult. Squares Difficult and Epic get finer room interiors. Organic node counts rise more evenly, and Curvy bows each corridor of the same graph Jagged draws straight.

## Scope

**In scope:**

- Preset grid, room, and organic node changes from the review
- Curvy wall, solution line, hint, and play hit-testing on the bowed centerline

**Out of scope:**

- Changing the seed when switching Jagged and Curvy
- Circular ring spacing
- A separate Curvy maze generator

---

## Checkpoints

- **C0** — Preset retune and bowed Curvy rendering on the existing organic graph

---

## Validation

**Commands to run:**

```bash
npm test
```

**Pass criteria:**

- Tests pass
- Classic Challenging is visibly finer than Hard and coarser than Difficult
- Squares Difficult room interiors are finer than Challenging, Epic finer still
- Same-seed Jagged and Curvy show the same route, with Curvy corridors bowed

---

## Retrospective (fill after checkpoints)

**What worked:**

- Classic Challenging at 18×24 lands between Hard and Difficult (about 28pt cells, seed 11 path 51).
- Squares Difficult and Epic interiors are finer than Challenging (sub cells about 12pt and 9pt).
- One bowed centerline, shared by the walls, the solution, the hint, and play, keeps Curvy on the Jagged graph.

**What didn't work:**

- A single cubic with offset controls left the junctions at an angle, so corridors kinked. Two cubics that leave along the passage fixed that without changing the crest height.

**Gaps identified:**

- Preview and play still pick a new seed when the style changes. Sharing a seed between Jagged and Curvy is still an open choice.
- Squares Difficult and Epic solution paths are not longer than Challenging. The interiors are finer; the route length is not.

**Lessons learned:**

- Corridor bows have to meet the existing junction arcs along the chord. Amplitude alone does not make the corner look curved.
