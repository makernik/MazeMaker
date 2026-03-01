/**
 * Squares style drawer: outer maze + room cells (embedded sub-mazes).
 * C4: minimal — draw outer grid walls and labels; solution overlay for outer path.
 * C5/C6: full room borders, sub-maze walls, and per-room solution overlay.
 */

import { DIRECTIONS } from '../../maze/grid.js';

function drawArrow(backend, x1, y1, x2, y2, headSize) {
  backend.setStroke('#000', 2, 'butt');
  backend.line(x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngle = Math.PI / 6;
  const head1X = x2 - headSize * Math.cos(angle - headAngle);
  const head1Y = y2 - headSize * Math.sin(angle - headAngle);
  const head2X = x2 - headSize * Math.cos(angle + headAngle);
  const head2Y = y2 - headSize * Math.sin(angle + headAngle);
  backend.line(x2, y2, head1X, head1Y);
  backend.line(x2, y2, head2X, head2Y);
}

function drawWall(backend, x1, y1, x2, y2, thickness, isRounded) {
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
  backend.setStroke('#000', thickness, isRounded ? 'round' : 'butt');
  backend.line(startX, startY, endX, endY);
}

/** Gap as fraction of cell size for room opening (match outer corridor). */
const ROOM_OPENING_FRAC = 0.5;

/**
 * Draw one segment of room border, optionally with a centered gap (for openings).
 */
function drawBorderSegment(backend, x1, y1, x2, y2, thickness, isRounded, gapFrac) {
  if (gapFrac == null || gapFrac <= 0) {
    drawWall(backend, x1, y1, x2, y2, thickness, isRounded);
    return;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gapLen = len * gapFrac;
  const half = gapLen / 2;
  const mid = len / 2;
  drawWall(backend, x1, y1, x1 + ux * (mid - half), y1 + uy * (mid - half), thickness, isRounded);
  drawWall(backend, x1 + ux * (mid + half), y1 + uy * (mid + half), x2, y2, thickness, isRounded);
}

/**
 * Draw room cell: solid border with gaps at openings, then sub-maze walls inside (round caps).
 */
function drawRoomCell(backend, roomCell, roomX, roomY, cellSize, lineThickness, style, roomSubSize) {
  const isRounded = style === 'classic';
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;
  const openings = new Set(roomCell.openings);
  const gapFrac = ROOM_OPENING_FRAC;

  // Border: four sides, gap on opening directions
  const top = roomY + cellSize;
  const bottom = roomY;
  const left = roomX;
  const right = roomX + cellSize;
  drawBorderSegment(backend, left, top, right, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.TOP) ? gapFrac : 0);
  drawBorderSegment(backend, left, bottom, right, bottom, effectiveThickness, isRounded, openings.has(DIRECTIONS.BOTTOM) ? gapFrac : 0);
  drawBorderSegment(backend, left, bottom, left, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.LEFT) ? gapFrac : 0);
  drawBorderSegment(backend, right, bottom, right, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.RIGHT) ? gapFrac : 0);

  // Sub-maze inside: scaled to fit, round caps, thinner
  const subCellSize = cellSize / roomSubSize;
  const subThickness = Math.max(0.5, lineThickness * 0.4);
  const subGrid = roomCell.subGrid;
  backend.save();
  backend.setStroke('#000', subThickness, 'round');
  for (let sr = 0; sr < subGrid.rows; sr++) {
    for (let sc = 0; sc < subGrid.cols; sc++) {
      const cell = subGrid.getCell(sr, sc);
      const sx = roomX + sc * subCellSize;
      const sy = roomY + (roomSubSize - 1 - sr) * subCellSize;
      if (cell.hasWall(DIRECTIONS.TOP)) {
        backend.line(sx, sy + subCellSize, sx + subCellSize, sy + subCellSize);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM)) {
        backend.line(sx, sy, sx + subCellSize, sy);
      }
      if (cell.hasWall(DIRECTIONS.LEFT)) {
        backend.line(sx, sy, sx, sy + subCellSize);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT)) {
        backend.line(sx + subCellSize, sy, sx + subCellSize, sy + subCellSize);
      }
    }
  }
  backend.restore();
}

/**
 * Draw outer maze walls. Non-room cells: Classic grid logic. Room cells: border with gaps + sub-maze inside.
 *
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze - Maze with layout 'squares', outerGrid, roomsGrid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize, lineThickness, style, roomSubSize }
 */
export function drawWalls(backend, maze, layoutResult) {
  const grid = maze.outerGrid;
  const roomsGrid = maze.roomsGrid;
  const { offsetX, offsetY, cellSize, lineThickness, style, roomSubSize } = layoutResult;
  const isRounded = style === 'classic';
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x = offsetX + col * cellSize;
      const y = offsetY + (grid.rows - 1 - row) * cellSize;
      const roomCell = roomsGrid?.getRoomCell(row, col);

      if (roomCell) {
        drawRoomCell(backend, roomCell, x, y, cellSize, lineThickness, style, roomSubSize ?? roomCell.subGrid.rows);
      } else {
        const cell = grid.getCell(row, col);
        if (cell.hasWall(DIRECTIONS.TOP)) {
          drawWall(backend, x, y + cellSize, x + cellSize, y + cellSize, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.BOTTOM)) {
          drawWall(backend, x, y, x + cellSize, y, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.LEFT)) {
          drawWall(backend, x, y, x, y + cellSize, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.RIGHT)) {
          drawWall(backend, x + cellSize, y, x + cellSize, y + cellSize, effectiveThickness, isRounded);
        }
      }
    }
  }
}

/**
 * Draw Start/Finish labels on outer maze.
 *
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with outerGrid, start, finish
 * @param {object} layoutResult - { offsetX, offsetY, cellSize }
 * @param {object} options - { useArrows, canvasHeight? }
 */
export function drawLabels(backend, maze, layoutResult, options = {}) {
  const grid = maze.outerGrid;
  const { offsetX, offsetY, cellSize } = layoutResult;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight;
  const isCanvas = canvasHeight != null;
  const toY = isCanvas ? (y) => canvasHeight - y : (y) => y;
  const yDir = isCanvas ? -1 : 1;

  const startX = offsetX + cellSize / 2;
  const startY = toY(offsetY + (grid.rows - 1) * cellSize + cellSize + 5);
  const finishX = offsetX + (grid.cols - 1) * cellSize + cellSize / 2;
  const finishY = toY(offsetY - 5);
  const fontSize = 10;

  const render = () => {
    if (useArrows) {
      drawArrow(backend, startX, startY + yDir * 15, startX, startY, 8);
      drawArrow(backend, finishX, finishY, finishX, finishY - yDir * 15, 8);
    } else {
      const startText = 'Start';
      const startW = backend.measureText(startText, { bold: true, fontSize });
      backend.drawText(startText, startX - startW / 2, startY + yDir * 5, { bold: true, fontSize });
      const finishText = 'Finish';
      const finishW = backend.measureText(finishText, { bold: true, fontSize });
      backend.drawText(finishText, finishX - finishW / 2, finishY - yDir * (fontSize + 5), { bold: true, fontSize });
    }
  };

  if (isCanvas) {
    backend.withScreenTransform(render);
  } else {
    render();
  }
}

/**
 * Draw outer solution path. Room interior paths drawn in C6.
 *
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with outerGrid
 * @param {object[]} path - Outer path [{ row, col }]
 * @param {object} layoutResult - { offsetX, offsetY, cellSize }
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const grid = maze.outerGrid;
  const { offsetX, offsetY, cellSize } = layoutResult;
  const rows = grid.rows;

  backend.save();
  backend.setStroke('#666', 1.5, 'butt');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const x1 = offsetX + (prev.col + 0.5) * cellSize;
    const y1 = offsetY + (rows - 1 - prev.row + 0.5) * cellSize;
    const x2 = offsetX + (curr.col + 0.5) * cellSize;
    const y2 = offsetY + (rows - 1 - curr.row + 0.5) * cellSize;
    backend.line(x1, y1, x2, y2);
  }

  backend.restore();
}
