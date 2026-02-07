/**
 * Maze Generator Tests
 * 
 * Tests for deterministic generation and grid integrity.
 */

import { describe, it, expect } from 'vitest';
import { generateMaze, generateMazes } from '../src/maze/generator.js';
import { MazeGrid, DIRECTIONS } from '../src/maze/grid.js';
import { validateMaze } from '../src/maze/solver.js';
import { DIFFICULTY_PRESETS } from '../src/utils/constants.js';

describe('MazeGrid', () => {
  it('creates a grid with correct dimensions', () => {
    const grid = new MazeGrid(10, 15);
    
    expect(grid.rows).toBe(10);
    expect(grid.cols).toBe(15);
    expect(grid.cells.length).toBe(10);
    expect(grid.cells[0].length).toBe(15);
  });
  
  it('initializes cells with all walls intact', () => {
    const grid = new MazeGrid(5, 5);
    const cell = grid.getCell(2, 2);
    
    expect(cell.hasWall(DIRECTIONS.TOP)).toBe(true);
    expect(cell.hasWall(DIRECTIONS.RIGHT)).toBe(true);
    expect(cell.hasWall(DIRECTIONS.BOTTOM)).toBe(true);
    expect(cell.hasWall(DIRECTIONS.LEFT)).toBe(true);
  });
  
  it('sets start at top-left and finish at bottom-right', () => {
    const grid = new MazeGrid(8, 10);
    
    expect(grid.start).toEqual({ row: 0, col: 0 });
    expect(grid.finish).toEqual({ row: 7, col: 9 });
  });
  
  it('removes walls between cells correctly', () => {
    const grid = new MazeGrid(3, 3);
    const cell1 = grid.getCell(1, 1);
    const cell2 = grid.getCell(1, 2);
    
    grid.removeWallBetween(cell1, cell2);
    
    expect(cell1.hasWall(DIRECTIONS.RIGHT)).toBe(false);
    expect(cell2.hasWall(DIRECTIONS.LEFT)).toBe(false);
  });
  
  it('opens entrance and exit correctly', () => {
    const grid = new MazeGrid(5, 5);
    
    grid.openEntrance();
    grid.openExit();
    
    const startCell = grid.getCell(0, 0);
    const finishCell = grid.getCell(4, 4);
    
    expect(startCell.hasWall(DIRECTIONS.TOP)).toBe(false);
    expect(finishCell.hasWall(DIRECTIONS.BOTTOM)).toBe(false);
  });
  
  it('correctly identifies connected cells', () => {
    const grid = new MazeGrid(3, 3);
    const cell1 = grid.getCell(1, 1);
    const cell2 = grid.getCell(1, 2);
    
    // Initially not connected
    expect(grid.areConnected(1, 1, 1, 2)).toBe(false);
    
    // Remove wall
    grid.removeWallBetween(cell1, cell2);
    
    // Now connected
    expect(grid.areConnected(1, 1, 1, 2)).toBe(true);
  });
});

describe('Maze Generator', () => {
  it('generates a valid maze grid', () => {
    const result = generateMaze({ ageRange: '3-5', seed: 12345 });
    
    expect(result.grid).toBeInstanceOf(MazeGrid);
    expect(result.seed).toBe(12345);
    expect(result.ageRange).toBe('3-5');
  });
  
  it('produces identical mazes for the same seed', () => {
    const maze1 = generateMaze({ ageRange: '9-13', seed: 99999 });
    const maze2 = generateMaze({ ageRange: '9-13', seed: 99999 });
    
    // Compare grid structure
    expect(maze1.rows).toBe(maze2.rows);
    expect(maze1.cols).toBe(maze2.cols);
    
    // Compare all cell walls
    for (let row = 0; row < maze1.rows; row++) {
      for (let col = 0; col < maze1.cols; col++) {
        const cell1 = maze1.grid.getCell(row, col);
        const cell2 = maze2.grid.getCell(row, col);
        
        expect(cell1.walls).toEqual(cell2.walls);
      }
    }
  });
  
  it('produces different mazes for different seeds', () => {
    const maze1 = generateMaze({ ageRange: '3-5', seed: 11111 });
    const maze2 = generateMaze({ ageRange: '3-5', seed: 22222 });
    
    // At least one cell should have different walls
    let foundDifference = false;
    for (let row = 0; row < maze1.rows && !foundDifference; row++) {
      for (let col = 0; col < maze1.cols && !foundDifference; col++) {
        const cell1 = maze1.grid.getCell(row, col);
        const cell2 = maze2.grid.getCell(row, col);
        
        if (JSON.stringify(cell1.walls) !== JSON.stringify(cell2.walls)) {
          foundDifference = true;
        }
      }
    }
    
    expect(foundDifference).toBe(true);
  });
  
  it('respects difficulty preset dimensions for 3-5 age range', () => {
    const maze = generateMaze({ ageRange: '3-5', seed: 42 });
    const preset = DIFFICULTY_PRESETS['3-5'];
    
    expect(maze.rows).toBe(preset.gridHeight);
    expect(maze.cols).toBe(preset.gridWidth);
  });
  
  it('respects difficulty preset dimensions for 9-13 age range', () => {
    const maze = generateMaze({ ageRange: '9-13', seed: 42 });
    const preset = DIFFICULTY_PRESETS['9-13'];
    
    expect(maze.rows).toBe(preset.gridHeight);
    expect(maze.cols).toBe(preset.gridWidth);
  });
  
  it('uses 6-8 preset dimensions', () => {
    const maze = generateMaze({ ageRange: '6-8', seed: 42 });
    const preset = DIFFICULTY_PRESETS['6-8'];
    
    expect(maze.rows).toBe(preset.gridHeight);
    expect(maze.cols).toBe(preset.gridWidth);
  });
  
  it('uses 14-17 preset dimensions', () => {
    const maze = generateMaze({ ageRange: '14-17', seed: 42 });
    const preset = DIFFICULTY_PRESETS['14-17'];
    
    expect(maze.rows).toBe(preset.gridHeight);
    expect(maze.cols).toBe(preset.gridWidth);
  });

  it('uses 18+ preset dimensions', () => {
    const maze = generateMaze({ ageRange: '18+', seed: 42 });
    const preset = DIFFICULTY_PRESETS['18+'];
    
    expect(maze.rows).toBe(preset.gridHeight);
    expect(maze.cols).toBe(preset.gridWidth);
  });
  
  it('opens entrance and exit', () => {
    const maze = generateMaze({ ageRange: '3-5', seed: 123 });
    
    const startCell = maze.grid.getCell(0, 0);
    const finishCell = maze.grid.getCell(maze.rows - 1, maze.cols - 1);
    
    expect(startCell.hasWall(DIRECTIONS.TOP)).toBe(false);
    expect(finishCell.hasWall(DIRECTIONS.BOTTOM)).toBe(false);
  });
  
  it('generates all cells as visited (fully connected)', () => {
    const maze = generateMaze({ ageRange: '9-13', seed: 777 });
    
    for (let row = 0; row < maze.rows; row++) {
      for (let col = 0; col < maze.cols; col++) {
        const cell = maze.grid.getCell(row, col);
        expect(cell.isVisited()).toBe(true);
      }
    }
  });
});

describe('Generate Multiple Mazes', () => {
  it('generates the requested quantity', () => {
    const result = generateMazes({ ageRange: '3-5', quantity: 5, baseSeed: 1000 });
    
    expect(result.mazes.length).toBe(5);
    expect(result.quantity).toBe(5);
  });
  
  it('each maze has a unique seed based on baseSeed + index', () => {
    const result = generateMazes({ ageRange: '3-5', quantity: 3, baseSeed: 5000 });
    
    expect(result.mazes[0].seed).toBe(5000);
    expect(result.mazes[1].seed).toBe(5001);
    expect(result.mazes[2].seed).toBe(5002);
  });
  
  it('produces deterministic results with same baseSeed', () => {
    const result1 = generateMazes({ ageRange: '9-13', quantity: 3, baseSeed: 8888 });
    const result2 = generateMazes({ ageRange: '9-13', quantity: 3, baseSeed: 8888 });
    
    for (let i = 0; i < 3; i++) {
      for (let row = 0; row < result1.mazes[i].rows; row++) {
        for (let col = 0; col < result1.mazes[i].cols; col++) {
          const cell1 = result1.mazes[i].grid.getCell(row, col);
          const cell2 = result2.mazes[i].grid.getCell(row, col);
          expect(cell1.walls).toEqual(cell2.walls);
        }
      }
    }
  });
});

describe('Recursive Backtracker algorithm', () => {
  it('produces a valid (solvable) maze with fixed seed', () => {
    const maze = generateMaze({
      ageRange: '3-5',
      seed: 4242,
      algorithm: 'recursive-backtracker',
    });
    expect(validateMaze(maze.grid)).toBe(true);
  });

  it('produces identical mazes for same seed and algorithm', () => {
    const maze1 = generateMaze({
      ageRange: '9-13',
      seed: 55555,
      algorithm: 'recursive-backtracker',
    });
    const maze2 = generateMaze({
      ageRange: '9-13',
      seed: 55555,
      algorithm: 'recursive-backtracker',
    });
    expect(maze1.rows).toBe(maze2.rows);
    expect(maze1.cols).toBe(maze2.cols);
    for (let row = 0; row < maze1.rows; row++) {
      for (let col = 0; col < maze1.cols; col++) {
        const cell1 = maze1.grid.getCell(row, col);
        const cell2 = maze2.grid.getCell(row, col);
        expect(cell1.walls).toEqual(cell2.walls);
      }
    }
  });

  it('default algorithm is Prim (no algorithm param)', () => {
    const mazeNoParam = generateMaze({ ageRange: '3-5', seed: 77777 });
    const mazePrim = generateMaze({
      ageRange: '3-5',
      seed: 77777,
      algorithm: 'prim',
    });
    expect(mazeNoParam.rows).toBe(mazePrim.rows);
    expect(mazeNoParam.cols).toBe(mazePrim.cols);
    for (let row = 0; row < mazeNoParam.rows; row++) {
      for (let col = 0; col < mazeNoParam.cols; col++) {
        const c1 = mazeNoParam.grid.getCell(row, col);
        const c2 = mazePrim.grid.getCell(row, col);
        expect(c1.walls).toEqual(c2.walls);
      }
    }
  });
});
