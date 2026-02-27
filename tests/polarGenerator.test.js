/**
 * Polar generator: determinism, connectivity, entrance/exit.
 */

import { describe, it, expect } from 'vitest';
import { generatePolarMaze, generatePolarMazes } from '../src/maze/polarGenerator.js';
import { POLAR_DIRECTIONS } from '../src/maze/polarGrid.js';

/** Count cells reachable from (0,0) by following open walls (no solver adapter yet). */
function countReachableFrom(grid) {
  const key = (r, w) => `${r},${w}`;
  const visited = new Set([key(0, 0)]);
  let stack = [{ ring: 0, wedge: 0 }];
  while (stack.length > 0) {
    const { ring, wedge } = stack.pop();
    const cell = grid.getCell(ring, wedge);
    for (const dir of Object.values(POLAR_DIRECTIONS)) {
      const neighbors = grid.getNeighbor(ring, wedge, dir);
      for (let i = 0; i < neighbors.length; i++) {
        if (cell.hasWall(dir, i)) continue;
        const n = neighbors[i];
        const k = key(n.ring, n.wedge);
        if (!visited.has(k)) {
          visited.add(k);
          stack.push(n);
        }
      }
    }
  }
  return visited.size;
}

describe('generatePolarMaze', () => {
  it('returns maze with layout polar and polarGrid', () => {
    const maze = generatePolarMaze({ ageRange: '4-5', seed: 100 });
    expect(maze.layout).toBe('polar');
    expect(maze.polarGrid).toBeDefined();
    expect(maze.seed).toBe(100);
    expect(maze.ageRange).toBe('4-5');
    expect(maze.preset).toBeDefined();
    expect(maze.algorithm).toBe('prim');
    expect(maze.start.ring).toBe(maze.polarGrid.maxRing);
    expect(maze.start.wedge).toBe(Math.floor(maze.polarGrid.wedges / 4));
    expect(maze.finish).toEqual({ ring: 0, wedge: 0 });
  });

  it('is deterministic for same seed', () => {
    const m1 = generatePolarMaze({ ageRange: '4-5', seed: 999 });
    const m2 = generatePolarMaze({ ageRange: '4-5', seed: 999 });
    expect(m1.polarGrid.rings).toBe(m2.polarGrid.rings);
    expect(m1.polarGrid.wedges).toBe(m2.polarGrid.wedges);
    const total = m1.polarGrid.getTotalCells();
    let sameWalls = 0;
    for (let r = 0; r < m1.polarGrid.rings; r++) {
      const count = r === 0 ? 1 : m1.polarGrid.wedges;
      for (let w = 0; w < count; w++) {
        const c1 = m1.polarGrid.getCell(r, w);
        const c2 = m2.polarGrid.getCell(r, w);
        for (const dir of [0, 1, 2, 3]) {
          if (c1.hasWall(dir) === c2.hasWall(dir)) sameWalls++;
        }
      }
    }
    expect(sameWalls).toBe(total * 4);
  });

  it('all cells reachable from center (perfect maze)', () => {
    const maze = generatePolarMaze({ ageRange: '4-5', seed: 100 });
    const total = maze.polarGrid.getTotalCells();
    const reached = countReachableFrom(maze.polarGrid);
    expect(reached).toBe(total);
  });

  it('entrance and exit are open', () => {
    const maze = generatePolarMaze({ ageRange: '4-5', seed: 200 });
    const topW = Math.floor(maze.polarGrid.wedges / 4);
    const startCell = maze.polarGrid.getCell(maze.polarGrid.maxRing, topW);
    expect(startCell.hasWall(POLAR_DIRECTIONS.OUTWARD)).toBe(false);
    const center = maze.polarGrid.getCell(0, 0);
    const firstRing = maze.polarGrid.getCell(1, 0);
    expect(center.hasWall(POLAR_DIRECTIONS.OUTWARD)).toBe(false);
    expect(firstRing.hasWall(POLAR_DIRECTIONS.INWARD)).toBe(false);
  });
});

describe('generatePolarMazes', () => {
  it('returns array of quantity mazes with sequential seeds', () => {
    const mazes = generatePolarMazes({ ageRange: '4-5', quantity: 3, baseSeed: 50 });
    expect(mazes).toHaveLength(3);
    expect(mazes[0].seed).toBe(50);
    expect(mazes[1].seed).toBe(51);
    expect(mazes[2].seed).toBe(52);
  });
});

describe('variable wedges', () => {
  it('generates perfect maze with wedge multiplier 2 (6-8 preset)', () => {
    const maze = generatePolarMaze({ ageRange: '6-8', seed: 300 });
    const total = maze.polarGrid.getTotalCells();
    const reached = countReachableFrom(maze.polarGrid);
    expect(reached).toBe(total);
    expect(maze.polarGrid.wedgesAtRing(1)).toBe(6);
    expect(maze.polarGrid.wedgesAtRing(maze.polarGrid.maxRing)).toBeGreaterThanOrEqual(6);
  });
});
