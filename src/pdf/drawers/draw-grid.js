/**
 * Grid maze drawer: walls (square/classic), labels, solution overlay.
 * Shared interface: drawWalls, drawLabels, drawSolutionOverlay.
 */

import { rgb } from 'pdf-lib';
import { DIRECTIONS } from '../../maze/grid.js';

function drawWall(page, x1, y1, x2, y2, thickness, isRounded) {
  let startX = x1;
  let startY = y1;
  let endX = x2;
  let endY = y2;
  if (!isRounded) {
    const half = thickness / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    startX = x1 - ux * half;
    startY = y1 - uy * half;
    endX = x2 + ux * half;
    endY = y2 + uy * half;
  }
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness,
    color: rgb(0, 0, 0),
    lineCap: isRounded ? 1 : 0,
  });
}

function drawArrow(page, x1, y1, x2, y2, headSize) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngle = Math.PI / 6;
  const head1X = x2 - headSize * Math.cos(angle - headAngle);
  const head1Y = y2 - headSize * Math.sin(angle - headAngle);
  const head2X = x2 - headSize * Math.cos(angle + headAngle);
  const head2Y = y2 - headSize * Math.sin(angle + headAngle);
  page.drawLine({ start: { x: x2, y: y2 }, end: { x: head1X, y: head1Y }, thickness: 2, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: x2, y: y2 }, end: { x: head2X, y: head2Y }, thickness: 2, color: rgb(0, 0, 0) });
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Maze with .grid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize, lineThickness, style }
 */
export function drawWalls(page, maze, layoutResult) {
  const grid = maze.grid;
  const { offsetX, offsetY, cellSize, lineThickness, style } = layoutResult;
  const isRounded = style === 'classic';
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.getCell(row, col);
      const x = offsetX + col * cellSize;
      const y = offsetY + (grid.rows - 1 - row) * cellSize;
      if (cell.hasWall(DIRECTIONS.TOP)) {
        drawWall(page, x, y + cellSize, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM)) {
        drawWall(page, x, y, x + cellSize, y, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.LEFT)) {
        drawWall(page, x, y, x, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT)) {
        drawWall(page, x + cellSize, y, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
    }
  }
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Maze with .grid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize }
 * @param {object} options - { useArrows, font, boldFont }
 */
export function drawLabels(page, maze, layoutResult, options) {
  const grid = maze.grid;
  const { offsetX, offsetY, cellSize } = layoutResult;
  const { useArrows, font, boldFont } = options;

  const startX = offsetX + cellSize / 2;
  const startY = offsetY + (grid.rows - 1) * cellSize + cellSize + 5;
  const finishX = offsetX + (grid.cols - 1) * cellSize + cellSize / 2;
  const finishY = offsetY - 5;

  if (useArrows) {
    drawArrow(page, startX, startY + 15, startX, startY, 8);
    drawArrow(page, finishX, finishY, finishX, finishY - 15, 8);
  } else {
    const fontSize = 10;
    const startText = 'Start';
    const startTextWidth = boldFont.widthOfTextAtSize(startText, fontSize);
    page.drawText(startText, { x: startX - startTextWidth / 2, y: startY + 5, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
    const finishText = 'Finish';
    const finishTextWidth = boldFont.widthOfTextAtSize(finishText, fontSize);
    page.drawText(finishText, { x: finishX - finishTextWidth / 2, y: finishY - fontSize - 5, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
  }
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Maze with .grid
 * @param {object[]} path - Array of { row, col }
 * @param {object} layoutResult - { offsetX, offsetY, cellSize }
 */
export function drawSolutionOverlay(page, maze, path, layoutResult) {
  const grid = maze.grid;
  const { offsetX, offsetY, cellSize } = layoutResult;
  const rows = grid.rows;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const x1 = offsetX + (prev.col + 0.5) * cellSize;
    const y1 = offsetY + (rows - 1 - prev.row + 0.5) * cellSize;
    const x2 = offsetX + (curr.col + 0.5) * cellSize;
    const y2 = offsetY + (rows - 1 - curr.row + 0.5) * cellSize;
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1.5,
      color: rgb(0.4, 0.4, 0.4),
      opacity: 0.7,
      dashArray: [4, 4],
    });
  }
}
