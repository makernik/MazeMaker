---
name: "Live canvas preview"
overview: "Replace static sample images with on-the-fly maze generation and canvas drawing. Share the same coordinate transform between preview and PDF. Add debug seed input and debug overlay (node IDs, neighbor counts, start/finish) on the preview canvas."
todos: []
isProject: false
---

# Plan: Live canvas preview

**Status:** done  
**Last updated:** 2025-02-07  
**Related:** DECISIONS.md (to add: preview seed policy, debug seed usage)

---

## Overview

- **Preview:** Generate one maze (grid or organic) from current level + maze style and draw it to a **canvas** in the right panel. No more static PNGs in `public/samples/`.
- **Shared transform:** Use the same layout math and transform for preview and PDF. Preview calls `getLayoutForMaze(maze, { pageWidth, pageHeight, margin, mazeWidth, mazeHeight, style })` with viewport dimensions; PDF uses existing page constants. Same `transform(x,y)` and scale → identical geometry; only the target (canvas vs PDF page) differs.
- **Debug:** (1) Manual seed input in the debug panel to regenerate the preview with that seed (e.g. for testing circle packing). (2) When debug mode is on, draw on the preview canvas: node IDs, neighbor counts, start/finish markers (and optionally grid cell indices for grid mazes).

---

## Scope

**In scope:**

- Replace sample `<img>` with a `<canvas>` in `.sample-preview`.
- Extend `getLayoutForMaze` to accept optional `pageWidth`, `pageHeight`, `margin` so the same formula produces a transform for a preview viewport (e.g. 400×500 px).
- Canvas drawing: implement drawing to `CanvasRenderingContext2D` that uses the same `layoutResult` (transform, scale, lineThickness, etc.) as the PDF drawers — for both grid and organic (walls + labels; no solution in preview unless we add it later).
- Preview flow: on load and when level or maze-style (and in debug, seed) change → generate one maze (grid or organic), compute layout for preview size, draw to canvas. Use a **deterministic preview seed** when not in debug (fixed per ageRange + mazeStyle); in debug use the seed from the input (populated with current preview seed, user-editable so e.g. paste seed from PDF footer for instant preview of that maze).
- Debug panel: add a text input for "Preview seed" (populated, editable); changing it regenerates the preview. Preview only (see DEFERRED_IDEAS: use debug seed for next PDF).
- Debug overlay: when `debugMode`, draw node IDs, neighbor counts, start/finish on canvas (organic; grid optional). Same behavior for all levels; no special debounce/skip for 18+.
- Remove/simplify: img-based `updateSamplePreview`, `SAMPLE_PLACEHOLDER_*`, "Sample path" debug row (replace with seed input).

**Out of scope:**

- Using the debug seed for the next "Generate PDF" run (see DEFERRED_IDEAS).
- Random preview on every click (see DEFERRED_IDEAS).
- Solution path on the preview canvas (v0 stays maze-only; can add later).
- Persistence of preview seed or canvas state.
- Changes to PDF generation logic other than reusing the same layout contract.

---

## Architecture

- **Layout:** `getLayoutForMaze(maze, pageOptions)` already takes `mazeWidth`, `mazeHeight`, `style`. Extend `pageOptions` with optional `pageWidth`, `pageHeight`, `margin`. When provided, use them instead of `PAGE_WIDTH`, `PAGE_HEIGHT`, `MARGIN` for computing `offsetX`/`offsetY` and thus the same `transform` shape. Preview passes e.g. `{ pageWidth: 400, pageHeight: 500, margin: 0, mazeWidth: 400, mazeHeight: 500, style }`.
- **Canvas coordinate system:** PDF uses y-up. Set canvas transform so the same (x,y) from `layoutResult.transform` maps correctly: e.g. `ctx.setTransform(1, 0, 0, -1, 0, canvas.height)` so y-up layout space maps to canvas (y-down) with origin at bottom.
- **Drawing:** New modules (e.g. `src/pdf/drawers/canvas-grid.js`, `src/pdf/drawers/canvas-organic.js`) or extend existing drawers with a "draw to canvas" path. They take `(ctx, maze, layoutResult)` and mirror the PDF drawing logic (same segments, same transform) but use `ctx.moveTo`, `ctx.lineTo`, `ctx.stroke`, `ctx.fillText`, etc. No pdf-lib in the canvas path.
- **Preview seed:** When not in debug, fixed seed per (ageRange, mazeStyle). In debug, seed input is populated (current preview seed) and user-editable so user can paste a seed from a prior PDF footer and get instant preview of that maze.

**Files touched:**

- `src/pdf/layout.js` — optional page dimensions in `getLayoutForMaze`.
- `src/pdf/drawers/` — add canvas drawers (e.g. `draw-grid-canvas.js`, `draw-organic-canvas.js`) or canvas methods alongside PDF ones; both use same `layoutResult`.
- `src/index.html` — replace `#sample-preview-img` with `<canvas id="sample-preview-canvas">`; add debug "Preview seed" input.
- `src/main.js` — replace img-based `updateSamplePreview` with: get form values, preview seed (debug input or fixed), generate one maze, get layout for preview viewport, draw to canvas; resize canvas to container; on debug seed input change, regenerate. Remove `SAMPLE_PLACEHOLDER_*`, sample path display.
- `src/styles/main.css` — style canvas (e.g. `.sample-preview__canvas`) and hide img rules or repurpose for canvas.
- `src/utils/samplePreview.js` — remove or keep for other uses; preview no longer uses path.
- `e2e/generate-pdf.spec.js` — update test that asserted img `src` (e.g. assert canvas is present and has content, or remove that assertion).
- `docs/DECISIONS.md` — note: preview is live-generated; preview seed policy (fixed per level+style when not debug; debug seed for preview only unless we add "use for PDF").

**Key interfaces:**

- `getLayoutForMaze(maze, pageOptions)` — `pageOptions` may include `pageWidth`, `pageHeight`, `margin` for preview viewport.
- Canvas drawers: `drawWallsToCanvas(ctx, maze, layoutResult)`, `drawLabelsToCanvas(ctx, maze, layoutResult)`; optional `drawDebugOverlayToCanvas(ctx, maze, layoutResult)` when `debugMode`.

---

## Checkpoints

- **C0** — Layout: extend `getLayoutForMaze` with optional `pageWidth`, `pageHeight`, `margin`; add a small unit test that layout with custom page size returns transform that fits in the given rectangle.
- **C1** — Canvas drawers: implement grid and organic canvas drawing (walls + labels) using the same `layoutResult` as PDF; no PDF dependency in canvas code. Wire preview area to a canvas and call these on a single generated maze with preview layout; canvas shows correct maze (no debug overlay yet).
- **C2** — Preview flow: on load and on level/maze-style change, generate one maze (deterministic seed when not debug), compute preview layout, draw to canvas; canvas resized to container. Replace img and img-based logic; remove placeholder/sample path for preview.
- **C3** — Debug: add "Preview seed" input in debug panel; when changed, regenerate preview with that seed. When `debugMode`, draw debug overlay on canvas (node IDs, neighbor counts, start/finish for organic; optional grid extras).
- **C4** — Docs, tests, e2e: DECISIONS.md entry; unit test for layout with custom page; e2e updated (canvas present, no img src assertion); run full test suite.

---

## Validation

**Tests:**

- Unit: `getLayoutForMaze(maze, { pageWidth: 400, pageHeight: 500, margin: 0 })` returns layout with transform mapping maze into 400×500.
- Optional: canvas drawer smoke test (generate maze, draw to canvas, assert no throw).

**Commands:**

```bash
npm run build
npm run test
npm run test:e2e
```

**Pass criteria:**

- Preview shows a maze on the canvas that matches the selected level and style; same transform concept as PDF.
- Debug seed input changes the preview when edited; debug overlay shows when debug mode is on.
- No reliance on `public/samples/` for preview; no broken e2e.

---

## Notes / Risks

- **Performance:** Same behavior for all levels in debug (no special skip for 18+); keep code and UX consistent. If slow on 18+ organic, we can optimize later.
- **Determinism:** Non-debug preview seed is fixed per (ageRange, mazeStyle). Document in DECISIONS.
- **Debug seed:** Populated with current preview seed; user can edit to any seed (e.g. from PDF footer) for instant preview. PDF generation continues to use its own seed unless we add "use for next PDF" (DEFERRED_IDEAS).

---

## Retrospective

*To be filled after checkpoints.*
