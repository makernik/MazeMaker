# Decisions

Architectural and design decisions for the Printable Maze Generator.

---

## D-012 — Live canvas preview; shared transform with PDF (2026-02-07)

**Context:** Preview should show a representative maze without maintaining static PNGs for every level×style. Same visual result as PDF for the same maze and layout.

**Decision:** Preview is **live-generated**: one maze is generated (grid or organic) from the current level and maze style and drawn to a **canvas** in the right panel. Layout uses the same math as PDF: `getLayoutForMaze(maze, pageOptions)` with optional `pageWidth`, `pageHeight`, `margin` so the preview viewport (e.g. 400×520) gets the same transform shape. Canvas drawers (`draw-grid-canvas.js`, `draw-organic-canvas.js`) use the same `layoutResult` as the PDF drawers but draw via `CanvasRenderingContext2D` (no pdf-lib). **Preview seed:** When not in debug mode, a deterministic seed per (ageRange, mazeStyle) is used so the same controls always show the same maze. In **debug mode**, a "Preview seed" text input is shown and **populated** with the current preview seed; the user can **edit** it (e.g. paste a seed from a prior PDF footer) to get an instant preview of that maze. Debug overlay on the canvas (node IDs, neighbor counts, start/finish markers for organic) is drawn when debug is on. See DEFERRED_IDEAS.md for "random preview on every click" and "use debug seed for next PDF".

**Supersedes:** D-011 for the preview mechanism (no static sample images for preview; `public/samples/` and `samplePreview.js` remain for any other use or removal later).

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

## D-004 — "Rounded" style means rounded corners (2026-01-31)

**Context:** The spec lists "Square" and "Rounded" maze styles. Organic/curvy paths and polar/circular mazes were considered but deemed too complex for v0.

**Decision:** "Rounded" in v0 means rounded corners on wall intersections, not organic curves or circular topology.

**Alternatives deferred:** Organic curves, polar mazes (see DEFERRED_IDEAS.md).

---

## D-008 — Organic style: non-grid graph topology (2026-02-07)

**Context:** Users may want maze layouts that are not grid-aligned. D-007 had introduced "Curvy" as grid + Bezier rendering; DEFERRED_IDEAS listed true organic (non-grid) topology as deferred.

**Decision:** "Organic" is a **maze style** that uses a different topology and generation path: circle packing (deterministic, variable radii) produces an arbitrary graph of touching cells; DFS on that graph carves a perfect maze. Solver and renderer support both grid and organic via a unified maze object (layout discriminator). Same seed → same PDF. The previous "Curvy" style (grid + Bezier rendering) has been removed and replaced by Organic.

**Scope:** Grid styles remain Square and Rounded. Organic is the only non-grid style in v0.

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
