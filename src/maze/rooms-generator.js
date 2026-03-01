/**
 * Squares style: generate outer maze + embedded room sub-mazes.
 * Outer maze is a perfect grid maze; room cells are 2-passage cells with interior sub-mazes.
 */

import { DIRECTIONS, DIRECTION_OFFSETS, OPPOSITE } from './grid.js';
import { MazeGrid } from './grid.js';
import { generateMaze } from './generator.js';
import { solveMaze, validateMaze } from './solver.js';
import { createRng } from '../utils/rng.js';
import { getDifficultyPreset, MIN_CELL_SIZE_SQUARES_PT } from '../utils/constants.js';
import { PRINTABLE_WIDTH, PRINTABLE_HEIGHT, FOOTER_HEIGHT } from '../pdf/layout.js';
import { RoomsGrid, RoomCell } from './roomsGrid.js';

const MAZE_TOP_MARGIN = 20;

/**
 * Map direction to border position in a sub-grid (center of that edge).
 * @param {number} direction - DIRECTIONS value
 * @param {number} subSize - cells per side
 * @returns {{ row: number, col: number }}
 */
function borderPositionForDirection(direction, subSize) {
  const mid = Math.floor(subSize / 2);
  if (direction === DIRECTIONS.TOP) return { row: 0, col: mid };
  if (direction === DIRECTIONS.BOTTOM) return { row: subSize - 1, col: mid };
  if (direction === DIRECTIONS.LEFT) return { row: mid, col: 0 };
  return { row: mid, col: subSize - 1 }; // RIGHT
}

/**
 * Collect the two open passage directions at (row, col) in the outer grid.
 * @param {import('./grid.js').MazeGrid} grid
 * @param {number} row
 * @param {number} col
 * @returns {number[]}
 */
function getOpenDirections(grid, row, col) {
  const cell = grid.getCell(row, col);
  const out = [];
  for (const d of Object.values(DIRECTIONS)) {
    if (!cell.hasWall(d)) out.push(d);
  }
  return out;
}

/**
 * Direction from room block (or, oc) with size K to a boundary passage cell (r, c).
 * Boundary means (r,c) is adjacent to the block (shares one side).
 */
function directionFromBlockToCell(or, oc, K, r, c) {
  if (r === or - 1) return DIRECTIONS.TOP;
  if (r === or + K) return DIRECTIONS.BOTTOM;
  if (c === oc - 1) return DIRECTIONS.LEFT;
  if (c === oc + K) return DIRECTIONS.RIGHT;
  return null;
}

/**
 * Rooms-first path: place room blocks, build graph (passage + room edges), carve spanning tree, then sub-mazes.
 * @param {object} opts
 * @returns {object} Maze object same shape as generateSquaresMaze
 */
function generateSquaresMazeRoomsFirst(opts) {
  const {
    gridWidth: cols,
    gridHeight: rows,
    roomOuterSize: K,
    roomCount: requestedRoomCount,
    roomSubSize,
    seed,
    ageRange,
    algorithm: algo,
    effectiveCellSize,
    preset,
  } = opts;

  const rng = createRng(seed);

  // 1. Place non-overlapping K×K blocks; avoid (0,0) and (rows-1, cols-1)
  const blocks = [];
  const maxAttempts = 500;
  for (let i = 0; i < requestedRoomCount; i++) {
    let placed = false;
    for (let _ = 0; _ < maxAttempts; _++) {
      const r = rng.randomInt(0, rows - K);
      const c = rng.randomInt(0, cols - K);
      const containsStart = r <= 0 && r + K > 0 && c <= 0 && c + K > 0;
      const containsFinish = r <= rows - 1 && r + K > rows - 1 && c <= cols - 1 && c + K > cols - 1;
      if (containsStart || containsFinish) continue;
      const overlap = blocks.some((b) => !(r + K <= b.r || b.r + K <= r || c + K <= b.c || b.c + K <= c));
      if (overlap) continue;
      blocks.push({ r, c });
      placed = true;
      break;
    }
  }

  // 2. Occupancy: null = passage, index = room id
  /** @type {(number|null)[][]} */
  const occupancy = [];
  for (let r = 0; r < rows; r++) {
    occupancy[r] = [];
    for (let c = 0; c < cols; c++) occupancy[r][c] = null;
  }
  blocks.forEach((b, id) => {
    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) occupancy[b.r + i][b.c + j] = id;
    }
  });

  // 3. Boundary passage cells per room
  /** @type {{ row: number, col: number }[][]} */
  let boundaryByRoom = blocks.map(() => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occupancy[r][c] !== null) continue;
      for (const d of Object.values(DIRECTIONS)) {
        const [dr, dc] = DIRECTION_OFFSETS[d];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const roomId = occupancy[nr][nc];
        if (roomId !== null) boundaryByRoom[roomId].push({ row: r, col: c });
      }
    }
  }

  // 3b. Keep only blocks with at least 2 boundary cells (so we can pick two distinct non-adjacent openings)
  const validIds = blocks.map((_, id) => id).filter((id) => boundaryByRoom[id].length >= 2);
  if (validIds.length < blocks.length) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = occupancy[r][c];
        if (id !== null && !validIds.includes(id)) occupancy[r][c] = null;
      }
    }
    const validBlocks = validIds.map((id) => blocks[id]);
    boundaryByRoom = validIds.map(() => []);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (occupancy[r][c] !== null) continue;
        for (const d of Object.values(DIRECTIONS)) {
          const [dr, dc] = DIRECTION_OFFSETS[d];
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const roomId = occupancy[nr][nc];
          if (roomId !== null) {
            const idx = validIds.indexOf(roomId);
            if (idx >= 0) boundaryByRoom[idx].push({ row: r, col: c });
          }
        }
      }
    }
    blocks.length = 0;
    blocks.push(...validBlocks);
  }

  // 4. For each room, pick 2 boundary cells (openings) on non-adjacent sides
  /** @type {{ row: number, col: number }[][]} */
  const openingCellsByRoom = [];
  for (let id = 0; id < blocks.length; id++) {
    const { r: or, c: oc } = blocks[id];
    const boundary = boundaryByRoom[id];
    const bySide = new Map();
    for (const cell of boundary) {
      const dir = directionFromBlockToCell(or, oc, K, cell.row, cell.col);
      if (dir != null) {
        if (!bySide.has(dir)) bySide.set(dir, []);
        bySide.get(dir).push(cell);
      }
    }
    const sides = Array.from(bySide.keys());
    rng.shuffle(sides);
    let b1 = null;
    let b2 = null;
    const side1 = sides[0];
    const cells1 = bySide.get(side1) ?? [];
    if (cells1.length > 0) {
      b1 = cells1[rng.randomInt(0, cells1.length - 1)];
      const opposite = OPPOSITE[side1];
      const otherSides = sides.filter((s) => s !== side1);
      const preferOpposite = otherSides.find((s) => s === opposite);
      const side2 = preferOpposite ?? otherSides[0];
      if (side2 != null) {
        const cells2 = bySide.get(side2) ?? [];
        if (cells2.length > 0) b2 = cells2[rng.randomInt(0, cells2.length - 1)];
      }
    }
    if (b2 == null && boundary.length > 0) {
      b1 = b1 ?? boundary[0];
      const second = boundary.find((c) => c !== b1) ?? boundary[boundary.length > 1 ? 1 : 0];
      b2 = second;
    }
    openingCellsByRoom[id] = [b1 ?? boundary[0], b2 ?? boundary[0]];
  }

  // 5. Passage cell list and key -> index
  /** @type {{ row: number, col: number }[]} */
  const passageCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occupancy[r][c] === null) passageCells.push({ row: r, col: c });
    }
  }
  const keyToIndex = new Map();
  passageCells.forEach((p, i) => keyToIndex.set(`${p.row},${p.col}`, i));
  const N = passageCells.length;

  // 6. Edges: passage-passage (adjacent) + one room edge per room (b1, b2)
  /** @type {{ u: number, v: number }[]} */
  const edges = [];
  for (let i = 0; i < passageCells.length; i++) {
    const { row, col } = passageCells[i];
    for (const d of [DIRECTIONS.RIGHT, DIRECTIONS.BOTTOM]) {
      const [dr, dc] = DIRECTION_OFFSETS[d];
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (occupancy[nr][nc] !== null) continue;
      const j = keyToIndex.get(`${nr},${nc}`);
      if (j != null && j > i) edges.push({ u: i, v: j });
    }
  }
  for (let id = 0; id < blocks.length; id++) {
    const [b1, b2] = openingCellsByRoom[id];
    const i = keyToIndex.get(`${b1.row},${b1.col}`);
    const j = keyToIndex.get(`${b2.row},${b2.col}`);
    if (i != null && j != null && i !== j) edges.push({ u: i, v: j });
  }

  // 7. Kruskal
  rng.shuffle(edges);
  const parent = Array.from({ length: N }, (_, i) => i);
  function find(i) {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i, j) {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }
  const treeEdges = new Set();
  for (const { u, v } of edges) {
    if (find(u) !== find(v)) {
      union(u, v);
      treeEdges.add(`${Math.min(u, v)},${Math.max(u, v)}`);
    }
  }

  // 8. Build MazeGrid: passage cells get walls from tree; room cells all walls
  const outerGrid = new MazeGrid(rows, cols);
  for (let i = 0; i < passageCells.length; i++) {
    const { row, col } = passageCells[i];
    const cell = outerGrid.getCell(row, col);
    for (const d of Object.values(DIRECTIONS)) {
      const [dr, dc] = DIRECTION_OFFSETS[d];
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (occupancy[nr][nc] !== null) continue;
      const j = keyToIndex.get(`${nr},${nc}`);
      if (j == null) continue;
      const inTree = treeEdges.has(`${Math.min(i, j)},${Math.max(i, j)}`);
      if (inTree) {
        const neighbor = outerGrid.getCell(nr, nc);
        outerGrid.removeWallBetween(cell, neighbor);
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      outerGrid.getCell(r, c).markVisited();
    }
  }
  outerGrid.openEntrance();
  outerGrid.openExit();

  // 9. RoomsGrid and RoomCells
  const roomsGrid = new RoomsGrid();
  roomsGrid.outerGrid = outerGrid;
  roomsGrid.roomSubSize = roomSubSize;
  roomsGrid.roomOuterSize = K;

  for (let id = 0; id < blocks.length; id++) {
    const { r: or, c: oc } = blocks[id];
    const [b1, b2] = openingCellsByRoom[id];
    const openingDir1 = directionFromBlockToCell(or, oc, K, b1.row, b1.col);
    const openingDir2 = directionFromBlockToCell(or, oc, K, b2.row, b2.col);
    const openings = [openingDir1, openingDir2].filter((x) => x != null);

    const subStart = borderPositionForDirection(openings[0] ?? DIRECTIONS.TOP, roomSubSize);
    const subFinish = borderPositionForDirection(openings[1] ?? DIRECTIONS.BOTTOM, roomSubSize);
    const derivedSeed = seed + id * 997;
    const subMaze = generateMaze({
      ageRange,
      seed: derivedSeed,
      algorithm: 'recursive-backtracker',
      gridWidth: roomSubSize,
      gridHeight: roomSubSize,
    });
    const subGrid = subMaze.grid;
    subGrid.getCell(subStart.row, subStart.col).removeWall(openings[0] ?? DIRECTIONS.TOP);
    subGrid.getCell(subFinish.row, subFinish.col).removeWall(openings[1] ?? DIRECTIONS.BOTTOM);

    const origStart = subGrid.start;
    const origFinish = subGrid.finish;
    subGrid.start = subStart;
    subGrid.finish = subFinish;
    const solution = solveMaze(subGrid);
    subGrid.start = origStart;
    subGrid.finish = origFinish;

    if (!solution || !solution.solved) throw new Error(`Squares rooms-first: sub-maze at ${or},${oc} not solvable`);
    if (!validateMaze(subGrid)) throw new Error(`Squares rooms-first: sub-maze at ${or},${oc} failed validation`);

    const roomCell = new RoomCell();
    roomCell.outerRow = or;
    roomCell.outerCol = oc;
    roomCell.outerSize = K;
    roomCell.openings = openings;
    roomCell.openingCells = [b1, b2];
    roomCell.subGrid = subGrid;
    roomCell.subStart = subStart;
    roomCell.subFinish = subFinish;
    roomCell.subSolutionPath = solution.path;
    roomsGrid.roomCells.set(`${or},${oc}`, roomCell);
  }

  return {
    layout: 'squares',
    outerGrid,
    roomsGrid,
    start: outerGrid.start,
    finish: outerGrid.finish,
    seed,
    ageRange,
    preset: { ...preset, cellSize: effectiveCellSize },
    algorithm: algo,
    rows: outerGrid.rows,
    cols: outerGrid.cols,
  };
}

/**
 * Generate a Squares-style maze: outer grid + embedded rooms.
 *
 * @param {object} config
 * @param {string} config.ageRange
 * @param {number} config.seed
 * @param {string} [config.algorithm] - outer maze algorithm (default from preset)
 * @returns {object} Maze object with layout: 'squares', outerGrid, roomsGrid, start, finish, seed, ageRange, preset, algorithm
 */
export function generateSquaresMaze(config) {
  const { ageRange, seed, algorithm } = config;
  const preset = getDifficultyPreset(ageRange);
  const algo = algorithm ?? preset.algorithm;

  let gridWidth = preset.gridWidth;
  let gridHeight = preset.gridHeight;
  let effectiveCellSize = preset.cellSize;
  if (preset.cellSize < MIN_CELL_SIZE_SQUARES_PT) {
    effectiveCellSize = MIN_CELL_SIZE_SQUARES_PT;
    const mazeHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - MAZE_TOP_MARGIN;
    gridWidth = Math.max(1, Math.floor(PRINTABLE_WIDTH / effectiveCellSize));
    gridHeight = Math.max(1, Math.floor(mazeHeight / effectiveCellSize));
  }

  const roomOuterSize = preset.roomOuterSize ?? 1;
  if (roomOuterSize > 1) {
    return generateSquaresMazeRoomsFirst({
      gridWidth,
      gridHeight,
      roomOuterSize,
      roomCount: preset.roomCount,
      roomSubSize: preset.roomSubSize,
      seed,
      ageRange,
      algorithm: algo,
      effectiveCellSize,
      preset,
    });
  }

  const outerMaze = generateMaze({
    ageRange,
    seed,
    algorithm: algo,
    gridWidth,
    gridHeight,
  });
  const outerGrid = outerMaze.grid;
  const roomSubSize = preset.roomSubSize;
  const roomsGrid = new RoomsGrid();
  roomsGrid.outerGrid = outerGrid;
  roomsGrid.roomSubSize = roomSubSize;
  roomsGrid.roomOuterSize = roomOuterSize;

  const rng = createRng(seed);
  const candidates = [];
  for (let r = 0; r < outerGrid.rows; r++) {
    for (let c = 0; c < outerGrid.cols; c++) {
      if (roomsGrid.openPassageCount(r, c) !== 2) continue;
      const openings = getOpenDirections(outerGrid, r, c);
      if (openings.length === 2 && OPPOSITE[openings[0]] === openings[1]) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  rng.shuffle(candidates);
  const roomCount = Math.min(preset.roomCount, candidates.length);

  for (let i = 0; i < roomCount; i++) {
    const { row: outerRow, col: outerCol } = candidates[i];
    const openings = getOpenDirections(outerGrid, outerRow, outerCol);

    const subStart = borderPositionForDirection(openings[0], roomSubSize);
    const subFinish = borderPositionForDirection(openings[1], roomSubSize);
    const derivedSeed = seed + i * 997;
    const subMaze = generateMaze({
      ageRange,
      seed: derivedSeed,
      algorithm: 'recursive-backtracker',
      gridWidth: roomSubSize,
      gridHeight: roomSubSize,
    });
    const subGrid = subMaze.grid;

    subGrid.getCell(subStart.row, subStart.col).removeWall(openings[0]);
    subGrid.getCell(subFinish.row, subFinish.col).removeWall(openings[1]);

    const origStart = subGrid.start;
    const origFinish = subGrid.finish;
    subGrid.start = subStart;
    subGrid.finish = subFinish;
    const solution = solveMaze(subGrid);
    subGrid.start = origStart;
    subGrid.finish = origFinish;

    if (!solution || !solution.solved) throw new Error(`Squares: sub-maze at ${outerRow},${outerCol} not solvable`);
    if (!validateMaze(subGrid)) throw new Error(`Squares: sub-maze at ${outerRow},${outerCol} failed validation`);

    const roomCell = new RoomCell();
    roomCell.outerRow = outerRow;
    roomCell.outerCol = outerCol;
    roomCell.outerSize = 1;
    roomCell.openings = openings;
    const [d0, d1] = openings;
    roomCell.openingCells = [
      { row: outerRow + DIRECTION_OFFSETS[d0][0], col: outerCol + DIRECTION_OFFSETS[d0][1] },
      { row: outerRow + DIRECTION_OFFSETS[d1][0], col: outerCol + DIRECTION_OFFSETS[d1][1] },
    ];
    roomCell.subGrid = subGrid;
    roomCell.subStart = subStart;
    roomCell.subFinish = subFinish;
    roomCell.subSolutionPath = solution.path;
    roomsGrid.roomCells.set(`${outerRow},${outerCol}`, roomCell);
  }

  return {
    layout: 'squares',
    outerGrid,
    roomsGrid,
    start: outerGrid.start,
    finish: outerGrid.finish,
    seed,
    ageRange,
    preset: { ...preset, cellSize: effectiveCellSize },
    algorithm: algo,
    rows: outerGrid.rows,
    cols: outerGrid.cols,
  };
}
