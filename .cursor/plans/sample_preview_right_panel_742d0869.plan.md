---
name: Sample preview right panel
overview: Add a sample/pregenerated maze preview in the right-side preview area, keyed by current controls (age range + maze style). Samples are static image files stored under `public/samples/` and displayed without matching actual generated PDFs.
todos: []
isProject: false
---

# Sample / Pregenerated Output on Right Panel

**Status:** draft  
**Scope:** Display a static sample image in the right preview area based on selected Age Range and Maze Style. Samples are app-provided assets (not live-generated); they will not match the generated PDF.

---

## Context

- Current UI: controls left (~30–35%), [preview area](src/index.html) right with intentional whitespace and a faint maze background ([main.css](src/styles/main.css) `.preview-area`, `.maze-background`).
- Controls that drive “sample” selection: **Age Range** (3–5, 6–8, 9–13, 14–17) and **Maze Style** (square, rounded). Theme is hidden in v0.
- v0 spec says “No persistence” and “No database” — interpreted as no *user* data. Sample images are **app assets** (shipped with the app, like theme images in `public/themes/`), so static files are in scope and avoid any user-facing persistence.

---

## Storage: Static files (recommended)

Use **static image files** in the repo, not a runtime database:

- **Location:** `public/samples/` so Vite serves them at `/samples/...` (offline-safe, no fetch to network).
- **Naming:** One image per (ageRange, mazeStyle), e.g.:
  - `3-5-square.png`, `3-5-rounded.png`
  - `6-8-square.png`, `6-8-rounded.png`
  - `9-13-square.png`, `9-13-rounded.png`
  - `14-17-square.png`, `14-17-rounded.png`
- **Format:** PNG or WebP; single representative “sample maze” per preset (e.g. one page worth). Assets can be pre-generated once (e.g. from existing PDF renderer + export frame to image, or designed manually) and committed.
- **Fallback:** If a file is missing (e.g. new preset added later), show nothing or a neutral placeholder so the UI never breaks.

This keeps the app local-only, avoids IndexedDB/build-time DB, and fits “small local … files.” If you later want a “local database” (e.g. IndexedDB) for caching or many samples, that can be a follow-up.

---

## UI behavior

- **Where:** Right side only — inside the existing `[.preview-area](src/index.html)` (e.g. a container above or beside the existing `.maze-background` so the decorative background can stay).
- **What:** One sample image at a time, chosen by current form state:
  - Listen to `age-range` and `maze-style` (and theme if/when exposed).
  - Map to a single asset key, e.g. `{ageRange}-{mazeStyle}.png`.
- **Not:** No “live” maze preview; no guarantee the sample matches the generated PDF (different seed/layout). Optional short label like “Sample output” or “Example” (per [ui_rules.mdc](.cursor/rules/ui_rules.mdc): muted, minimal).
- **Responsive:** On narrow viewports, preview area is already below controls; sample can scale within the preview area (e.g. max-width/max-height, object-fit contain) so it doesn’t overflow.

---

## Data flow (high level)

```mermaid
flowchart LR
  subgraph controls [Controls]
    AgeRange[Age Range]
    MazeStyle[Maze Style]
  end
  subgraph logic [App logic]
    Map[Map to sample key]
    Path["Path e.g. /samples/3-5-square.png"]
  end
  subgraph assets [Assets]
    Files[public/samples/*.png]
  end
  subgraph ui [Preview area]
    Img[Sample image]
  end
  AgeRange --> Map
  MazeStyle --> Map
  Map --> Path
  Path --> Img
  Files --> Path
```



- **Inputs:** `age-range`, `maze-style` (and optionally `theme` when visible).
- **Logic:** Derive asset path from current values; update `<img src="...">` or equivalent in the preview area.
- **Output:** One image visible at a time; no persistence of user data.

---

## Files to add or change


| Purpose                | File / path                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample assets          | `public/samples/<ageRange>-<mazeStyle>.png` (e.g. 8 files for 4 age ranges × 2 styles)                                                                     |
| Preview markup         | [src/index.html](src/index.html) — add a wrapper and `<img>` (or picture) in `.preview-area` for the sample                                                |
| Preview styles         | [src/styles/main.css](src/styles/main.css) — styles for sample container and image (sizing, fit, optional caption)                                         |
| Sample selection logic | [src/main.js](src/main.js) (or a small `src/utils/samplePreview.js`) — compute path from form state, set image `src`, handle missing file                  |
| Docs                   | [docs/DECISIONS.md](docs/DECISIONS.md) — short decision: sample preview is static app assets in `public/samples/`, keyed by controls; not user data, no DB |


---

## Checkpoints

- **C0** — Add `public/samples/` and a minimal sample image (e.g. one placeholder); implement path-from-controls and display in preview area; verify layout (controls left, sample right) and no console errors.
- **C1** — Cover all control combinations: age range + maze style; fallback when file missing; optional “Sample output” label; responsive behavior.
- **C2** — Replace placeholder(s) with real sample images (or document how to generate them); add DECISIONS.md entry; run existing tests and e2e.

---

## Validation

- **Manual:** Change age range and maze style; confirm the right-side image updates and matches the selected combination; confirm missing asset does not break UI.
- **Automated:** Existing `npm run build` and e2e (e.g. [e2e/generate-pdf.spec.js](e2e/generate-pdf.spec.js)) still pass; add optional e2e assertion that preview area contains an img with expected `src` pattern for current form state.
- **Pass criteria:** Sample visible on right; switches with controls; works offline; no user data persistence; layout and fonts still comply with [ui_rules.mdc](.cursor/rules/ui_rules.mdc).

---

## Out of scope (explicit)

- Live maze preview that matches the upcoming PDF.
- Storing or reusing user-generated content.
- Cloud or network fetch for samples.
- Theme-based samples until Theme control is exposed.

---

## Notes

- **Generating sample assets:** Either export one frame from the existing PDF pipeline (e.g. deterministic seed + render one page to PNG in a build step or script) or add a few hand-made PNGs. Decision can be recorded in DECISIONS.md.
- **v0 spec “No persistence”:** Satisfied by treating samples as read-only app assets in `public/`, not user or session data.

