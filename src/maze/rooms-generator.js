/**
 * Squares style: generate outer maze + embedded room sub-mazes.
 * Outer maze is a perfect grid maze; room cells are 2-passage cells with interior sub-mazes.
 */

import { DIRECTIONS } from './grid.js';
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

  const rng = createRng(seed);
  const candidates = [];
  for (let r = 0; r < outerGrid.rows; r++) {
    for (let c = 0; c < outerGrid.cols; c++) {
      if (roomsGrid.openPassageCount(r, c) === 2) candidates.push({ row: r, col: c });
    }
  }
  rng.shuffle(candidates);
  const roomCount = Math.min(preset.roomCount, candidates.length);

  for (let i = 0; i < roomCount; i++) {
    const { row: outerRow, col: outerCol } = candidates[i];
    const openings = getOpenDirections(outerGrid, outerRow, outerCol);
    if (openings.length !== 2) continue;

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
    roomCell.openings = openings;
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
