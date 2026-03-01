/**
 * RoomsGrid and RoomCell — data model for Squares style (embedded rooms).
 * Outer maze is a MazeGrid; room cells are a subset of cells with exactly 2 open passages.
 */

import { DIRECTIONS } from './grid.js';

/**
 * A single room cell: outer position, its two openings, and the interior sub-maze.
 */
export class RoomCell {
  constructor() {
    /** @type {number} row in outer grid */
    this.outerRow = 0;
    /** @type {number} col in outer grid */
    this.outerCol = 0;
    /** @type {number[]} the 2 open passage directions (DIRECTIONS values) in the outer maze */
    this.openings = [];
    /** @type {import('./grid.js').MazeGrid} the room's interior maze */
    this.subGrid = null;
    /** @type {{ row: number, col: number }} in subGrid — aligned with openings[0] */
    this.subStart = null;
    /** @type {{ row: number, col: number }} in subGrid — aligned with openings[1] */
    this.subFinish = null;
    /** @type {{ row: number, col: number }[]} BFS path through sub-maze (stored at gen time) */
    this.subSolutionPath = [];
  }
}

/**
 * Wrapper around an outer MazeGrid plus a map of room cells (Squares style).
 */
export class RoomsGrid {
  constructor() {
    /** @type {import('./grid.js').MazeGrid} unmodified outer maze */
    this.outerGrid = null;
    /** @type {Map<string, RoomCell>} key 'row,col' */
    this.roomCells = new Map();
    /** @type {number} cells per side in each sub-maze */
    this.roomSubSize = 0;
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  isRoomCell(row, col) {
    return this.roomCells.has(`${row},${col}`);
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {RoomCell|undefined}
   */
  getRoomCell(row, col) {
    return this.roomCells.get(`${row},${col}`);
  }

  /**
   * Number of open passages (no wall) at this cell in the outer grid.
   * @param {number} row
   * @param {number} col
   * @returns {number} 0–4
   */
  openPassageCount(row, col) {
    const grid = this.outerGrid;
    if (!grid || !grid.isValidPosition(row, col)) return 0;
    const cell = grid.getCell(row, col);
    let count = 0;
    for (const dir of Object.values(DIRECTIONS)) {
      if (!cell.hasWall(dir)) count++;
    }
    return count;
  }
}
