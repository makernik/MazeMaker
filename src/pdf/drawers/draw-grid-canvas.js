/**
 * Grid maze canvas drawer: same layout contract as draw-grid.js (offsetX, offsetY, cellSize).
 * Draws to CanvasRenderingContext2D. Caller must set ctx transform for y-up (e.g. setTransform(1,0,0,-1,0,canvas.height)).
 */

import { DIRECTIONS } from '../../maze/grid.js';

function drawWall(ctx, x1, y1, x2, y2, thickness, isRounded) {
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
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.lineWidth = thickness;
  ctx.strokeStyle = '#000';
  ctx.lineCap = isRounded ? 'round' : 'butt';
  ctx.stroke();
}

function drawArrow(ctx, x1, y1, x2, y2, headSize) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngle = Math.PI / 6;
  const head1X = x2 - headSize * Math.cos(angle - headAngle);
  const head1Y = y2 - headSize * Math.sin(angle - headAngle);
  const head2X = x2 - headSize * Math.cos(angle + headAngle);
  const head2Y = y2 - headSize * Math.sin(angle + headAngle);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(head1X, head1Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(head2X, head2Y);
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx - Context with y-up transform applied (e.g. setTransform(1,0,0,-1,0,height))
 * @param {object} maze - Maze with .grid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize, lineThickness, style }
 */
export function drawWalls(ctx, maze, layoutResult) {
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
        drawWall(ctx, x, y + cellSize, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM)) {
        drawWall(ctx, x, y, x + cellSize, y, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.LEFT)) {
        drawWall(ctx, x, y, x, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT)) {
        drawWall(ctx, x + cellSize, y, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx - Caller has set y-up transform; we draw labels in screen space so text is right-side up.
 * @param {object} maze - Maze with .grid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize }
 * @param {object} options - { useArrows, canvasHeight } (canvasHeight required for correct label position)
 */
export function drawLabels(ctx, maze, layoutResult, options = {}) {
  const grid = maze.grid;
  const { offsetX, offsetY, cellSize } = layoutResult;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight ?? 0;

  const startX = offsetX + cellSize / 2;
  const startYLayout = offsetY + (grid.rows - 1) * cellSize + cellSize + 5;
  const finishX = offsetX + (grid.cols - 1) * cellSize + cellSize / 2;
  const finishYLayout = offsetY - 5;

  const toScreenY = (layoutY) => canvasHeight - layoutY;
  const startY = toScreenY(startYLayout);
  const finishY = toScreenY(finishYLayout);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const fontSize = 10;
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  if (useArrows) {
    drawArrow(ctx, startX, startY - 15, startX, startY, 8);
    drawArrow(ctx, finishX, finishY, finishX, finishY + 15, 8);
  } else {
    const startText = 'Start';
    const startTextWidth = ctx.measureText(startText).width;
    ctx.fillText(startText, startX - startTextWidth / 2, startY - 5);
    const finishText = 'Finish';
    const finishTextWidth = ctx.measureText(finishText).width;
    ctx.fillText(finishText, finishX - finishTextWidth / 2, finishY + fontSize + 5);
  }
  ctx.restore();
}
