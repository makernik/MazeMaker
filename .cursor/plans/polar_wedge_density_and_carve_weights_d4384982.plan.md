---
name: Polar wedge density and carve weights
overview: Add an optional per-ring wedge-count array to PolarGrid for expressive density control, and apply per-ring direction weights during polar generation so outer rings favor angular carving (orbiting) and inner rings favor inward carving (funnel), producing a maze that feels open at the edge and deliberately funnels near the center.
todos: []
isProject: false
---

# Polar wedge density and per-ring carve weights

## Goal

- **Wedge density**: Support an expressive per-ring wedge count array in PolarGrid (not only formula-based counts) so layout can vary density by ring.
- **Carve weighting**: During polar maze generation, weight the probability of carving **inward** vs **angular** (CW/CCW) differently per ring:
  - **Outer rings**: Prefer angular moves (lots of orbiting) — open, confusing at the edge.
  - **Inner rings**: Prefer inward moves (commit and dive) — deliberate funnel toward the center.
- Outcome: Maze feels open and disorienting at the outside, then satisfyingly funnels near the center because the player "earned" the funnel.

---

## 1. PolarGrid: optional per-ring wedge count array

**File:** [src/maze/polarGrid.js](src/maze/polarGrid.js)

- **Constructor**: Support an optional 4th argument or options object that provides an explicit **wedge count per ring**: e.g. `wedgeCounts: number[]` with length `rings`, where `wedgeCounts[0] === 1` (center) and `wedgeCounts[r]` is the wedge count for ring `r`.
- **Integer ratio requirement**: For each adjacent pair of rings, the outer ring's wedge count **must** be an integer multiple of the inner ring's count. That is, for all `r` in `1 .. rings-1`, `wedgeCounts[r] % wedgeCounts[r-1] === 0`. The existing logic (`outwardIndexFromInner`, `getOutwardNeighbors`, `innerWedgeFor`) assumes `outerW / innerW` is an integer; if someone passes e.g. `[1, 6, 7, 14]`, then 6→7 is not an integer ratio and `outwardIndexFromInner` will silently produce wrong indices. Valid example: `[1, 6, 12, 24]` (each step is an integer multiple).
- **Behavior**: If `wedgeCounts` is provided and valid (see validation below), use it to set `_wedgeCounts`. Otherwise keep current behavior: compute from `baseWedges` and `wedgeMultiplier` (and cap at MAX_WEDGES). This preserves backward compatibility; presets can stay formula-based until we want custom profiles.
- **Validation**: Reject invalid `wedgeCounts` explicitly. Require: (1) length === rings, (2) wedgeCounts[0] === 1, (3) all values >= 1, and (4) **for each r from 1 to rings-1, wedgeCounts[r] is an integer multiple of wedgeCounts[r-1]** (i.e. `wedgeCounts[r] % wedgeCounts[r-1] === 0`). If any check fails, throw or fall back to formula-based counts; do not accept the array. C0 must implement this validation so invalid arrays like `[1, 6, 7, 14]` are never used.
- No change to `wedgesAtRing(r)`, `getNeighbor`, `outwardNeighborCount`, or `innerWedgeFor` — they already read from `_wedgeCounts`. Drawing and solver continue to work.

---

## 2. Per-ring direction weight function

**Location:** Polar generator (e.g. [src/maze/polarGenerator.js](src/maze/polarGenerator.js)) or a small shared helper used only by polar generation.

- **Concept**: Given a **ring index** (0 .. maxRing) and a **direction** (INWARD, OUTWARD, CW, CCW), return a **weight** (positive number) used for weighted random selection.
- **Desired character**:
  - **Outer rings** (ring near maxRing): Prefer angular (CW, CCW); disprefer inward. So: angular weight high, inward weight low.
  - **Inner rings** (ring near 1): Prefer inward; angular can be lower. So: inward weight high, angular weight low.
  - **Outward**: Can be neutral (e.g. 1.0) or slightly down so we don’t over-expand outward from inner rings; or same as angular for outer rings.
- **Normalization**: Use a simple model, e.g. `t = ring / maxRing` (0 = center ring, 1 = outer ring). Then for example:
  - `inwardWeight(ring) = 1 + (1 - t) * k` (inner rings get higher inward weight)
  - `angularWeight(ring) = 1 + t * k` (outer rings get higher angular weight)
  - `outwardWeight(ring) = 1` or similar
  with a tunable `k` (e.g. 1 or 2) so the effect is noticeable but not extreme. Exact formula can be tuned; the plan is to have a single place that maps (ring, direction) → weight.
- **Interface**: e.g. `getCarveWeight(ring, direction, maxRing) → number`. Deterministic.

---

## 3. Weighted random choice (RNG)

**File:** [src/utils/rng.js](src/utils/rng.js)

- Add `**weightedChoice(array, weights)**`: given an array and a same-length array of non-negative weights, pick an index with probability proportional to weight, return that element (or index). Deterministic: use the existing `random()` so same seed gives same choice.
- Used by polar DFS when selecting among neighbors (and optionally Kruskal later).

---

## 4. Polar DFS: weighted neighbor choice

**File:** [src/maze/polarGenerator.js](src/maze/polarGenerator.js)

- **Current behavior**: `getUnvisitedNeighbors(ring, wedge)` returns `{ ring, wedge }[]`; we `rng.shuffle(neighbors)` and take `neighbors[0]`.
- **New behavior**: For each candidate neighbor we need the **direction** from current cell to that neighbor (INWARD, OUTWARD, CW, CCW). Options: (a) extend `getUnvisitedNeighbors` to return direction (e.g. `{ ring, wedge, direction }`), or (b) compute direction in the generator from (current, next) — compare rings and wedges to infer direction. Option (b) keeps PolarGrid unchanged; add a small helper e.g. `directionFromTo(grid, from, to)` that returns POLAR_DIRECTIONS value.
- Then: compute weight for each neighbor as `getCarveWeight(current.ring, directionFromTo(current, next), grid.maxRing)`. Use `rng.weightedChoice(neighbors, weights)` instead of shuffle-and-take-first. If no weighting config (see below), fall back to current shuffle behavior so we can keep one code path and optionally enable weighting via preset/option.

---

## 5. Polar Prim (deferred)

- Per-ring carve weights for **Prim** are out of scope for this plan. Polar Prim remains **uniform** (current behavior: random wall pick). We will revisit Prim a different way later.

---

## 6. Polar Kruskal (optional)

**File:** [src/maze/polarGenerator.js](src/maze/polarGenerator.js)

- **Current behavior**: All edges shuffled uniformly, then process in order with union-find.
- **Option A**: Keep Kruskal uniform (no per-ring bias) so we have one "unbiased" polar algorithm.
- **Option B**: Weighted selection — assign each edge a weight from the edge’s "outer" ring (e.g. max(ring, nRing)) and direction (inward vs angular); then repeatedly do weighted pick (without replacement) instead of shuffle. More invasive; can be a later checkpoint.
- Recommendation: **Option A** for initial implementation (only DFS gets carve weights); document that Kruskal and Prim remain uniform.

---

## 7. Presets and wiring

- **Presets** ([src/utils/constants.js](src/utils/constants.js)): No requirement to add `polarWedgeCounts` immediately; existing `polarBaseWedges` and `polarWedgeMultiplier` continue to drive wedge counts unless we introduce optional `polarWedgeCounts` per preset. If we do, polarGenerator or layout would pass it into PolarGrid when constructing.
- **Polar generator** ([src/maze/polarGenerator.js](src/maze/polarGenerator.js)): When creating the grid, if the preset (or config) has `polarWedgeCounts`, pass it to PolarGrid so `_wedgeCounts` is set from the array. Otherwise use existing (rings, baseWedges, wedgeMultiplier).
- **Carve weights**: Decide whether weighting is always on for polar DFS or gated by preset (e.g. a boolean like `polarCarveWeights: true`). Simplest: always apply the weight function for polar DFS (no new preset key); we can add a kill switch later if needed.

---

## 8. Direction-from-to helper

- Given grid and two cells (or (r,w) and (nr,nw)), determine the direction from the first to the second. Logic:
  - If `nr < r` → INWARD (and for ring 0 there is no inward from ring 0).
  - If `nr > r` → OUTWARD.
  - If `nr === r` → CW or CCW by comparing wedge (account for wrap). One of `(nw - w + W) % W === 1` → CW; `(w - nw + W) % W === 1` → CCW.
- Place in polarGenerator (or polarGrid as a static/util) for DFS. PolarGrid already has the geometry; the helper can live next to the generators.

---

## 9. Tests

- **PolarGrid**: If constructor accepts `wedgeCounts`, add test that when `wedgeCounts` is provided and valid, `wedgesAtRing(r)` returns the given values and that `getTotalCells`, `getNeighbor`, and `removeWallBetween` behave (e.g. connectivity test with explicit wedge array). **Validation**: Test that invalid arrays are rejected — e.g. `[1, 6, 7, 14]` fails (6→7 not an integer ratio); `[1, 6, 12, 24]` is accepted and works.
- **Weight function**: Unit test that inward weight is higher at ring 1 than at maxRing and angular weight is higher at maxRing than at ring 1 (for a fixed maxRing).
- **Determinism**: Same seed + same preset (with or without wedge counts / weights) produces same polar maze (existing determinism test still passes; add one that uses custom wedge counts if added).
- **Connectivity**: Polar maze with carve weights still produces a perfect maze (all cells reachable from center); reuse existing countReachableFrom-style test.

---

## 10. Documentation

- **DECISIONS.md**: Short note that polar generation can use per-ring direction weights (outer → angular, inner → inward) for a funnel feel, and that PolarGrid supports an optional per-ring wedge count array. Document that only DFS uses carve weights; Prim and Kruskal remain uniform (Prim to be revisited a different way).
- **Code comments**: In polarGenerator, comment that DFS uses getCarveWeight so outer rings favor orbiting and inner rings favor moving inward.

---

## Checkpoints

- **C0**: PolarGrid accepts optional `wedgeCounts` array; validation rejects invalid arrays (length, ring 0 === 1, positive, and **each ring's wedge count is an integer multiple of the prior ring's** — e.g. reject `[1, 6, 7, 14]`, accept `[1, 6, 12, 24]`); wedge counts from array when valid; tests.
- **C1**: RNG: add `weightedChoice(array, weights)`; unit test.
- **C2**: `getCarveWeight(ring, direction, maxRing)` and `directionFromTo(grid, from, to)`; unit test weights and direction logic.
- **C3**: Polar DFS uses weighted neighbor choice when carving; no change to Prim or Kruskal; determinism and connectivity tests pass.
- **C4**: Presets optionally support `polarWedgeCounts` and pass through to PolarGrid (if desired); otherwise C0–C3 are sufficient for the funnel effect.
- **C5**: DECISIONS.md and comments; final smoke (generate a few polar PDFs with default and with custom wedge counts if implemented).

---

## File summary


| File                                                     | Change                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/maze/polarGrid.js](src/maze/polarGrid.js)           | Constructor accepts optional `wedgeCounts`; when provided, set `_wedgeCounts` from it.                                                                      |
| [src/utils/rng.js](src/utils/rng.js)                     | Add `weightedChoice(array, weights)`.                                                                                                                       |
| [src/maze/polarGenerator.js](src/maze/polarGenerator.js) | Add `getCarveWeight`, `directionFromTo`; DFS uses weighted choice; optional preset `polarWedgeCounts` passed to PolarGrid. Polar Prim unchanged (deferred). |
| [src/utils/constants.js](src/utils/constants.js)         | Optional: add `polarWedgeCounts` to one or more presets.                                                                                                    |
| [docs/DECISIONS.md](docs/DECISIONS.md)                   | Note on polar carve weights and optional wedge count array.                                                                                                 |
| Tests                                                    | PolarGrid wedgeCounts; RNG weightedChoice; weight/direction helpers; polar determinism and connectivity with weights.                                       |


---

## Out of scope (for this plan)

- Wilson's for polar (separate plan).
- Changing draw-polar or layout for wedge counts (they already use `wedgesAtRing`).
- Organic or grid topology.

