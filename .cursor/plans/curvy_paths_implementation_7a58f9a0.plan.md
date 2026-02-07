---
name: Curvy paths implementation
overview: Add a "Curvy" maze style that draws walls as smooth vector curves (e.g. Bezier) while keeping the existing grid topology and Prim's algorithm. Same maze connectivity and solver; only the rendering of wall segments changes.
todos: []
isProject: false
---

# Curvy Paths Implementation Plan

**Status:** draft  
**Scope:** Curvy **rendering** of the existing grid maze (same topology, same generation). Organic **topology** (different generation algorithm) is out of scope.

---

## Scope

**In scope:**

- New maze style **Curvy**: wall segments drawn as smooth curves (e.g. cubic Bezier) instead of straight lines.
- Same grid data structure (`[src/maze/grid.js](src/maze/grid.js)`), Prim's generator (`[src/maze/generator.js](src/maze/generator.js)`), and solver; no algorithm change.
- Deterministic: same maze + style → same PDF (curve control points derived from segment geometry only).
- PDF remains vector-first (pdf-lib supports paths via `drawSvgPath()` with SVG path syntax including cubic Bezier `C`).
- UI: add a third style option "Curvy" alongside Square and Rounded (`[src/index.html](src/index.html)`, `[src/main.js](src/main.js)`).
- Update `[docs/DECISIONS.md](docs/DECISIONS.md)` (new decision for Curvy style) and `[docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md)` (clarify or remove the organic/curvy bullet as implemented in rendering form).

**Out of scope:**

- Changing maze **topology** (e.g. organic/circular layout, different generation algorithm).
- Animations or non-print behavior.
- New difficulty presets or theme changes.

---

## Approach

**Rendering strategy:** Keep drawing one entity per wall segment. For style `curvy`, replace each straight `drawLine` with a curved path:

- **Option A (recommended):** Each wall segment (x1,y1)→(x2,y2) is drawn as a cubic Bezier curve. Control points are offset perpendicular to the segment by a small, deterministic amount (e.g. proportional to `cellSize` or `lineThickness`) so the line gently bows. Same segment always gets the same curve (no RNG in rendering).
- **Option B:** Trace contiguous wall runs (e.g. horizontal/vertical chains) and draw them as single smooth paths; more complex, fewer joints.

**Technical notes:**

- pdf-lib: use `page.drawSvgPath(...)` with SVG path string (e.g. `M x1 y1 C cpx1 cpy1 cpx2 cpy2 x2 y2`). Stroke width and color via the same pattern as current lines (thickness, black). Line caps can be round for curvy style to avoid sharp ends.
- Coordinate system: same as today (PDF coords, origin bottom-left). Offset control points in the plane so the curve stays within the same “lane” (no overlap with adjacent corridors).
- **Deduplication:** Today each cell draws its own wall edges, so shared edges are drawn twice. For curvy, drawing the same edge twice with the same curve is fine (overdraw); alternatively, you could collect unique wall segments and draw each once (cleaner, slightly more code).

**Data flow (unchanged):**

- `generateMaze()` → grid with `cell.hasWall(direction)`.
- `drawMaze(page, grid, { style, ... })` → if `style === 'curvy'`, call a `drawCurvedWall` (or equivalent) instead of `drawWall` for each segment; otherwise keep current behavior.

---

## Architecture

```mermaid
flowchart LR
  subgraph unchanged [Unchanged]
    Gen[generator.js]
    Grid[grid.js]
    Solver[solver.js]
  end
  subgraph render [Renderer changes]
    DrawMaze[drawMaze]
    DrawWall[drawWall]
    DrawCurvedWall[drawCurvedWall]
  end
  Gen --> Grid
  Grid --> DrawMaze
  DrawMaze --> DrawWall
  DrawMaze --> DrawCurvedWall
  style --> DrawMaze
```



**Files to touch:**

- `[src/pdf/renderer.js](src/pdf/renderer.js)` — add curvy style handling: `drawCurvedWall(page, x1, y1, x2, y2, thickness)` using `drawSvgPath` and Bezier; in `drawMaze`, branch on `style === 'curvy'` and use it for each wall segment.
- `[src/index.html](src/index.html)` — add radio option for Curvy (e.g. value `curvy`, label “Curvy Paths” or “Smooth Paths”).
- `[src/main.js](src/main.js)` — no logic change if form already sends `maze-style`; ensure `values.mazeStyle` is passed through to `renderMazesToPdf` (already is).
- `[docs/DECISIONS.md](docs/DECISIONS.md)` — add decision: Curvy style = curved rendering of grid-aligned topology; generation unchanged.
- `[docs/DEFERRED_IDEAS.md](docs/DEFERRED_IDEAS.md)` — update “Organic / Curvy Maze Paths” to note that curvy **rendering** is implemented; organic **topology** remains deferred.

**Key contracts:**

- `drawMaze(page, grid, options)` continues to accept `style` in `options`; `style` may be `'square' | 'rounded' | 'curvy'`.
- Curvy rendering must not use randomness; same grid + dimensions → same curve geometry.

---

## Checkpoints

- **C0** — Baseline: `npm run build` and existing e2e (e.g. generate PDF) pass with current styles (square, rounded).
- **C1** — Implement `drawCurvedWall` and use it in `drawMaze` when `style === 'curvy'`; generate a single PDF with curvy style and confirm visually (smooth segments, no topology change).
- **C2** — Add “Curvy” to UI (index.html); run full flow (generate PDF with each style); update DECISIONS and DEFERRED_IDEAS.
- **C3** — Validation: deterministic check (same seed + curvy → same PDF bytes or same path geometry); add or adjust test if needed (e.g. snapshot or path command string).

---

## Validation

**Tests:**

- Existing e2e (`[e2e/generate-pdf.spec.js](e2e/generate-pdf.spec.js)`): ensure it still passes; optionally add a run with `style: 'curvy'` and assert PDF is generated.
- Determinism: generate two PDFs with same seed + curvy, compare (e.g. file size or a hash of drawn path data) to ensure identical output.

**Commands:**

```bash
npm run build
npm run test
# e2e if present
```

**Pass criteria:**

- Build and current tests pass.
- Curvy style produces a PDF with visibly curved wall segments; topology (solution path) unchanged from square/rounded for same seed.
- Same seed + curvy → identical curvy PDF output.

---

## Notes / Risks

- **pdf-lib API:** Confirm `drawSvgPath` exists in the project’s pdf-lib version and supports stroke options (thickness, color). If not, use low-level path operators or an alternative (e.g. multiple short Bezier segments via another API).
- **Control point choice:** Perpendicular offset magnitude (e.g. 0.15 * segment length) should be tuned so curves look smooth but don’t cross into adjacent cells. Keep formula deterministic (no RNG).
- **Print quality:** Curves remain vector; no rasterization required. Black & white and US Letter constraints unchanged.

---

## Optional later work (not in this plan)

- Organic **topology** (non-grid layout, different algorithm) as in DEFERRED_IDEAS.
- Deduplicating shared edges when drawing curvy walls for slightly cleaner output and fewer path commands.

