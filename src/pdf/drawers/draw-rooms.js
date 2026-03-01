/**
 * Squares style drawer: outer maze + room cells (embedded sub-mazes).
 * C4: minimal — draw outer grid walls and labels; solution overlay for outer path.
 * C5/C6: full room borders, sub-maze walls, and per-room solution overlay.
 */

import { DIRECTIONS, DIRECTION_OFFSETS } from '../../maze/grid.js';

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

/**
 * Gap as fraction of that wall segment's length (not cell size).
 * Used in drawBorderSegment: gapLen = len * ROOM_OPENING_FRAC, so one centered gap per opening side.
 * Effect: 1×1 room → gap = 0.5×cellSize; K×1 side → gap = 0.5×K×cellSize. Plan said "match outer corridor" (≈1 cell); this scales with room size.
 */
const ROOM_OPENING_FRAC = 0.5;

/**
 * Derive opening directions from openingCells when openings is missing/empty.
 * Direction from block (or, oc) with size K to passage cell (r, c): which side of the block (r,c) is on.
 * @param {number} or - block top row
 * @param {number} oc - block left col
 * @param {number} K - block size
 * @param {{ row: number, col: number }[]} openingCells
 * @returns {number[]} DIRECTIONS values
 */
function openingsFromCells(or, oc, K, openingCells) {
  if (!openingCells || openingCells.length === 0) return [];
  const out = [];
  const oR = Number(or);
  const oC = Number(oc);
  const k = Number(K);
  for (const cell of openingCells) {
    const r = Number(cell.row);
    const c = Number(cell.col);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (r === oR - 1) out.push(DIRECTIONS.TOP);
    else if (r === oR + k) out.push(DIRECTIONS.BOTTOM);
    else if (c === oC - 1) out.push(DIRECTIONS.LEFT);
    else if (c === oC + k) out.push(DIRECTIONS.RIGHT);
  }
  return out;
}

/**
 * Resolve which opening directions to use for drawing gaps.
 * 1) Prefer roomCell.openings; 2) derive from roomCell.openingCells; 3) for 1×1 only, read from outerGrid.
 * @param {import('../../maze/roomsGrid.js').RoomCell} roomCell
 * @param {import('../../maze/grid.js').MazeGrid} [outerGrid] - used when openings/openingCells are missing (1×1 only)
 */
function getOpeningDirections(roomCell, outerGrid) {
  const fromOpenings = roomCell.openings;
  if (fromOpenings != null && fromOpenings.length > 0) return fromOpenings;
  const fromCells = openingsFromCells(
    roomCell.outerRow,
    roomCell.outerCol,
    roomCell.outerSize ?? 1,
    roomCell.openingCells
  );
  if (fromCells.length > 0) return fromCells;
  if (outerGrid && (roomCell.outerSize ?? 1) === 1) {
    const cell = outerGrid.getCell(roomCell.outerRow, roomCell.outerCol);
    if (cell) {
      const dirs = [];
      for (const d of Object.values(DIRECTIONS)) {
        if (!cell.hasWall(d)) dirs.push(d);
      }
      return dirs;
    }
  }
  return [];
}

/**
 * Draw one segment of room border, optionally with a centered gap (for openings).
 * Used for 1×1 rooms; for K>1 use drawRoomBorderSideWithGaps.
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
 * Return set of segment indices (0..K-1) that have an opening on the given side.
 * Block is [or, or+K) x [oc, oc+K]. TOP = row or-1; BOTTOM = or+K; LEFT = col oc-1; RIGHT = oc+K.
 */
function getOpeningIndicesForSide(or, oc, K, openingCells, side) {
  const indices = new Set();
  if (!openingCells) return indices;
  const oR = Number(or);
  const oC = Number(oc);
  const k = Number(K);
  for (const cell of openingCells) {
    const r = Number(cell.row);
    const c = Number(cell.col);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    if (side === DIRECTIONS.TOP && r === oR - 1) indices.add(c - oC);
    else if (side === DIRECTIONS.BOTTOM && r === oR + k) indices.add(c - oC);
    else if (side === DIRECTIONS.LEFT && c === oC - 1) indices.add(r - oR);
    else if (side === DIRECTIONS.RIGHT && c === oC + k) indices.add(r - oR);
  }
  return indices;
}

/**
 * Draw one side of the room as K segments; skip segments that are openings (cell-aligned gaps).
 */
function drawRoomBorderSideWithGaps(backend, roomX, roomY, blockSize, K, side, openingIndices, thickness, isRounded) {
  const segLen = blockSize / K;
  const top = roomY + blockSize;
  const bottom = roomY;
  const left = roomX;
  const right = roomX + blockSize;
  for (let i = 0; i < K; i++) {
    if (openingIndices.has(i)) continue;
    if (side === DIRECTIONS.TOP) {
      drawWall(backend, left + i * segLen, top, left + (i + 1) * segLen, top, thickness, isRounded);
    } else if (side === DIRECTIONS.BOTTOM) {
      drawWall(backend, left + i * segLen, bottom, left + (i + 1) * segLen, bottom, thickness, isRounded);
    } else if (side === DIRECTIONS.LEFT) {
      drawWall(backend, left, bottom + i * segLen, left, bottom + (i + 1) * segLen, thickness, isRounded);
    } else {
      drawWall(backend, right, bottom + i * segLen, right, bottom + (i + 1) * segLen, thickness, isRounded);
    }
  }
}

/**
 * Draw one room: solid border with gaps at openings, then sub-maze walls inside (round caps).
 * @param {number} blockSize - width/height of the room in points (cellSize for 1×1, roomOuterSize*cellSize for blocks)
 * @param {import('../../maze/grid.js').MazeGrid} [outerGrid] - optional, for fallback opening directions (1×1)
 */
function drawRoomCell(backend, roomCell, roomX, roomY, blockSize, lineThickness, style, roomSubSize, outerGrid) {
  const isRounded = style === 'classic';
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;
  const openingDirs = getOpeningDirections(roomCell, outerGrid);
  const openings = new Set(openingDirs);
  const gapFrac = ROOM_OPENING_FRAC;
  const K = roomCell.outerSize ?? 1;
  const or = roomCell.outerRow;
  const oc = roomCell.outerCol;
  const top = roomY + blockSize;
  const bottom = roomY;
  const left = roomX;
  const right = roomX + blockSize;

  backend.setStroke('#000', effectiveThickness, isRounded ? 'round' : 'butt');
  if (K > 1 && roomCell.openingCells?.length) {
    const openingIndicesTop = getOpeningIndicesForSide(or, oc, K, roomCell.openingCells, DIRECTIONS.TOP);
    const openingIndicesBottom = getOpeningIndicesForSide(or, oc, K, roomCell.openingCells, DIRECTIONS.BOTTOM);
    const openingIndicesLeft = getOpeningIndicesForSide(or, oc, K, roomCell.openingCells, DIRECTIONS.LEFT);
    const openingIndicesRight = getOpeningIndicesForSide(or, oc, K, roomCell.openingCells, DIRECTIONS.RIGHT);
    drawRoomBorderSideWithGaps(backend, roomX, roomY, blockSize, K, DIRECTIONS.TOP, openingIndicesTop, effectiveThickness, isRounded);
    drawRoomBorderSideWithGaps(backend, roomX, roomY, blockSize, K, DIRECTIONS.BOTTOM, openingIndicesBottom, effectiveThickness, isRounded);
    drawRoomBorderSideWithGaps(backend, roomX, roomY, blockSize, K, DIRECTIONS.LEFT, openingIndicesLeft, effectiveThickness, isRounded);
    drawRoomBorderSideWithGaps(backend, roomX, roomY, blockSize, K, DIRECTIONS.RIGHT, openingIndicesRight, effectiveThickness, isRounded);
  } else {
    drawBorderSegment(backend, left, top, right, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.TOP) ? gapFrac : 0);
    drawBorderSegment(backend, left, bottom, right, bottom, effectiveThickness, isRounded, openings.has(DIRECTIONS.BOTTOM) ? gapFrac : 0);
    drawBorderSegment(backend, left, bottom, left, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.LEFT) ? gapFrac : 0);
    drawBorderSegment(backend, right, bottom, right, top, effectiveThickness, isRounded, openings.has(DIRECTIONS.RIGHT) ? gapFrac : 0);
  }

  const subCellSize = blockSize / roomSubSize;
  const subThickness = Math.max(0.5, lineThickness * 0.4);
  const subGrid = roomCell.subGrid;
  /** Do not draw sub-maze walls on the room perimeter; the thick room border defines it. */
  const onRoomTop = (sr) => sr === 0;
  const onRoomBottom = (sr) => sr === roomSubSize - 1;
  const onRoomLeft = (sc) => sc === 0;
  const onRoomRight = (sc) => sc === roomSubSize - 1;

  backend.save();
  backend.setStroke('#000', subThickness, 'round');
  for (let sr = 0; sr < subGrid.rows; sr++) {
    for (let sc = 0; sc < subGrid.cols; sc++) {
      const cell = subGrid.getCell(sr, sc);
      const sx = roomX + sc * subCellSize;
      const sy = roomY + (roomSubSize - 1 - sr) * subCellSize;
      if (cell.hasWall(DIRECTIONS.TOP) && !onRoomTop(sr)) {
        backend.line(sx, sy + subCellSize, sx + subCellSize, sy + subCellSize);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM) && !onRoomBottom(sr)) {
        backend.line(sx, sy, sx + subCellSize, sy);
      }
      if (cell.hasWall(DIRECTIONS.LEFT) && !onRoomLeft(sc)) {
        backend.line(sx, sy, sx, sy + subCellSize);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT) && !onRoomRight(sc)) {
        backend.line(sx + subCellSize, sy, sx + subCellSize, sy + subCellSize);
      }
    }
  }
  backend.restore();
}

/**
 * Draw outer maze walls. Non-room cells: Classic grid logic. Room cells: border with gaps + sub-maze inside.
 * For roomOuterSize > 1, each room is drawn once as a block (roomOuterSize×cellSize); passage cells drawn per cell.
 *
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze - Maze with layout 'squares', outerGrid, roomsGrid
 * @param {object} layoutResult - { offsetX, offsetY, cellSize, lineThickness, style, roomSubSize, roomOuterSize }
 */
export function drawWalls(backend, maze, layoutResult) {
  const grid = maze.outerGrid;
  const roomsGrid = maze.roomsGrid;
  const { offsetX, offsetY, cellSize, lineThickness, style, roomSubSize, roomOuterSize } = layoutResult;
  const K = roomOuterSize ?? 1;
  const isRounded = style === 'classic';
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;
  const rows = grid.rows;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const roomCell = roomsGrid?.getRoomCell(row, col);
      if (roomCell && K > 1) {
        continue;
      }
      const x = offsetX + col * cellSize;
      const y = offsetY + (rows - 1 - row) * cellSize;
      if (roomCell) {
        drawRoomCell(backend, roomCell, x, y, cellSize, lineThickness, style, roomSubSize ?? roomCell.subGrid.rows, grid);
      } else {
        const cell = grid.getCell(row, col);
        const skipWall = (dir) => {
          const [dr, dc] = DIRECTION_OFFSETS[dir];
          const nr = row + dr;
          const nc = col + dc;
          return grid.isValidPosition(nr, nc) && roomsGrid?.isRoomCell(nr, nc);
        };
        if (cell.hasWall(DIRECTIONS.TOP) && !skipWall(DIRECTIONS.TOP)) {
          drawWall(backend, x, y + cellSize, x + cellSize, y + cellSize, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.BOTTOM) && !skipWall(DIRECTIONS.BOTTOM)) {
          drawWall(backend, x, y, x + cellSize, y, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.LEFT) && !skipWall(DIRECTIONS.LEFT)) {
          drawWall(backend, x, y, x, y + cellSize, effectiveThickness, isRounded);
        }
        if (cell.hasWall(DIRECTIONS.RIGHT) && !skipWall(DIRECTIONS.RIGHT)) {
          drawWall(backend, x + cellSize, y, x + cellSize, y + cellSize, effectiveThickness, isRounded);
        }
      }
    }
  }

  if (K > 1 && roomsGrid) {
    const blockSize = K * cellSize;
    for (const roomCell of roomsGrid.roomCells.values()) {
      const roomX = offsetX + roomCell.outerCol * cellSize;
      const roomY = offsetY + (rows - roomCell.outerRow - roomCell.outerSize) * cellSize;
      drawRoomCell(backend, roomCell, roomX, roomY, blockSize, lineThickness, style, roomSubSize ?? roomCell.subGrid.rows, grid);
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
 * Draw outer solution path and, for room cells on the path, their inner subSolutionPath.
 * Rooms not on the critical path get no inner path (dead-end indistinguishability).
 *
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with outerGrid, roomsGrid
 * @param {object[]} path - Outer path [{ row, col }]
 * @param {object} layoutResult - { offsetX, offsetY, cellSize, roomSubSize }
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const grid = maze.outerGrid;
  const roomsGrid = maze.roomsGrid;
  const { offsetX, offsetY, cellSize, roomSubSize } = layoutResult;
  const rows = grid.rows;

  backend.save();
  backend.setStroke('#666', 1.5, 'butt');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);

  const isOpeningPair = (a, b) => {
    if (!roomsGrid?.roomCells) return false;
    for (const room of roomsGrid.roomCells.values()) {
      const oc = room.openingCells;
      if (!oc || oc.length < 2) continue;
      const match = (oc[0].row === a.row && oc[0].col === a.col && oc[1].row === b.row && oc[1].col === b.col) ||
        (oc[0].row === b.row && oc[0].col === b.col && oc[1].row === a.row && oc[1].col === a.col);
      if (match) return true;
    }
    return false;
  };

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    if (isOpeningPair(prev, curr)) continue;
    const x1 = offsetX + (prev.col + 0.5) * cellSize;
    const y1 = offsetY + (rows - 1 - prev.row + 0.5) * cellSize;
    const x2 = offsetX + (curr.col + 0.5) * cellSize;
    const y2 = offsetY + (rows - 1 - curr.row + 0.5) * cellSize;
    backend.line(x1, y1, x2, y2);
  }

  // Inner solution for rooms on the critical path only (1×1: path contains room cell; block: path contains both openings)
  if (roomsGrid && path.length > 0) {
    const pathCellKeys = new Set(path.map((p) => `${p.row},${p.col}`));
    const subSize = roomSubSize ?? 0;
    const roomOuterSize = roomsGrid.roomOuterSize ?? 1;
    for (const roomCell of roomsGrid.roomCells.values()) {
      const onPath = roomOuterSize === 1
        ? pathCellKeys.has(`${roomCell.outerRow},${roomCell.outerCol}`)
        : (roomCell.openingCells?.length >= 2 &&
           pathCellKeys.has(`${roomCell.openingCells[0].row},${roomCell.openingCells[0].col}`) &&
           pathCellKeys.has(`${roomCell.openingCells[1].row},${roomCell.openingCells[1].col}`));
      if (!onPath) continue;
      const subPath = roomCell.subSolutionPath;
      if (!subPath || subPath.length < 2) continue;
      const K = roomCell.outerSize ?? 1;
      const roomX = offsetX + roomCell.outerCol * cellSize;
      const roomY = offsetY + (rows - roomCell.outerRow - K) * cellSize;
      const subCellSize = subSize > 0 ? (K * cellSize) / subSize : cellSize;
      for (let j = 1; j < subPath.length; j++) {
        const prev = subPath[j - 1];
        const curr = subPath[j];
        const x1 = roomX + (prev.col + 0.5) * subCellSize;
        const y1 = roomY + (subSize - 1 - prev.row + 0.5) * subCellSize;
        const x2 = roomX + (curr.col + 0.5) * subCellSize;
        const y2 = roomY + (subSize - 1 - curr.row + 0.5) * subCellSize;
        backend.line(x1, y1, x2, y2);
      }
    }
  }

  backend.restore();
}
