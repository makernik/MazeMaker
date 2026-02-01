# v0 Product Spec — Printable Maze Generator (Local, Offline)

## Purpose

Generate a print-ready PDF maze pack for children in under 30 seconds, optimized for home printers and parent-assisted engagement.

Secondary purpose: serve as a clean, inspectable demonstration of deterministic generation, validation, UX restraint, and testability.

---

## Execution Mode (v0 — Explicit)

- Local web app
- Single user
- Offline after download
- Runs via one command
- No authentication
- No database
- Stateless between runs

---

## Target Users

- **Primary:** Parents printing short activity packs (road trips, quiet time)
- **Secondary:** Technical reviewers (hiring managers, peers) inspecting code quality

---

## Core Constraints (Hard)

- Local-only web app
- Offline after initial load
- Black & white only
- US Letter (8.5 × 11)
- 1 maze per page
- Quantity: 1–10 (default 5)
- Perfect mazes only (single solution)
- No AI dependencies
- No cloud services

---

## User-Facing UI (Minimal)

### Exposed Controls (Default Mode)

**Age Range**

- 3–5 (implemented)
- 6–8 (maps to 3–5)
- 9–13 (implemented)
- 14–17 (maps to 9–13)

**Maze Style**

- Square
- Rounded

**Theme Category**

- None (default)
- Shapes
- Animals

**Quantity**

- Slider or stepper: 1–10 (default 5)

**Primary Action**

- Generate Printable PDF

### Debug Mode (Hidden / Toggle)

Purpose: tuning and technical credibility, not user empowerment.

- Quantity default: 1

**Exposes:**

- Difficulty parameters (path length, dead-end density, corridor width)
- Random seed (display-only)
- Solver overlay (visual proof)

**Rules:**

- No braids
- No multi-solution logic
- Solver path never printed in normal mode

---

## Maze Rules (v0)

### Topology

- Perfect maze (tree)
- Fixed start: top-left
- Fixed goal: bottom-right
- Framing implied ("find the treasure"), not configurable

### Difficulty Presets

**Ages 3–5**

- Short paths
- Few dead ends
- Wide corridors
- Thick lines

**Ages 9–13**

- Longer paths
- Moderate dead ends
- Narrower corridors
- Finer lines

Other age bands map internally to nearest preset.

### Determinism Policy

- Maze generation is deterministic once a seed is chosen
- Seeds are hidden in normal mode
- Seed is visible (read-only) in Debug Mode

---

## Themes (v0 — Decorative Only)

**Shapes** (frame or corner embellishment only)

- triangle, circle, square, rectangle, rhombus
- parallelogram, pentagon, 5-point star, heart, torus

**Animals** (frame or corner embellishment only)

- dog, cat, duck, bear, fox, butterfly

**Rules:**

- Maze grid remains rectangular
- No silhouette-constrained paths
- No internal illustrations

---

## Output

- Single PDF containing N pages
- Safe margins: ≥ 0.5"
- Footer (small, consistent):

```
Generated with MakerNik Maze Tool
makernik.com
```

### PDF Rendering Requirements

- Vector-first rendering preferred
- Crisp lines at any print DPI
- Avoid rasterization unless unavoidable

---

## Validation & Failure Handling

- Every maze is solved programmatically before PDF render
- On failure: regenerate automatically
- If repeated failures occur:
  - Show a single inline error message
  - No stack traces in UI
  - Console logging allowed

---

## Non-Goals (Explicit)

- No persistence
- No profiles
- No saved favorites
- No seed reuse UI
- No cloud
- No AI
- No commercial features

---

## Required Artifacts

```
/src           (application code)
/docs
  DECISIONS.md
  DEFERRED_IDEAS.md
README.md
```
