---
name: Solver Renderer Refactor
overview: Refactor the solver and PDF renderer so that grid, organic, and future topologies are handled via maze adapters and a pluggable solver-algorithm layer (one algorithm, BFS, now; design allows future user-selectable solvers and solver match-up), plus layout-specific drawers; making the code scalable, modular, and testable.
todos: []
isProject: false
---

# Solver and Renderer Refactor for Multi-Topology Support

Refactor [src/maze/solver.js](src/maze/solver.js) and [src/pdf/renderer.js](src/pdf/renderer.js) so that existing capabilities (grid + square/rounded/curvy, organic) and planned ones (polar from [circular_mazes_implementation_f1dda3a0.plan.md](.cursor/plans/circular_mazes_implementation_f1dda3a0.plan.md), organic from [organic_non-grid_maze_a59da083.plan.md](.cursor/plans/organic_non-grid_maze_a59da083.plan.md)) are supported through **maze adapters + pluggable solver algorithms** (solver) and **layout-specific drawers + layout pipeline** (renderer). Right now only one solver algorithm (BFS) is used; the design allows future user-selectable solvers (e.g. UI) and solver match-up output (e.g. compare multiple algorithms on the same maze).

---

## Current state

- **Solver:** [src/maze/solver.js](src/maze/solver.js) already has a unified `solveMaze(mazeOrGrid)` that branches on `maze.layout === 'organic'` and calls `solveMazeGrid` or `solveMazeOrganic`. `isPerfectMaze` and `pathToDirections` are grid-only. Adding polar would add a third branch and more duplicated BFS logic.
- **Renderer:** [src/pdf/renderer.js](src/pdf/renderer.js) (~707 lines) branches in `renderMazesToPdf` on `maze.layout === 'organic'`; grid path uses `drawMaze` (square/rounded/curvy), `drawLabels`, `drawSolverOverlay`; organic uses `drawOrganicMaze`, `drawOrganicLabels`, `drawOrganicSolverOverlay`. All in one file. Adding polar would add another branch and more inline functions.

Plans and deferred ideas that drive the design:

- **Organic plan:** Graph topology (nodes + neighbor list, wall state); solver BFS on graph; renderer draws walls between adjacent circles. Already partially implemented; refactor should keep organic support and make adding more topologies trivial.
- **Circular plan:** Polar topology (rings × wedges); polar BFS; renderer draws arcs + radial segments. Solver and renderer need a path that does not require editing the same big functions.
- **Deferred (general):** Random start/finish, masked shapes, locked rooms ([docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md)). Refactor should not block these (e.g. start/finish can stay on the maze object; drawers read from maze).
- **Deferred (solver/pathfinding):** Three items in [docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md) under "Solver / Pathfinding" are **prepared for but not implemented** in this refactor: (1) **Solution metrics for match-up** — solution object may allow optional fields (e.g. stepsExpanded) for future match-up display; we do not add or require them now. (2) **Deterministic neighbor order** — adapter contract will state that `getNeighbors(state)` must return a stable order so multiple algorithms stay deterministic; we document it, we do not add extra sorting in this refactor. (3) **Match-up cost on large mazes** — we do not implement match-up; if added later, limiting to smaller mazes or fewer algorithms is a deferred UX consideration.

---

## Target architecture

### Solver: maze adapters + pluggable solver algorithms

- **Contract (adapter interface):** A maze is represented to the solver by an object that provides:
  - `getStart()` → start state (e.g. `{ row, col }` or `id` or `{ ring, wedge }`)
  - `getFinish()` → finish state (same shape)
  - `getNeighbors(state)` → array of reachable neighbor states (only through open passages). **Deterministic order required** (see DEFERRED_IDEAS: "Deterministic neighbor order in maze adapters") so same maze + same algorithm → same path; we prepare by documenting this, not by adding sorting in the refactor.
  - `key(state)` → string key for visited set (e.g. `"r,c"`, `"id"`, `"ring,wedge"`)
  - Optionally `getTotalCells()` for perfect-maze check (reachable count vs total).
  - Solution object is `{ path, length, solved }`; **optional extra fields** (e.g. for match-up metrics) are allowed later (see DEFERRED_IDEAS: "Solution metrics for solver match-up"). We do not add or require them in this refactor.
- **Solver algorithm strategy:** The solver layer supports multiple algorithms behind a single API. **Right now:** only one algorithm (BFS) is implemented and used; no UI or selection. **Future:** user can select which solver to deploy (e.g. dropdown in UI, or debug “solver match-up” that runs several algorithms on the same maze and shows comparison—path length, step count, etc.—in displayed output or PDF).
- **Algorithm registry:** Solver algorithms are registered by id (e.g. `'bfs'`). Each algorithm is a function `(adapter) => { path, length, solved }`. One internal implementation today: BFS (`solveWithAdapter(adapter)`). Adding DFS or A* later = add a new function and register it; no change to adapters or topology.
- **Public API:** `solveMaze(maze, options)` where `options.algorithm` defaults to `'bfs'` (or omit for backward compatibility). `validateMaze(maze, options)` uses the same options. For match-up, a future `solveMazeWithAll(maze, algorithmIds)` could return `{ 'bfs': solution1, 'dfs': solution2, ... }` for display.
- **Adapters:** Thin wrappers that implement the contract (topology-only; no solver logic):
  - Grid adapter: wraps `MazeGrid` (start/finish, DIRECTIONS, getCell, hasWall, isValidPosition).
  - Organic adapter: wraps maze with `graph`, `startId`, `finishId` (getNeighbors, hasWall).
  - Polar adapter (when implemented): wraps PolarGrid (polar directions, getNeighbor, hasWall).
- **isPerfectMaze / pathToDirections:** `isPerfectMaze(maze)` becomes generic using the adapter. `pathToDirections(path, layout)` remains grid-specific (or accept layout and no-op for non-grid).

File structure (solver):

- Keep [src/maze/solver.js](src/maze/solver.js) as the single entry point: `solveMaze(maze, options?)`, `validateMaze(maze, options?)`, `isPerfectMaze(maze)`, `pathToDirections(path, layout)`. It resolves `maze.layout` to an adapter and looks up the requested algorithm (default `'bfs'`) in a small registry, then runs that algorithm with the adapter.
- Add [src/maze/solver-adapters.js](src/maze/solver-adapters.js): `getAdapterForMaze(maze)`, gridAdapter, organicAdapter, later polarAdapter.
- Add [src/maze/solver-algorithms.js](src/maze/solver-algorithms.js) (or a section in solver.js): register `'bfs'` → BFS implementation; export `getSolver(algorithmId)` and `getRegisteredAlgorithmIds()`. Future: register `'dfs'`, `'astar'`, etc.; UI or match-up code uses `getRegisteredAlgorithmIds()` and calls `solveMaze(maze, { algorithm })` per selection.

### Renderer: layout pipeline + drawer registry

- **Layout step:** For each maze, compute a **layout result**: transform (offset + scale), line thickness, and any layout-specific options (e.g. cellSize for grid, bounds for organic). This can live in a small module so adding a topology = adding one layout function.
- **Draw step:** For each layout type, a **drawer** is responsible for: draw walls, draw labels, draw solution overlay (if requested). Style (square/rounded/curvy) is a parameter only for grid; other topologies have a single visual style for now.
- **Pipeline in renderMazesToPdf:** For each maze: (1) determine layout (e.g. `maze.layout` or `'grid'`); (2) compute layout result (transform, thickness, etc.); (3) get drawer for layout; (4) call drawer.drawWalls(page, maze, layoutResult, style); drawer.drawLabels(...); if debug && showSolution, drawer.drawSolutionOverlay(...). No branching on layout inside a single 100-line function; the branch is “which drawer.”
- **Modular files:** Split renderer into:
  - [src/pdf/renderer.js](src/pdf/renderer.js): `renderMazesToPdf`, `renderSingleMaze`, `downloadPdf`, font/embed and footer. Imports layout module and drawer registry; loops over mazes and calls the appropriate drawer.
  - [src/pdf/layout.js](src/pdf/layout.js) (or reuse existing [src/pdf/layout.js](src/pdf/layout.js) if it exists for page constants): extend to export `getLayoutForMaze(maze, pageOptions)` → { transform, lineThickness, ... } so each topology has one function (e.g. `layoutGrid`, `layoutOrganic`, later `layoutPolar`). Existing [src/pdf/layout.js](src/pdf/layout.js) already has PAGE_WIDTH, PRINTABLE_*, etc.; keep those and add layout computation here or in a dedicated `renderer-layout.js`.
  - [src/pdf/drawers/draw-grid.js](src/pdf/drawers/draw-grid.js): grid walls (square/rounded/curvy), grid labels, grid solver overlay. Exports one object e.g. `{ drawWalls, drawLabels, drawSolutionOverlay }` that take (page, maze, layoutResult, options).
  - [src/pdf/drawers/draw-organic.js](src/pdf/drawers/draw-organic.js): organic walls, labels, solution overlay (current drawOrganicMaze, drawOrganicLabels, drawOrganicSolverOverlay). Same interface as grid drawer.
  - [src/pdf/drawers/index.js](src/pdf/drawers/index.js) (or inline in renderer): registry `drawers['grid']`, `drawers['organic']`, and later `drawers['polar']`. Main renderer calls `drawers[maze.layout || 'grid']`.

This keeps [src/pdf/renderer.js](src/pdf/renderer.js) short and makes adding polar = add `draw-polar.js` + `layoutPolar` + register `drawers['polar']`.

---

## Scope

**In scope:**

- Solver: Introduce adapter interface and a **pluggable solver-algorithm layer** (registry keyed by algorithm id; only BFS implemented and used). Move grid/organic logic into adapters; `solveMaze(maze, options?)` and `validateMaze(maze, options?)` accept optional `options.algorithm` (default `'bfs'`). Generalize `isPerfectMaze(maze)` to work with organic (and any adapter that supports getTotalCells / reachable count). Design enables future UI solver selection and solver match-up (e.g. run multiple algorithms on same maze and show comparison); no UI or match-up output in this refactor.
- Renderer: Introduce layout module (or extend existing layout.js) for per-topology layout computation; extract grid and organic drawing into drawer modules with a common interface; main renderer uses a drawer registry and no layout switch in the middle of a large function; keep existing public API `renderMazesToPdf`, `renderSingleMaze`, `downloadPdf`.
- Tests: Solver tests for generic BFS with a mock adapter; solver tests for grid and organic via real mazes (existing tests still pass); renderer tests that still call `renderSingleMaze` / `renderMazesToPdf` (determinism and smoke); optional unit tests for individual drawers with a mock page.
- Docs: Update [docs/DECISIONS.md](docs/DECISIONS.md) with a short decision on “solver adapter and renderer drawer pattern” and on "pluggable solver algorithms (single algorithm now; future selection/match-up)" for multi-topology support; no change to product scope.

**Out of scope:**

- Implementing polar/circular topology (that remains in the circular mazes plan); this refactor only makes adding it a matter of adding an adapter and a drawer + layout.
- **Solver UI and match-up:** UI to select solver algorithm, or displayed/PDF "solver match-up" output (e.g. comparing BFS vs DFS vs A* on the same maze). The refactor only makes the code ready (registry + `options.algorithm`). The three deferred items in [docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md) (Solver / Pathfinding) — solution metrics, deterministic neighbor order, match-up cost on large mazes — are **not coded now**; the refactor prepares the structure for them.
- Changing generator or main.js flow (beyond any minimal wiring needed to pass through layout).
- Other deferred ideas (random start/finish, masked shapes, locked rooms); the refactor does not implement them, only keeps the structure ready.

---

## Implementation checkpoints

- **C0 — Solver adapter interface and pluggable algorithm (BFS only)**
  - Define the adapter contract (getStart, getFinish, getNeighbors, key; optional getTotalCells).
  - Add solver-algorithms.js (or equivalent): register a single algorithm `'bfs'` that runs BFS; export `getSolver(algorithmId)` (default `'bfs'`) and optionally `getRegisteredAlgorithmIds()` for future UI/match-up.
  - Implement BFS as one algorithm function `(adapter) => solution`; no topology-specific BFS code.
  - Add solver-adapters.js with `getAdapterForMaze(maze)`, gridAdapter, organicAdapter; have `solveMaze(maze, options?)` / `validateMaze(maze, options?)` resolve adapter, then call `getSolver(options?.algorithm ?? 'bfs')(adapter)`.
  - Keep `isPerfectMaze` working for grid (later checkpoint can generalize); ensure all existing solver tests pass.
- **C1 — Generalize isPerfectMaze and pathToDirections**
  - Extend adapter contract (or organic adapter) so reachable count and total cells are available; implement generic `isPerfectMaze(maze)` using adapter.
  - Restrict `pathToDirections` to grid (or accept layout and no-op for non-grid); update callers if any.
  - Add/update tests for isPerfectMaze on organic mazes.
- **C2 — Renderer layout module**
  - Add or extend layout module to export `getLayoutForMaze(maze, options)` returning { transform, lineThickness, style, ... } for grid and organic (and any shared options). Main renderer uses this instead of inlining layout math.
- **C3 — Renderer drawers (grid + organic)**
  - Create drawers/draw-grid.js and drawers/draw-organic.js with shared interface (drawWalls, drawLabels, drawSolutionOverlay).
  - Move current grid drawing (drawMaze, drawLabels, drawSolverOverlay) and helper functions (drawWall, drawCurvedWall, drawCornerArc, etc.) into draw-grid.js; move organic drawing into draw-organic.js.
  - Add drawers registry; renderMazesToPdf selects drawer by `maze.layout || 'grid'` and calls the three methods. Remove duplicated layout branching from main renderer.
- **C4 — Tests and docs**
  - Add solver unit test that runs BFS with a mock adapter (e.g. 3-node graph).
  - Ensure all existing pdf.test.js and solver.test.js pass; add any new tests for organic isPerfectMaze or drawer behavior if needed.
  - Document the pattern in DECISIONS.md (solver adapter + renderer drawer for multi-topology).

---

## Validation

- `npm run test` passes (solver + PDF tests).
- Same maze + style produces same PDF bytes (determinism).
- Grid (square/rounded/curvy) and organic mazes still solve, validate, and render correctly.
- Public API: `solveMaze(maze, options?)` and `validateMaze(maze, options?)` may accept optional `options.algorithm` (default `'bfs'`); all other signatures unchanged. Only internal structure and the pluggable algorithm layer are added.

---

## Files to add or touch


| File                                                           | Action                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [src/maze/solver.js](src/maze/solver.js)                       | Refactor: resolve adapter + algorithm from registry; call selected solver (default BFS) |
| [src/maze/solver-adapters.js](src/maze/solver-adapters.js)     | New: getAdapterForMaze, gridAdapter, organicAdapter                                     |
| [src/maze/solver-algorithms.js](src/maze/solver-algorithms.js) | New: algorithm registry; register 'bfs'; getSolver(id), getRegisteredAlgorithmIds()     |
| [src/pdf/renderer.js](src/pdf/renderer.js)                     | Slim down: use layout module + drawer registry; remove inlined draw logic               |
| [src/pdf/layout.js](src/pdf/layout.js)                         | Add getLayoutForMaze (or new renderer-layout.js) for grid/organic layout computation    |
| src/pdf/drawers/draw-grid.js                                   | New: grid walls (square/rounded/curvy), labels, solution overlay                        |
| src/pdf/drawers/draw-organic.js                                | New: organic walls, labels, solution overlay                                            |
| src/pdf/drawers/index.js                                       | New: drawer registry by layout                                                          |
| [docs/DECISIONS.md](docs/DECISIONS.md)                         | Add decision: solver adapter + renderer drawer pattern                                  |
| tests/solver.test.js                                           | Add mock-adapter test; keep existing tests                                              |
| tests/pdf.test.js                                              | No API change; re-run and fix if imports break                                          |


---

## Notes

- **Backward compatibility:** Grid mazes that do not set `layout` continue to be treated as `'grid'` (solver and renderer default to grid adapter/drawer). Callers that do not pass `options.algorithm` get BFS (single algorithm today).
- **Solver selection and match-up (future):** To support user-selectable solver in UI: add a control that sets `options.algorithm` (e.g. from `getRegisteredAlgorithmIds()`); pass through to `solveMaze`/`validateMaze` and, if needed, to the renderer for solution overlay. For a "solver match-up" (e.g. compare BFS vs DFS vs A* on the same maze): call `solveMaze(maze, { algorithm })` for each registered id; display or export results (path length, step count, etc.) in debug panel or a dedicated PDF section. No implementation of UI or match-up in this refactor. See [docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md) (Solver / Pathfinding) for: solution metrics for match-up, deterministic neighbor order, and match-up cost on large mazes — we prepare for these but do not implement them now.
- **Polar later:** When implementing the circular mazes plan, add polarAdapter in solver-adapters.js and draw-polar.js + layoutPolar; register `drawers['polar']`. No change to the solver algorithm layer or to the renderer loop.
- **Curvy vs organic:** Curvy remains a grid **style** (rendering only). Organic is a **layout** (different topology). The refactor keeps style as a parameter of the grid drawer only.

