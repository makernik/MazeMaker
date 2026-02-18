/**
 * Layout: getLayoutForMaze with default and custom page dimensions (preview viewport).
 */

import { describe, it, expect } from 'vitest';
import { getLayoutForMaze } from '../src/pdf/layout.js';
import { generateMaze } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';

describe('getLayoutForMaze', () => {
  it('returns grid layout with default page dimensions', () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 1 });
    const layout = getLayoutForMaze(maze, { style: 'classic' });
    expect(layout.layoutType).toBe('grid');
    expect(layout.offsetX).toBeGreaterThanOrEqual(0);
    expect(layout.offsetY).toBeGreaterThanOrEqual(0);
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.style).toBe('classic');
  });

  it('returns organic layout with default page dimensions', () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 2 });
    const layout = getLayoutForMaze(maze);
    expect(layout.layoutType).toBe('organic');
    expect(typeof layout.transform).toBe('function');
    expect(layout.scale).toBeGreaterThan(0);
    const p = layout.transform(0, 0);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });

  it('with custom page dimensions (preview viewport), transform fits in rectangle', () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 3 });
    const pageWidth = 400;
    const pageHeight = 500;
    const margin = 0;
    const layout = getLayoutForMaze(maze, {
      pageWidth,
      pageHeight,
      margin,
      mazeWidth: pageWidth,
      mazeHeight: pageHeight,
      style: 'organic',
    });
    expect(layout.layoutType).toBe('organic');
    const { boundsWidth, boundsHeight, transform } = layout;
    // Corners of maze in source space: (0,0), (boundsWidth, 0), (0, boundsHeight), (boundsWidth, boundsHeight)
    const corners = [
      transform(0, 0),
      transform(boundsWidth, 0),
      transform(0, boundsHeight),
      transform(boundsWidth, boundsHeight),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(pageWidth + 1);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(pageHeight + 1);
    }
  });

  it('grid with custom page dimensions returns layout in viewport', () => {
    const maze = generateMaze({ ageRange: '3', seed: 4 });
    const pageWidth = 300;
    const pageHeight = 400;
    const layout = getLayoutForMaze(maze, {
      pageWidth,
      pageHeight,
      margin: 0,
      mazeWidth: pageWidth,
      mazeHeight: pageHeight,
      style: 'square',
    });
    expect(layout.layoutType).toBe('grid');
    expect(layout.offsetX).toBeGreaterThanOrEqual(0);
    expect(layout.offsetX + layout.cellSize * maze.cols).toBeLessThanOrEqual(pageWidth + 1);
    expect(layout.offsetY).toBeGreaterThanOrEqual(0);
    expect(layout.offsetY + layout.cellSize * maze.rows).toBeLessThanOrEqual(pageHeight + 1);
  });
});
