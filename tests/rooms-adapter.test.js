/**
 * Squares adapter and solver: outer path, isPerfectMaze.
 */

import { describe, it, expect } from 'vitest';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import { solveMaze, isPerfectMaze } from '../src/maze/solver.js';
import { getDifficultyPreset } from '../src/utils/constants.js';

describe('squares adapter / solver', () => {
  it('solveMaze finds outer path', () => {
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 100 });
    const solution = solveMaze(maze);
    expect(solution).not.toBeNull();
    expect(solution.solved).toBe(true);
    expect(Array.isArray(solution.path)).toBe(true);
    expect(solution.path.length).toBeGreaterThanOrEqual(2);
    expect(solution.path[0]).toEqual(maze.start);
    expect(solution.path[solution.path.length - 1]).toEqual(maze.finish);
  });

  it('isPerfectMaze: all passage cells reachable when 1×1; reachable ≤ total when room blocks', () => {
    const preset = getDifficultyPreset('6-8');
    const maze = generateSquaresMaze({ ageRange: '6-8', seed: 101 });
    const result = isPerfectMaze(maze);
    expect(result.totalCells).toBe(maze.outerGrid.rows * maze.outerGrid.cols);
    expect(result.reachableCells).toBeLessThanOrEqual(result.totalCells);
    if ((preset.roomOuterSize ?? 1) === 1) {
      expect(result.allCellsReachable).toBe(true);
      expect(result.isPerfect).toBe(true);
      expect(result.reachableCells).toBe(result.totalCells);
    } else {
      expect(result.reachableCells).toBeGreaterThan(0);
    }
  });
});
