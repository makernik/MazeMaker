/**
 * Organic (jagged) maze drawer (unified): corridor walls, junction arcs,
 * labels, solution overlay.  All rendering goes through a DrawBackend.
 * Shared interface: drawWalls, drawLabels, drawSolutionOverlay.
 */

import { computeNodeTrims, computeCorridorWidth, prepareGraphData } from './organic-geometry.js';

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

/**
 * Draw corridor walls and junction arcs for a graph (main or filler).
 */
function drawGraphCorridors(backend, graph, nodePassages, allNodeTrims, params) {
  const { transform, wallThickness, halfW, scale } = params;
  const drawnEdges = new Set();

  backend.setStroke('#000', wallThickness, 'round');

  for (const node of graph.nodes) {
    for (const nid of node.neighbors) {
      const key = node.id < nid ? `${node.id}-${nid}` : `${nid}-${node.id}`;
      if (drawnEdges.has(key) || graph.hasWall(node.id, nid)) continue;
      drawnEdges.add(key);
      const other = graph.getNode(nid);
      if (!other) continue;
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const px = -uy;
      const py = ux;
      const trimsA = allNodeTrims.get(node.id);
      const trimsB = allNodeTrims.get(nid);
      const aTrim = trimsA ? trimsA.get(nid) : null;
      const bTrim = trimsB ? trimsB.get(node.id) : null;
      const cap = dist * 0.45;
      const ltA = Math.min(aTrim ? aTrim.leftTrim : 0, cap);
      const rtA = Math.min(aTrim ? aTrim.rightTrim : 0, cap);
      const ltB = Math.min(bTrim ? bTrim.leftTrim : 0, cap);
      const rtB = Math.min(bTrim ? bTrim.rightTrim : 0, cap);

      const s1 = transform(node.x + ux * ltA + px * halfW, node.y + uy * ltA + py * halfW);
      const e1 = transform(other.x - ux * rtB + px * halfW, other.y - uy * rtB + py * halfW);
      backend.line(s1.x, s1.y, e1.x, e1.y);

      const s2 = transform(node.x + ux * rtA - px * halfW, node.y + uy * rtA - py * halfW);
      const e2 = transform(other.x - ux * ltB - px * halfW, other.y - uy * ltB - py * halfW);
      backend.line(s2.x, s2.y, e2.x, e2.y);
    }
  }

  for (const node of graph.nodes) {
    const passages = nodePassages.get(node.id);
    if (!passages || passages.length === 0) continue;
    const cx = node.x;
    const cy = node.y;
    const n = passages.length;
    for (let i = 0; i < n; i++) {
      const curr = passages[i];
      const next = passages[(i + 1) % n];
      let gap = next.angle - curr.angle;
      if (i === n - 1) gap += 2 * Math.PI;
      if (gap < 0) gap += 2 * Math.PI;
      if (gap <= Math.PI) continue;

      const arcStart = curr.angle + Math.PI / 2;
      let arcEnd = next.angle - Math.PI / 2;
      if (i === n - 1) arcEnd += 2 * Math.PI;
      const span = arcEnd - arcStart;
      if (span < 0.02) continue;

      const center = transform(cx, cy);
      const r = halfW * scale;
      backend.beginPath();
      backend.arc(center.x, center.y, r, arcStart, arcEnd);
      backend.stroke();
    }
  }
}

/**
 * Draw organic maze (corridors, junctions, boundary). Returns stats for footer.
 *
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze
 * @param {object} layoutResult - { transform, lineThickness, scale }
 * @returns {{ corridorWidth: number, avgDist: number }|undefined}
 */
export function drawWalls(backend, maze, layoutResult) {
  const { transform, lineThickness, scale } = layoutResult;
  const { graph } = maze;
  const wallThickness = lineThickness * scale;

  const { corridorWidth, halfW, avgDist } = computeCorridorWidth(graph, lineThickness);

  const { nodePassages, allNodeTrims } = prepareGraphData(graph, halfW);
  const startPassages = nodePassages.get(maze.startId);
  if (startPassages) {
    startPassages.push({ nid: -1, angle: Math.PI / 2 });
    startPassages.sort((a, b) => a.angle - b.angle);
  }
  const finishPassages = nodePassages.get(maze.finishId);
  if (finishPassages) {
    finishPassages.push({ nid: -2, angle: -Math.PI / 2 });
    finishPassages.sort((a, b) => a.angle - b.angle);
  }
  if (startPassages && startPassages.length > 0) {
    allNodeTrims.set(maze.startId, computeNodeTrims(startPassages, halfW));
  }
  if (finishPassages && finishPassages.length > 0) {
    allNodeTrims.set(maze.finishId, computeNodeTrims(finishPassages, halfW));
  }

  const drawParams = { transform, wallThickness, halfW, scale };
  drawGraphCorridors(backend, graph, nodePassages, allNodeTrims, drawParams);

  if (maze.fillerGraph) {
    const fillerData = prepareGraphData(maze.fillerGraph, halfW);
    drawGraphCorridors(backend, maze.fillerGraph, fillerData.nodePassages, fillerData.allNodeTrims, drawParams);
  }

  backend.setStroke('#000', wallThickness, 'round');

  const bw = maze.boundsWidth;
  const bh = maze.boundsHeight;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  const halfThick = lineThickness / 2;

  const line = (x1, y1, x2, y2) => {
    const a = transform(x1, y1);
    const b = transform(x2, y2);
    backend.line(a.x, a.y, b.x, b.y);
  };

  const startTrims = allNodeTrims.get(maze.startId);
  const startVT = startTrims ? startTrims.get(-1) : { leftTrim: 0, rightTrim: 0 };
  const finishTrims = allNodeTrims.get(maze.finishId);
  const finishVT = finishTrims ? finishTrims.get(-2) : { leftTrim: 0, rightTrim: 0 };
  line(startPos.x - halfW, bh + halfThick, startPos.x - halfW, startPos.y + startVT.leftTrim - halfThick);
  line(startPos.x + halfW, bh + halfThick, startPos.x + halfW, startPos.y + startVT.rightTrim - halfThick);
  line(finishPos.x - halfW, 0 - halfThick, finishPos.x - halfW, finishPos.y - finishVT.rightTrim + halfThick);
  line(finishPos.x + halfW, 0 - halfThick, finishPos.x + halfW, finishPos.y - finishVT.leftTrim + halfThick);
  const gapHalf = halfW;
  line(0, bh, startPos.x - gapHalf, bh);
  line(startPos.x + gapHalf, bh, bw, bh);
  line(0, 0, finishPos.x - gapHalf, 0);
  line(finishPos.x + gapHalf, 0, bw, 0);
  line(0, 0, 0, bh);
  line(bw, 0, bw, bh);

  return { corridorWidth, avgDist };
}

/**
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze - Organic maze
 * @param {object} layoutResult - { transform, boundsWidth, boundsHeight }
 * @param {object} options - { useArrows, canvasHeight? }
 */
export function drawLabels(backend, maze, layoutResult, options = {}) {
  const { transform, boundsHeight } = layoutResult;
  const bTopLayout = transform(0, boundsHeight).y;
  const bBottomLayout = transform(0, 0).y;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight;
  const isCanvas = canvasHeight != null;
  const toY = isCanvas ? (y) => canvasHeight - y : (y) => y;
  const yDir = isCanvas ? -1 : 1;

  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  if (!startPos || !finishPos) return;
  const startX = transform(startPos.x, startPos.y).x;
  const finishX = transform(finishPos.x, finishPos.y).x;

  const topY = toY(bTopLayout);
  const bottomY = toY(bBottomLayout);
  const gap = 4;
  const fontSize = 10;

  const render = () => {
    if (useArrows) {
      drawArrow(backend, startX, topY + yDir * (gap + 15), startX, topY + yDir * gap, 8);
      drawArrow(backend, finishX, bottomY - yDir * gap, finishX, bottomY - yDir * (gap + 15), 8);
    } else {
      const startText = 'Start';
      const startW = backend.measureText(startText, { bold: true, fontSize });
      backend.drawText(startText, startX - startW / 2, topY + yDir * gap, { bold: true, fontSize });
      const finishText = 'Finish';
      const finishW = backend.measureText(finishText, { bold: true, fontSize });
      backend.drawText(finishText, finishX - finishW / 2, bottomY - yDir * (fontSize + gap), { bold: true, fontSize });
    }
  };

  if (isCanvas) {
    backend.withScreenTransform(render);
  } else {
    render();
  }
}

/**
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze - Organic maze with nodePositions
 * @param {number[]} path - Node ids
 * @param {object} layoutResult - { transform }
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const { transform } = layoutResult;
  const points = [];
  for (let i = 0; i < path.length; i++) {
    const pos = maze.nodePositions.get(path[i]);
    if (!pos) return;
    points.push(transform(pos.x, pos.y));
  }
  if (points.length < 2) return;

  backend.save();
  backend.setStroke('#666', 1.5, 'butt');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);

  if (points.length === 2) {
    backend.line(points[0].x, points[0].y, points[1].x, points[1].y);
  } else {
    backend.beginPath();
    backend.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      backend.quadraticCurveTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    backend.stroke();
  }

  backend.restore();
}
