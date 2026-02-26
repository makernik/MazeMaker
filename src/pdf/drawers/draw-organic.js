/**
 * Organic maze drawer: corridor walls, labels, solution overlay.
 * Shared interface: drawWalls (returns stats for footer), drawLabels, drawSolutionOverlay.
 */

import { rgb } from 'pdf-lib';
import { computeNodeTrims } from './organic-geometry.js';

function drawArrow(page, x1, y1, x2, y2, headSize) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 2, color: rgb(0, 0, 0) });
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
 * Compute passage directions and miter trims for all nodes in a graph.
 */
function prepareGraphData(graph, halfW) {
  const nodePassages = new Map();
  for (const node of graph.nodes) {
    const passages = [];
    for (const nid of node.neighbors) {
      if (graph.hasWall(node.id, nid)) continue;
      const other = graph.getNode(nid);
      if (!other) continue;
      passages.push({ nid, angle: Math.atan2(other.y - node.y, other.x - node.x) });
    }
    passages.sort((a, b) => a.angle - b.angle);
    nodePassages.set(node.id, passages);
  }
  const allNodeTrims = new Map();
  for (const node of graph.nodes) {
    const passages = nodePassages.get(node.id);
    if (passages && passages.length > 0) {
      allNodeTrims.set(node.id, computeNodeTrims(passages, halfW));
    }
  }
  return { nodePassages, allNodeTrims };
}

/**
 * Draw corridor walls and junction arcs for a graph (main or filler).
 */
function drawGraphCorridors(page, graph, nodePassages, allNodeTrims, params) {
  const { transform, wallThickness, halfW, scale } = params;
  const drawnEdges = new Set();

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
      page.drawLine({
        start: transform(node.x + ux * ltA + px * halfW, node.y + uy * ltA + py * halfW),
        end: transform(other.x - ux * rtB + px * halfW, other.y - uy * rtB + py * halfW),
        thickness: wallThickness,
        color: rgb(0, 0, 0),
        lineCap: 1,
      });
      page.drawLine({
        start: transform(node.x + ux * rtA - px * halfW, node.y + uy * rtA - py * halfW),
        end: transform(other.x - ux * ltB - px * halfW, other.y - uy * ltB - py * halfW),
        thickness: wallThickness,
        color: rgb(0, 0, 0),
        lineCap: 1,
      });
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

      const r = halfW * scale;
      if (Math.abs(span - Math.PI) < 0.01) {
        const midAngle = (arcStart + arcEnd) / 2;
        const p1 = transform(cx + halfW * Math.cos(arcStart), cy + halfW * Math.sin(arcStart));
        const pm = transform(cx + halfW * Math.cos(midAngle), cy + halfW * Math.sin(midAngle));
        const p2 = transform(cx + halfW * Math.cos(arcEnd), cy + halfW * Math.sin(arcEnd));
        const arcOpts = { borderColor: rgb(0, 0, 0), borderWidth: wallThickness, borderLineCap: 1 };
        page.drawSvgPath(`M ${p1.x} ${-p1.y} A ${r} ${r} 0 0 0 ${pm.x} ${-pm.y}`, arcOpts);
        page.drawSvgPath(`M ${pm.x} ${-pm.y} A ${r} ${r} 0 0 0 ${p2.x} ${-p2.y}`, arcOpts);
      } else {
        const p1 = transform(cx + halfW * Math.cos(arcStart), cy + halfW * Math.sin(arcStart));
        const p2 = transform(cx + halfW * Math.cos(arcEnd), cy + halfW * Math.sin(arcEnd));
        const largeArc = span > Math.PI ? 1 : 0;
        page.drawSvgPath(`M ${p1.x} ${-p1.y} A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${-p2.y}`, {
          borderColor: rgb(0, 0, 0),
          borderWidth: wallThickness,
          borderLineCap: 1,
        });
      }
    }
  }
}

/**
 * Draw organic maze (corridors, junctions, boundary). Returns stats for footer.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Organic maze with graph, nodePositions, startId, finishId, boundsWidth, boundsHeight
 * @param {object} layoutResult - { transform, lineThickness, scale }
 * @returns {{ corridorWidth: number, avgDist: number }|undefined}
 */
export function drawWalls(page, maze, layoutResult) {
  const { transform, lineThickness, scale } = layoutResult;
  const { graph } = maze;
  const wallThickness = lineThickness * scale;

  let totalDist = 0;
  let edgeCount = 0;
  for (const node of graph.nodes) {
    for (const nid of node.neighbors) {
      if (nid > node.id) {
        const other = graph.getNode(nid);
        if (!other) continue;
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
        edgeCount++;
      }
    }
  }
  const avgDist = edgeCount > 0 ? totalDist / edgeCount : 30;
  const maxCorridorW = avgDist * 0.35;
  const corridorWidth = Math.max(lineThickness * 2, Math.min(Math.max(lineThickness * 3, 8), maxCorridorW));
  const halfW = corridorWidth / 2;

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
  // Recompute trims for start/finish after adding virtual passages
  if (startPassages && startPassages.length > 0) {
    allNodeTrims.set(maze.startId, computeNodeTrims(startPassages, halfW));
  }
  if (finishPassages && finishPassages.length > 0) {
    allNodeTrims.set(maze.finishId, computeNodeTrims(finishPassages, halfW));
  }

  const drawParams = { transform, wallThickness, halfW, scale };
  drawGraphCorridors(page, graph, nodePassages, allNodeTrims, drawParams);

  if (maze.fillerGraph) {
    const fillerData = prepareGraphData(maze.fillerGraph, halfW);
    drawGraphCorridors(page, maze.fillerGraph, fillerData.nodePassages, fillerData.allNodeTrims, drawParams);
  }

  const bw = maze.boundsWidth;
  const bh = maze.boundsHeight;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  const lineOpts = { thickness: wallThickness, color: rgb(0, 0, 0), lineCap: 1 };
  const halfThick = lineThickness / 2;
  const startTrims = allNodeTrims.get(maze.startId);
  const startVT = startTrims ? startTrims.get(-1) : { leftTrim: 0, rightTrim: 0 };
  const finishTrims = allNodeTrims.get(maze.finishId);
  const finishVT = finishTrims ? finishTrims.get(-2) : { leftTrim: 0, rightTrim: 0 };
  page.drawLine({ start: transform(startPos.x - halfW, bh + halfThick), end: transform(startPos.x - halfW, startPos.y + startVT.leftTrim - halfThick), ...lineOpts });
  page.drawLine({ start: transform(startPos.x + halfW, bh + halfThick), end: transform(startPos.x + halfW, startPos.y + startVT.rightTrim - halfThick), ...lineOpts });
  page.drawLine({ start: transform(finishPos.x - halfW, 0 - halfThick), end: transform(finishPos.x - halfW, finishPos.y - finishVT.rightTrim + halfThick), ...lineOpts });
  page.drawLine({ start: transform(finishPos.x + halfW, 0 - halfThick), end: transform(finishPos.x + halfW, finishPos.y - finishVT.leftTrim + halfThick), ...lineOpts });
  const gapHalf = halfW;
  page.drawLine({ start: transform(0, bh), end: transform(startPos.x - gapHalf, bh), ...lineOpts });
  page.drawLine({ start: transform(startPos.x + gapHalf, bh), end: transform(bw, bh), ...lineOpts });
  page.drawLine({ start: transform(0, 0), end: transform(finishPos.x - gapHalf, 0), ...lineOpts });
  page.drawLine({ start: transform(finishPos.x + gapHalf, 0), end: transform(bw, 0), ...lineOpts });
  page.drawLine({ start: transform(0, 0), end: transform(0, bh), ...lineOpts });
  page.drawLine({ start: transform(bw, 0), end: transform(bw, bh), ...lineOpts });

  return { corridorWidth, avgDist };
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Organic maze
 * @param {object} layoutResult - { transform, boundsWidth, boundsHeight }
 * @param {object} options - { useArrows, font, boldFont }
 */
export function drawLabels(page, maze, layoutResult, options) {
  const { transform, boundsWidth, boundsHeight } = layoutResult;
  const boundaryTop = transform(0, boundsHeight).y;
  const boundaryBottom = transform(0, 0).y;
  const { useArrows, font, boldFont } = options;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  if (!startPos || !finishPos) return;
  const startX = transform(startPos.x, startPos.y).x;
  const finishX = transform(finishPos.x, finishPos.y).x;
  const gap = 4;
  if (useArrows) {
    drawArrow(page, startX, boundaryTop + gap + 15, startX, boundaryTop + gap, 8);
    drawArrow(page, finishX, boundaryBottom - gap, finishX, boundaryBottom - gap - 15, 8);
  } else {
    const fontSize = 10;
    const startText = 'Start';
    page.drawText(startText, { x: startX - boldFont.widthOfTextAtSize(startText, fontSize) / 2, y: boundaryTop + gap, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
    const finishText = 'Finish';
    page.drawText(finishText, { x: finishX - boldFont.widthOfTextAtSize(finishText, fontSize) / 2, y: boundaryBottom - fontSize - gap, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
  }
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze - Organic maze with nodePositions
 * @param {number[]} path - Node ids
 * @param {object} layoutResult - { transform }
 */
export function drawSolutionOverlay(page, maze, path, layoutResult) {
  const { transform } = layoutResult;
  const points = [];
  for (let i = 0; i < path.length; i++) {
    const pos = maze.nodePositions.get(path[i]);
    if (!pos) return;
    points.push(transform(pos.x, pos.y));
  }
  if (points.length < 2) return;
  const lineOpts = { thickness: 1.5, color: rgb(0.4, 0.4, 0.4), opacity: 0.7, dashArray: [4, 4] };
  if (points.length === 2) {
    page.drawLine({ start: points[0], end: points[1], ...lineOpts });
    return;
  }
  const toSvg = (p) => `${p.x} ${-p.y}`;
  const parts = [`M ${toSvg(points[0])}`];
  for (let i = 1; i < points.length - 1; i++) {
    parts.push(`Q ${toSvg(points[i])} ${toSvg(points[i + 1])}`);
  }
  page.drawSvgPath(parts.join(' '), {
    x: 0,
    y: 0,
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1.5,
    borderDashArray: [4, 4],
    opacity: 0.7,
  });
}
