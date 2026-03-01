---
name: Corridor-following filler
overview: Replace the grid-based void filler placement with corridor-parallel placement so filler corridors run alongside existing main maze corridors instead of forming random blobs in void regions.
todos:
  - id: c0-corridor-fillers
    content: "C0: Implement generateCorridorFillers() in circle-packing.js -- place filler nodes at perpendicular offsets from carved main edges, collision-check against main circles, connect sequential nodes"
    status: pending
  - id: c1-integrate-generator
    content: "C1: Integrate into organic-generator.js -- replace fillVoids() call, compute corridorHalfW, build filler graph from corridor-following nodes"
    status: pending
  - id: c2-test-validate
    content: "C2: Update tests in circle-packing.test.js, run all tests, visual validation with jagged and curvy styles"
    status: pending
isProject: false
---

# Corridor-Following Filler Corridors

## Problem

`[fillVoids()](src/maze/circle-packing.js)` (line 303) places filler circles on a uniform grid in void regions. These circles form independent graphs with random-direction corridors. The result is visually disconnected blobs that don't follow the main maze's flow.

## Approach: Corridor-Parallel Filler Placement

Replace grid-based void-filling with a strategy that places filler nodes at perpendicular offsets from each **carved** main maze edge. The filler graph edges connect sequential nodes along each corridor's offset path, so filler corridors naturally run parallel to nearby main corridors.

### Algorithm sketch

For each carved edge A-B in the main graph:

- Compute perpendicular direction `p`
- For each side (left, right):
  - Offset distance = `corridorHalfW + gap + fillerRadius` (place beyond the wall line)
  - Sample 2-3 positions along the edge (e.g. t = 0.25, 0.50, 0.75)
  - At each sample: `pos = lerp(A, B, t) + p * offset`
  - If pos doesn't overlap any main circle and is within bounds, create a filler node
- Connect sequential filler nodes along the same edge/side
- At junctions: connect filler nodes from different edges that are close and roughly co-directional

Then run DFS on the filler graph to carve a spanning tree (preserving dead-ends for visual interest). Since nodes are placed along corridor offsets, even the DFS paths will follow main corridor directions.

### Why this works

- Filler node positions are derived from main corridor geometry, not a grid
- Filler edges connect nodes along the same corridor offset, so direction is inherently parallel
- DFS on this graph produces dead-ends that terminate along corridor directions
- The rendering pipeline is unchanged -- filler graph flows through the same `drawGraphCorridors()` in all 4 drawers

## Files Changed

- `**[src/maze/circle-packing.js](src/maze/circle-packing.js)`**: Replace `fillVoids()` with new `generateCorridorFillers(mainGraph, circles, boundsWidth, boundsHeight, corridorHalfW, seed)` function
- `**[src/maze/organic-generator.js](src/maze/organic-generator.js)**`: Update lines 62-71 to call the new function; compute `corridorHalfW` from avgDist (same formula as drawers) so filler placement knows where walls are
- `**[tests/circle-packing.test.js](tests/circle-packing.test.js)**`: Update/add tests for new filler function

## Files NOT Changed

- All 4 drawers (`draw-organic.js`, `draw-curvy.js`, `draw-organic-canvas.js`, `draw-curvy-canvas.js`) -- they already render any filler graph via `drawGraphCorridors()`
- `[organic-geometry.js](src/pdf/drawers/organic-geometry.js)` -- shared geometry unchanged
- `[organic-graph.js](src/maze/organic-graph.js)` -- `buildOrganicGraph()` and `OrganicGraph` unchanged

## Scope

**Included:**

- New corridor-following filler placement function
- Integration into organic generator
- Updated tests

**Excluded:**

- Main maze generation changes
- Drawer/renderer changes
- New visual styles or UI changes

## Checkpoints

**C0 -- New `generateCorridorFillers()` function**

- Implement in `circle-packing.js`
- For each carved edge, place filler nodes at perpendicular offsets on both sides
- Use spatial grid to check overlap with main circles
- Connect sequential filler nodes and cross-connect at junctions
- Return filler circles array

**C1 -- Integrate into organic generator**

- Replace `fillVoids()` call in `organic-generator.js` with `generateCorridorFillers()`
- Compute `corridorHalfW` in the generator (same formula drawers use for `halfW`) so filler placement is wall-aware
- Keep `carveFillerPaths()` as-is -- it runs DFS on whatever filler graph it receives
- Export `fillVoids` remains available but unused (or remove if no other callers)

**C2 -- Test and validate**

- Update `circle-packing.test.js` for new function signature and behavior
- Verify determinism: same seed produces same filler
- Visual validation: generate jagged and curvy mazes, confirm filler corridors follow main corridors
- Verify all existing tests still pass

## Validation

- Filler corridors visually parallel nearby main corridors (no random blobs)
- No overlap between filler and main circles
- Deterministic: same seed + parameters yields same filler
- All tests pass
- Both jagged and curvy styles render correctly with new filler

