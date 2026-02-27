/**
 * Maze adapters: normalize grid, organic, and polar mazes to a single contract
 * for the solver. Contract: getStart, getFinish, getNeighbors(state), key(state), optional getTotalCells.
 * getNeighbors must return deterministic order (see DEFERRED_IDEAS).
 */

import { DIRECTIONS, DIRECTION_OFFSETS } from './grid.js';
import { POLAR_DIRECTIONS } from './polarGrid.js';

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
 * Polar adapter. getNeighbors returns { ring, wedge } in fixed POLAR_DIRECTIONS order (deterministic).
 *
 * @param {object} maze - Maze object with layout 'polar', polarGrid, start, finish
 * @returns {object} Adapter
 */
export function polarAdapter(maze) {
  const grid = maze.polarGrid;
  const start = maze.start ?? grid.start;
  const finish = maze.finish ?? grid.finish;

  return {
    getStart() {
      return { ring: start.ring, wedge: start.wedge };
    },
    getFinish() {
      return { ring: finish.ring, wedge: finish.wedge };
    },
    getNeighbors(state) {
      const { ring, wedge } = state;
      const cell = grid.getCell(ring, wedge);
      const out = [];
      for (const dir of Object.values(POLAR_DIRECTIONS)) {
        const neighbors = grid.getNeighbor(ring, wedge, dir);
        for (let i = 0; i < neighbors.length; i++) {
          if (cell.hasWall(dir, i)) continue;
          out.push({ ring: neighbors[i].ring, wedge: neighbors[i].wedge });
        }
      }
      return out;
    },
    key(state) {
      return `${state.ring},${state.wedge}`;
    },
    getTotalCells() {
      return grid.getTotalCells();
    },
  };
}

/**
 * Return the adapter for the given maze. Default layout is 'grid'.
 *
 * @param {object} mazeOrGrid - Full maze object (with layout, grid/graph/polarGrid, start/finish) or MazeGrid
 * @returns {object} Adapter implementing the solver contract
 */
export function getAdapterForMaze(mazeOrGrid) {
  if (mazeOrGrid.layout === 'organic') {
    return organicAdapter(mazeOrGrid);
  }
  if (mazeOrGrid.layout === 'polar') {
    return polarAdapter(mazeOrGrid);
  }
  return gridAdapter(mazeOrGrid);
}
