# Printable Maze Generator

Local, offline, print-first maze packs for kids.

## What This Is

A small web app that generates printable PDF maze packs. Choose age range, style, theme, and quantity—then download a single PDF. Built for parents; structured to be inspectable and testable.

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

1. You set age range, maze style (square/rounded corners), theme (none/shapes/animals), and quantity (1–10).
2. The app generates that many perfect mazes (Prim's algorithm, seeded for determinism).
3. Each maze is validated with a BFS solver.
4. A single PDF is built (one maze per page, US Letter) and downloaded.

## Debug Mode

Hidden mode for tuning and technical review. **Not** for end users.

- **Toggle:** `Ctrl+Shift+D` or open the app with `?debug=1` in the URL.
- **Shows:** Seed (read-only), grid dimensions, cell size, line thickness. Solver path is drawn on the PDF when debug is on.
- Quantity defaults to 1 when you enable debug but you can change it with the slider.

## Key Design Choices

- **Print-first:** PDF output, safe margins, black & white.
- **Perfect mazes only:** Single solution, no loops.
- **No persistence:** Stateless between runs.
- **Local-only:** No cloud, no accounts, works offline after first load.
- **Deterministic:** Same parameters + seed → same maze and PDF.

## Tech Stack

- **Frontend:** Vanilla JS, Vite
- **PDF:** pdf-lib (vector output)
- **Maze:** Prim's algorithm, seeded PRNG (Mulberry32)
- **Tests:** Vitest (unit), Playwright (E2E)

## Project Structure

```
src/
  main.js           # App entry, UI wiring
  index.html
  maze/             # Generator (Prim's), grid, solver (BFS)
  pdf/              # Renderer, layout
  themes/           # Shape/animal decorations (v0: corner icons)
  utils/            # RNG, constants (difficulty presets)
  styles/
tests/              # Unit tests
e2e/                # Playwright E2E tests
docs/               # DECISIONS.md, DEFERRED_IDEAS.md
```

## License

Free for personal use. Non-commercial. Attribution encouraged.

## Author

Nik Chaphalkar — [makernik.com](https://makernik.com)
