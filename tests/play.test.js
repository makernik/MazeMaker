/**
 * Play mode: tracing, wall forgiveness, hints, and one solve per layout.
 */

import { describe, it, expect } from 'vitest';
import { MazeGrid, DIRECTIONS } from '../src/maze/grid.js';
import { generateMaze } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { generatePolarMaze } from '../src/maze/polarGenerator.js';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import { getLayoutForMaze } from '../src/pdf/layout.js';
import { DIFFICULTY_PRESETS, getDifficultyPreset } from '../src/utils/constants.js';
import {
  PLAY_TOLERANCE_MAX,
  PLAY_TOLERANCE_MIN,
  clampPlayTolerance,
} from '../src/play/tolerance.js';
import { applyCell, createTrace, hintKeys, isBranch } from '../src/play/trace.js';
import { locateGrid } from '../src/play/locate.js';
import {
  addPointer,
  clearPath,
  createPlayState,
  currentHintKeys,
  setTolerance,
} from '../src/play/session.js';

function layoutFor(maze, style = 'classic') {
  return getLayoutForMaze(maze, {
    pageWidth: 480,
    pageHeight: 640,
    margin: 28,
    style,
  });
}

function walkCenters(state) {
  let next = state;
  const keys = state.topology.solution;
  for (let i = 0; i < keys.length; i++) {
    next = addPointer(next, state.topology.center(keys[i]), i === 0 ? 'start' : 'move');
  }
  return next;
}

describe('play tolerance defaults', () => {
  it('gives every level a forgiveness value inside the slider', () => {
    const values = Object.values(DIFFICULTY_PRESETS).map((preset) => preset.playTolerance);
    expect(values).toHaveLength(7);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(PLAY_TOLERANCE_MIN);
      expect(value).toBeLessThanOrEqual(PLAY_TOLERANCE_MAX);
      expect(clampPlayTolerance(value)).toBe(value);
    }
  });

  it('is looser for younger levels than for Epic', () => {
    expect(getDifficultyPreset('3').playTolerance).toBeGreaterThan(getDifficultyPreset('18+').playTolerance);
    expect(getDifficultyPreset('6-8').playTolerance).toBeGreaterThan(getDifficultyPreset('15-17').playTolerance);
  });
});

describe('play hint and progress', () => {
  const neighbors = new Map([
    ['0', ['1']],
    ['1', ['0', '2']],
    ['2', ['1', '3', '7']],
    ['3', ['2', '4']],
    ['4', ['3', '5', '8']],
    ['5', ['4', '6']],
    ['6', ['5']],
    ['7', ['2']],
    ['8', ['4']],
  ]);
  const solution = ['0', '1', '2', '3', '4', '5', '6'];
  const branch = (key) => isBranch(key, neighbors);

  it('shows the solution through two branches and the correct exit', () => {
    expect(hintKeys(solution, 0, branch)).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('starts the hint at the furthest correct cell', () => {
    expect(hintKeys(solution, 2, branch)).toEqual(['2', '3', '4', '5']);
  });

  it('draws through the finish when fewer than two branches remain', () => {
    expect(hintKeys(solution, 4, branch)).toEqual(['4', '5', '6']);
  });

  it('keeps the furthest correct cell at the junction after a wrong turn', () => {
    let trace = createTrace();
    for (const cell of ['0', '1', '2', '7']) {
      trace = applyCell(trace, solution, neighbors, cell);
    }
    expect(trace.started).toBe(true);
    expect(trace.furthest).toBe(2);
    expect(trace.solved).toBe(false);
    expect(trace.stack).toEqual(['0', '1', '2', '7']);

    for (const cell of ['2', '3', '4', '5', '6']) {
      trace = applyCell(trace, solution, neighbors, cell);
    }
    expect(trace.solved).toBe(true);
    expect(trace.furthest).toBe(6);
  });

  it('does not start from a cell other than the start', () => {
    const trace = applyCell(createTrace(), solution, neighbors, '6');
    expect(trace.started).toBe(false);
  });
});

describe('grid corridor forgiveness', () => {
  const grid = new MazeGrid(2, 2);
  grid.removeWallBetween(grid.getCell(0, 0), grid.getCell(0, 1));
  const tolerance = 0.3;

  it('stays in the cell when the point crosses a wall within forgiveness', () => {
    const stayed = locateGrid(grid, tolerance, { x: 0.5, y: 1.2 }, '0,0', '0,0');
    expect(stayed).toBe('0,0');
    expect(grid.getCell(0, 0).hasWall(DIRECTIONS.BOTTOM)).toBe(true);
  });

  it('does not enter a blocked cell once the point is past forgiveness', () => {
    const off = locateGrid(grid, tolerance, { x: 0.5, y: 1.5 }, '0,0', '0,0');
    expect(off).toBeNull();
  });

  it('enters the next corridor through an opening', () => {
    const next = locateGrid(grid, tolerance, { x: 1.15, y: 0.5 }, '0,0', '0,0');
    expect(next).toBe('0,1');
  });

  it('accepts the start cell from slightly outside the entrance', () => {
    const start = locateGrid(grid, tolerance, { x: 0.5, y: -0.2 }, null, '0,0');
    expect(start).toBe('0,0');
  });
});

describe('play session on generated mazes', () => {
  function play(maze, tolerance = 0.42) {
    return createPlayState(maze, layoutFor(maze), tolerance);
  }

  it('solves a classic maze by walking corridor centers', () => {
    const state = walkCenters(play(generateMaze({ ageRange: '3', seed: 42 })));
    expect(state.trace.solved).toBe(true);
  });

  it('still solves when each center is nudged within forgiveness', () => {
    const maze = generateMaze({ ageRange: '3', seed: 42 });
    const tolerance = 0.3;
    let state = play(maze, tolerance);
    const keys = state.topology.solution;
    for (let i = 0; i < keys.length; i++) {
      const center = state.topology.center(keys[i]);
      state = addPointer(state, center, i === 0 ? 'start' : 'move');
      state = addPointer(state, { x: center.x, y: center.y - tolerance * 0.5 }, 'move');
    }
    expect(state.trace.solved).toBe(true);
  });

  it('does not treat a leap through a wall as progress', () => {
    const grid = new MazeGrid(2, 2);
    grid.removeWallBetween(grid.getCell(0, 0), grid.getCell(0, 1));
    grid.removeWallBetween(grid.getCell(0, 1), grid.getCell(1, 1));
    grid.removeWallBetween(grid.getCell(1, 1), grid.getCell(1, 0));
    const maze = { grid, rows: 2, cols: 2, preset: { lineThickness: 2 } };
    let state = play(maze, 0.2);
    const start = state.topology.center('0,0');
    state = addPointer(state, start, 'start');
    state = addPointer(state, { x: start.x, y: start.y + 2.2 }, 'move');
    expect(grid.areConnected(0, 0, 1, 0)).toBe(false);
    expect(state.trace.solved).toBe(false);
    expect(state.trace.stack).toEqual(['0,0']);
  });

  it('clears the path and keeps the same solution', () => {
    let state = play(generateMaze({ ageRange: '3', seed: 7 }));
    const before = state.topology.solution.slice();
    state = addPointer(state, state.topology.center(before[0]), 'start');
    state = addPointer(state, state.topology.center(before[1]), 'move');
    expect(state.trace.started).toBe(true);
    state = clearPath(state);
    expect(state.strokes).toEqual([]);
    expect(state.trace.started).toBe(false);
    expect(state.topology.solution).toEqual(before);
  });

  it('re-reads the stroke when forgiveness changes', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 11 });
    let state = play(maze, 0.1);
    const keys = state.topology.solution;
    state = addPointer(state, state.topology.center(keys[0]), 'start');
    const center = state.topology.center(keys[0]);
    const stray = { x: center.x, y: center.y - 0.25 };
    state = addPointer(state, stray, 'move');
    const loose = setTolerance(state, 0.42);
    expect(loose.trace.started).toBe(true);
    expect(loose.tolerance).toBe(0.42);
  });

  it('hints from the furthest correct cell on a real maze', () => {
    let state = play(generateMaze({ ageRange: '3', seed: 3 }));
    const keys = state.topology.solution;
    state = addPointer(state, state.topology.center(keys[0]), 'start');
    const hint = currentHintKeys(state);
    expect(hint[0]).toBe(keys[0]);
    expect(hint.length).toBeGreaterThan(1);
    expect(hint.length).toBeLessThanOrEqual(keys.length);
    const end = keys.indexOf(hint[hint.length - 1]);
    expect(end).toBeGreaterThanOrEqual(0);
  });

  it('solves jagged, circular, and squares mazes along the solution', () => {
    const jagged = walkCenters(play(generateOrganicMaze({ ageRange: '3', seed: 5 }), 0.42));
    expect(jagged.trace.solved).toBe(true);

    const circular = walkCenters(play(generatePolarMaze({ ageRange: '3', seed: 5 }), 0.42));
    expect(circular.trace.solved).toBe(true);

    const epic = walkCenters(play(generatePolarMaze({ ageRange: '18+', seed: 5 }), 0.1));
    expect(epic.trace.solved).toBe(true);

    const squares = play(generateSquaresMaze({ ageRange: '3', seed: 5 }), 0.42);
    for (let i = 1; i < squares.topology.solution.length; i++) {
      const prev = squares.topology.solution[i - 1];
      const curr = squares.topology.solution[i];
      expect(squares.topology.neighbors.get(prev)).toContain(curr);
    }
    expect(walkCenters(squares).trace.solved).toBe(true);
  });
});
