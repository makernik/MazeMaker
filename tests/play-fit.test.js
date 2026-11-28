/**
 * Phone play scale: a short stage letterboxes a portrait maze.
 * Growing the page makes the maze fill the width, and pointer
 * coordinates still land on the same cell.
 */

import { describe, it, expect } from 'vitest';
import { generateMaze } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { generatePolarMaze } from '../src/maze/polarGenerator.js';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import {
  FOOTER_HEIGHT,
  MAZE_TOP_MARGIN,
  PRINTABLE_HEIGHT,
  PRINTABLE_WIDTH,
  getLayoutForMaze,
} from '../src/pdf/layout.js';
import { DIFFICULTY_PRESETS } from '../src/utils/constants.js';
import {
  drawnMazeWidth,
  fitPlayCanvas,
  mazeWidthLimit,
} from '../src/play/fit.js';
import { buildView } from '../src/play/model.js';
import { locateGrid } from '../src/play/locate.js';
import {
  PLAY_EDGE_BELOW_PX,
  PLAY_EDGE_SLOP_PX,
  clientToLocal,
  isNearPlayCanvas,
  mapClientToMaze,
} from '../src/play/view.js';

const PHONE_WIDTH = 388;
const PHONE_STAGE = 337;

function layoutOf(maze, fit, style = 'classic') {
  return getLayoutForMaze(maze, {
    pageWidth: fit.pageWidth,
    pageHeight: fit.pageHeight,
    margin: fit.margin,
    style,
  });
}

function gridMaze(cols, rows) {
  return {
    cols,
    rows,
    grid: { rows },
    preset: { lineThickness: 2 },
  };
}

describe('play canvas fit', () => {
  it('letterboxes Hard on a short phone stage and fills the width when the page grows', () => {
    const preset = DIFFICULTY_PRESETS['9-11'];
    const maze = gridMaze(preset.gridWidth, preset.gridHeight);
    const short = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: false });
    const grown = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: true });
    const shortLayout = layoutOf(maze, short);
    const grownLayout = layoutOf(maze, grown);
    const shortWidth = drawnMazeWidth(maze, shortLayout);
    const grownWidth = drawnMazeWidth(maze, grownLayout);

    expect(shortWidth).toBeLessThan(PHONE_WIDTH * 0.6);
    expect(grown.cssHeight).toBeGreaterThan(PHONE_STAGE);
    expect(grownWidth).toBeGreaterThan(shortWidth * 1.5);
    expect(grownWidth).toBeCloseTo(mazeWidthLimit(grown.pageWidth, grown.margin, maze), 0);
    expect(grownLayout.cellSize / grown.dpr).toBeGreaterThan(24);
  });

  it('fills every classic level to the phone width', () => {
    for (const preset of Object.values(DIFFICULTY_PRESETS)) {
      const maze = gridMaze(preset.gridWidth, preset.gridHeight);
      const fit = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: true });
      const layout = layoutOf(maze, fit);
      expect(drawnMazeWidth(maze, layout)).toBeCloseTo(
        mazeWidthLimit(fit.pageWidth, fit.margin, maze),
        0
      );
      expect(fit.cssHeight).toBeGreaterThan(PHONE_STAGE);
    }
  });

  it('fills organic, circular, and squares the same way', () => {
    const organic = {
      layout: 'organic',
      boundsWidth: PRINTABLE_WIDTH,
      boundsHeight: PRINTABLE_HEIGHT - FOOTER_HEIGHT - MAZE_TOP_MARGIN,
      preset: { lineThickness: 2 },
    };
    const polar = {
      layout: 'polar',
      polarGrid: { maxRing: 8, rings: 9, wedges: 6 },
      preset: { lineThickness: 2, polarRingRatio: 0.97, polarRoomScale: 1.15 },
    };
    const squares = { layout: 'squares', ...gridMaze(18, 24) };
    for (const maze of [organic, polar, squares]) {
      const fit = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, 2, { allowGrow: true });
      const layout = layoutOf(maze, fit);
      expect(drawnMazeWidth(maze, layout)).toBeCloseTo(
        mazeWidthLimit(fit.pageWidth, fit.margin, maze),
        0
      );
    }
  });

  it('drops back to a shorter page when the next maze is less tall', () => {
    const hard = gridMaze(12, 18);
    const round = {
      layout: 'polar',
      polarGrid: { maxRing: 4, rings: 5, wedges: 6 },
      preset: { lineThickness: 2 },
    };
    const hardFit = fitPlayCanvas(hard, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: true });
    const roundFit = fitPlayCanvas(round, PHONE_WIDTH, hardFit.cssHeight, 1, { allowGrow: true });
    expect(roundFit.cssHeight).toBeLessThan(hardFit.cssHeight - 40);
    const layout = layoutOf(round, roundFit);
    expect(drawnMazeWidth(round, layout)).toBeCloseTo(
      mazeWidthLimit(roundFit.pageWidth, roundFit.margin, round),
      0
    );
  });

  it('keeps the printable Epic grid, so a phone cell stays dense after the width fit', () => {
    const preset = DIFFICULTY_PRESETS['18+'];
    const maze = gridMaze(preset.gridWidth, preset.gridHeight);
    const fit = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: true });
    const layout = layoutOf(maze, fit);
    const cssCell = layout.cellSize / fit.dpr;
    expect(preset.gridWidth).toBe(36);
    expect(drawnMazeWidth(maze, layout)).toBeCloseTo(mazeWidthLimit(fit.pageWidth, fit.margin, maze), 0);
    expect(cssCell).toBeGreaterThan(8);
    expect(cssCell).toBeLessThan(16);
  });
});

describe('play coordinate mapping after scale', () => {
  const maze = generateMaze({ ageRange: '9-11', seed: 21 });
  const tolerance = DIFFICULTY_PRESETS['9-11'].playTolerance;

  function place(dpr) {
    const fit = fitPlayCanvas(maze, PHONE_WIDTH, PHONE_STAGE, dpr, { allowGrow: true });
    const layout = layoutOf(maze, fit);
    const view = buildView(maze, layout);
    const rect = {
      left: 12,
      top: 90,
      width: fit.cssWidth,
      height: fit.cssHeight,
      right: 12 + fit.cssWidth,
      bottom: 90 + fit.cssHeight,
    };
    return { fit, layout, view, rect };
  }

  function clientFor(local, placed) {
    const at = placed.view.toLayout(local);
    return {
      x: placed.rect.left + at.x / placed.fit.dpr,
      y: placed.rect.top + (placed.fit.pageHeight - at.y) / placed.fit.dpr,
    };
  }

  it('maps the start cell back to itself at 1x and 2x', () => {
    const local = { x: 0.5, y: 0.5 };
    for (const dpr of [1, 2]) {
      const placed = place(dpr);
      const client = clientFor(local, placed);
      const back = mapClientToMaze(
        client.x,
        client.y,
        placed.rect,
        placed.fit.pageWidth,
        placed.fit.pageHeight,
        placed.view
      );
      expect(back.x).toBeCloseTo(local.x, 5);
      expect(back.y).toBeCloseTo(local.y, 5);
      const canvas = {
        width: placed.fit.pageWidth,
        height: placed.fit.pageHeight,
        getBoundingClientRect: () => placed.rect,
      };
      const viaCanvas = clientToLocal(canvas, client.x, client.y, placed.view);
      expect(viaCanvas.x).toBeCloseTo(local.x, 5);
      expect(viaCanvas.y).toBeCloseTo(local.y, 5);
      expect(locateGrid(maze.grid, tolerance, back, null, '0,0')).toBe('0,0');
    }
  });

  it('still accepts a point just outside the entrance after the maze is scaled', () => {
    const placed = place(2);
    const outside = { x: 0.5, y: -tolerance * 0.5 };
    const client = clientFor(outside, placed);
    const back = mapClientToMaze(
      client.x,
      client.y,
      placed.rect,
      placed.fit.pageWidth,
      placed.fit.pageHeight,
      placed.view
    );
    expect(back.y).toBeLessThan(0);
    expect(locateGrid(maze.grid, tolerance, back, null, '0,0')).toBe('0,0');
    expect(client.y).toBeLessThan(placed.rect.top + placed.layout.cellSize / placed.fit.dpr);
  });

  it('generated organic, circular, and squares mazes fill a phone width', () => {
    const cases = [
      [generateOrganicMaze({ ageRange: '9-11', seed: 4 }), 'jagged'],
      [generatePolarMaze({ ageRange: '9-11', seed: 4 }), 'classic'],
      [generateSquaresMaze({ ageRange: '4-5', seed: 4 }), 'squares'],
    ];
    for (const [mazeCase, style] of cases) {
      const fit = fitPlayCanvas(mazeCase, PHONE_WIDTH, PHONE_STAGE, 1, { allowGrow: true });
      const layout = layoutOf(mazeCase, fit, style);
      expect(drawnMazeWidth(mazeCase, layout)).toBeCloseTo(
        mazeWidthLimit(fit.pageWidth, fit.margin, mazeCase),
        0
      );
    }
  });
});

describe('play touch margin', () => {
  const rect = {
    left: 16,
    top: 120,
    width: 380,
    height: 560,
    right: 396,
    bottom: 680,
  };

  it('includes a drag that starts above the canvas and excludes the controls below it', () => {
    expect(isNearPlayCanvas(200, rect.top - (PLAY_EDGE_SLOP_PX - 4), rect)).toBe(true);
    expect(isNearPlayCanvas(200, rect.top - (PLAY_EDGE_SLOP_PX + 12), rect)).toBe(false);
    expect(isNearPlayCanvas(200, rect.bottom + PLAY_EDGE_BELOW_PX + 20, rect)).toBe(false);
    expect(isNearPlayCanvas(200, rect.bottom + PLAY_EDGE_BELOW_PX - 1, rect)).toBe(true);
    expect(isNearPlayCanvas(rect.left + 40, rect.top + 40, rect)).toBe(true);
  });
});
