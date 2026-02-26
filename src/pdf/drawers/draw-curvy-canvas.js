/**
 * Curvy maze canvas drawer: quadratic-Bezier corridor walls with per-edge
 * midpoint bulge, plus cubic-Bezier junction curves.
 * Same layout contract as draw-organic-canvas.js (transform, scale, lineThickness).
 * Draws to CanvasRenderingContext2D with y-up transform set by caller.
 */

import { computeNodeTrims, prepareGraphData } from './organic-geometry.js';

export { drawLabels } from './draw-organic-canvas.js';

const BULGE_FACTOR = 0.22;

/**
 * Draw corridor walls as quadratic Bezier curves (offset midpoint) and
 * junction gaps as cubic Bezier arcs.
 */
function drawGraphCorridors(ctx, graph, nodePassages, allNodeTrims, params) {
  const { transform, wallThickness, halfW, scale } = params;
  const drawnEdges = new Set();

  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineWidth = wallThickness;

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

      const bulge = dist * BULGE_FACTOR;
      const variation = Math.sin(node.id * 0.7 + nid * 0.3);
      const offX = px * bulge * variation;
      const offY = py * bulge * variation;

      // Left wall — quadratic Bezier via offset midpoint
      const lS = { x: node.x + ux * ltA + px * halfW, y: node.y + uy * ltA + py * halfW };
      const lE = { x: other.x - ux * rtB + px * halfW, y: other.y - uy * rtB + py * halfW };
      const lQ = { x: (lS.x + lE.x) / 2 + offX, y: (lS.y + lE.y) / 2 + offY };
      const lSt = transform(lS.x, lS.y);
      const lQt = transform(lQ.x, lQ.y);
      const lEt = transform(lE.x, lE.y);
      ctx.beginPath();
      ctx.moveTo(lSt.x, lSt.y);
      ctx.quadraticCurveTo(lQt.x, lQt.y, lEt.x, lEt.y);
      ctx.stroke();

      // Right wall — same offset so corridor snakes without changing width
      const rS = { x: node.x + ux * rtA - px * halfW, y: node.y + uy * rtA - py * halfW };
      const rE = { x: other.x - ux * ltB - px * halfW, y: other.y - uy * ltB - py * halfW };
      const rQ = { x: (rS.x + rE.x) / 2 + offX, y: (rS.y + rE.y) / 2 + offY };
      const rSt = transform(rS.x, rS.y);
      const rQt = transform(rQ.x, rQ.y);
      const rEt = transform(rE.x, rE.y);
      ctx.beginPath();
      ctx.moveTo(rSt.x, rSt.y);
      ctx.quadraticCurveTo(rQt.x, rQt.y, rEt.x, rEt.y);
      ctx.stroke();
    }
  }

  // Junction curves (Bezier approximation of circular arcs)
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

      if (span > Math.PI * 0.95) {
        const midAngle = (arcStart + arcEnd) / 2;
        drawJunctionBezier(ctx, cx, cy, halfW, arcStart, midAngle, transform);
        drawJunctionBezier(ctx, cx, cy, halfW, midAngle, arcEnd, transform);
      } else {
        drawJunctionBezier(ctx, cx, cy, halfW, arcStart, arcEnd, transform);
      }
    }
  }
}

/** Cubic Bezier approximation of a circular arc on the halfW circle (canvas). */
function drawJunctionBezier(ctx, cx, cy, halfW, aStart, aEnd, transform) {
  const span = aEnd - aStart;
  const k = (4 / 3) * Math.tan(span / 4);
  const p1 = { x: cx + halfW * Math.cos(aStart), y: cy + halfW * Math.sin(aStart) };
  const p2 = { x: cx + halfW * Math.cos(aEnd), y: cy + halfW * Math.sin(aEnd) };
  const cp1 = {
    x: p1.x + k * halfW * (-Math.sin(aStart)),
    y: p1.y + k * halfW * Math.cos(aStart),
  };
  const cp2 = {
    x: p2.x - k * halfW * (-Math.sin(aEnd)),
    y: p2.y - k * halfW * Math.cos(aEnd),
  };
  const p1T = transform(p1.x, p1.y);
  const p2T = transform(p2.x, p2.y);
  const c1T = transform(cp1.x, cp1.y);
  const c2T = transform(cp2.x, cp2.y);
  ctx.beginPath();
  ctx.moveTo(p1T.x, p1T.y);
  ctx.bezierCurveTo(c1T.x, c1T.y, c2T.x, c2T.y, p2T.x, p2T.y);
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} maze
 * @param {object} layoutResult
 */
export function drawWalls(ctx, maze, layoutResult) {
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
  if (startPassages && startPassages.length > 0) {
    allNodeTrims.set(maze.startId, computeNodeTrims(startPassages, halfW));
  }
  if (finishPassages && finishPassages.length > 0) {
    allNodeTrims.set(maze.finishId, computeNodeTrims(finishPassages, halfW));
  }

  const drawParams = { transform, wallThickness, halfW, scale };
  drawGraphCorridors(ctx, graph, nodePassages, allNodeTrims, drawParams);

  if (maze.fillerGraph) {
    const fillerData = prepareGraphData(maze.fillerGraph, halfW);
    drawGraphCorridors(ctx, maze.fillerGraph, fillerData.nodePassages, fillerData.allNodeTrims, drawParams);
  }

  // Boundary walls (straight lines — same as jagged)
  const bw = maze.boundsWidth;
  const bh = maze.boundsHeight;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  const halfThick = lineThickness / 2;

  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineWidth = wallThickness;

  const line = (x1, y1, x2, y2) => {
    const a = transform(x1, y1);
    const b = transform(x2, y2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
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
}
