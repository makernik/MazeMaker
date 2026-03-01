---
name: Corridor-following filler
overview: Replace the grid-based void filler placement with corridor-parallel placement so filler corridors run alongside existing main maze corridors instead of forming random blobs in void regions.
todos:
  - id: c0-extract-computeCorridorWidth
    content: "C0: Extract computeCorridorWidth() into organic-geometry.js, replace inline blocks in all 4 drawers"
    status: completed
  - id: c1-corridor-fillers
    content: "C1: Implement generateCorridorFillers() in circle-packing.js -- place filler nodes at perpendicular offsets from carved main edges, collision-check against main circles, connect sequential nodes"
    status: completed
  - id: c2-integrate-generator
    content: "C2: Add organicFill to constants.js presets (0 for medium and below, 1 for hard and up); gate filler in organic-generator.js on preset.organicFill; use computeCorridorWidth for halfW"
    status: completed
  - id: c3-test-validate
    content: "C3: Update tests (6 new), all 193 tests pass. Visual validation pending user review."
    status: completed
isProject: false
---

# Corridor-Following Filler Corridors

## Problem

`[fillVoids()](src/maze/circle-packing.js)` (line 303) places filler circles on a uniform grid in void regions. These circles form independent graphs with random-direction corridors. The result is visually disconnected blobs that don't follow the main maze's flow.

## Approach: Corridor-Parallel Filler Placement

Replace grid-based void-filling with a strategy that places filler nodes at perpendicular offsets from each **carved** main maze edge. The filler graph edges connect sequential nodes along each corridor's offset path, so filler corridors naturally run parallel to nearby main corridors.

### Algorithm sketch (v2 — long single-edge filler)

The v1 approach (multi-node strips with junction cross-connections) produced short chunky stubs. v2 simplifies: each filler corridor is a **single long edge** spanning most of its parent corridor's length.

For each carved edge A-B in the main graph:

- Compute perpendicular direction `p`
- For each side (left, right):
  - Offset distance = `halfW * 3` (one halfW for main wall, one for gap, one for filler wall center)
  - Place two nodes: one at `t = 0.15`, one at `t = 0.85` along the offset path
  - If both nodes are within bounds and don't overlap any OTHER corridor, create the pair + one edge
- No junction cross-connections (they caused crossing stubs)
- DFS opens the single wall on each 2-node component, producing a clean parallel corridor with round end caps

Parameters are derived from `halfW` (visual corridor width), not from circle topology radius:

- `fillerR = max(2, halfW)` — node radius for the graph
- `offset = halfW * 3` — centerline-to-centerline distance
- `corridorClearance = halfW * 2 + 1` — collision check radius
- `minEdgeLen = halfW * 8` — skip short edges where filler would be a blob

### Per-level filler flag (`organicFill`)

Filler corridors are only generated when `preset.organicFill` is truthy. The flag lives in `DIFFICULTY_PRESETS` in `[constants.js](src/utils/constants.js)`:


| Level | Label          | `organicFill` |
| ----- | -------------- | ------------- |
| 3     | Intro          | 0             |
| 4-5   | Easy           | 0             |
| 6-8   | Medium         | 0             |
| 9-11  | Hard           | 1             |
| 12-14 | Challenging    | 1             |
| 15-17 | Difficult      | 1             |
| 18+   | Epic Adventure | 1             |


Simpler mazes (Medium and below) have fewer, larger circles with more void space — filler adds visual noise without benefit. Harder mazes (Hard and up) are dense enough that void regions look like gaps without filler. The generator skips filler entirely when `organicFill === 0`, so `fillerGraph` is `null` and no filler rendering occurs.

### Why this works

- Filler node positions are derived from main corridor geometry, not a grid
- Filler edges connect nodes along the same corridor offset, so direction is inherently parallel
- DFS on this graph produces dead-ends that terminate along corridor directions
- The rendering pipeline is unchanged -- filler graph flows through the same `drawGraphCorridors()` in all 4 drawers
- Filler is gated per level — only generated for Hard+ where void gaps are visually distracting

## Files Changed

- `**[src/utils/constants.js](src/utils/constants.js)`**: Add `organicFill` to each preset in `DIFFICULTY_PRESETS`. `0` for 3, 4-5, 6-8; `1` for 9-11, 12-14, 15-17, 18+.
- `**[src/pdf/drawers/organic-geometry.js](src/pdf/drawers/organic-geometry.js)`**: New exported `computeCorridorWidth(graph, lineThickness?)` function. Extracts the avgDist + halfW computation duplicated across all 4 drawers. Returns `{ corridorWidth, halfW, avgDist }`. `lineThickness` defaults to `1.5` so callers without a layout get a reasonable value.
- `**[src/maze/circle-packing.js](src/maze/circle-packing.js)`**: Replace `fillVoids()` with new `generateCorridorFillers(mainGraph, circles, boundsWidth, boundsHeight, corridorHalfW, seed)` function
- `**[src/maze/organic-generator.js](src/maze/organic-generator.js)`**: Gate filler generation on `preset.organicFill`; import `computeCorridorWidth` from `organic-geometry.js` to get `halfW`
- `**[src/pdf/drawers/draw-organic.js](src/pdf/drawers/draw-organic.js)`**: Replace inline avgDist/halfW block with `computeCorridorWidth(graph, lineThickness)` call
- `**[src/pdf/drawers/draw-curvy.js](src/pdf/drawers/draw-curvy.js)**`: Same inline block replacement
- `**[src/pdf/drawers/draw-organic-canvas.js](src/pdf/drawers/draw-organic-canvas.js)**`: Same inline block replacement
- `**[src/pdf/drawers/draw-curvy-canvas.js](src/pdf/drawers/draw-curvy-canvas.js)**`: Same inline block replacement
- `**[tests/circle-packing.test.js](tests/circle-packing.test.js)**`: Update/add tests for new filler function

## Files NOT Changed

- `[organic-graph.js](src/maze/organic-graph.js)` -- `buildOrganicGraph()` and `OrganicGraph` unchanged

## Scope

**Included:**

- Extract `computeCorridorWidth()` into `organic-geometry.js` (DRY up 4 drawers)
- New corridor-following filler placement function
- Integration into organic generator
- Updated tests

**Excluded:**

- Main maze generation changes
- New visual styles or UI changes

## Checkpoints

**C0 -- Extract `computeCorridorWidth()` into `organic-geometry.js`**

- New export: `computeCorridorWidth(graph, lineThickness = 1.5)` returns `{ corridorWidth, halfW, avgDist }`
- Replace the inline avgDist/halfW block in all 4 drawers with a call to `computeCorridorWidth`
- Verify no visual regression (same formula, just moved)

**C1 -- New `generateCorridorFillers()` function**

- Implement in `circle-packing.js`
- For each carved edge, place filler nodes at perpendicular offsets on both sides
- Sample at t = [0.25, 0.50, 0.75] (exclusion zone near junction centers)
- Use spatial grid to check overlap with main circles
- Connect sequential filler nodes along the same edge/side
- Cross-connect at junctions: proximity < fillerR*4, angle between parent edges < 45 deg
- Return filler circles array and a neighbor map

**C2 -- Integrate into organic generator + level gating**

- Add `organicFill` to each preset in `constants.js` (0 for 3, 4-5, 6-8; 1 for 9-11 through 18+)
- In `organic-generator.js`, skip filler entirely when `preset.organicFill === 0` (set `fillerGraph = null`)
- When `organicFill === 1`: replace `fillVoids()` call with `generateCorridorFillers()`
- Import `computeCorridorWidth` from `organic-geometry.js` to get `halfW` at generation time (using default `lineThickness`)
- Keep `carveFillerPaths()` as-is -- it runs DFS on whatever filler graph it receives

**C3 -- Test and validate**

- Update `circle-packing.test.js` for new filler function signature and behavior
- Verify determinism: same seed produces same filler
- Visual validation: generate jagged and curvy mazes, confirm filler corridors follow main corridors
- Verify all existing tests still pass

## Validation

- Filler corridors visually parallel nearby main corridors (no random blobs)
- No overlap between filler and main circles
- Deterministic: same seed + parameters yields same filler
- All tests pass
- Both jagged and curvy styles render correctly with new filler

