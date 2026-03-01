/**
 * Squares maze generator: determinism, room count, solvability, cellSize coercion.
 */

import { describe, it, expect } from 'vitest';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import { validateMaze } from '../src/maze/solver.js';
import { getDifficultyPreset, MIN_CELL_SIZE_SQUARES_PT } from '../src/utils/constants.js';

describe('generateSquaresMaze', () => {
  it('returns maze with layout squares and required shape', () => {
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 100 });
    expect(maze.layout).toBe('squares');
    expect(maze.outerGrid).toBeDefined();
    expect(maze.roomsGrid).toBeDefined();
    expect(maze.start).toEqual(maze.outerGrid.start);
    expect(maze.finish).toEqual(maze.outerGrid.finish);
    expect(maze.seed).toBe(100);
    expect(maze.rows).toBe(maze.outerGrid.rows);
    expect(maze.cols).toBe(maze.outerGrid.cols);
  });

  it('is deterministic for same seed and ageRange', () => {
    const a = generateSquaresMaze({ ageRange: '6-8', seed: 42 });
    const b = generateSquaresMaze({ ageRange: '6-8', seed: 42 });
    expect(a.outerGrid.rows).toBe(b.outerGrid.rows);
    expect(a.outerGrid.cols).toBe(b.outerGrid.cols);
    expect(a.roomsGrid.roomCells.size).toBe(b.roomsGrid.roomCells.size);
    for (const key of a.roomsGrid.roomCells.keys()) {
      expect(b.roomsGrid.roomCells.has(key)).toBe(true);
    }
  });

  it('produces different room placement for different seeds', () => {
    const a = generateSquaresMaze({ ageRange: '9-11', seed: 1 });
    const b = generateSquaresMaze({ ageRange: '9-11', seed: 2 });
    const keysA = [...a.roomsGrid.roomCells.keys()].sort();
    const keysB = [...b.roomsGrid.roomCells.keys()].sort();
    expect(keysA).not.toEqual(keysB);
  });

  it('each room has exactly two openings', () => {
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 200 });
    for (const room of maze.roomsGrid.roomCells.values()) {
      expect(room.openings.length).toBe(2);
      expect(maze.roomsGrid.openPassageCount(room.outerRow, room.outerCol)).toBe(2);
    }
  });

  it('each room sub-maze is solvable from subStart to subFinish', () => {
    const maze = generateSquaresMaze({ ageRange: '6-8', seed: 300 });
    for (const room of maze.roomsGrid.roomCells.values()) {
      expect(room.subSolutionPath.length).toBeGreaterThanOrEqual(2);
      const start = room.subSolutionPath[0];
      const finish = room.subSolutionPath[room.subSolutionPath.length - 1];
      expect(start.row).toBe(room.subStart.row);
      expect(start.col).toBe(room.subStart.col);
      expect(finish.row).toBe(room.subFinish.row);
      expect(finish.col).toBe(room.subFinish.col);
    }
  });

  it('room count does not exceed preset and may be less when few candidates', () => {
    const preset = getDifficultyPreset('4-5');
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 400 });
    expect(maze.roomsGrid.roomCells.size).toBeLessThanOrEqual(preset.roomCount);
    expect(maze.roomsGrid.roomCells.size).toBeGreaterThanOrEqual(0);
  });

  it('outer maze grid is valid (solvable)', () => {
    const maze = generateSquaresMaze({ ageRange: '9-11', seed: 500 });
    expect(validateMaze(maze.outerGrid)).toBe(true);
  });

  it('coerces cellSize to minimum when preset below 28pt', () => {
    const preset = getDifficultyPreset('18+');
    expect(preset.cellSize).toBeLessThan(MIN_CELL_SIZE_SQUARES_PT);
    const maze = generateSquaresMaze({ ageRange: '18+', seed: 600 });
    expect(maze.preset.cellSize).toBe(MIN_CELL_SIZE_SQUARES_PT);
    expect(maze.outerGrid.rows).toBeLessThanOrEqual(preset.gridHeight);
    expect(maze.outerGrid.cols).toBeLessThanOrEqual(preset.gridWidth);
  });
});
