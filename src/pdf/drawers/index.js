/**
 * Drawer registry by style. Each drawer implements drawWalls, drawLabels,
 * drawSolutionOverlay.  All drawers accept a DrawBackend as their first
 * argument; callers create PdfBackend or CanvasBackend and pass it in.
 */

import * as gridDrawer from './draw-grid.js';
import * as jaggedDrawer from './draw-organic.js';
import * as curvyDrawer from './draw-curvy.js';

const drawers = {
  grid: gridDrawer,
  jagged: jaggedDrawer,
  curvy: curvyDrawer,
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

export { drawers };
