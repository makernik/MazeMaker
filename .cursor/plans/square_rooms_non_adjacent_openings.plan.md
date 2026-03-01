---
name: square-rooms-non-adjacent-openings
overview: Enforce that square (rooms) style mazes have two openings per room that are non-adjacent (on opposite or at least different sides).
todos: []
isProject: false
---

# Plan: Square rooms — non-adjacent openings

**Status:** executing  
**Last updated:** 2026-02-28  
**Owner:** agent  

---

## Overview

User requirement: the two openings of each square room must be **non-adjacent**. Currently both openings can lie on the same side of the room (e.g. both on the right wall), which is considered adjacent. Openings should be on different sides (ideally opposite) so they are clearly non-adjacent.

## Scope

**In scope:**

- Block rooms (K×K, `roomOuterSize` > 1): when picking two boundary cells as openings, choose them from **different sides** of the room (so the resulting opening directions are non-adjacent). Prefer opposite sides when available.
- 1×1 rooms: only use outer grid cells as room candidates when the cell’s two passages are on **opposite sides** (non-adjacent openings).

**Out of scope:**

- Changing room count or placement; no UI changes.
- Other maze styles (grid, jagged, curvy, polar).

---

## Checkpoints

- **C0** — Helper: define “non-adjacent” (opposite sides) and use when selecting openings (block + 1×1).
- **C1** — Validation: run existing tests and manual smoke (squares preset); confirm no adjacent openings.

---

## Validation

**Commands to run:**

```bash
npm run test
npm run build
```

**Pass criteria:**

- All tests pass. Squares generation (both 1×1 and K×K) produces rooms whose two openings are on different sides (non-adjacent). No deterministic/seed requirements change beyond the new constraint.

---

## Files touched

- `src/maze/rooms-generator.js` — import `OPPOSITE` from grid; when picking two openings for block rooms, pick from different sides; when choosing 1×1 room candidates, require opposite-side openings.
