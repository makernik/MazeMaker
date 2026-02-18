/**
 * Maze Solver - BFS Pathfinder
 *
 * Validates that a maze has exactly one solution using BFS (Breadth-First Search).
 * Supports grid and organic mazes via maze adapters and a pluggable algorithm registry (see solver-adapters.js, solver-algorithms.js).
 */

import { DIRECTIONS, DIRECTION_OFFSETS } from './grid.js';
import { getAdapterForMaze } from './solver-adapters.js';
import { getSolver } from './solver-algorithms.js';

/**
 * Solve a maze (grid or organic). Uses adapter + selected algorithm (default 'bfs').
 *
 * @param {object} mazeOrGrid - Maze object (with layout, grid or graph, start/finish) or MazeGrid
 * @param {object} [options] - Optional. algorithm: solver id (default 'bfs').
 * @returns {object|null} Solution: { path, length, solved }. Grid path is [{row,col}]; organic path is node ids.
 */
export function solveMaze(mazeOrGrid, options = {}) {
  const adapter = getAdapterForMaze(mazeOrGrid);
  const algorithmId = options.algorithm ?? 'bfs';
  const solve = getSolver(algorithmId);
  return solve(adapter);
}

/**
 * Validate that a maze is solvable. Accepts full maze object or grid.
 *
 * @param {object} mazeOrGrid - Maze object or MazeGrid
 * @param {object} [options] - Optional. algorithm: solver id (default 'bfs').
 * @returns {boolean}
 */
export function validateMaze(mazeOrGrid, options = {}) {
  const solution = solveMaze(mazeOrGrid, options);
  return solution !== null && solution.solved;
}

/**
 * Check if a maze is a "perfect" maze (single solution): all cells reachable from start.
 * Works for grid and organic (and any topology with an adapter that has getTotalCells).
 *
 * @param {object} mazeOrGrid - Maze object or MazeGrid
 * @returns {object} { isPerfect, reachableCells, totalCells, allCellsReachable }
 */
export function isPerfectMaze(mazeOrGrid) {
  const adapter = getAdapterForMaze(mazeOrGrid);
  const totalCells = typeof adapter.getTotalCells === 'function' ? adapter.getTotalCells() : null;
  if (totalCells == null) {
    return { isPerfect: false, reachableCells: 0, totalCells: 0, allCellsReachable: false };
  }

  const start = adapter.getStart();
  const visited = new Set([adapter.key(start)]);
  const queue = [start];

  while (queue.length > 0) {
    const state = queue.shift();
    for (const nextState of adapter.getNeighbors(state)) {
      const k = adapter.key(nextState);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(nextState);
    }
  }

  const reachableCells = visited.size;
  const isPerfect = reachableCells === totalCells;
  return {
    isPerfect,
    reachableCells,
    totalCells,
    allCellsReachable: isPerfect,
  };
}

/**
 * Get solution path as an array of directions (grid only).
 * For non-grid layouts (e.g. organic) returns [].
 *
 * @param {object[]|number[]} path - Array of {row, col} (grid) or node ids (organic)
 * @param {string} [layout] - 'grid' or 'organic'; if omitted, inferred from path (has row/col = grid).
 * @returns {string[]} Array of direction names ('up','right','down','left') or [] for non-grid
 */
export function pathToDirections(path, layout) {
  if (!path || path.length < 2) return [];
  const isGridPath = layout !== 'organic' && typeof path[0] === 'object' && 'row' in path[0] && 'col' in path[0];
  if (!isGridPath) return [];

  const directionNames = {
    [DIRECTIONS.TOP]: 'up',
    [DIRECTIONS.RIGHT]: 'right',
    [DIRECTIONS.BOTTOM]: 'down',
    [DIRECTIONS.LEFT]: 'left',
  };

  const directions = [];

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    const dRow = curr.row - prev.row;
    const dCol = curr.col - prev.col;

    let direction;
    if (dRow === -1) direction = DIRECTIONS.TOP;
    else if (dRow === 1) direction = DIRECTIONS.BOTTOM;
    else if (dCol === -1) direction = DIRECTIONS.LEFT;
    else if (dCol === 1) direction = DIRECTIONS.RIGHT;

    directions.push(directionNames[direction]);
  }

  return directions;
}
