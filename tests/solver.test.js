/**
 * Maze Solver Tests
 * 
 * Tests for path finding and single-solution validation.
 */

import { describe, it, expect } from 'vitest';
import { solveMaze, validateMaze, isPerfectMaze, pathToDirections } from '../src/maze/solver.js';
import { getSolver } from '../src/maze/solver-algorithms.js';
import { generateMaze } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { MazeGrid, DIRECTIONS } from '../src/maze/grid.js';

describe('Maze Solver', () => {
  it('finds a path from start to finish', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 12345 });
    const solution = solveMaze(maze.grid);
    
    expect(solution).not.toBeNull();
    expect(solution.solved).toBe(true);
    expect(solution.path.length).toBeGreaterThan(0);
    
    // Path should start at start position
    expect(solution.path[0]).toEqual({ row: 0, col: 0 });
    
    // Path should end at finish position
    const lastPos = solution.path[solution.path.length - 1];
    expect(lastPos).toEqual({ row: maze.rows - 1, col: maze.cols - 1 });
  });
  
  it('confirms maze has exactly one solution (perfect maze)', () => {
    const maze = generateMaze({ ageRange: '9-11', seed: 54321 });
    const result = isPerfectMaze(maze.grid);
    
    expect(result.isPerfect).toBe(true);
    expect(result.allCellsReachable).toBe(true);
    expect(result.reachableCells).toBe(result.totalCells);
  });
  
  it('validateMaze returns true for valid mazes', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 99999 });
    expect(validateMaze(maze.grid)).toBe(true);
  });
  
  it('finds solution for multiple generated mazes', () => {
    // Test several different mazes
    const seeds = [1, 100, 1000, 10000, 100000];
    
    for (const seed of seeds) {
      const maze = generateMaze({ ageRange: '9-11', seed });
      const solution = solveMaze(maze.grid);
      
      expect(solution).not.toBeNull();
      expect(solution.solved).toBe(true);
    }
  });
  
  it('all cells are reachable in generated mazes', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 77777 });
    const result = isPerfectMaze(maze.grid);
    
    expect(result.reachableCells).toBe(maze.rows * maze.cols);
  });
  
  it('path contains consecutive adjacent cells', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 11111 });
    const solution = solveMaze(maze.grid);
    
    for (let i = 1; i < solution.path.length; i++) {
      const prev = solution.path[i - 1];
      const curr = solution.path[i];
      
      // Cells should be adjacent (Manhattan distance = 1)
      const distance = Math.abs(prev.row - curr.row) + Math.abs(prev.col - curr.col);
      expect(distance).toBe(1);
    }
  });
  
  it('path length matches path array length', () => {
    const maze = generateMaze({ ageRange: '9-11', seed: 22222 });
    const solution = solveMaze(maze.grid);
    
    expect(solution.length).toBe(solution.path.length);
  });
  
  it('returns null for unsolvable maze (isolated finish)', () => {
    // Create a maze with all walls intact (no passages)
    const grid = new MazeGrid(3, 3);
    // Don't run any generation - all walls remain

    const solution = solveMaze(grid);
    expect(solution).toBeNull();
  });

  it('isPerfectMaze returns true for organic mazes (all nodes reachable)', () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 400 });
    const result = isPerfectMaze(maze);
    expect(result.isPerfect).toBe(true);
    expect(result.reachableCells).toBe(result.totalCells);
    expect(result.totalCells).toBe(maze.graph.nodes.length);
  });
});

describe('pathToDirections', () => {
  it('converts path to direction strings', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ];
    
    const directions = pathToDirections(path);
    
    expect(directions).toEqual(['right', 'down', 'right']);
  });
  
  it('returns empty array for single-cell path', () => {
    const path = [{ row: 0, col: 0 }];
    const directions = pathToDirections(path);
    
    expect(directions).toEqual([]);
  });
  
  it('returns empty array for null/undefined path', () => {
    expect(pathToDirections(null)).toEqual([]);
    expect(pathToDirections(undefined)).toEqual([]);
  });

  it('returns [] for organic path (node ids)', () => {
    expect(pathToDirections([0, 1, 2], 'organic')).toEqual([]);
    expect(pathToDirections([5, 3, 7])).toEqual([]);
  });
  
  it('handles all four directions', () => {
    const path = [
      { row: 1, col: 1 },
      { row: 0, col: 1 }, // up
      { row: 0, col: 2 }, // right
      { row: 1, col: 2 }, // down
      { row: 1, col: 1 }, // left
    ];
    
    const directions = pathToDirections(path);
    
    expect(directions).toEqual(['up', 'right', 'down', 'left']);
  });
});

describe('Solver Determinism', () => {
  it('produces same solution path for same maze', () => {
    const maze1 = generateMaze({ ageRange: '4-5', seed: 33333 });
    const maze2 = generateMaze({ ageRange: '4-5', seed: 33333 });

    const solution1 = solveMaze(maze1.grid);
    const solution2 = solveMaze(maze2.grid);

    expect(solution1.path).toEqual(solution2.path);
  });
});

describe('Solver with mock adapter', () => {
  it('BFS finds path on 3-node graph via adapter', () => {
    const adapter = {
      getStart: () => 0,
      getFinish: () => 2,
      getNeighbors: (state) => {
        const id = typeof state === 'number' ? state : state;
        if (id === 0) return [1];
        if (id === 1) return [0, 2];
        if (id === 2) return [1];
        return [];
      },
      key: (state) => String(typeof state === 'number' ? state : state),
    };
    const solve = getSolver('bfs');
    const solution = solve(adapter);
    expect(solution).not.toBeNull();
    expect(solution.solved).toBe(true);
    expect(solution.path).toEqual([0, 1, 2]);
    expect(solution.length).toBe(3);
  });

  it('BFS returns null when no path (disconnected finish)', () => {
    const adapter = {
      getStart: () => 0,
      getFinish: () => 2,
      getNeighbors: (state) => {
        const id = typeof state === 'number' ? state : state;
        if (id === 0) return [1];
        if (id === 1) return [0];
        return [];
      },
      key: (state) => String(typeof state === 'number' ? state : state),
    };
    const solve = getSolver('bfs');
    const solution = solve(adapter);
    expect(solution).toBeNull();
  });
});
