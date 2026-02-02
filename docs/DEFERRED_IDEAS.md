# Deferred Ideas

Ideas considered but explicitly deferred from v0 scope.

**Note:** These are not todos. Do not implement unless explicitly requested.

---

## Maze Topology

### Organic / Curvy Maze Paths
Maze walls with smooth, organic curves instead of grid-aligned walls. Requires fundamentally different generation algorithm.

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
