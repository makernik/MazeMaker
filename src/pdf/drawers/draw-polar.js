/**
 * Polar (circular) maze drawer: circumferential arcs and radial segments.
 * Backend-agnostic (same contract as draw-grid, draw-organic, draw-curvy).
 */

import { POLAR_DIRECTIONS } from '../../maze/polarGrid.js';

/**
 * Convert polar (angle in rad, radius) to layout x,y. Angle 0 = right, CCW positive.
 */
function polarToXY(centerX, centerY, angle, radius) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

/**
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with .polarGrid, layout 'polar'
 * @param {object} layoutResult - { centerX, centerY, maxRadius, roomRadius, lineThickness, rings, wedges }
 * @returns {object|undefined} Optional stats (e.g. for footer); polar drawer returns undefined
 */
export function drawWalls(backend, maze, layoutResult) {
  const grid = maze.polarGrid;
  const { centerX, centerY, maxRadius, lineThickness } = layoutResult;
  const roomRadius = layoutResult.roomRadius ?? maxRadius / grid.maxRing;
  const maxRing = grid.maxRing;
  const ringWidth = (maxRadius - roomRadius) / maxRing;
  backend.setStroke('#000', lineThickness, 'butt');

  // Center room: OUTWARD wall of ring 0 = circle at roomRadius (two semicircles for SVG)
  const centerCell = grid.getCell(0, 0);
  if (centerCell.hasWall(POLAR_DIRECTIONS.OUTWARD, 0)) {
    backend.beginPath();
    backend.moveTo(centerX + roomRadius, centerY);
    backend.arc(centerX, centerY, roomRadius, 0, Math.PI);
    backend.arc(centerX, centerY, roomRadius, Math.PI, 2 * Math.PI);
    backend.stroke();
  }

  for (let r = 1; r <= maxRing; r++) {
    const innerR = roomRadius + (r - 1) * ringWidth;
    const outerR = roomRadius + r * ringWidth;
    const wedgeCount = grid.wedgesAtRing(r);
    const angleStep = (2 * Math.PI) / wedgeCount;
    for (let w = 0; w < wedgeCount; w++) {
      const cell = grid.getCell(r, w);
      if (!cell) continue;
      const a0 = w * angleStep;
      const a1 = (w + 1) * angleStep;
      const outwardCount = cell.walls[POLAR_DIRECTIONS.OUTWARD].length;

      for (let i = 0; i < outwardCount; i++) {
        if (!cell.hasWall(POLAR_DIRECTIONS.OUTWARD, i)) continue;
        const segStart = (w + i / outwardCount) * angleStep;
        const segEnd = (w + (i + 1) / outwardCount) * angleStep;
        backend.beginPath();
        backend.moveTo(centerX + outerR * Math.cos(segStart), centerY + outerR * Math.sin(segStart));
        backend.arc(centerX, centerY, outerR, segStart, segEnd);
        backend.stroke();
      }
      if (cell.hasWall(POLAR_DIRECTIONS.INWARD)) {
        if (r === 1) {
          const p0 = polarToXY(centerX, centerY, a0, outerR);
          const p1 = polarToXY(centerX, centerY, a1, outerR);
          backend.line(centerX + roomRadius * Math.cos(a0), centerY + roomRadius * Math.sin(a0), p0.x, p0.y);
          backend.line(centerX + roomRadius * Math.cos(a1), centerY + roomRadius * Math.sin(a1), p1.x, p1.y);
        } else {
          backend.beginPath();
          backend.moveTo(centerX + innerR * Math.cos(a0), centerY + innerR * Math.sin(a0));
          backend.arc(centerX, centerY, innerR, a0, a1);
          backend.stroke();
        }
      }
      if (cell.hasWall(POLAR_DIRECTIONS.CW)) {
        const pInner = polarToXY(centerX, centerY, a1, r === 1 ? roomRadius : innerR);
        const pOuter = polarToXY(centerX, centerY, a1, outerR);
        backend.line(pInner.x, pInner.y, pOuter.x, pOuter.y);
      }
      if (cell.hasWall(POLAR_DIRECTIONS.CCW)) {
        const pInner = polarToXY(centerX, centerY, a0, r === 1 ? roomRadius : innerR);
        const pOuter = polarToXY(centerX, centerY, a0, outerR);
        backend.line(pInner.x, pInner.y, pOuter.x, pOuter.y);
      }
    }
  }
}

/**
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with .polarGrid, .start, .finish
 * @param {object} layoutResult - { centerX, centerY, maxRadius, roomRadius }
 * @param {object} options - { useArrows, canvasHeight? }
 */
export function drawLabels(backend, maze, layoutResult, options = {}) {
  const { centerX, centerY, maxRadius } = layoutResult;
  const roomRadius = layoutResult.roomRadius ?? maxRadius / maze.polarGrid.maxRing;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight;
  const isCanvas = canvasHeight != null;
  const toY = isCanvas ? (y) => canvasHeight - y : (y) => y;
  const yDir = isCanvas ? -1 : 1;

  // Start at top of circle (angle π/2), finish at center
  const startPos = polarToXY(centerX, centerY, Math.PI / 2, maxRadius);
  const startX = startPos.x;
  const startY = toY(startPos.y);
  const finishX = centerX;
  const finishY = toY(centerY);
  const fontSize = 10;

  const render = () => {
    if (useArrows) {
      backend.setStroke('#000', 2, 'butt');
      const shaftLen = 15;
      const headSize = 8;

      // Start arrow: shaft from boundary to tip just inside; arrowhead points inward (into maze from top)
      const startTipX = startX;
      const startTipY = startY - yDir * shaftLen;
      backend.line(startX, startY, startTipX, startTipY);
      backend.line(startTipX, startTipY, startTipX + headSize * 0.5, startTipY + yDir * headSize);
      backend.line(startTipX, startTipY, startTipX - headSize * 0.5, startTipY + yDir * headSize);

      // Finish arrow: shaft from room boundary to tip just inside room; arrowhead points inward (toward center)
      const arrowTipX = centerX + roomRadius - shaftLen;
      const arrowTipY = toY(centerY);
      backend.line(centerX + roomRadius, arrowTipY, arrowTipX, arrowTipY);
      backend.line(arrowTipX, arrowTipY, arrowTipX + headSize * Math.cos(0.5), arrowTipY - yDir * headSize * Math.sin(0.5));
      backend.line(arrowTipX, arrowTipY, arrowTipX + headSize * Math.cos(0.5), arrowTipY + yDir * headSize * Math.sin(0.5));
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
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with .polarGrid
 * @param {object[]} path - Array of { ring, wedge }
 * @param {object} layoutResult - { centerX, centerY, maxRadius, roomRadius, rings, wedges }
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const grid = maze.polarGrid;
  const { centerX, centerY, maxRadius } = layoutResult;
  const roomRadius = layoutResult.roomRadius ?? maxRadius / grid.maxRing;
  const maxRing = grid.maxRing;
  const ringWidth = (maxRadius - roomRadius) / maxRing;

  function cellToXY(r, w) {
    if (r === 0) return { x: centerX, y: centerY };
    const radius = roomRadius + (r - 0.5) * ringWidth;
    const wedgeCount = grid.wedgesAtRing(r);
    const angleStep = (2 * Math.PI) / wedgeCount;
    const angle = (w + 0.5) * angleStep;
    return polarToXY(centerX, centerY, angle, radius);
  }

  backend.save();
  backend.setStroke('#666', 1.5, 'butt');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const p1 = cellToXY(prev.ring, prev.wedge);
    const p2 = cellToXY(curr.ring, curr.wedge);
    backend.line(p1.x, p1.y, p2.x, p2.y);
  }

  backend.restore();
}
