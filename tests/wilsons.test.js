/**
 * Wilson's algorithm: determinism and connectivity with grid and polar adapters.
 */

import { describe, it, expect } from 'vitest';
import { runWilsons } from '../src/maze/wilsons.js';
import { createRng } from '../src/utils/rng.js';
import { MazeGrid, DIRECTIONS } from '../src/maze/grid.js';
import { PolarGrid, POLAR_DIRECTIONS } from '../src/maze/polarGrid.js';

function countReachableGrid(grid) {
  const visited = new Set();
  const stack = [{ row: 0, col: 0 }];
  visited.add('0,0');
  while (stack.length > 0) {
    const { row, col } = stack.pop();
    for (const dir of Object.values(DIRECTIONS)) {
      const [dr, dc] = { [DIRECTIONS.TOP]: [-1, 0], [DIRECTIONS.RIGHT]: [0, 1], [DIRECTIONS.BOTTOM]: [1, 0], [DIRECTIONS.LEFT]: [0, -1] }[dir];
      const nr = row + dr;
      const nc = col + dc;
      const c = grid.getCell(row, col);
      const n = grid.getCell(nr, nc);
      if (!n || !c || c.hasWall(dir)) continue;
      const key = `${nr},${nc}`;
      if (!visited.has(key)) {
        visited.add(key);
        stack.push({ row: nr, col: nc });
      }
    }
  }
  return visited.size;
}

function countReachablePolar(grid) {
  const key = (r, w) => `${r},${w}`;
  const visited = new Set([key(0, 0)]);
  const stack = [{ ring: 0, wedge: 0 }];
  while (stack.length > 0) {
    const { ring, wedge } = stack.pop();
    const cell = grid.getCell(ring, wedge);
    for (const dir of Object.values(POLAR_DIRECTIONS)) {
      const neighbors = grid.getNeighbor(ring, wedge, dir);
      for (let i = 0; i < neighbors.length; i++) {
        const hasWall = dir === POLAR_DIRECTIONS.OUTWARD ? cell.hasWall(dir, i) : cell.hasWall(dir);
        if (hasWall) continue;
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

describe('runWilsons', () => {
  it('produces a connected maze on a small grid (3x3)', () => {
    const grid = new MazeGrid(3, 3);
    const adapter = {
      getAllKeys() {
        const out = [];
        for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) out.push(`${r},${c}`);
        return out;
      },
      getAdjacentKeys(key) {
        const [r, c] = key.split(',').map(Number);
        const out = [];
        for (const dir of Object.values(DIRECTIONS)) {
          const [dr, dc] = { [DIRECTIONS.TOP]: [-1, 0], [DIRECTIONS.RIGHT]: [0, 1], [DIRECTIONS.BOTTOM]: [1, 0], [DIRECTIONS.LEFT]: [0, -1] }[dir];
          const n = grid.getNeighbor(r, c, dir);
          if (n) out.push(`${n.row},${n.col}`);
        }
        return out;
      },
      removeWallBetween(k1, k2) {
        const [r1, c1] = k1.split(',').map(Number);
        const [r2, c2] = k2.split(',').map(Number);
        grid.removeWallBetween(grid.getCell(r1, c1), grid.getCell(r2, c2));
      },
      markVisited(key) {
        const [r, c] = key.split(',').map(Number);
        grid.getCell(r, c).markVisited();
      },
      isVisited(key) {
        const [r, c] = key.split(',').map(Number);
        return grid.getCell(r, c).isVisited();
      },
    };
    runWilsons(adapter, createRng(42));
    const total = grid.rows * grid.cols;
    const reached = countReachableGrid(grid);
    expect(reached).toBe(total);
  });

  it('produces a connected maze on a small polar grid', () => {
    const grid = new PolarGrid(2, 4);
    const adapter = {
      getAllKeys() {
        const out = [];
        for (let r = 0; r < grid.rings; r++) {
          const W = grid.wedgesAtRing(r);
          for (let w = 0; w < W; w++) out.push(`${r},${w}`);
        }
        return out;
      },
      getAdjacentKeys(key) {
        const [r, w] = key.split(',').map(Number);
        const out = [];
        for (const dir of Object.values(POLAR_DIRECTIONS)) {
          const neighbors = grid.getNeighbor(r, w, dir);
          for (const n of neighbors) {
            const nKey = `${n.ring},${n.wedge}`;
            if (out.includes(nKey)) continue;
            let symmetric = false;
            for (const d of Object.values(POLAR_DIRECTIONS)) {
              const back = grid.getNeighbor(n.ring, n.wedge, d);
              if (back.some((b) => b.ring === r && b.wedge === w)) {
                symmetric = true;
                break;
              }
            }
            if (symmetric) out.push(nKey);
          }
        }
        return out;
      },
      removeWallBetween(k1, k2) {
        const [r1, w1] = k1.split(',').map(Number);
        const [r2, w2] = k2.split(',').map(Number);
        grid.removeWallBetween(grid.getCell(r1, w1), grid.getCell(r2, w2));
      },
      markVisited(key) {
        const [r, w] = key.split(',').map(Number);
        grid.getCell(r, w).markVisited();
      },
      isVisited(key) {
        const [r, w] = key.split(',').map(Number);
        return grid.getCell(r, w).isVisited();
      },
    };
    runWilsons(adapter, createRng(100));
    const total = grid.getTotalCells();
    const reached = countReachablePolar(grid);
    expect(reached).toBe(total);
  });

  it('is deterministic: same seed gives same grid maze', () => {
    const build = (seed) => {
      const grid = new MazeGrid(4, 4);
      const adapter = {
        getAllKeys() {
          const out = [];
          for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) out.push(`${r},${c}`);
          return out;
        },
        getAdjacentKeys(key) {
          const [r, c] = key.split(',').map(Number);
          const out = [];
          for (const dir of Object.values(DIRECTIONS)) {
            const n = grid.getNeighbor(r, c, dir);
            if (n) out.push(`${n.row},${n.col}`);
          }
          return out;
        },
        removeWallBetween(k1, k2) {
          const [r1, c1] = k1.split(',').map(Number);
          const [r2, c2] = k2.split(',').map(Number);
          grid.removeWallBetween(grid.getCell(r1, c1), grid.getCell(r2, c2));
        },
        markVisited(key) {
          const [r, c] = key.split(',').map(Number);
          grid.getCell(r, c).markVisited();
        },
        isVisited(key) {
          const [r, c] = key.split(',').map(Number);
          return grid.getCell(r, c).isVisited();
        },
      };
      runWilsons(adapter, createRng(seed));
      return grid;
    };
    const g1 = build(123);
    const g2 = build(123);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell1 = g1.getCell(r, c);
        const cell2 = g2.getCell(r, c);
        for (const d of Object.values(DIRECTIONS)) {
          expect(cell1.hasWall(d)).toBe(cell2.hasWall(d));
        }
      }
    }
  });
});
