# v1 Product Spec — Printable Maze Generator

**Baseline:** v0 is complete (see `docs/V0_REVIEW.md`). This spec covers the full v1 surface — everything from v0 plus four new capabilities. Items marked **(v0)** are unchanged; items marked **(v1 NEW)** are additions.

---

## Purpose

Generate a print-ready PDF maze pack for children in under 30 seconds, optimized for home printers and parent-assisted engagement. **(v1 NEW)** Available as a public website at `mazes.makernik.com` and downloadable for local use.

Secondary purpose: serve as a clean, inspectable demonstration of deterministic generation, validation, UX restraint, and testability.

---

## Execution Mode

- Local web app **(v0)**
- **(v1 NEW)** Also deployed as a static site on GitHub Pages (`mazes.makernik.com`)
- Single user **(v0)**
- Offline after download **(v0)**
- Runs via one command (local) or by visiting the URL (hosted) **(v1 NEW)**
- No authentication **(v0)**
- No database **(v0)**
- Stateless between runs **(v0)**

---

## Target Users

- **Primary:** Parents printing short activity packs (road trips, quiet time) **(v0)**
- **Secondary:** Technical reviewers (hiring managers, peers) inspecting code quality **(v0)**
- **(v1 NEW)** Website visitors who discover the tool online and use it directly

---

## Core Constraints (Hard)

- Local-only web app (also served as static site) **(v0, extended)**
- Offline after initial load **(v0)**
- Black & white only **(v0)**
- **(v1 NEW)** Page size: US Letter (8.5 x 11 in) or A4 (210 x 297 mm), auto-detected from browser locale (US Letter for US locales, A4 otherwise)
- 1 maze per page **(v0)**
- Quantity: 1–10 (default 5) **(v0)**
- Perfect mazes only (single solution) **(v0)**
- No AI dependencies **(v0)**
- No cloud services **(v0)**

---

## User-Facing UI (Minimal)

### Exposed Controls (Default Mode)

**Age Range** **(v0)**

- 3 — Intro
- 4–5 — Easy
- 6–8 — Medium
- 9–11 — Hard
- 12–14 — Challenging
- 15–17 — Difficult
- 18+ — Epic Adventure

**Maze Topology** **(v1 NEW)**

- Rectangular (default) — uses the existing grid and organic layout engines
- Circular — concentric rings with radial passages (polar topology)

**Maze Style** **(v0, adjusted)**

When topology is Rectangular:

- Classic (rounded corners, default)
- Organic (circle-packing graph)
- Square (sharp corners)

When topology is Circular:

- Single style (polar arcs + radial lines); no sub-style selector

**Start / Finish** **(v1 NEW)**

- Fixed (default) — top-left / bottom-right for grid; center / outer edge for polar
- Random — seeded random boundary placement; deterministic per seed

**Theme Category** **(v0, still hidden)**

- None (default)
- Shapes
- Animals

Themes are implemented but the UI control remains hidden in v1. No change from v0.

**Quantity** **(v0)**

- Slider or stepper: 1–10 (default 5)

**Primary Action** **(v0)**

- Generate Printable PDF

### Debug Mode (Hidden / Toggle) **(v0)**

Purpose: tuning and technical credibility, not user empowerment.

- Quantity default: 1

**Exposes:**

- Difficulty parameters (path length, dead-end density, corridor width)
- Random seed (display-only; editable in preview)
- Solver overlay (visual proof)
- **(v1 NEW)** Topology and page-size overrides visible in debug

**Rules:**

- No braids
- No multi-solution logic
- Solver path never printed in normal mode

---

## Maze Rules

### Shared Rules (all topologies)

- Perfect maze (tree) — single solution, no loops **(v0)**
- Every maze validated by solver before PDF render **(v0)**
- Determinism: same seed + parameters → same maze **(v0)**

### Rectangular Topology **(v0)**

- Grid-based cell layout (rows x cols)
- Start: top-left (0, 0); Finish: bottom-right (rows-1, cols-1) — when start/finish is "Fixed"
- **(v1 NEW)** When start/finish is "Random": start and finish placed on random boundary cells (seeded, deterministic)
- Styles: Classic (rounded corners), Square (sharp corners), Organic (circle-packing)
- Algorithms: Prim's, Recursive Backtracker, Kruskal's (age-mapped; see `constants.js`)

### Circular (Polar) Topology **(v1 NEW)**

- Concentric rings with radial wedge segments
- Cells indexed by (ring, wedge); ring 0 is a single center cell
- Walls: inward, outward, clockwise, counter-clockwise
- Start: center cell (ring 0). Finish: outer ring.
  - Fixed mode: finish at wedge 0 of the outermost ring
  - Random mode: finish at a seeded random wedge on the outermost ring
- Generation: Prim's algorithm on polar graph (seeded, deterministic)
- Presets per age range: rings and initial wedge count (fewer for young, more for older); wedge count may increase in outer rings for cell-size consistency

### Difficulty Presets **(v0, extended)**

Presets are per age range. Grid presets are unchanged from v0.

**Grid presets (v0):**

| Age   | Grid      | Cell | Line | Algorithm              | Organic nodes |
|-------|-----------|------|------|------------------------|---------------|
| 3     | 6 x 7    | 72pt | 4pt  | Recursive Backtracker  | 30            |
| 4–5   | 7 x 8    | 60pt | 4pt  | Recursive Backtracker  | 80            |
| 6–8   | 10 x 14  | 30pt | 4pt  | Recursive Backtracker  | 120           |
| 9–11  | 12 x 18  | 24pt | 2pt  | Prim's                 | 400           |
| 12–14 | 14 x 20  | 24pt | 2pt  | Prim's                 | 800           |
| 15–17 | 24 x 30  | 20pt | 2pt  | Prim's                 | 1200          |
| 18+   | 36 x 42  | 12pt | 1pt  | Prim's                 | 1900          |

**(v1 NEW) Polar presets:** Rings and base wedges per age range. Exact values TBD during implementation; target: 3–5 rings for age 3, scaling to 12+ rings for 18+. Wedge counts double or increase in outer rings to maintain printable cell proportions. Line thickness reuses the grid preset values per age.

### Determinism Policy **(v0)**

- Maze generation is deterministic once a seed is chosen
- Seeds are hidden in normal mode
- Seed is visible (read-only) in Debug Mode
- **(v1 NEW)** Random start/finish positions are derived from the same seed — no additional randomness source

---

## Output

- Single PDF containing N pages **(v0)**
- **(v1 NEW)** Page size: US Letter (612 x 792 pt) or A4 (595.28 x 841.89 pt), based on locale auto-detection
- Safe margins: >= 0.5 in (36 pt) **(v0)**
- Footer (small, consistent): **(v0)**

```
Generated with MakerNik Maze Tool
mazes.makernik.com
```

### PDF Rendering Requirements **(v0)**

- Vector-first rendering preferred
- Crisp lines at any print DPI
- Avoid rasterization unless unavoidable
- **(v1 NEW)** Polar mazes rendered as arc paths and radial line segments (vector, not approximated with raster)

---

## Page Size Auto-Detection **(v1 NEW)**

- On load, detect browser locale via `navigator.language` or `navigator.languages`
- US-based locales (`en-US`, `en-us`, etc.) default to US Letter; all others default to A4
- No explicit UI control in default mode (auto-detect is transparent)
- Debug mode may expose the detected page size for verification
- Layout math in `layout.js` already accepts `pageWidth` and `pageHeight`; wire the detected dimensions through

---

## Deployment **(v1 NEW)**

### Hosted

- Target: `mazes.makernik.com` (custom domain on GitHub Pages)
- Build: `npm run build` produces static `dist/` folder
- Deploy: GitHub Actions workflow on push to main (or manual trigger)
- `vite.config.js`: `base: '/'` (custom domain serves from root)
- CNAME file in `public/` for GitHub Pages custom domain

### Local Use (for technical users)

README includes instructions:

```
git clone https://github.com/<user>/MazeMaker.git
cd MazeMaker
npm install
npm run dev
```

Or for a production build:

```
npm run build
npm run preview
```

---

## Validation & Failure Handling **(v0)**

- Every maze is solved programmatically before PDF render
- On failure: regenerate automatically
- If repeated failures occur:
  - Show a single inline error message
  - No stack traces in UI
  - Console logging allowed

---

## Non-Goals (Explicit) **(v0)**

- No persistence
- No profiles
- No saved favorites
- No seed reuse UI (debug seed affects preview only)
- No cloud
- No AI
- No commercial features

---

## Architecture Notes (v1 context)

These are not requirements but context for implementers. The v0 codebase established patterns that v1 features plug into:

- **Solver adapters** (D-010): `solver-adapters.js` normalizes any topology to `{ getStart, getFinish, getNeighbors, key, getTotalCells? }`. Polar topology adds one adapter.
- **Drawer registry** (`drawers/index.js`): PDF and canvas drawers registered by layout type. Polar topology adds `draw-polar.js` and `draw-polar-canvas.js`.
- **Layout** (`layout.js`): `getLayoutForMaze(maze, pageOptions)` computes transform per topology. Add a `'polar'` branch.
- **Constants** (`constants.js`): `DIFFICULTY_PRESETS` gain polar-specific fields (rings, wedges).
- **Renderer** (`renderer.js`): Page dimensions are configurable; pass locale-detected width/height.

---

## Required Artifacts

```
/src                  (application code)
/docs
  DECISIONS.md
  DEFERRED_IDEAS.md
/.github
  workflows/deploy.yml   (v1 NEW — GitHub Actions deploy)
/public
  CNAME                  (v1 NEW — custom domain for GitHub Pages)
README.md
```

---

## Version

v1 release version: `1.0.0` in `package.json`. See D-013 for version policy.
