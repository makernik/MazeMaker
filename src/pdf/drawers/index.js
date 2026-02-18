/**
 * Drawer registry by layout type. Each drawer implements drawWalls, drawLabels, drawSolutionOverlay.
 * Canvas drawers (for preview) use same layoutResult; no pdf-lib.
 */

import * as gridDrawer from './draw-grid.js';
import * as organicDrawer from './draw-organic.js';
import * as gridCanvasDrawer from './draw-grid-canvas.js';
import * as organicCanvasDrawer from './draw-organic-canvas.js';

const drawers = {
  grid: gridDrawer,
  organic: organicDrawer,
};

const canvasDrawers = {
  grid: gridCanvasDrawer,
  organic: organicCanvasDrawer,
};

/**
 * Get drawer for layout type. Default 'grid' for unknown or missing layout.
 *
 * @param {string} [layoutType] - 'grid' | 'organic'
 * @returns {object} Drawer with drawWalls, drawLabels, drawSolutionOverlay
 */
export function getDrawer(layoutType) {
  return drawers[layoutType] ?? drawers.grid;
}

/**
 * Get canvas drawer for layout type (preview). Same layoutResult as PDF.
 *
 * @param {string} [layoutType] - 'grid' | 'organic'
 * @returns {object} { drawWalls(ctx, maze, layoutResult), drawLabels(ctx, maze, layoutResult, options?) }
 */
export function getCanvasDrawer(layoutType) {
  return canvasDrawers[layoutType] ?? canvasDrawers.grid;
}

export { drawers };
