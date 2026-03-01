# Decisions

Architectural and design decisions for the Printable Maze Generator.

---

## D-018 — Square rooms: non-adjacent openings (2026-02-28)

**Context:** In Squares style, each room has two openings to the outer maze. If both openings lie on the same side of the room (or on adjacent sides sharing a corner), they are considered adjacent and look like a single wide opening. User requirement: the two openings must be **non-adjacent** (on different sides).

**Decision:**

- **1×1 rooms:** Only use outer grid cells that have exactly two passages on **opposite** sides (TOP–BOTTOM or LEFT–RIGHT) as room candidates. Implemented by filtering candidates in `generateSquaresMaze` before shuffling.
- **Block rooms (K×K, roomOuterSize > 1):** When choosing two boundary cells as openings, group boundary by side (direction from block); pick one cell from one side and one from a **different** side (prefer **opposite** when available). If a block has fewer than two boundary cells, exclude it from the layout (recompute occupancy and boundary) so the passage graph stays connected and every room has two distinct openings.
- **Tests:** Added "each room has two non-adjacent openings (different sides)". "outer maze grid is valid" uses seed 502 so the rooms-first layout remains connected.

---

## D-017 — Polar per-ring carve weights and optional wedge count array (2026-02-27)

**Context:** Polar mazes should feel open and disorienting at the outer edge, then deliberately funnel toward the center so the player "earns" the funnel. We also want to support an explicit per-ring wedge count array for future preset tuning.

**Decision:**

- **Carve weights:** When generating a polar maze with **recursive-backtracker (DFS)**, neighbor choice is **weighted by ring and direction**: outer rings get higher weight for angular moves (CW/CCW), inner rings get higher weight for inward moves. Prim and Kruskal remain uniform; only DFS uses these weights. Implemented via `getCarveWeight(ring, direction, maxRing)` and `directionFromTo(grid, from, to)` in `polarGenerator.js`; DFS uses `rng.weightedChoice(neighbors, weights)`.
- **Optional wedge count array:** `PolarGrid` accepts an optional 4th argument `wedgeCounts: number[]`. If provided, it must satisfy: length === rings, wedgeCounts[0] === 1, all positive integers, and **each ring's count must be an integer multiple of the prior ring's** (so `outwardIndexFromInner` and related logic remain correct). Invalid arrays **throw** with a clear message; no silent fallback. Presets can stay formula-based; see DEFERRED_IDEAS for validating preset arrays when we add `polarWedgeCounts`.

---

## D-015 — Unified draw backends: one drawer per style (2026-02-25)

**Context:** Every drawing style (grid, jagged, curvy) had two near-identical implementations: one calling pdf-lib (`page.drawLine`, `page.drawSvgPath`) and one calling `CanvasRenderingContext2D` (`ctx.moveTo`, `ctx.lineTo`, `ctx.stroke`). Geometry and algorithms were 90-100% duplicated; only the final draw calls differed.

**Decision:** Introduce a `DrawBackend` interface (`src/pdf/drawers/draw-backend.js`) with two implementations: `createPdfBackend(page, fonts)` wraps a pdf-lib PDFPage and `createCanvasBackend(ctx)` wraps a Canvas2D context. Each drawer (`draw-grid.js`, `draw-organic.js`, `draw-curvy.js`) is written once against the backend contract. Callers (renderer.js for PDF, main.js for canvas preview) create the appropriate backend and pass it. Deleted files: `draw-grid-canvas.js`, `draw-organic-canvas.js`, `draw-curvy-canvas.js`. The registry (`drawers/index.js`) has a single `getDrawer(style)` function; `getCanvasDrawer` is removed.

**Backend interface:** `setStroke`, `line`, `beginPath`, `moveTo`, `lineTo`, `arc`, `bezierCurveTo`, `quadraticCurveTo`, `stroke`, `drawText`, `measureText`, `withScreenTransform`, `save`, `restore`, `setDash`, `setOpacity`.

**Labels:** Unified via a `yDir` multiplier (+1 for PDF y-up, -1 for canvas screen y-down) and `withScreenTransform` (canvas: save/identity/restore; PDF: no-op). Font handling is backend-internal: PdfBackend receives embedded PDFFont objects at creation; CanvasBackend constructs CSS font strings.

**Trade-off:** PdfBackend accumulates SVG path strings internally and emits via `page.drawSvgPath()` on `stroke()`. This matches the existing pdf-lib usage pattern. For `line()`, it calls `page.drawLine()` directly for efficiency and correct line-cap behavior. Arc commands in SVG paths handle the ~π semicircle split internally.

---

## D-016 — Circular (polar) maze topology (2026-02-26)

**Context:** Users should be able to generate circular mazes (concentric rings with radial passages) in addition to rectangular (grid and organic) mazes. Polar mazes use a different data structure and a single visual style; they do not use the "Maze Style" (Classic/Jagged/Curvy/Square) options.

**Decision:** Add a **Maze Topology** control: "Rectangular" (default) and "Circular". When **Circular** is selected, the Maze Style fieldset is visually disabled and not applied (polar has one style). Form value `topology` is read in `main.js`; circular topology uses `generatePolarMaze` / `generatePolarMazes` for preview and PDF. Preview seed is deterministic per (ageRange, topology) so circular uses a distinct key (e.g. `'polar'`) from rectangular styles. Solver and renderer already branch on `maze.layout === 'polar'` (adapter and drawer). Debug panel shows polar info (rings × wedges) when the generated maze is polar. Start at center (ring 0), finish at outer ring (wedge 0). Documented as implemented in v1; see DEFERRED_IDEAS for prior "Polar / Circular Mazes" deferral now closed.

---

## D-012 — Live canvas preview; shared transform with PDF (2026-02-07)

**Context:** Preview should show a representative maze without maintaining static PNGs for every level×style. Same visual result as PDF for the same maze and layout.

**Decision:** Preview is **live-generated**: one maze is generated (grid or organic) from the current level and maze style and drawn to a **canvas** in the right panel. Layout uses the same math as PDF: `getLayoutForMaze(maze, pageOptions)` with optional `pageWidth`, `pageHeight`, `margin` so the preview viewport (e.g. 400×520) gets the same transform shape. Canvas drawers (`draw-grid-canvas.js`, `draw-organic-canvas.js`) use the same `layoutResult` as the PDF drawers but draw via `CanvasRenderingContext2D` (no pdf-lib). **Preview seed:** When not in debug mode, a deterministic seed per (ageRange, mazeStyle) is used so the same controls always show the same maze. In **debug mode**, a "Preview seed" text input is shown and **populated** with the current preview seed; the user can **edit** it (e.g. paste a seed from a prior PDF footer) to get an instant preview of that maze. Debug overlay on the canvas (node IDs, neighbor counts, start/finish markers for organic) is drawn when debug is on. See DEFERRED_IDEAS.md for "random preview on every click" and "use debug seed for next PDF".

**Supersedes:** D-011 for the preview mechanism. Static sample images and related code are unused for preview; see **docs/Unused.md** for a list and removal notes.

---

## D-013 — Version management (2026-02-07)

**Context:** Need a single place for release version and a policy for v0 and future releases.

**Decision:** The **canonical release version** is `package.json` → `"version"`. v0 corresponds to the **first release** (e.g. `0.1.0`). To release: run tests and build, then create a Git tag (e.g. `v0.1.0`) and a GitHub release; tag and `package.json` version should match. Bump `package.json` `version` when cutting a new release (manual edit). No separate VERSION file; docs (README, AGENTS.md) reference package.json as the source of truth for version.

---

## D-011 — Sample preview: static app assets, no solver (2026-02-07) [superseded for preview by D-012]

**Context:** The right-side preview area should show a sample maze image keyed by the selected level and maze style so users see representative output before generating a PDF. Samples must work offline and must not display a solver or solution path.

**Decision:** Sample preview uses **static image files** in `public/samples/`, keyed by level (age-range value) and maze style. Naming: `{ageRange}-{mazeStyle}.png` with filename-safe mapping for `18+` (e.g. `18plus`). Up to 7×3 = 21 assets; a subset is acceptable—when a file is missing, the preview shows no image (no error). Samples are **maze-only** (no solver path). They are read-only app assets, not user data; no persistence or database. Logic lives in `src/utils/samplePreview.js`; main.js updates the preview image on form change and on load.

**Generating sample assets:** Export one page from the PDF pipeline without solution overlay (e.g. deterministic seed + render to PNG in a build script), or add hand-made PNGs. Document the process if a script is added.

---

## D-010 — Solver adapter and renderer drawer pattern (2026-02-08)

**Context:** Support multiple maze topologies (grid, organic, future polar) and keep solver/renderer scalable and testable without large if-else branches.

**Decision:**

- **Solver:** Maze adapters normalize each topology to a single contract (getStart, getFinish, getNeighbors, key; optional getTotalCells). One BFS implementation in `solver-algorithms.js` runs against any adapter. Adapters live in `solver-adapters.js`; `solveMaze(maze, options?)` resolves layout to an adapter and looks up the algorithm (default `'bfs'`) in a registry. Adding a topology = add one adapter; adding a solver algorithm (e.g. DFS) = register one function.
- **Renderer:** Layout is computed once per maze via `getLayoutForMaze(maze, pageOptions)` in `layout.js`. Drawers (e.g. `drawers/draw-grid.js`, `drawers/draw-organic.js`) implement a common interface: drawWalls, drawLabels, drawSolutionOverlay. The main renderer selects a drawer by layout and calls the three methods. Adding a topology = add one layout branch in getLayoutForMaze + one drawer module + register in `drawers/index.js`.

**Pluggable solver algorithms:** Only BFS is implemented. The design allows future user-selectable solver (e.g. UI) and solver match-up (compare algorithms on the same maze); see DEFERRED_IDEAS.md (Solver / Pathfinding). No UI or match-up in this refactor.

---

## D-009 — npm "Unknown env config devdir" warning (2026-02-08)

**Context:** Running `npm install` may show: `npm warn Unknown env config "devdir". This will stop working in the next major version of npm.`

**Cause:** The environment sets `NPM_CONFIG_DEVDIR` (e.g. Cursor sandbox or a user/node-gyp helper). npm 11 no longer recognizes this config key and warns that it will be removed.

**Decision:** No project-level code or .npmrc change. Document the workaround for contributors who see the warning. To silence it: unset the environment variable (`$env:NPM_CONFIG_DEVDIR = ''` in PowerShell; `unset NPM_CONFIG_DEVDIR` in Bash), or if it was set in npm user config run `npm config delete devdir`. The project does not set this variable; it is external (IDE sandbox or system).

---

## D-006 — Self-hosted fonts (2026-02-02)

**Context:** UI rules require "Fonts should be self-hosted or bundled" and "No runtime dependency on Google Fonts CDN" for offline resilience.

**Decision:** Use @fontsource (Fraunces + Inter) as npm dependencies; import their CSS in main.css so Vite bundles the font files. Remove Google Fonts links from index.html. System font fallbacks (Georgia, system-ui) remain in CSS for resilience.

---

## D-005 — Error handling: single inline message, no stack traces (2026-02-02)

**Context:** AGENTS.md requires "Repeated generation failure → single inline error" and "No stack traces in UI".

**Decision:** On generation failure, show one fixed message in the status area only. First failure: "Generation failed. Please try again." After two or more consecutive failures: "Generation failed again. Check the console for details." Log full error to `console.error` only; never surface `error.message` or `error.stack` in the UI. No retry loops, modals, or alerts.

---

## D-004 — "Classic" style (formerly "Rounded") means rounded corners (2026-01-31, renamed 2026-02-08)

**Context:** The spec listed "Square" and "Rounded" maze styles. Organic/curvy paths and polar/circular mazes were considered but deemed too complex for v0. "Rounded" was renamed to **"Classic"** to avoid vocabulary collision with upcoming curved, circular, and other geometry terms.

**Decision:** "Classic" is a grid-topology maze with rounded corners on wall intersections (round line caps). Internal style value: `'classic'`.

**Alternatives deferred:** Organic curves, polar mazes (see DEFERRED_IDEAS.md).

---

## D-014 — Jagged / Curvy split and Catmull-Rom rendering (2026-02-17)

**Context:** The organic maze style (circle-packing topology) benefits from a visual variant with smooth curves instead of straight-line corridor walls. The name "Organic" was ambiguous; splitting into explicit sub-styles clarifies intent.

**Decision:** The former "Organic" style is renamed **"Jagged"** (straight-line walls with miter-point junctions). A new **"Curvy"** style shares the same generation pipeline (circle packing, organic graph, DFS/Prim's/Kruskal's) but renders corridor walls using **Catmull-Rom splines** (converted to cubic Bezier for pdf-lib SVG paths and canvas). Junction arcs are approximated with cubic Bezier curves. All 3 algorithms are available for both Jagged and Curvy. Internal style values: `'jagged'`, `'curvy'`. Maze layout remains `'organic'`; the drawer registry maps by style name.

**UI:** Four top-level style options: Classic | Jagged | Curvy | Square Corners.

**Curve geometry:** Phantom points for Catmull-Rom are the node center + perpendicular offset (halfW); this reuses the miter-point geometry shared via `organic-geometry.js`.

---

## D-008 — Organic style: non-grid graph topology (2026-02-07)

**Context:** Users may want maze layouts that are not grid-aligned. D-007 had introduced "Curvy" as grid + Bezier rendering; DEFERRED_IDEAS listed true organic (non-grid) topology as deferred.

**Decision:** "Organic" is a **maze style** that uses a different topology and generation path: circle packing (deterministic, variable radii) produces an arbitrary graph of touching cells; DFS on that graph carves a perfect maze. Solver and renderer support both grid and organic via a unified maze object (layout discriminator). Same seed → same PDF. The previous "Curvy" style (grid + Bezier rendering) has been removed and replaced by Organic.

**Scope:** Grid styles remain Square and Classic (formerly Rounded). Organic topology is split into Jagged and Curvy sub-styles (see D-014).

---

## D-003 — pdf-lib for PDF generation (2026-01-31)

**Context:** Need vector-first PDF rendering for crisp print output at any DPI.

**Decision:** Use pdf-lib (~250KB, pure JS, excellent vector path support).

**Alternatives considered:** jsPDF (more raster-focused), PDFKit (heavier, Node-oriented).

---

## D-002 — Vanilla JS + Vite (2026-01-31)

**Context:** Spec emphasizes "clean, inspectable demonstration" and minimal tooling.

**Decision:** Use Vanilla JS with Vite for dev/build. No framework.

**Alternatives considered:** React (more boilerplate), Svelte (less common).

---

## D-001 — Prim's algorithm for maze generation (2026-01-31)

**Context:** Need a deterministic perfect-maze algorithm. Different algorithms produce different maze characteristics.

**Decision:** Use Prim's algorithm for all age ranges in v0. Prim's creates mazes with short branching dead-ends, which are more intuitive and forgiving for younger children.

**Update:** Recursive Backtracker (DFS) and Kruskal's are available as alternative algorithms, selectable via `config.algorithm: 'recursive-backtracker'` or `'kruskal'`. Default remains `'prim'`. Same seed and algorithm yield the same maze (deterministic). Kruskal's produces a different "twisty" character; all three are used by the algorithm randomizer for older-age multi-maze packs.

**Future consideration:** Map algorithms to age bands (e.g. Recursive Backtracker for younger, Prim for older) for age-appropriate challenge (see DEFERRED_IDEAS.md). Age ranges in v0: 3, 4–5, 6–8, 9–11, 12–14, 15–17, 18+ (label: Epic Adventure).
