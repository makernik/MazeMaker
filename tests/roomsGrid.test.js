/**
 * RoomsGrid and RoomCell — unit tests for Squares style data model.
 */

import { describe, it, expect } from 'vitest';
import { RoomCell, RoomsGrid } from '../src/maze/roomsGrid.js';
import { MazeGrid, DIRECTIONS } from '../src/maze/grid.js';

describe('RoomCell', () => {
  it('creates with default properties', () => {
    const rc = new RoomCell();
    expect(rc.outerRow).toBe(0);
    expect(rc.outerCol).toBe(0);
    expect(rc.openings).toEqual([]);
    expect(rc.subGrid).toBe(null);
    expect(rc.subStart).toBe(null);
    expect(rc.subFinish).toBe(null);
    expect(rc.subSolutionPath).toEqual([]);
  });

  it('accepts and retains assigned properties', () => {
    const rc = new RoomCell();
    rc.outerRow = 2;
    rc.outerCol = 3;
    rc.openings = [DIRECTIONS.TOP, DIRECTIONS.BOTTOM];
    expect(rc.outerRow).toBe(2);
    expect(rc.outerCol).toBe(3);
    expect(rc.openings).toEqual([DIRECTIONS.TOP, DIRECTIONS.BOTTOM]);
  });
});

describe('RoomsGrid', () => {
  it('creates with empty roomCells and null outerGrid', () => {
    const rg = new RoomsGrid();
    expect(rg.outerGrid).toBe(null);
    expect(rg.roomCells.size).toBe(0);
    expect(rg.roomSubSize).toBe(0);
  });

  it('isRoomCell returns false when no rooms', () => {
    const rg = new RoomsGrid();
    rg.outerGrid = new MazeGrid(4, 4);
    expect(rg.isRoomCell(0, 0)).toBe(false);
    expect(rg.isRoomCell(1, 1)).toBe(false);
  });

  it('isRoomCell returns true for registered room cells', () => {
    const rg = new RoomsGrid();
    rg.outerGrid = new MazeGrid(4, 4);
    const rc = new RoomCell();
    rc.outerRow = 1;
    rc.outerCol = 2;
    rg.roomCells.set('1,2', rc);
    expect(rg.isRoomCell(1, 2)).toBe(true);
    expect(rg.isRoomCell(0, 0)).toBe(false);
  });

  it('getRoomCell returns the room cell for registered key', () => {
    const rg = new RoomsGrid();
    rg.outerGrid = new MazeGrid(4, 4);
    const rc = new RoomCell();
    rc.outerRow = 2;
    rc.outerCol = 3;
    rg.roomCells.set('2,3', rc);
    expect(rg.getRoomCell(2, 3)).toBe(rc);
    expect(rg.getRoomCell(0, 0)).toBeUndefined();
  });

  it('openPassageCount returns 0 when outerGrid is null', () => {
    const rg = new RoomsGrid();
    expect(rg.openPassageCount(0, 0)).toBe(0);
  });

  it('openPassageCount returns 0 for invalid position', () => {
    const rg = new RoomsGrid();
    rg.outerGrid = new MazeGrid(3, 3);
    expect(rg.openPassageCount(-1, 0)).toBe(0);
    expect(rg.openPassageCount(0, 10)).toBe(0);
  });

  it('openPassageCount returns 0 for cell with all walls intact', () => {
    const rg = new RoomsGrid();
    rg.outerGrid = new MazeGrid(3, 3);
    expect(rg.openPassageCount(1, 1)).toBe(0);
  });

  it('openPassageCount counts open passages after walls removed', () => {
    const grid = new MazeGrid(3, 3);
    const cell = grid.getCell(1, 1);
    cell.removeWall(DIRECTIONS.TOP);
    cell.removeWall(DIRECTIONS.BOTTOM);
    const rg = new RoomsGrid();
    rg.outerGrid = grid;
    expect(rg.openPassageCount(1, 1)).toBe(2);
    expect(rg.openPassageCount(0, 0)).toBe(0);
  });

  it('openPassageCount returns 4 when all walls removed', () => {
    const grid = new MazeGrid(2, 2);
    const cell = grid.getCell(0, 0);
    for (const d of Object.values(DIRECTIONS)) {
      cell.removeWall(d);
    }
    const rg = new RoomsGrid();
    rg.outerGrid = grid;
    expect(rg.openPassageCount(0, 0)).toBe(4);
  });
});
