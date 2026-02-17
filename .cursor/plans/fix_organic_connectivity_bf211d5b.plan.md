---
name: Fix organic connectivity
overview: Fix the circle packing to guarantee 100% node connectivity for organic mazes by strengthening attraction forces and adding a post-pack connectivity repair pass that relocates orphan circles.
todos:
  - id: fix-a-attraction
    content: Increase attraction range from 0.15 to 0.4 and scale maxIterations with targetCount in packCircles (circle-packing.js)
    status: pending
  - id: fix-b-ensure-connected
    content: "Add ensureConnected(circles, width, height) function in circle-packing.js: BFS components, relocate orphans, brief re-relax, repeat until single component"
    status: pending
  - id: integrate-generator
    content: Call ensureConnected between packCircles and computeNeighbors in organic-generator.js
    status: pending
  - id: test-validate
    content: Run all tests, verify 73 pass, check lints, confirm connectivity via footer data
    status: pending
isProject: false
---

# Fix Organic Maze Connectivity

## Problem

The circle packing in [src/maze/circle-packing.js](src/maze/circle-packing.js) produces disconnected neighbor graphs. The DFS in [src/maze/organic-generator.js](src/maze/organic-generator.js) only carves through one connected component, leaving orphan nodes invisible and the maze sparse. Worst case: Easy level (80 nodes) had only 3 connected.

**Root cause math** (Easy level, 80 nodes in ~540x680 area):

- Average circle radius ~24, touching distance ~48
- Current `attractRange = max(2, (a.r+b.r) * 0.15)` = ~7 points of gap
- Circles only attract when gap < 7, but average spacing between random placements is ~68
- Most circles are far beyond attraction range and never get pulled together

## Two-pronged fix

### Fix A -- Stronger packing attraction (circle-packing.js)

In `packCircles`, line 64:

- Increase attraction range from `0.15` to `0.4` of combined radii so circles pull together from further away
- Scale `maxIterations` with node count: `Math.max(200, Math.ceil(targetCount * 2.5))` to give larger packs more time to settle
- These changes reduce fragmentation but do not guarantee 100% connectivity

### Fix B -- Post-pack connectivity repair (circle-packing.js)

Add a new exported function `ensureConnected(circles)` called from `organic-generator.js` between `packCircles` and `computeNeighbors`. Algorithm:

1. Compute neighbors (using existing `computeNeighbors`)
2. Find connected components via BFS on the neighbor graph
3. If only one component, return circles unchanged
4. Identify the largest component as "main"
5. For each orphan component, find the orphan node closest to any main-component node
6. Teleport that orphan node to touch the closest main node: place it at distance `mainNode.r + orphanNode.r` along the vector from main to orphan's current position
7. After relocating all bridge nodes, run a brief relaxation pass (~50 iterations, same repulsion logic) to resolve overlaps, then re-check neighbors
8. Repeat until fully connected (bounded to prevent infinite loop)

This is deterministic (processes components sorted by first node id) and guarantees connectivity.

### Integration in organic-generator.js

Current flow (lines 31-39):

```javascript
const { circles } = packCircles({ ... });
const neighborMap = computeNeighbors(circles);
const graph = buildOrganicGraph(circles, neighborMap);
```

New flow:

```javascript
const { circles } = packCircles({ ... });
ensureConnected(circles, width, height);
const neighborMap = computeNeighbors(circles);
const graph = buildOrganicGraph(circles, neighborMap);
```

`ensureConnected` mutates circle positions in place (same as the packing relaxation does) and is deterministic.

## Validation

- All 73 existing tests pass
- Footer data shows `nodes:N/N` (100% connectivity) for every level
- Same seed still produces same maze (determinism maintained)
- Visual inspection of "1 of each" organic PDF at all levels

