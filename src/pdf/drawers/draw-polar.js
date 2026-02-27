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
 * @param {object} layoutResult - { centerX, centerY, maxRadius, lineThickness, rings, wedges }
 * @returns {object|undefined} Optional stats (e.g. for footer); polar drawer returns undefined
 */
export function drawWalls(backend, maze, layoutResult) {
  const grid = maze.polarGrid;
  const { centerX, centerY, maxRadius, lineThickness, rings, wedges } = layoutResult;
  const maxRing = grid.maxRing;
  const angleStep = (2 * Math.PI) / wedges;
  backend.setStroke('#000', lineThickness, 'butt');

  // Ring 0 (center): only OUTWARD wall = full circle at ring 1 outer radius (two semicircles for SVG)
  const centerCell = grid.getCell(0, 0);
  if (centerCell.hasWall(POLAR_DIRECTIONS.OUTWARD)) {
    const r1 = maxRadius / maxRing;
    backend.beginPath();
    backend.moveTo(centerX + r1, centerY);
    backend.arc(centerX, centerY, r1, 0, Math.PI);
    backend.arc(centerX, centerY, r1, Math.PI, 2 * Math.PI);
    backend.stroke();
  }

  for (let r = 1; r <= maxRing; r++) {
    const innerR = (r - 1) * (maxRadius / maxRing);
    const outerR = r * (maxRadius / maxRing);
    const wedgeCount = r === 0 ? 1 : wedges;
    for (let w = 0; w < wedgeCount; w++) {
      const cell = grid.getCell(r, w);
      if (!cell) continue;
      const a0 = w * angleStep;
      const a1 = (w + 1) * angleStep;

      if (cell.hasWall(POLAR_DIRECTIONS.OUTWARD)) {
        backend.beginPath();
        backend.moveTo(centerX + outerR * Math.cos(a0), centerY + outerR * Math.sin(a0));
        backend.arc(centerX, centerY, outerR, a0, a1);
        backend.stroke();
      }
      if (cell.hasWall(POLAR_DIRECTIONS.INWARD)) {
        if (r === 1) {
          const p0 = polarToXY(centerX, centerY, a0, outerR);
          const p1 = polarToXY(centerX, centerY, a1, outerR);
          backend.line(centerX, centerY, p0.x, p0.y);
          backend.line(centerX, centerY, p1.x, p1.y);
        } else {
          backend.beginPath();
          backend.moveTo(centerX + innerR * Math.cos(a0), centerY + innerR * Math.sin(a0));
          backend.arc(centerX, centerY, innerR, a0, a1);
          backend.stroke();
        }
      }
      if (cell.hasWall(POLAR_DIRECTIONS.CW)) {
        const pInner = polarToXY(centerX, centerY, a1, r === 1 ? 0 : innerR);
        const pOuter = polarToXY(centerX, centerY, a1, outerR);
        backend.line(pInner.x, pInner.y, pOuter.x, pOuter.y);
      }
      if (cell.hasWall(POLAR_DIRECTIONS.CCW)) {
        const pInner = polarToXY(centerX, centerY, a0, r === 1 ? 0 : innerR);
        const pOuter = polarToXY(centerX, centerY, a0, outerR);
        backend.line(pInner.x, pInner.y, pOuter.x, pOuter.y);
      }
    }
  }
}

/**
 * @param {object} backend - DrawBackend
 * @param {object} maze - Maze with .polarGrid, .finish
 * @param {object} layoutResult - { centerX, centerY, maxRadius }
 * @param {object} options - { useArrows, canvasHeight? }
 */
export function drawLabels(backend, maze, layoutResult, options = {}) {
  const { centerX, centerY, maxRadius } = layoutResult;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight;
  const isCanvas = canvasHeight != null;
  const toY = isCanvas ? (y) => canvasHeight - y : (y) => y;
  const yDir = isCanvas ? -1 : 1;

  const startX = centerX;
  const startY = toY(centerY);
  const finishX = centerX + maxRadius;
  const finishY = toY(centerY);
  const fontSize = 10;

  const render = () => {
    if (useArrows) {
      backend.setStroke('#000', 2, 'butt');
      backend.line(startX, startY + yDir * 15, startX, startY);
      backend.line(finishX - 15, finishY, finishX, finishY);
      const headSize = 8;
      backend.line(finishX, finishY, finishX - headSize, finishY - headSize * 0.5);
      backend.line(finishX, finishY, finishX - headSize, finishY + headSize * 0.5);
      backend.line(startX, startY, startX + headSize * 0.5, startY - yDir * headSize);
      backend.line(startX, startY, startX - headSize * 0.5, startY - yDir * headSize);
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
 * @param {object} layoutResult - { centerX, centerY, maxRadius, rings, wedges }
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const grid = maze.polarGrid;
  const { centerX, centerY, maxRadius, wedges } = layoutResult;
  const maxRing = grid.maxRing;
  const angleStep = (2 * Math.PI) / wedges;

  function cellToXY(r, w) {
    if (r === 0) return { x: centerX, y: centerY };
    const radius = (r - 0.5) * (maxRadius / maxRing);
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
