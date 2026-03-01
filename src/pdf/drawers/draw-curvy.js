/**
 * Curvy maze drawer (unified): continuous Catmull-Rom spline walls along
 * chains of pass-through nodes, plus cubic-Bezier junction arcs.
 * Same generation and layout as jagged; only the rendering differs.
 * Labels and solution overlay are identical to jagged — re-exported directly.
 * All rendering goes through a DrawBackend (pdf or canvas).
 */

import {
  computeNodeTrims,
  computeCorridorWidth,
  prepareGraphData,
  catmullRomToBezier,
  extractThreads,
  enhanceDeadEndThreads,
  phantomFactor,
} from './organic-geometry.js';

export { drawLabels, drawSolutionOverlay } from './draw-organic.js';

// ---------------------------------------------------------------------------
// Spline helpers
// ---------------------------------------------------------------------------

function addPhantoms(pts, halfW) {
  const first = pts[0];
  const second = pts[1];
  const segLen0 = Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2) || 1;
  const f0 = phantomFactor(segLen0, halfW);
  const phantom0 = {
    x: first.x - (second.x - first.x) * f0,
    y: first.y - (second.y - first.y) * f0,
  };

  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const segLenN = Math.sqrt((last.x - prev.x) ** 2 + (last.y - prev.y) ** 2) || 1;
  const fN = phantomFactor(segLenN, halfW);
  const phantomN = {
    x: last.x + (last.x - prev.x) * fN,
    y: last.y + (last.y - prev.y) * fN,
  };

  return [phantom0, ...pts, phantomN];
}

function drawSplinePath(backend, fullPts, transform) {
  const segCount = fullPts.length - 3;
  if (segCount < 1) return;

  const s = transform(fullPts[1].x, fullPts[1].y);
  backend.beginPath();
  backend.moveTo(s.x, s.y);

  for (let i = 0; i < segCount; i++) {
    const p0 = fullPts[i];
    const p1 = fullPts[i + 1];
    const p2 = fullPts[i + 2];
    const p3 = fullPts[i + 3];
    const b = catmullRomToBezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    const c1 = transform(b.cp1x, b.cp1y);
    const c2 = transform(b.cp2x, b.cp2y);
    const e = transform(p2.x, p2.y);
    backend.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
  }

  backend.stroke();
}

// ---------------------------------------------------------------------------
// Straight-line fallback (per-edge, same as jagged)
// ---------------------------------------------------------------------------

function drawThreadStraight(backend, thread, graph, allNodeTrims, halfW, transform) {
  for (let i = 0; i < thread.length - 1; i++) {
    const node = graph.getNode(thread[i]);
    const other = graph.getNode(thread[i + 1]);
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    const trimsA = allNodeTrims.get(thread[i]);
    const trimsB = allNodeTrims.get(thread[i + 1]);
    const aTrim = trimsA ? trimsA.get(thread[i + 1]) : null;
    const bTrim = trimsB ? trimsB.get(thread[i]) : null;
    const cap = dist * 0.45;
    const ltA = Math.min(aTrim ? aTrim.leftTrim : 0, cap);
    const rtA = Math.min(aTrim ? aTrim.rightTrim : 0, cap);
    const ltB = Math.min(bTrim ? bTrim.leftTrim : 0, cap);
    const rtB = Math.min(bTrim ? bTrim.rightTrim : 0, cap);

    const lS = transform(node.x + ux * ltA + px * halfW, node.y + uy * ltA + py * halfW);
    const lE = transform(other.x - ux * rtB + px * halfW, other.y - uy * rtB + py * halfW);
    backend.line(lS.x, lS.y, lE.x, lE.y);

    const rS = transform(node.x + ux * rtA - px * halfW, node.y + uy * rtA - py * halfW);
    const rE = transform(other.x - ux * ltB - px * halfW, other.y - uy * ltB - py * halfW);
    backend.line(rS.x, rS.y, rE.x, rE.y);
  }
}

// ---------------------------------------------------------------------------
// Junction arcs (cubic Bezier approximation of circular arcs)
// ---------------------------------------------------------------------------

function drawJunctionBezier(backend, cx, cy, halfW, aStart, aEnd, transform) {
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
  backend.beginPath();
  backend.moveTo(p1T.x, p1T.y);
  backend.bezierCurveTo(c1T.x, c1T.y, c2T.x, c2T.y, p2T.x, p2T.y);
  backend.stroke();
}

// ---------------------------------------------------------------------------
// Main corridor + junction drawing
// ---------------------------------------------------------------------------

function drawGraphCorridors(backend, graph, nodePassages, allNodeTrims, params) {
  const { transform, wallThickness, halfW, startId, finishId } = params;

  backend.setStroke('#000', wallThickness, 'round');

  const posMap = new Map();
  for (const node of graph.nodes) posMap.set(node.id, { x: node.x, y: node.y });

  const forceEndpoints = new Set();
  if (startId != null) forceEndpoints.add(startId);
  if (finishId != null) forceEndpoints.add(finishId);

  const rawThreads = extractThreads(nodePassages, graph, forceEndpoints);
  const threads = enhanceDeadEndThreads(rawThreads, nodePassages, posMap, halfW);
  const splineInteriors = new Set();

  for (const thread of threads) {
    const n = thread.length;
    if (n < 2) continue;

    const centers = [];
    for (const id of thread) {
      const pos = posMap.get(id);
      centers.push({ x: pos.x, y: pos.y });
    }

    const tangents = [];
    const perps = [];
    for (let i = 0; i < n; i++) {
      let tx, ty;
      if (i === 0) {
        tx = centers[1].x - centers[0].x;
        ty = centers[1].y - centers[0].y;
      } else if (i === n - 1) {
        tx = centers[n - 1].x - centers[n - 2].x;
        ty = centers[n - 1].y - centers[n - 2].y;
      } else {
        tx = (centers[i + 1].x - centers[i - 1].x) / 2;
        ty = (centers[i + 1].y - centers[i - 1].y) / 2;
      }
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      tangents.push({ x: tx / len, y: ty / len });
      perps.push({ x: -ty / len, y: tx / len });
    }

    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i < n; i++) {
      const c = centers[i];
      const p = perps[i];
      const t = tangents[i];

      if (i === 0) {
        const trimsA = allNodeTrims.get(thread[0]);
        let nbrIdx = 1;
        while (nbrIdx < n && thread[nbrIdx] < 0) nbrIdx++;
        const aTrim = trimsA ? trimsA.get(thread[nbrIdx]) : null;
        const d01 = Math.sqrt((centers[1].x - c.x) ** 2 + (centers[1].y - c.y) ** 2) || 1;
        const cap = d01 * 0.45;
        const lt = Math.min(aTrim ? aTrim.leftTrim : 0, cap);
        const rt = Math.min(aTrim ? aTrim.rightTrim : 0, cap);
        leftPts.push({ x: c.x + t.x * lt + p.x * halfW, y: c.y + t.y * lt + p.y * halfW });
        rightPts.push({ x: c.x + t.x * rt - p.x * halfW, y: c.y + t.y * rt - p.y * halfW });
      } else if (i === n - 1) {
        const trimsB = allNodeTrims.get(thread[n - 1]);
        let nbrIdx = n - 2;
        while (nbrIdx >= 0 && thread[nbrIdx] < 0) nbrIdx--;
        const bTrim = trimsB ? trimsB.get(thread[nbrIdx]) : null;
        const dLast = Math.sqrt((c.x - centers[n - 2].x) ** 2 + (c.y - centers[n - 2].y) ** 2) || 1;
        const cap = dLast * 0.45;
        const lt = Math.min(bTrim ? bTrim.leftTrim : 0, cap);
        const rt = Math.min(bTrim ? bTrim.rightTrim : 0, cap);
        leftPts.push({ x: c.x - t.x * rt + p.x * halfW, y: c.y - t.y * rt + p.y * halfW });
        rightPts.push({ x: c.x - t.x * lt - p.x * halfW, y: c.y - t.y * lt - p.y * halfW });
      } else {
        leftPts.push({ x: c.x + p.x * halfW, y: c.y + p.y * halfW });
        rightPts.push({ x: c.x - p.x * halfW, y: c.y - p.y * halfW });
      }
    }

    let ok = true;
    for (let i = 0; i < n; i++) {
      const dx = rightPts[i].x - leftPts[i].x;
      const dy = rightPts[i].y - leftPts[i].y;
      if (dx * dx + dy * dy < halfW * halfW * 0.25) { ok = false; break; }
    }

    if (!ok) {
      drawThreadStraight(backend, thread, graph, allNodeTrims, halfW, transform);
      continue;
    }

    for (let i = 1; i < n - 1; i++) splineInteriors.add(thread[i]);

    const fullLeft = addPhantoms(leftPts, halfW);
    const fullRight = addPhantoms(rightPts, halfW);
    drawSplinePath(backend, fullLeft, transform);
    drawSplinePath(backend, fullRight, transform);
  }

  for (const node of graph.nodes) {
    if (splineInteriors.has(node.id)) continue;
    const passages = nodePassages.get(node.id);
    if (!passages || passages.length === 0) continue;
    const cx = node.x;
    const cy = node.y;
    const pn = passages.length;
    for (let i = 0; i < pn; i++) {
      const curr = passages[i];
      const next = passages[(i + 1) % pn];
      let gap = next.angle - curr.angle;
      if (i === pn - 1) gap += 2 * Math.PI;
      if (gap < 0) gap += 2 * Math.PI;
      if (gap <= Math.PI) continue;

      const arcStart = curr.angle + Math.PI / 2;
      let arcEnd = next.angle - Math.PI / 2;
      if (i === pn - 1) arcEnd += 2 * Math.PI;
      const span = arcEnd - arcStart;
      if (span < 0.02) continue;

      if (span > Math.PI * 0.95) {
        const mid = (arcStart + arcEnd) / 2;
        drawJunctionBezier(backend, cx, cy, halfW, arcStart, mid, transform);
        drawJunctionBezier(backend, cx, cy, halfW, mid, arcEnd, transform);
      } else {
        drawJunctionBezier(backend, cx, cy, halfW, arcStart, arcEnd, transform);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Draw curvy organic maze. Returns stats for footer.
 *
 * @param {object} backend - DrawBackend (pdf or canvas)
 * @param {object} maze
 * @param {object} layoutResult
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

  const drawParams = {
    transform, wallThickness, halfW, scale,
    startId: maze.startId, finishId: maze.finishId,
  };
  drawGraphCorridors(backend, graph, nodePassages, allNodeTrims, drawParams);

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
