/**
 * Maze adapters: normalize grid and organic (and future polar) mazes to a single contract
 * for the solver. Contract: getStart, getFinish, getNeighbors(state), key(state), optional getTotalCells.
 * getNeighbors must return deterministic order (see DEFERRED_IDEAS).
 */

import { DIRECTIONS, DIRECTION_OFFSETS } from './grid.js';

/**
 * Grid adapter. getNeighbors uses fixed DIRECTIONS order (deterministic).
 *
 * @param {object} mazeOrGrid - Maze object with .grid or raw MazeGrid
 * @returns {object} Adapter
 */
export function gridAdapter(mazeOrGrid) {
  const grid = mazeOrGrid.grid ?? mazeOrGrid;
  const start = grid.start;
  const finish = grid.finish;

  return {
    getStart() {
      return { row: start.row, col: start.col };
    },
    getFinish() {
      return { row: finish.row, col: finish.col };
    },
    getNeighbors(state) {
      const { row, col } = state;
      const cell = grid.getCell(row, col);
      const out = [];
      for (const direction of Object.values(DIRECTIONS)) {
        if (cell.hasWall(direction)) continue;
        const [dRow, dCol] = DIRECTION_OFFSETS[direction];
        const newRow = row + dRow;
        const newCol = col + dCol;
        if (!grid.isValidPosition(newRow, newCol)) continue;
        out.push({ row: newRow, col: newCol });
      }
      return out;
    },
    key(state) {
      return `${state.row},${state.col}`;
    },
    getTotalCells() {
      return grid.rows * grid.cols;
    },
  };
}

/**
 * Organic adapter. getNeighbors returns neighbor ids in graph order (deterministic per graph structure).
 *
 * @param {object} maze - Maze object with layout 'organic', graph, startId, finishId
 * @returns {object} Adapter
 */
export function organicAdapter(maze) {
  const { graph, startId, finishId } = maze;

  return {
    getStart() {
      return startId;
    },
    getFinish() {
      return finishId;
    },
    getNeighbors(state) {
      const id = typeof state === 'number' ? state : state;
      const neighbors = graph.getNeighbors(id);
      const out = [];
      for (const nid of neighbors) {
        if (graph.hasWall(id, nid)) continue;
        out.push(nid);
      }
      return out;
    },
    key(state) {
      const id = typeof state === 'number' ? state : state;
      return String(id);
    },
    getTotalCells() {
      return graph.nodes.length;
    },
  };
}

/**
 * Return the adapter for the given maze. Default layout is 'grid'.
 *
 * @param {object} mazeOrGrid - Full maze object (with layout, grid/graph, start/finish) or MazeGrid
 * @returns {object} Adapter implementing the solver contract
 */
export function getAdapterForMaze(mazeOrGrid) {
  if (mazeOrGrid.layout === 'organic') {
    return organicAdapter(mazeOrGrid);
  }
  return gridAdapter(mazeOrGrid);
}
