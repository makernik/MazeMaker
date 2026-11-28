/**
 * Play canvas size. On a phone the stage is short, so a portrait maze
 * letterboxes into a narrow strip. Growing the page until the maze is
 * limited by width makes that strip fill the stage.
 */

import { FOOTER_HEIGHT, MAZE_TOP_MARGIN, POLAR_LABEL_CLEARANCE } from '../pdf/layout.js';

/**
 * @param {number} [dpr]
 * @returns {number}
 */
export function deviceScale(dpr) {
  const n = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.min(n, 2);
}

/**
 * Same margin the play canvas passes to getLayoutForMaze.
 * @param {number} pageWidth
 * @param {number} pageHeight
 */
export function playMargin(pageWidth, pageHeight) {
  return Math.max(16, Math.round(Math.min(pageWidth, pageHeight) * 0.04));
}

/**
 * Content height, in page pixels, for a maze drawn at `mazeWidth`.
 * Polar is square. Grid and squares follow rows/cols. Organic follows its bounds.
 * @param {object} maze
 * @param {number} mazeWidth
 */
export function contentHeightForWidth(maze, mazeWidth) {
  if (maze?.layout === 'polar') return mazeWidth;
  if (maze?.layout === 'organic') {
    const w = maze.boundsWidth;
    const h = maze.boundsHeight;
    if (!(w > 0) || !(h > 0)) return mazeWidth;
    return mazeWidth * (h / w);
  }
  const cols = maze?.cols;
  const rows = maze?.rows;
  if (!(cols > 0) || !(rows > 0)) return mazeWidth;
  return mazeWidth * (rows / cols);
}

/**
 * Bitmap page height at which the maze is limited by `pageWidth`.
 * Taller pages do not make that maze any larger.
 * @param {object} maze
 * @param {number} pageWidth
 */
export function pageHeightToFillWidth(maze, pageWidth) {
  let margin = playMargin(pageWidth, pageWidth);
  let pageHeight = pageWidth;
  for (let i = 0; i < 4; i++) {
    const mazeWidth = Math.max(1, pageWidth - 2 * margin);
    const mazeHeight = contentHeightForWidth(maze, mazeWidth);
    const next = Math.ceil(mazeHeight + FOOTER_HEIGHT + MAZE_TOP_MARGIN + 2 * margin);
    const nextMargin = playMargin(pageWidth, next);
    pageHeight = Math.max(2, next);
    if (nextMargin === margin) return pageHeight;
    margin = nextMargin;
  }
  return pageHeight;
}

/**
 * Bitmap size for the play canvas.
 * `allowGrow` (phone) raises the page until the maze fills the width.
 * Otherwise the page matches the stage and the maze letterboxes inside it.
 *
 * @param {object} maze
 * @param {number} cssWidth
 * @param {number} cssHeight
 * @param {number} [dpr]
 * @param {{ allowGrow?: boolean }} [options]
 */
export function fitPlayCanvas(maze, cssWidth, cssHeight, dpr = 1, options = {}) {
  const scale = deviceScale(dpr);
  const width = Math.max(40, cssWidth);
  const height = Math.max(40, cssHeight);
  const pageWidth = Math.max(2, Math.round(width * scale));
  let pageHeight = Math.max(2, Math.round(height * scale));
  if (options.allowGrow) {
    // The phone page is the maze's own aspect, not the leftover stage.
    // A shorter maze must not keep the previous maze's extra height.
    pageHeight = pageHeightToFillWidth(maze, pageWidth);
  }
  const margin = playMargin(pageWidth, pageHeight);
  return {
    pageWidth,
    pageHeight,
    margin,
    cssWidth: pageWidth / scale,
    cssHeight: pageHeight / scale,
    dpr: scale,
  };
}

/**
 * Width of the drawn maze in layout pixels.
 * @param {object} maze
 * @param {object} layout
 */
export function drawnMazeWidth(maze, layout) {
  if (maze.layout === 'organic') return maze.boundsWidth * layout.scale;
  if (maze.layout === 'polar') return layout.maxRadius * 2;
  return layout.cellSize * maze.cols;
}

/**
 * Widest the layout can draw the maze at this page width.
 * Polar keeps room for the outer labels.
 * @param {number} pageWidth
 * @param {number} margin
 * @param {object} maze
 */
export function mazeWidthLimit(pageWidth, margin, maze) {
  const inner = pageWidth - 2 * margin;
  if (maze?.layout === 'polar') return inner - 2 * POLAR_LABEL_CLEARANCE;
  return inner;
}
