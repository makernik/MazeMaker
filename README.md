# Printable Maze Generator

Local, offline, print-first maze packs for kids.

## What This Is

A small web app that generates printable PDF maze packs. Choose age range, style, and quantity—then download a single PDF. Built for parents; structured to be inspectable and testable.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. Use the controls, click **Generate Printable PDF**, and your mazes download.

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server (http://localhost:5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | E2E smoke tests (Playwright; starts dev server). First time: `npx playwright install chromium` |

## How It Works

1. You set age range, maze style (square / rounded / organic), and quantity (1–10). (Theme selector is hidden this iteration; corner decorations are implemented but paused.)
2. The right panel shows a **live preview**: one maze is generated from the current level and style and drawn on a canvas (same layout as the PDF). Same controls always show the same preview maze (deterministic seed per level+style).
3. Click **Generate Printable PDF**. The app generates that many perfect mazes (Prim's for grid, DFS for organic; seeded for determinism).
4. Each maze is validated with a BFS solver. A single PDF is built (one maze per page, US Letter) and downloaded.

## Debug Mode

Hidden mode for tuning and technical review. **Not** for end users.

- **Toggle:** `Ctrl+Shift+D` or open the app with `?debug=1` in the URL.
- **Shows:** Seed (read-only), grid dimensions, cell size, line thickness. **Preview seed** — editable; change it to see a different maze in the preview (e.g. paste a seed from a PDF footer). Debug overlay on the preview canvas (node IDs, neighbor counts, start/finish markers for organic). Solver path is drawn on the PDF when debug is on.
- Quantity defaults to 1 when you enable debug but you can change it with the slider.

**Version:** Release version is in `package.json` (`version`). v0 scope is complete; see `docs/V0_REVIEW.md` for release readiness.

## Key Design Choices

- **Print-first:** PDF output, safe margins, black & white.
- **Perfect mazes only:** Single solution, no loops.
- **No persistence:** Stateless between runs.
- **Local-only:** No cloud, no accounts, works offline after first load.
- **Deterministic:** Same parameters + seed → same maze and PDF.

## Tech Stack

- **Frontend:** Vanilla JS, Vite
- **PDF:** pdf-lib (vector output); preview uses canvas drawers (same layout math as PDF)
- **Maze:** Prim's (grid), DFS (organic); seeded PRNG (Mulberry32)
- **Tests:** Vitest (unit), Playwright (E2E)

## Project Structure

```
src/
  main.js           # App entry, UI wiring, live preview canvas
  index.html
  maze/             # Generator (Prim's, organic DFS), grid/organic, solver (BFS)
  pdf/              # Renderer, layout, drawers (PDF + canvas for preview)
  themes/           # Shape/animal decorations (corner icons; theme UI currently hidden)
  utils/            # RNG, constants (difficulty presets)
  styles/
tests/              # Unit tests
e2e/                # Playwright E2E tests
docs/               # DECISIONS.md, DEFERRED_IDEAS.md, Unused.md
```

## License

Free for personal use. Non-commercial. Attribution encouraged.

## Author

Nik Chaphalkar — [makernik.com](https://makernik.com)
