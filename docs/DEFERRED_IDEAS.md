# Deferred Ideas

Ideas considered but explicitly deferred from v0 scope.

**Note:** These are not todos. Do not implement unless explicitly requested.

---

## Maze Topology

### Organic / Curvy Maze Paths
**Organic (implemented):** Maze style "Organic" uses circle-packing layout and a non-grid graph; DFS generates the maze (see DECISIONS.md D-008). Curvy (grid + Bezier rendering) was removed in favor of Organic.

**Planned enhancements (see `.cursor/plans/organic_enhancements_plan_048eced4.plan.md`):**
- Split Organic into **Jagged** (current straight-line rendering) and **Curvy** (Catmull-Rom splines through shared miter-point geometry)
- **Two-pass dense fill:** pass 1 generates maze at current density for difficulty control; pass 2 adds decorative disconnected corridors in void regions (visual complexity, not connected to solvable maze)
- **Debug algorithm picker:** all 3 algorithms (DFS, Prim's, Kruskal's) available for organic-topology styles; "1 of each algorithm" debug mode

### 2.5D Visual Bridges (Curvy)
Allow corridors to visually cross over other corridors while the maze remains a perfect tree (single solution, no loops). The crossing is a rendering trick — the "over" corridor is drawn with a gap/shadow where it passes above the "under" corridor; optional bridge rails for visual clarity.

**Generation:** Requires non-planar edges in the graph (tree edges of a planar graph don't cross). After circle packing and neighbor detection, add a small number of "bridge candidate" edges connecting circles separated by 1–2 intermediate circles. DFS/Prim's/Kruskal's may or may not carve through them. If carved, the corridor visually crosses intermediate corridors. Selection is seeded/deterministic.

**Constraints:** Solver unaffected (operates on the tree graph). Perfect maze invariant preserved — no new connections at crossing points. Bridge frequency is a tuning parameter (age-scaled or constant).

**Timing:** Depends on maturity of Curvy style and miter-point geometry. To be scheduled after Curvy is stable and visually validated.

### Polar / Circular Mazes
Concentric ring topology with radial passages. Different data structure and rendering approach.

### Age-Specific Algorithm Selection
Use Prim's algorithm for younger ages (3-8) and Recursive Backtracker / DFS for older ages (9+). Prim's produces short branching dead-ends (forgiving); DFS produces long winding passages (challenging).

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
Adapter contract should require `getNeighbors(state)` to return a **deterministic order** (e.g. fixed order per topology) so that same maze + same algorithm yields the same path. Document in the adapter contract; implementors (grid, organic, polar) must return stable neighbor order. The refactor prepares for multiple algorithms with reproducible output.

### Match-up cost on large mazes
Running multiple solver algorithms on one maze (e.g. for debug or educational match-up) may be slow on large mazes (e.g. 18+ organic, ~1900 nodes). If match-up is added later, consider limiting it to a subset of algorithms, smaller mazes only, or on-demand only. Not a refactor requirement; a note for future match-up UX.

---

## Preview / UX

**Current behavior:** Preview is a **live canvas** (one maze generated from current level + style, same layout as PDF). Static sample images in `public/samples/` are no longer used for preview; see DECISIONS D-012 and docs/Unused.md.

### Random preview on every click
Preview could change to a new random maze each time the user changes level or style (new seed per interaction). Deferred in favor of deterministic preview per level+style so the same controls always show the same maze; avoids surprise and keeps behavior predictable.

### Use debug seed for next PDF
Option to "use this seed for next PDF" so the debug panel seed (e.g. pasted from a prior PDF footer) is used when the user clicks Generate Printable PDF. Lets users re-export a specific maze. Deferred; debug seed currently affects preview only.
