# Printable Maze Generator

**Live:** https://maze.makernik.com

Local, offline, print-first maze packs for kids.

## What This Is

A small web app that opens on a maze you can play. Choose a level and style, then open Print for a PDF pack. Built for parents; structured to be inspectable and testable.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. A maze is ready to trace. Open **Print**, then click **Generate Printable PDF**, and the pack downloads.

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

1. The page opens on a playable maze. The first visit is Easy and Classic. The last chosen level and style are remembered on this device. (Theme selector is hidden this iteration; corner decorations are implemented but paused.)
2. Changing the level or style rolls a new maze. **New maze** rolls again with the same settings. Hint, Start over, and line forgiveness work on that maze. The drawing uses the same layout math as the PDF.
3. **Print** opens the pack options: quantity (1–10) and whether page 1 is the maze on screen. **Generate Printable PDF** builds that many perfect mazes (Prim's for grid, DFS/Prim's/Kruskal's for organic; seeded for determinism).
4. Each maze is validated with a BFS solver. A single PDF is built (one maze per page, US Letter) and downloaded.

## Debug Mode

Hidden mode for tuning and technical review. **Not** for end users.

- **Toggle:** `Ctrl+Shift+D` or open the app with `?debug=1` in the URL.
- **Shows:** Seed (read-only), grid dimensions, cell size, line thickness. The canvas is the playable maze, so the preview-seed field does not redraw it. Solver path is drawn on the PDF when debug is on and “Show solution” is checked. **"1 of each level"** generates one maze per difficulty level with the selected style. **"1 of each algorithm"** generates one maze per algorithm (DFS, Prim's, Kruskal's) at the selected level. Those debug packs do not replace page 1 with the on-screen maze.
- Quantity defaults to 1 when you enable debug. Change it with the slider in the print sheet.

**Version:** Release version is in `package.json` (`version`). v0 scope is complete; see `docs/V0_REVIEW.md` for release readiness.

## Key Design Choices

- **Print-first:** PDF output, safe margins, black & white.
- **Perfect mazes only:** Single solution, no loops.
- **Level and style only:** Those two choices are stored in `localStorage`. Seeds, strokes, and mazes are not.
- **Local-only:** No cloud, no accounts, works offline after first load.
- **Deterministic:** Same parameters + seed → same maze and PDF.

## Tech Stack

- **Frontend:** Vanilla JS, Vite
- **PDF:** pdf-lib (vector output); preview uses canvas drawers (same layout math as PDF)
- **Maze:** Prim's (grid), DFS/Prim's/Kruskal's (organic); seeded PRNG (Mulberry32)
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
