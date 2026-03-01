---
name: Embedded rooms maze style and style picker consolidation
overview: |
  Consolidate Topology + Style into a single five-option Style picker: Classic, Jagged, Curvy, Circular, Squares. "Squares" is a new style: one large rectangular outer maze containing multiple embedded square sub-mazes (rooms). Each room has exactly two openings aligned with the outer maze's carved passages; a player must solve the room's interior to exit the other side. Some rooms sit on the critical path; others sit on dead-end branches — the outer spanning tree decides which, not a separate mechanism. Both the outer maze and every sub-maze are perfect. The Topology selector is removed entirely; Circular moves into the Style picker.
todos: []
isProject: false
---

# Embedded Rooms (Squares Style) + Style Picker Consolidation

**Status:** executing

**C0:** UI — Topology removed; five-option Style picker (`name="maze-style"`); `main.js` routes by `mazeStyle`; Squares shows "not yet available" until C4. Default style in layout/renderer switched to `classic`.

---

## Style mapping (before → after)


| Before                                 | After (UI label) | value      | layout       |
| -------------------------------------- | ---------------- | ---------- | ------------ |
| Topology: Rectangular + Style: Classic | Classic          | `classic`  | grid         |
| Topology: Rectangular + Style: Jagged  | Jagged           | `jagged`   | organic      |
| Topology: Rectangular + Style: Curvy   | Curvy            | `curvy`    | organic      |
| Topology: Circular                     | Circular         | `circular` | polar        |
| *(new)*                                | Squares          | `squares`  | grid + rooms |


**Topology selector:** removed entirely. Style is the sole user-facing
control that determines layout and generation path.

**End caps for Squares style:** round for all sub-maze wall segments.
Outer maze walls use existing Classic end-cap style.

---

## Locked design decisions

### Dead-end room indistinguishability

Rooms on dead-end branches of the outer maze are **visually identical** to
rooms on the critical path. The player cannot tell which rooms must be solved
and which lead nowhere — this is intentional and is part of the difficulty.

Future: a boolean flag `showDeadEndRooms` (on the maze object and/or preset)
would allow dead-end rooms to be rendered with a visual distinction (e.g.
lighter border, dashed outline). Not implemented in this plan.

### Squares is grid-only

The outer maze for Squares style is always a rectangular grid. Rooms are not
supported on Jagged, Curvy, or Circular topologies. Organic cells have no
fixed rectangular boundary; polar cells are wedge-shaped. Squares is a
standalone style, not a modifier combinable with other styles.

### Sub-maze algorithm

Sub-mazes always use `recursive-backtracker` regardless of the outer maze's
algorithm. Recursive backtracker produces winding paths that make small rooms
feel harder than their size suggests — appropriate where cell count is low.

### Room candidate selection fallback

If 2-passage candidate cells in the outer maze are fewer than
`preset.roomCount`, silently reduce room count to however many candidates
exist. Never relax to 1-passage (dead-end) cells to meet the count — that
variant is deferred.

### Minimum outer cell size

If the outer maze's `cellSize` from preset is below **28pt**, coerce to 28pt
minimum and recompute grid dimensions to fit the printable area. Below this
threshold a sub-maze of even 3×3 cells would be illegible in print.

---

## 1. UI: single Style picker, Topology removed

**File:** `src/index.html`

- Remove the **Topology** fieldset entirely.
- Replace the existing **Maze Style** toggle group: remove "Square Corners", add **Circular** and **Squares**. Use `name="maze-style"` (existing convention). User sees only the style picker; topology is derived in code from style (e.g. `mazeStyle === 'circular'` → polar).

```html
<div class="toggle-group" role="radiogroup" aria-label="Maze Style">
  <label class="toggle">
    <input type="radio" name="maze-style" value="classic" checked />
    <span>Classic</span>
  </label>
  <label class="toggle">
    <input type="radio" name="maze-style" value="jagged" />
    <span>Jagged</span>
  </label>
  <label class="toggle">
    <input type="radio" name="maze-style" value="curvy" />
    <span>Curvy</span>
  </label>
  <label class="toggle">
    <input type="radio" name="maze-style" value="circular" />
    <span>Circular</span>
  </label>
  <label class="toggle">
    <input type="radio" name="maze-style" value="squares" />
    <span>Squares</span>
  </label>
</div>
```

**File:** `src/main.js`

- In `getFormValues()`: remove topology field; style alone drives routing. Keep reading `maze-style` (camelCase `mazeStyle` in JS).
- Derive circular from style: `isCircular = values.mazeStyle === 'circular'`. Replace all `values.topology === 'circular'` with that.
- `previewSeedFor(ageRange, mazeStyle)`: remove topology param; use `mazeStyle === 'circular'` for polar key.
- Style fieldset visibility: topology under the hood only — keep style fieldset always visible (no hide when circular). Simplify or no-op `syncMazeStyleVisibility`; remove form handler for `topology` (no topology radio).
- C0: when `mazeStyle === 'squares'`, PDF generation shows "Squares style is not yet available." and returns; preview can show classic grid as placeholder until C4. Add `else if values.mazeStyle === 'squares'` generation branch in C4.
- Fix pre-existing bug: use `GRID_ALGORITHM_IDS` (not `ALGORITHM_IDS`) in "1 of each algorithm" branch.

---

## 2. Data model: RoomsGrid and RoomCell

**New file:** `src/maze/roomsGrid.js`

```js
class RoomCell {
  outerRow;        // row in outer grid
  outerCol;        // col in outer grid
  openings;        // DIRECTIONS[] — the 2 open passages in the outer maze
  subGrid;         // MazeGrid — the room's interior maze
  subStart;        // { row, col } in subGrid — aligned with openings[0]
  subFinish;       // { row, col } in subGrid — aligned with openings[1]
  subSolutionPath; // { row, col }[] — BFS path through sub-maze (stored at gen time)
}

class RoomsGrid {
  outerGrid;       // MazeGrid — unmodified outer maze
  roomCells;       // Map<'row,col', RoomCell>
  roomSubSize;     // cells per side in each sub-maze
}
```

Methods: `isRoomCell(row, col)`, `getRoomCell(row, col)`,
`openPassageCount(row, col)` (counts open walls in outer grid cell).

---

## 3. Room placement and sub-maze generation

**New file:** `src/maze/rooms-generator.js`

### Step 1 — Generate outer maze

Call existing `generateMaze({ ageRange, seed, algorithm })`. If preset
`cellSize` < 28pt, override to 28pt and recompute grid dimensions.

### Step 2 — Select room cells

Collect all outer cells where `openPassageCount === 2`. Shuffle with `rng`.
Take `min(preset.roomCount, candidates.length)` as room cells.

### Step 3 — Generate each room's sub-maze

For each selected room cell:

- `openings` = the 2 DIRECTIONS with open walls in the outer maze.
- Map each opening to a border entry position in the sub-grid:
  - `TOP` → `{ row: 0, col: Math.floor(subSize/2) }`
  - `BOTTOM` → `{ row: subSize-1, col: Math.floor(subSize/2) }`
  - `LEFT` → `{ row: Math.floor(subSize/2), col: 0 }`
  - `RIGHT` → `{ row: Math.floor(subSize/2), col: subSize-1 }`
- `subStart` = border position for `openings[0]`;
`subFinish` = border position for `openings[1]`.
- Seed: `seed + cellIndex * 997` (deterministic per room).
- Generate: `generateMaze({ ageRange, seed: derivedSeed, algorithm: 'recursive-backtracker' })`.
- Force open the outer wall of subGrid at `subStart` and `subFinish`.
- Solve sub-maze; store solution as `subSolutionPath` on RoomCell.
- Validate solvable (guaranteed by generation, but validate to match practice).

### Step 4 — Return maze object

```js
{
  layout: 'squares',
  outerGrid,
  roomsGrid,
  start,           // outer grid start
  finish,          // outer grid finish
  seed,
  ageRange,
  preset,
  algorithm,       // outer maze algorithm
}
```

### Preset additions (`src/utils/constants.js`)

```js
roomCount: N,      // target number of embedded rooms
roomSubSize: N,    // sub-maze cells per side
```


| Age   | roomCount | roomSubSize |
| ----- | --------- | ----------- |
| 3     | 1         | 3           |
| 4–5   | 2         | 3           |
| 6–8   | 3         | 4           |
| 9–11  | 4         | 5           |
| 12–14 | 5         | 6           |
| 15–17 | 6         | 7           |
| 18+   | 8         | 8           |


---

## 4. Solver: squares adapter

**File:** `src/maze/solver-adapters.js`

Add `squaresAdapter(maze)`:

- `getStart` / `getFinish`: outer grid start/finish.
- `getNeighbors(state)`: for non-room cells, same as `gridAdapter`. For room
cells, treat as a passable node — the room interior is always solvable so
the outer solver sees room cells as ordinary passable cells. It does not
navigate the sub-maze interior.
- `getTotalCells()`: outer grid total cells.
- Sub-maze solution paths are stored on each `RoomCell` at generation time
for use by `drawSolutionOverlay`.

Add `if (maze.layout === 'squares') return squaresAdapter(maze)` to
`getAdapterForMaze`.

---

## 5. Rendering: draw-rooms.js

**New file:** `src/pdf/drawers/draw-rooms.js`

### drawWalls

- **Outer non-room cells**: draw walls using existing Classic grid wall logic.
- **Room cells**: skip normal outer wall drawing. Instead:
  - Draw a solid-border square at the cell's bounding box.
  - Leave gaps at the two opening directions sized to match an outer corridor.
  - Inside the bounding box, draw the sub-maze walls scaled to fit.
  `subCellSize = outerCellSize / roomSubSize`.
  - Sub-maze wall thickness: `max(0.5, lineThickness * 0.4)`.
  - **End caps:** round for all sub-maze wall segments.

### drawLabels

- Outer Start/Finish labels same as Classic drawer.
- Per-room Enter/Exit labels: deferred.

### drawSolutionOverlay

- Draw outer solution path normally (room cells treated as waypoints).
- For each room cell on the critical path (present in outer solution path):
draw the `subSolutionPath` inside that room using the same dashed style.
- Rooms on dead-end branches: no inner solution drawn (consistent with
indistinguishability — dead-end rooms never reveal their inner path even
in debug mode, since doing so would identify them as dead ends).

---

## 6. Layout

**File:** `src/pdf/layout.js`

- Add `maze.layout === 'squares'` branch. Formula identical to grid, plus
`roomSubSize` passed through in the result.
- Return `layoutType: 'squares'`.

---

## 7. Drawer registry

**File:** `src/pdf/drawers/index.js`

- Import `draw-rooms.js` as `squaresDrawer`.
- Add `squares: squaresDrawer` to `drawers` map.
- `getDrawerKey`: add `if (maze.layout === 'squares') return 'squares'`.

---

## 8. Footer label

**File:** `src/pdf/renderer.js`

```js
function formatStyleLabel(style) {
  const labels = {
    classic: 'Classic', jagged: 'Jagged', curvy: 'Curvy',
    circular: 'Circular', squares: 'Squares',
  };
  return labels[style] ?? style;
}
```

---

## 9. Tests

- **rooms-generator**: determinism; correct room count (with and without
fallback); each room has exactly 2 openings; each sub-maze solvable from
subStart to subFinish; cellSize coercion when preset < 28pt.
- **squares adapter / solver**: `solveMaze` finds outer path; `isPerfectMaze`
reports all outer cells reachable.
- **draw-rooms smoke**: generate a squares maze; call `drawWalls` on a canvas
backend without throwing.
- **e2e**: existing style loop covers `circular` works via style picker (no
topology radio). Add `squares` to the e2e style sweep.
- **constants**: `roomCount` and `roomSubSize` present on all presets.

---

## 10. Documentation

`**docs/DECISIONS.md`**:

- D-XXX — Style picker consolidation: Topology selector removed. Five styles:
Classic, Jagged, Curvy, Circular, Squares. Circular moved from Topology
into Style; Topology as a user-facing concept is retired.
- D-XXX — Squares style: rectangular outer maze + embedded sub-mazes on a
subset of 2-passage cells. Rooms visually indistinguishable regardless of
critical-path vs dead-end status (intentional). Sub-mazes always use
recursive-backtracker; end caps round. Rooms grid-only.

`**docs/DEFERRED_IDEAS.md`**:

- `showDeadEndRooms` flag: render dead-end rooms with visual distinction.
- Rooms in Jagged/Curvy (organic) mazes: organic cells have no fixed
rectangular boundary — fundamental rework required.
- Rooms in Circular (polar) mazes: wedge geometry incompatible.
- Dead-end (1-passage) room cells as a harder variant.
- Enter/Exit labels on room openings for younger ages.
- Update existing "Locked Rooms" note: locked rooms (themed gating, icon
placement) are a separate concept from embedded rooms (Squares style) —
locked rooms are a rendering overlay; embedded rooms are structural.

---

## Checkpoints

- **C0**: UI — remove Topology fieldset; five-option Style picker (`name="maze-style"`); `main.js` routes by `mazeStyle`; Squares shows "not yet available" until C4; `syncMazeStyleVisibility` keeps fieldset visible; `GRID_ALGORITHM_IDS` fix. **Done.** Validation: `npm run test` 160 passed.
- **C1**: Constants — `roomCount`, `roomSubSize` on all presets; `MIN_CELL_SIZE_SQUARES_PT` (28) and coercion documented in constants.js. **Done.** Validation: `npm run test` 162 passed (includes constants tests in maze.test.js).
- **C2**: `roomsGrid.js` — RoomCell, RoomsGrid, openPassageCount; unit tests. **Done.** Validation: `tests/roomsGrid.test.js` 11 tests passed.
- **C3**: `rooms-generator.js` — outer maze, room selection, sub-maze
generation, RoomsGrid assembly; determinism, solvability, fallback tests. **Done.** Optional gridWidth/gridHeight added to generateMaze. Validation: `tests/rooms-generator.test.js` 8 passed; full suite 181 passed.
- **C4**: `solver-adapters.js` — `squaresAdapter`; solver finds outer path;
`isPerfectMaze` works. Wire `main.js` squares branch. **Done.** Layout squares branch, draw-rooms (minimal), registry, formatStyleLabel, debug panel. Validation: `tests/rooms-adapter.test.js` + layout squares test; full suite 185 passed.
- **C5**: `draw-rooms.js` — `drawWalls` (room border with gaps at openings; sub-maze scaled, round caps, thickness); smoke test on canvas and PDF backend. **Done.** Validation: `tests/draw-rooms.test.js` 2 passed; full suite 187 passed.
- **C6**: `draw-rooms.js` — `drawSolutionOverlay`.
- **C7**: Layout and registry wiring; full PDF render smoke across all five
styles.
- **C8**: Docs — DECISIONS.md, DEFERRED_IDEAS.md; regression check all styles.

---

## File change list


| File                                    | Change                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `src/index.html`                        | Remove Topology fieldset; five-option Style picker                      |
| `src/main.js`                           | Remove topology reads; route circular via mazeStyle; add squares branch |
| `src/utils/constants.js`                | Add `roomCount`, `roomSubSize` per preset                               |
| **New** `src/maze/roomsGrid.js`         | RoomCell, RoomsGrid, openPassageCount                                   |
| **New** `src/maze/rooms-generator.js`   | Outer maze + room selection + sub-maze generation                       |
| `src/maze/solver-adapters.js`           | Add squaresAdapter; wire getAdapterForMaze                              |
| **New** `src/pdf/drawers/draw-rooms.js` | drawWalls, drawLabels, drawSolutionOverlay                              |
| `src/pdf/drawers/index.js`              | Register squares drawer; getDrawerKey squares branch                    |
| `src/pdf/layout.js`                     | Add squares layout branch                                               |
| `src/pdf/renderer.js`                   | formatStyleLabel for all five styles                                    |
| `docs/DECISIONS.md`                     | Style consolidation; Squares style decisions                            |
| `docs/DEFERRED_IDEAS.md`                | showDeadEndRooms; organic/polar rooms; locked rooms distinction         |
| **New** `tests/roomsGrid.test.js`       | RoomCell, RoomsGrid, openPassageCount (C2)                              |
| **New** `tests/rooms-generator.test.js` | Determinism, room count, solvability, fallback                          |
| **New** `tests/rooms-adapter.test.js`   | Solver outer path; isPerfectMaze                                        |
| **New** `tests/draw-rooms.test.js`      | drawWalls smoke (canvas + PDF backend) (C5)                             |


---

## Gaps identified (plan vs current code)

*Review: 2026-02-28. Gaps to address during execution.*

### UI / Form (resolved in C0)

- **HTML:** Use `name="maze-style"`; `getFormValues()` unchanged (reads `maze-style`, returns `mazeStyle`).
- **Replace four with five:** Square Corners removed; five options: Classic, Jagged, Curvy, Circular, Squares.
- **Style visibility:** Topology is under the hood only (derived from `mazeStyle`). Style fieldset always visible; `syncMazeStyleVisibility` simplified to never hide; no topology radio handler.

### main.js

- **Circular routing:** Plan says "Replace `if topology === 'circular'` with `if values.mazeStyle === 'circular'`". All branches that use `values.topology` or `isCircular` must be updated (preview seed, generate branches, oneOfEachLevel, oneOfEachAlgo, filename).
- **Preview seed:** `previewSeedFor(ageRange, mazeStyle, topology)` must be updated to take only `(ageRange, mazeStyle)` and use `mazeStyle === 'circular'` for the polar key (no more topology).
- **Debug "1 of each algorithm":** Code uses `ALGORITHM_IDS` at lines 356–367 but only `GRID_ALGORITHM_IDS` is imported — pre-existing bug (ReferenceError when that path runs). Plan does not require fixing it, but implementers will hit it; consider fixing in C0 or separately.
- **Squares in oneOfEachLevel / oneOfEachAlgo:** Plan wires squares in C4. Specify behavior when "1 of each level" or "1 of each algorithm" is checked and style is Squares (e.g. same as grid: one maze per level/algo using squares generator).

### Layout / Renderer

- **layout.js default style:** Current default is `style = pageOptions.style ?? 'square'`. After consolidation, default could be `'classic'` for consistency with first option.
- **Footer style label:** Plan adds `formatStyleLabel(style)` but does not state the call site. Use it when building `debugInfo`: e.g. `style: formatStyleLabel(style)` (or a layout-derived style key) so the footer shows "Classic", "Squares", etc., not raw values.
- **Squares maze shape for layout:** Plan return shape has `outerGrid`, `roomsGrid` but not top-level `rows`/`cols`. `getLayoutForMaze` for squares should use `maze.outerGrid.rows` and `maze.outerGrid.cols` (or add `rows`/`cols` on the maze object for consistency with grid mazes).

### Validation / Solver

- **validateMaze(squares):** `validateMaze` uses `solveMaze` → `getAdapterForMaze`. Once `squaresAdapter` is added, validation will work. No change needed; just ensure squares maze object has the shape the adapter expects.
- **pathToDirections:** Documented "grid only"; squares outer path is grid-like `{row,col}[]`. If any code uses `pathToDirections` with squares solution path, it should work; no plan change needed.

### Tests

- **e2e "style loop":** Plan says "existing style loop covers circular works via style picker" and "Add squares to the e2e style sweep." There is no current e2e test that loops over styles (grep found no match). Either add a new e2e style sweep or document that "e2e" means manual/acceptance; if automated, add a test that generates one maze per style (classic, jagged, curvy, circular, squares) and optionally asserts PDF render.
- **rooms-adapter.test.js:** Plan lists `tests/rooms-adapter.test.js`; file name in table is "rooms-adapter". Consider naming `squares-adapter.test.js` or `rooms-adapter.test.js` to match adapter name (squaresAdapter).

### Plan template alignment

- **Validation section:** Template requires a **Validation** subsection (tests to add/update, commands, pass criteria). Plan has "## 9. Tests" but no explicit **Validation** block; adding one would align with the template and make pass criteria explicit (e.g. `npm run test`, all five styles generate and render).
- **Last updated / Owner:** Template has Status, Last updated, Owner, Related; plan has only Status. Optional to add for traceability.

### Determinism / Privacy (existing code)

- **Network calls in main.js:** Several `fetch('http://127.0.0.1:7243/...')` calls exist (agent log/telemetry). Workspace rules forbid runtime network calls and telemetry. Not introduced by this plan; consider removing or gating behind a build/debug flag in a separate change.

---

## Out of scope (this plan)

- `showDeadEndRooms` visual flag.
- Rooms in Jagged, Curvy, or Circular styles.
- Dead-end (1-passage) room cells as harder variant.
- Non-square room shapes.
- Enter/Exit labels on room openings.
- Algorithm randomizer for Squares (always preset algorithm for outer,
always recursive-backtracker for sub-mazes).
- Locked rooms (themed gating, icon placement) — separate deferred idea.

