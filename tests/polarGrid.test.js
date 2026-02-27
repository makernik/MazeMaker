/**
 * Polar grid: construction, neighbors, walls, entrance/exit.
 */

import { describe, it, expect } from 'vitest';
import { PolarGrid, PolarCell, POLAR_DIRECTIONS } from '../src/maze/polarGrid.js';

describe('PolarGrid', () => {
  it('constructs with at least 2 rings and 2 wedges', () => {
    const grid = new PolarGrid(3, 4);
    expect(grid.rings).toBe(3);
    expect(grid.wedges).toBe(4);
    expect(grid.maxRing).toBe(2);
  });

  it('throws for invalid rings or wedges', () => {
    expect(() => new PolarGrid(1, 4)).toThrow();
    expect(() => new PolarGrid(3, 1)).toThrow();
  });

  it('ring 0 has one cell, other rings have wedge-count cells', () => {
    const grid = new PolarGrid(3, 4);
    expect(grid.getCell(0, 0)).toBeInstanceOf(PolarCell);
    expect(grid.getCell(0, 1)).toBeNull();
    expect(grid.getCell(1, 0)).toBeInstanceOf(PolarCell);
    expect(grid.getCell(1, 3)).toBeInstanceOf(PolarCell);
    expect(grid.getCell(1, 4)).toBeNull();
    expect(grid.getCell(2, 0)).toBeInstanceOf(PolarCell);
  });

  it('start is outer ring at top wedge, finish is center (0,0)', () => {
    const grid = new PolarGrid(4, 6);
    expect(grid.start.ring).toBe(3);
    expect(grid.start.wedge).toBe(Math.floor(6 / 4));
    expect(grid.finish).toEqual({ ring: 0, wedge: 0 });
  });

  it('getTotalCells returns 1 + (rings-1)*wedges', () => {
    expect(new PolarGrid(3, 4).getTotalCells()).toBe(1 + 2 * 4);
    expect(new PolarGrid(4, 6).getTotalCells()).toBe(1 + 3 * 6);
  });

  it('center has only OUTWARD neighbor (1,0)', () => {
    const grid = new PolarGrid(3, 4);
    const outward = grid.getNeighbor(0, 0, POLAR_DIRECTIONS.OUTWARD);
    expect(outward).toHaveLength(1);
    expect(outward[0]).toEqual({ ring: 1, wedge: 0 });
    expect(grid.getNeighbors(0, 0)).toHaveLength(0);
  });

  it('inner ring cell has INWARD, OUTWARD, CW, CCW neighbors', () => {
    const grid = new PolarGrid(3, 4);
    const inw = grid.getNeighbor(1, 1, POLAR_DIRECTIONS.INWARD);
    const outw = grid.getNeighbor(1, 1, POLAR_DIRECTIONS.OUTWARD);
    const cw = grid.getNeighbor(1, 1, POLAR_DIRECTIONS.CW);
    const ccw = grid.getNeighbor(1, 1, POLAR_DIRECTIONS.CCW);
    expect(inw).toContainEqual({ ring: 0, wedge: 0 });
    expect(outw).toContainEqual({ ring: 2, wedge: 1 });
    expect(cw).toContainEqual({ ring: 1, wedge: 2 });
    expect(ccw).toContainEqual({ ring: 1, wedge: 0 });
    expect(grid.getNeighbors(1, 1)).toHaveLength(0);
  });

  it('removeWallBetween clears both sides', () => {
    const grid = new PolarGrid(2, 4);
    const c0 = grid.getCell(0, 0);
    const c1 = grid.getCell(1, 0);
    expect(c0.hasWall(POLAR_DIRECTIONS.OUTWARD, 0)).toBe(true);
    expect(c1.hasWall(POLAR_DIRECTIONS.INWARD)).toBe(true);
    grid.removeWallBetween(c0, c1);
    expect(c0.hasWall(POLAR_DIRECTIONS.OUTWARD, 0)).toBe(false);
    expect(c1.hasWall(POLAR_DIRECTIONS.INWARD)).toBe(false);
  });

  it('openEntrance opens outer boundary at start (top wedge)', () => {
    const grid = new PolarGrid(2, 4);
    grid.openEntrance();
    const topW = Math.floor(4 / 4);
    expect(grid.getCell(grid.maxRing, topW).hasWall(POLAR_DIRECTIONS.OUTWARD)).toBe(false);
  });

  it('openExit opens passage from ring 1 into center room', () => {
    const grid = new PolarGrid(2, 4);
    grid.openExit();
    expect(grid.getCell(0, 0).hasWall(POLAR_DIRECTIONS.OUTWARD, 0)).toBe(false);
    expect(grid.getCell(1, 0).hasWall(POLAR_DIRECTIONS.INWARD)).toBe(false);
  });

  it('variable wedges: outer rings have 2× wedge count when multiplier is 2', () => {
    const grid = new PolarGrid(3, 4, 2);
    expect(grid.wedgesAtRing(0)).toBe(1);
    expect(grid.wedgesAtRing(1)).toBe(4);
    expect(grid.wedgesAtRing(2)).toBe(8);
    expect(grid.getTotalCells()).toBe(1 + 4 + 8);
    const out = grid.getNeighbor(1, 0, POLAR_DIRECTIONS.OUTWARD);
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ ring: 2, wedge: 0 });
    expect(out).toContainEqual({ ring: 2, wedge: 1 });
  });
});
