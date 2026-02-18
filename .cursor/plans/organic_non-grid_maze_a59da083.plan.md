---
name: Organic non-grid maze
overview: "Replace the grid-based Curvy style with a new Organic style: circle-packing layout plus a general graph (nodes with explicit neighbors), DFS (or similar) for maze generation, and rendering of wall segments between adjacent cells. Curvy rendering is removed in favor of this true organic topology."
todos: []
isProject: false
---

# Organic Non-Grid Maze Plan

**Status:** draft  
**Scope:** Replace grid-based "Curvy" with an **Organic** maze style: arbitrary graph from circle packing, spanning-tree generation (e.g. DFS), and rendering of walls between touching cells. Grid styles (Square, Rounded) and all existing presets remain unchanged.

---

## Current vs target


| Aspect     | Current (Curvy)                | Target (Organic)                                  |
| ---------- | ------------------------------ | ------------------------------------------------- |
| Topology   | Grid (rows × cols)             | Arbitrary graph (nodes + neighbor list)           |
| Layout     | Implicit (cell size, grid)     | Circle packing in printable area (variable radii) |
| Generation | Prim / RB / Kruskal on grid    | DFS (or other) on graph edges                     |
| Solver     | BFS on (row, col) + DIRECTIONS | BFS on graph nodes (passage edges)                |
| Rendering  | Bezier walls + arcs on grid    | Wall segments between adjacent circle pairs       |


---

## Scope

**In scope**

- New **Organic** style: non-grid graph, circle-packing layout, deterministic (seed → same PDF).
- **Remove** current "Curvy" style (grid + Bezier rendering) and replace it with Organic in the UI.
- Graph representation: nodes with id, 2D position, radius, and explicit list of neighbor node ids; edges store wall open/closed.
- Circle packing (or particle-style packing) inside printable bounds; variable radii (position and/or seeded random) to avoid regular hex pattern (see [Charybdis-style reference](https://www.reddit.com/r/mazes/comments/8zebzj/charybdis/)).
- Start/finish: defined by geometry (e.g. start = node in top region, finish = node in bottom region).
- Validation and solver: BFS on graph; same contract as today (validate before PDF, optional debug overlay).
- Single maze per page, perfect maze only, black & white, US Letter, no new dependencies beyond existing (pdf-lib, Vite, etc.).

**Out of scope**

- Keeping both "Curvy" (grid) and "Organic" (graph) as separate styles (plan replaces Curvy with Organic).
- Polar/hex/other topologies.
- "Several small mazes in parallel + meta-graph DFS" as first implementation (can be a later variant; start with one graph from one packing).
- Maze quality metrics / multi-run analysis (mentioned in your reference) beyond "perfect maze, solvable."

---

## Architecture

```mermaid
flowchart TB
  subgraph grid_path [Existing grid path]
    Gen[generator.js]
    Grid[grid.js]
    SolverGrid[solver.js BFS grid]
    DrawGrid[drawMaze grid]
  end
  subgraph organic_path [New organic path]
    Pack[circle-packing.js]
    Graph[organic-graph.js]
    GenOrganic[organic-generator.js]
    SolverOrganic[solver organic]
    DrawOrganic[drawOrganicMaze]
  end
  Pack --> Graph
  Graph --> GenOrganic
  GenOrganic --> SolverOrganic
  GenOrganic --> DrawOrganic
  main[main.js]
  main --> Gen
  main --> GenOrganic
  style[maze style]
  style --> DrawGrid
  style --> DrawOrganic
```



- **main.js**: When style is Organic, call organic generation and pass result to renderer; otherwise current flow. Maze object gets a **layout** discriminator: `'grid'` (has `maze.grid`) or `'organic'` (has `maze.graph` + `maze.nodePositions` / layout metadata).
- **Renderer**: Branch on layout (or style): grid → existing `drawMaze`; organic → new `drawOrganicMaze` (wall segments between adjacent nodes where wall present, labels/solution from node positions).
- **Solver**: Either one module that accepts both (e.g. `solveMaze(maze)` branches on `maze.layout`) or a thin wrapper so `validateMaze(maze)` and `solveMaze(maze)` work for both.

---

## Data structures

**Graph (organic)**

- **Nodes**: `{ id, x, y, r }` in points (PDF space or normalized then scaled). Ids are stable (e.g. 0..n-1).
- **Neighbors**: each node has `neighbors: number[]` (node ids). Two nodes are adjacent if their circles touch or overlap (within epsilon).
- **Walls**: for each unordered pair `(i, j)` that are neighbors, store whether the passage is open (wall removed) or closed. E.g. `walls: Set<string>` where key is `"i,j"` with i < j, and presence means wall exists; or store on edge list `edges: { a, b, open }[]`.

**Maze object (unified)**

- `maze.layout`: `'grid'` | `'organic'`.
- If grid: `maze.grid`, `maze.rows`, `maze.cols`, `maze.start` / `maze.finish` (row/col), `maze.preset`, `maze.seed`, etc.
- If organic: `maze.graph` (nodes, edges/wall state), `maze.nodePositions` (id → {x,y} in page coords), `maze.startId`, `maze.finishId`, `maze.preset`, `maze.seed`, `maze.algorithm` (e.g. 'dfs').

---

## Implementation steps

### 1. Circle packing / layout

- **File**: e.g. `src/maze/circle-packing.js`.
- **Input**: target bounds (e.g. PRINTABLE_WIDTH × PRINTABLE_HEIGHT minus margin for maze), approximate number of cells (from difficulty preset: e.g. derive from grid cell count or new preset field), seed.
- **Output**: list of circles `{ id, x, y, r }` in bounds. Deterministic: same seed → same positions and radii.
- **Method**: Options (pick one for v0):
  - **A)** Simple particle simulation: place circles, repel overlaps, vary radius by index and seed so not uniform (breaks hex).
  - **B)** Formal circle packing (e.g. front-chain or Poisson-disk–style with variable radii).
- **Neighbor graph**: from final positions, compute adjacency: circles i, j are neighbors if `dist(ci, cj) <= ri + rj + epsilon` (or touch). Build list of edges (unordered pairs). Store on each node `neighbors: number[]`.

### 2. Graph representation

- **File**: e.g. `src/maze/organic-graph.js`.
- **Graph class or plain object**: nodes array (id, x, y, r, neighbors), and wall state. Methods: `getNeighbors(id)`, `hasWall(id1, id2)`, `removeWall(id1, id2)`, `getNode(id)`.
- **Start/finish**: from layout, choose start node (e.g. node with max y in top 15% of bounds) and finish node (e.g. max y in bottom 15%, or min y). Open their "boundary" so solver has entrance/exit (e.g. virtual edge or mark node as start/finish and renderer draws gap).

### 3. Organic generator

- **File**: e.g. `src/maze/organic-generator.js`.
- **Flow**: create RNG(seed) → run circle packing(bounds, targetCount, seed) → build graph (nodes + edges) → run DFS (or Recursive Backtracker) on graph to remove walls (spanning tree) → set start/finish nodes and open entrance/exit.
- **Export**: `generateOrganicMaze(config)` with `ageRange`, `seed`. Returns maze object with `layout: 'organic'`, `graph`, `nodePositions`, `startId`, `finishId`, `preset`, `seed`, `algorithm`.

### 4. Solver and validation for graph

- **File**: `src/maze/solver.js` (extend) or `src/maze/solver-organic.js` (new, then unified entry).
- **Graph BFS**: from startId, traverse only edges where wall is open; queue node ids; track path (list of node ids). Finish when current === finishId.
- **Unified API**: `solveMaze(maze)` — if `maze.layout === 'organic'` call graph BFS and return `{ path: nodeIds, length, solved }` (path as list of ids for overlay). `validateMaze(maze)` — if organic, run BFS and check path exists; optionally count reachable nodes for perfect-maze check.

### 5. Renderer for organic mazes

- **File**: [src/pdf/renderer.js](src/pdf/renderer.js).
- **Layout scaling**: organic layout is generated in a logical space; scale/translate to fit page (same as grid: center in printable area, respect footer).
- **Drawing walls**: for each graph edge (i, j) where wall is present, draw a segment. Segment = line (or optional curve) between the two circles: e.g. chord (line between the two closest points on the circles) or line between centers with thickness so it spans the gap. Use existing line thickness from preset.
- **Labels**: start label above node at `nodePositions[startId]`, finish below `nodePositions[finishId]` (with arrow or text as per age).
- **Solver overlay**: path is list of node ids; draw dashed line through `nodePositions[id]` in order.
- **Branch in renderMazesToPdf**: if maze.layout === 'organic', compute bbox from nodePositions + radii, scale to fit, then call `drawOrganicMaze(...)`; else current grid drawMaze.

### 6. Main app and constants

- **main.js**: When building mazes, if selected style is Organic, call `generateOrganicMaze(...)` (or generator returns organic maze when style is organic); otherwise `generateMaze` / `generateMazes` as today. Validation: `validateMaze(maze)` works for both (solver already branched).
- **Constants**: Difficulty presets may need an approximate "cell count" or "complexity" for organic (e.g. from grid rows×cols for same age range). No new UI for now: same age range → same approximate size.
- **UI**: Replace "Curvy Paths" with "Organic" (or "Organic Paths") in [src/index.html](src/index.html); value e.g. `organic`. Style `curvy` removed; `organic` triggers organic generation + organic rendering.

### 7. Tests and docs

- **Tests**: Add tests for circle packing (determinism, bounds), graph build, organic DFS, solver on graph, organic PDF render (smoke + determinism). Existing grid tests unchanged.
- **Docs**: Update [docs/DECISIONS.md](docs/DECISIONS.md) (e.g. D-007 superseded: Organic topology; Curvy rendering removed). Update [docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md): organic topology no longer deferred for this style.

---

## Checkpoints (incremental)

- **C0** — Circle packing module: deterministic layout in bounds, variable radii; unit tests for determinism and neighbor count.
- **C1** — Organic graph: build from packing (nodes + edges), wall state, getNeighbors / hasWall / removeWall; start/finish selection.
- **C2** — Organic generator: DFS on graph, produce maze object (layout, graph, nodePositions, startId, finishId); validate with BFS solver.
- **C3** — Solver/validation: unified solveMaze(maze) and validateMaze(maze) for grid and organic.
- **C4** — Organic renderer: drawOrganicMaze (walls, labels, optional solution overlay); integrate into renderMazesToPdf.
- **C5** — Main + UI: Organic style option, wire generation and download; remove Curvy; update docs and tests.

---

## Validation

- Same seed + Organic → same circle layout, same graph, same maze, same PDF bytes (determinism test).
- Every organic maze is solvable (validateMaze before PDF); solver overlay in debug matches path.
- Grid and Rounded styles unchanged; existing tests pass.
- No new runtime dependencies; offline-first, black & white, one maze per page preserved.

---

## Files to add or touch


| File                                          | Action                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/maze/circle-packing.js`                  | New: layout only                                                                       |
| `src/maze/organic-graph.js`                   | New: graph + wall state                                                                |
| `src/maze/organic-generator.js`               | New: pack → graph → DFS                                                                |
| `src/maze/solver.js`                          | Extend: accept maze, branch on layout                                                  |
| `src/pdf/renderer.js`                         | Branch on layout; add drawOrganicMaze; remove curvy-only code when Organic replaces it |
| `src/main.js`                                 | Style organic → organic generation                                                     |
| `src/index.html`                              | Curvy → Organic label/value                                                            |
| `src/utils/constants.js`                      | Optional: organic complexity/count from preset                                         |
| `docs/DECISIONS.md`, `docs/DEFERRED_IDEAS.md` | Update                                                                                 |
| Tests                                         | New organic tests; keep grid tests                                                     |


---

## Optional later: "small mazes + meta-graph"

Your reference described generating many small mazes and running DFS on the graph of their contact points. That can be a second phase: use small grid or small organic mazes as "cells," place them, detect contacts, build meta-graph, run DFS on that. Same solver/rendering ideas apply at the meta level. Not in initial scope above.