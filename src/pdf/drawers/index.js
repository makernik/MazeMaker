/**
 * Drawer registry by layout type. Each drawer implements drawWalls, drawLabels, drawSolutionOverlay.
 */

import * as gridDrawer from './draw-grid.js';
import * as organicDrawer from './draw-organic.js';

const drawers = {
  grid: gridDrawer,
  organic: organicDrawer,
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

export { drawers };
