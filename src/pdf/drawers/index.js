/**
 * Drawer registry by style. Each drawer implements drawWalls, drawLabels, drawSolutionOverlay.
 * Canvas drawers (for preview) use same layoutResult; no pdf-lib.
 */

import * as gridDrawer from './draw-grid.js';
import * as jaggedDrawer from './draw-organic.js';
import * as curvyDrawer from './draw-curvy.js';
import * as gridCanvasDrawer from './draw-grid-canvas.js';
import * as jaggedCanvasDrawer from './draw-organic-canvas.js';
import * as curvyCanvasDrawer from './draw-curvy-canvas.js';

const drawers = {
  grid: gridDrawer,
  jagged: jaggedDrawer,
  curvy: curvyDrawer,
};

const canvasDrawers = {
  grid: gridCanvasDrawer,
  jagged: jaggedCanvasDrawer,
  curvy: curvyCanvasDrawer,
};

/**
 * Get drawer for style. Grid styles ('classic', 'square') map to 'grid'.
 * Organic styles ('jagged', 'curvy') map to their own drawers.
 *
 * @param {string} [style] - 'grid' | 'jagged' | 'curvy' | 'classic' | 'square'
 * @returns {object} Drawer with drawWalls, drawLabels, drawSolutionOverlay
 */
export function getDrawer(style) {
  return drawers[style] ?? drawers.grid;
}

/**
 * Get canvas drawer for style (preview). Same layoutResult as PDF.
 *
 * @param {string} [style] - 'grid' | 'jagged' | 'curvy' | 'classic' | 'square'
 * @returns {object} { drawWalls(ctx, maze, layoutResult), drawLabels(ctx, maze, layoutResult, options?) }
 */
export function getCanvasDrawer(style) {
  return canvasDrawers[style] ?? canvasDrawers.grid;
}

export { drawers };
