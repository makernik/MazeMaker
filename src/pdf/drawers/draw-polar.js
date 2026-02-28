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
  backend.setStroke('#000', lineThickness, 'round');

  // Room border: always draw a circle at roomRadius to delineate the center room from the maze.
  // Leave a gap at the passage (wedge 0 on ring 1) so the path into the room is open.
  const ring1W = grid.wedgesAtRing(1);
  const angleStep1 = (2 * Math.PI) / ring1W;
  const passageAngle = 0.5 * angleStep1;
  const gapHalf = 0.5 * angleStep1;
  const gapStart = passageAngle - gapHalf;
  const gapEnd = passageAngle + gapHalf;
  // Draw room border so the gap (0 to gapEnd) is left open. Use arcs with span < π so the backend
  // draws the short arc from gapEnd to π (not the long arc through 0° which would close the gap).
  const midGapToPi = (gapEnd + Math.PI) / 2;
  backend.beginPath();
  backend.moveTo(centerX + roomRadius * Math.cos(gapEnd), centerY + roomRadius * Math.sin(gapEnd));
  backend.arc(centerX, centerY, roomRadius, gapEnd, midGapToPi);
  backend.arc(centerX, centerY, roomRadius, midGapToPi, Math.PI);
  backend.arc(centerX, centerY, roomRadius, Math.PI, 2 * Math.PI);
  backend.stroke();

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
        // Inner boundary: for r===1 it's the room circle; for r>1 it's the inner ring edge.
        const innerBoundR = r === 1 ? roomRadius : innerR;
        backend.beginPath();
        backend.moveTo(centerX + innerBoundR * Math.cos(a0), centerY + innerBoundR * Math.sin(a0));
        backend.arc(centerX, centerY, innerBoundR, a0, a1);
        backend.stroke();
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
  const grid = maze.polarGrid;
  const { centerX, centerY, maxRadius } = layoutResult;
  const roomRadius = layoutResult.roomRadius ?? maxRadius / grid.maxRing;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight;
  const isCanvas = canvasHeight != null;
  const toY = isCanvas ? (y) => canvasHeight - y : (y) => y;
  const yDir = isCanvas ? -1 : 1;

  // Start: center of gap = center of start wedge on outer ring (angle at wedge mid)
  const outerW = grid.wedgesAtRing(grid.maxRing);
  const startAngle = (maze.start.wedge + 0.5) * (2 * Math.PI / outerW);
  const startBoundary = polarToXY(centerX, centerY, startAngle, maxRadius);
  const startTip = polarToXY(centerX, centerY, startAngle, maxRadius - 15);
  const startX = startBoundary.x;
  const startY = toY(startBoundary.y);
  const finishX = centerX;
  const finishY = toY(centerY);
  const fontSize = 10;

  // Finish: center of gap = center of wedge 0 on ring 1 (passage into center room)
  const ring1W = grid.wedgesAtRing(1);
  const finishAngle = (0 + 0.5) * (2 * Math.PI / ring1W);
  const finishBoundary = polarToXY(centerX, centerY, finishAngle, roomRadius);
  const finishTip = polarToXY(centerX, centerY, finishAngle, roomRadius - 15);

  const render = () => {
    if (useArrows) {
      backend.setStroke('#000', 2, 'round');
      const shaftLen = 15;
      const headSize = 8;
      const headSpread = 0.5;

      // Start arrow: shaft from boundary to tip; arrowhead points inward
      backend.line(startBoundary.x, toY(startBoundary.y), startTip.x, toY(startTip.y));
      backend.line(startTip.x, toY(startTip.y), startTip.x + headSize * Math.cos(startAngle + headSpread), toY(startTip.y + headSize * Math.sin(startAngle + headSpread)));
      backend.line(startTip.x, toY(startTip.y), startTip.x + headSize * Math.cos(startAngle - headSpread), toY(startTip.y + headSize * Math.sin(startAngle - headSpread)));

      // Finish arrow: shaft from room boundary to tip; arrowhead points inward (toward center)
      backend.line(finishBoundary.x, toY(finishBoundary.y), finishTip.x, toY(finishTip.y));
      backend.line(finishTip.x, toY(finishTip.y), finishTip.x + headSize * Math.cos(finishAngle + headSpread), toY(finishTip.y + headSize * Math.sin(finishAngle + headSpread)));
      backend.line(finishTip.x, toY(finishTip.y), finishTip.x + headSize * Math.cos(finishAngle - headSpread), toY(finishTip.y + headSize * Math.sin(finishAngle - headSpread)));
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
 * Waypoint on the boundary between two cells (passage) so the solution path stays inside corridors.
 * @param {number} ring - Ring of the cell we're leaving
 * @param {number} wedge - Wedge of the cell we're leaving
 * @param {object} curr - Next cell { ring, wedge }
 * @param {object} grid - PolarGrid
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} roomRadius
 * @param {number} ringWidth
 */
function passageWaypoint(prev, curr, grid, centerX, centerY, roomRadius, ringWidth) {
  const W = grid.wedgesAtRing(prev.ring);
  const angleStep = (2 * Math.PI) / W;

  if (prev.ring === curr.ring) {
    // CW/CCW: cross radial boundary at mid-radius of the ring
    const innerR = roomRadius + (prev.ring - 1) * ringWidth;
    const outerR = roomRadius + prev.ring * ringWidth;
    const midR = (innerR + outerR) / 2;
    const passageAngle = curr.wedge === (prev.wedge + 1) % W
      ? (prev.wedge + 1) * angleStep
      : prev.wedge * angleStep;
    return polarToXY(centerX, centerY, passageAngle, midR);
  }

  // INWARD or OUTWARD: cross arc boundary at midpoint of wedge angle
  const boundaryR = prev.ring > curr.ring
    ? roomRadius + (prev.ring - 1) * ringWidth  // inner edge of prev
    : roomRadius + prev.ring * ringWidth;       // outer edge of prev
  // From center (0,0) use next cell's wedge; otherwise use prev cell's wedge
  const wedgeAngle = prev.ring === 0
    ? (curr.wedge + 0.5) * (2 * Math.PI) / grid.wedgesAtRing(curr.ring)
    : (prev.wedge + 0.5) * angleStep;
  return polarToXY(centerX, centerY, wedgeAngle, boundaryR);
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
  backend.setStroke('#666', 1.5, 'round');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const p1 = cellToXY(prev.ring, prev.wedge);
    const p2 = cellToXY(curr.ring, curr.wedge);
    const way = passageWaypoint(prev, curr, grid, centerX, centerY, roomRadius, ringWidth);
    backend.line(p1.x, p1.y, way.x, way.y);
    backend.line(way.x, way.y, p2.x, p2.y);
  }

  backend.restore();
}
