---
name: Corridor-following filler
overview: Replace the grid-based void filler placement with corridor-parallel placement so filler corridors run alongside existing main maze corridors instead of forming random blobs in void regions.
todos:
  - id: c0-extract-computeCorridorWidth
    content: "C0: Extract computeCorridorWidth() into organic-geometry.js, replace inline blocks in all 4 drawers"
    status: pending
  - id: c1-corridor-fillers
    content: "C1: Implement generateCorridorFillers() in circle-packing.js -- place filler nodes at perpendicular offsets from carved main edges, collision-check against main circles, connect sequential nodes"
    status: pending
  - id: c2-integrate-generator
    content: "C2: Add organicFill to constants.js presets (0 for medium and below, 1 for hard and up); gate filler in organic-generator.js on preset.organicFill; use computeCorridorWidth for halfW"
    status: pending
  - id: c3-test-validate
    content: "C3: Update tests, run all tests, visual validation with jagged and curvy styles"
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

Then run DFS on the filler graph to carve a spanning tree (preserving dead-ends for visual interest). Since nodes are placed along corridor offsets, even the DFS paths will follow main corridor directions.

### Junction handling (nodes with 3+ carved passages)

**Crowding prevention.** Filler nodes are sampled starting at `t >= 0.25` along each edge, never at the junction node itself (`t=0`). This creates a natural exclusion zone of at least 25% of edge-length around every junction center. No additional exclusion logic is needed.

**Cross-connection rule.** After all filler nodes are placed, attempt to link filler endpoints from different edges that meet at the same main-graph node:

1. **Proximity gate**: two filler endpoints must be within `fillerR * 4` of each other.
2. **Angle tolerance (45 deg)**: the angle between the two parent-edge directions must be < 45 degrees. This means filler paths from gently-curving corridors connect into continuous parallels, while perpendicular corridors (T-junctions, 90-degree bends) stay separate -- which is correct, since a tiny filler corridor turning a right angle would look jarring.
3. Eligible pairs get a neighbor connection (with a wall, as usual). DFS carving decides which cross-connections actually become drawn edges.

**Why 45 degrees.** At 30 degrees almost nothing connects, leaving most junctions as disconnected stubs. At 60+ degrees, filler starts wrapping around moderate bends which looks forced at filler scale. 45 degrees is the sweet spot: gentle curves connect, sharp turns don't. DFS carving is a further safety net -- even if a cross-connection is created, it only draws if the spanning tree traverses it.

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
- `**[src/maze/organic-generator.js](src/maze/organic-generator.js)**`: Gate filler generation on `preset.organicFill`; import `computeCorridorWidth` from `organic-geometry.js` to get `halfW`
- `**[src/pdf/drawers/draw-organic.js](src/pdf/drawers/draw-organic.js)**`: Replace inline avgDist/halfW block with `computeCorridorWidth(graph, lineThickness)` call
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

