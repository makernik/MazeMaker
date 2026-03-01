/**
 * RoomsGrid and RoomCell — data model for Squares style (embedded rooms).
 * Outer maze is a MazeGrid; room cells are a subset of cells with exactly 2 open passages.
 */

import { DIRECTIONS } from './grid.js';

/**
 * A single room cell: outer position (top-left of block), block size, two openings, and the interior sub-maze.
 * For roomOuterSize === 1, block is (outerRow, outerCol); for > 1 the room occupies outerSize×outerSize cells.
 */
export class RoomCell {
  constructor() {
    /** @type {number} row in outer grid (top-left of block) */
    this.outerRow = 0;
    /** @type {number} col in outer grid (top-left of block) */
    this.outerCol = 0;
    /** @type {number} outer grid cells per side of this room (1 = single cell) */
    this.outerSize = 1;
    /** @type {number[]} the 2 open passage directions (DIRECTIONS values) at the room boundary; for 1×1 only */
    this.openings = [];
    /** @type {{ row: number, col: number }[]} the 2 passage cells that are this room's openings (for solver/drawing) */
    this.openingCells = [];
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
    /** @type {Map<string, RoomCell>} key 'row,col' (top-left of block for outerSize > 1) */
    this.roomCells = new Map();
    /** @type {number} cells per side in each sub-maze */
    this.roomSubSize = 0;
    /** @type {number} outer grid cells per side of each room block (1 = one cell per room) */
    this.roomOuterSize = 1;
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  isRoomCell(row, col) {
    if (this.roomOuterSize === 1) return this.roomCells.has(`${row},${col}`);
    for (const room of this.roomCells.values()) {
      if (row >= room.outerRow && row < room.outerRow + room.outerSize &&
          col >= room.outerCol && col < room.outerCol + room.outerSize) return true;
    }
    return false;
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {RoomCell|undefined}
   */
  getRoomCell(row, col) {
    if (this.roomOuterSize === 1) return this.roomCells.get(`${row},${col}`);
    for (const room of this.roomCells.values()) {
      if (row >= room.outerRow && row < room.outerRow + room.outerSize &&
          col >= room.outerCol && col < room.outerCol + room.outerSize) return room;
    }
    return undefined;
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
