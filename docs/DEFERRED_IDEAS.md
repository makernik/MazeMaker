# Deferred Ideas

Ideas considered but explicitly deferred from v0 scope.

**Note:** These are not todos. Do not implement unless explicitly requested.

---

## Priority suggestions (from current implementation)

- **Higher value, lower effort:** Age-specific algorithm selection (preset and algorithm plumbing exist; only age→algorithm mapping is missing). Use debug seed for next PDF (debug seed already drives preview; extend to PDF generation).
- **Builds on existing work:** Solver match-up and solution metrics (adapter + algorithm registry in place; add optional metrics and compare UI when needed). 2.5D visual bridges (Curvy and miter-point geometry are stable; bridge candidate edges can be scheduled when desired).
- **Moderate scope:** Random start/finish (topology-specific: grid corners vs organic endpoints vs polar center/rim).
- **Lower until themes re-enabled:** Locked rooms, masked shapes (Theme UI is paused; backend supports theme param).
- **Keep deferred by design:** Random preview on every click (determinism preferred; same controls → same preview).

---

## Maze Topology

### Organic / Curvy Maze Paths
**Organic (implemented):** Maze style "Organic" uses circle-packing layout and a non-grid graph; DFS generates the maze (see DECISIONS.md D-008). Curvy (grid + Bezier rendering) was removed in favor of Organic.

**Implemented:** Jagged/Curvy split, two-pass dense fill, debug algorithm picker ("1 of each algorithm"). See built plan `.cursor/plans/built/organic_enhancements_plan_048eced4.plan.md`.

### 2.5D Visual Bridges (Curvy)
Allow corridors to visually cross over other corridors while the maze remains a perfect tree (single solution, no loops). The crossing is a rendering trick — the "over" corridor is drawn with a gap/shadow where it passes above the "under" corridor; optional bridge rails for visual clarity.

**Generation:** Requires non-planar edges in the graph (tree edges of a planar graph don't cross). After circle packing and neighbor detection, add a small number of "bridge candidate" edges connecting circles separated by 1–2 intermediate circles. DFS/Prim's/Kruskal's may or may not carve through them. If carved, the corridor visually crosses intermediate corridors. Selection is seeded/deterministic.

**Constraints:** Solver unaffected (operates on the tree graph). Perfect maze invariant preserved — no new connections at crossing points. Bridge frequency is a tuning parameter (age-scaled or constant).

**Timing:** Depends on maturity of Curvy style and miter-point geometry. To be scheduled after Curvy is stable and visually validated.

### Labyrinth style
**Labyrinth:** Outer maze is primary; small embedded rooms act as passage obstacles. Rooms are sized by preset difficulty and may optionally be scaled by position on the critical path. Distinct from **Squares** style, where rooms are primary (room blocks define layout; outer maze connects them). The current Squares 1×1 flow (maze first, then select 2-passage cells as rooms) is the algorithm for Labyrinth; it is preserved when implementing rooms-first for Squares and will become the Labyrinth style. See embedded_rooms plan section 3b.

### Polar / Circular Mazes
**Implemented (v1):** Circular topology is available via the "Maze Topology" control (Rectangular / Circular). Polar mazes use concentric rings and radial passages; generation is Prim's on a polar grid; start at center, finish at outer ring. See DECISIONS D-016.

### Age-Specific Algorithm Selection
Use Prim's algorithm for younger ages (3-8) and Recursive Backtracker / DFS for older ages (9+). Prim's produces short branching dead-ends (forgiving); DFS produces long winding passages (challenging).

### Wilson's algorithm
Add Wilson's (loop-erased random walk) as a topology-agnostic maze generator for grid and polar. Layout-keyed algorithm pools: polar would exclude Prim; organic would exclude Wilson's. Plan: `add_wilson's_algorithm_4078dece.plan.md` (not yet implemented).

### Corridor-following filler placement
Replace the current grid-based void filler in organic mazes with corridor-parallel placement: place filler nodes at perpendicular offsets from carved main edges so filler corridors run alongside main corridors instead of forming random blobs. Plan: `corridor-following_filler_1e0d2fdf.plan.md` (not yet implemented).

### Polar debug overlay (optional)
Optional ring/wedge labels or minimal footer stats on the canvas preview when topology is Circular. Not required for polar; documented as optional cleanup in the circular mazes plan.

### Polar preset wedge counts and constructor options
When adding `polarWedgeCounts` to difficulty presets, ensure every preset array satisfies the integer-ratio rule (each ring's wedge count is an integer multiple of the prior ring's); otherwise PolarGrid will throw at creation. Consider a quick validation pass or comment in constants when preset arrays are introduced. If PolarGrid later needs more options (e.g. carve-weights toggle), consider an options object instead of a 4th positional argument.

---

## Themes

### Locked Rooms with Theme Icons
Place theme icons inside "rooms" within the maze that the solver must pass through.

### Masked / Silhouette Shapes
Constrain the maze boundary to a thematic shape (e.g., animal silhouette) rather than a rectangle.

---

## Start / Finish

### Random Start / Finish Locations
Generate start and finish points at varied positions instead of fixed top-left / bottom-right.

---

## Solver / Pathfinding

### Solution metrics for solver match-up
Extend solver solution object with optional algorithm-specific metrics (e.g. `stepsExpanded`, `nodesVisited`) so that a future "solver match-up" (comparing BFS vs DFS vs A* on the same maze) can display path length, step count, or nodes explored. The refactor (adapter + algorithm registry) prepares for this; the solution contract may allow extra fields. Not implemented in the solver refactor.

### Deterministic neighbor order in maze adapters
**Implemented.** Adapter contract requires `getNeighbors(state)` to return deterministic order. Grid adapter uses fixed `DIRECTIONS` order; organic uses graph neighbor order; polar uses fixed `POLAR_DIRECTIONS` order. Documented in solver-adapters.js; same maze + same algorithm yields the same path.

### Match-up cost on large mazes
Running multiple solver algorithms on one maze (e.g. for debug or educational match-up) may be slow on large mazes (e.g. 18+ organic, ~1900 nodes). If match-up is added later, consider limiting it to a subset of algorithms, smaller mazes only, or on-demand only. Not a refactor requirement; a note for future match-up UX.

---

## Preview / UX

**Current behavior:** Preview is a **live canvas** (one maze generated from current level + style, same layout as PDF). Static sample images in `public/samples/` are no longer used for preview; see DECISIONS D-012 and docs/Unused.md.

### Random preview on every click
Preview could change to a new random maze each time the user changes level or style (new seed per interaction). Deferred in favor of deterministic preview per level+style so the same controls always show the same maze; avoids surprise and keeps behavior predictable.

### Use debug seed for next PDF
Option to "use this seed for next PDF" so the debug panel seed (e.g. pasted from a prior PDF footer) is used when the user clicks Generate Printable PDF. Lets users re-export a specific maze. Deferred; debug seed currently affects preview only.
