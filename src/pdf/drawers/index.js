/**
 * Drawer registry by style. Each drawer implements drawWalls, drawLabels,
 * drawSolutionOverlay.  All drawers accept a DrawBackend as their first
 * argument; callers create PdfBackend or CanvasBackend and pass it in.
 */

import * as gridDrawer from './draw-grid.js';
import * as jaggedDrawer from './draw-organic.js';
import * as curvyDrawer from './draw-curvy.js';
import * as polarDrawer from './draw-polar.js';
import * as squaresDrawer from './draw-rooms.js';

const drawers = {
  grid: gridDrawer,
  jagged: jaggedDrawer,
  curvy: curvyDrawer,
  polar: polarDrawer,
  squares: squaresDrawer,
};

/**
 * Get drawer key for a maze and style (for renderer/preview dispatch).
 * @param {object} maze - Maze with .layout
 * @param {string} [style] - Form style: 'classic' | 'jagged' | 'curvy' | 'circular' | 'squares'
 * @returns {string} Drawer key: 'polar' | 'curvy' | 'jagged' | 'squares' | 'grid'
 */
export function getDrawerKey(maze, style) {
  if (maze.layout === 'polar') return 'polar';
  if (maze.layout === 'organic') return style === 'curvy' ? 'curvy' : 'jagged';
  if (maze.layout === 'squares') return 'squares';
  return 'grid';
}

/**
 * Get drawer for style. Grid styles ('classic', 'square') map to 'grid'.
 * Organic styles ('jagged', 'curvy') and 'polar' map to their own drawers.
 *
 * @param {string} [style] - 'grid' | 'jagged' | 'curvy' | 'polar' | 'squares' | 'classic'
 * @returns {object} Drawer with drawWalls, drawLabels, drawSolutionOverlay
 */
export function getDrawer(style) {
  return drawers[style] ?? drawers.grid;
}

export { drawers };
