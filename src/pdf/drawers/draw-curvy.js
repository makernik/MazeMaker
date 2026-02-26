/**
 * Curvy maze drawer (PDF): Catmull-Rom corridor walls + Bezier junction curves.
 * Same generation and layout as jagged; only the rendering differs.
 * Labels and solution overlay are identical to jagged — re-exported directly.
 */

import { rgb } from 'pdf-lib';
import { computeNodeTrims, prepareGraphData, catmullRomToBezier } from './organic-geometry.js';

export { drawLabels, drawSolutionOverlay } from './draw-organic.js';

/**
 * Draw corridor walls as Catmull-Rom curves and junction gaps as Bezier arcs.
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

      const svgOpts = { borderColor: rgb(0, 0, 0), borderWidth: wallThickness, borderLineCap: 1 };

      // Left wall — Catmull-Rom through trim endpoints
      const lS = { x: node.x + ux * ltA + px * halfW, y: node.y + uy * ltA + py * halfW };
      const lE = { x: other.x - ux * rtB + px * halfW, y: other.y - uy * rtB + py * halfW };
      const lP0 = { x: node.x + px * halfW, y: node.y + py * halfW };
      const lP3 = { x: other.x + px * halfW, y: other.y + py * halfW };
      const lb = catmullRomToBezier(lP0.x, lP0.y, lS.x, lS.y, lE.x, lE.y, lP3.x, lP3.y);
      const lSt = transform(lS.x, lS.y);
      const lEt = transform(lE.x, lE.y);
      const lC1 = transform(lb.cp1x, lb.cp1y);
      const lC2 = transform(lb.cp2x, lb.cp2y);
      page.drawSvgPath(
        `M ${lSt.x} ${-lSt.y} C ${lC1.x} ${-lC1.y} ${lC2.x} ${-lC2.y} ${lEt.x} ${-lEt.y}`,
        svgOpts,
      );

      // Right wall
      const rS = { x: node.x + ux * rtA - px * halfW, y: node.y + uy * rtA - py * halfW };
      const rE = { x: other.x - ux * ltB - px * halfW, y: other.y - uy * ltB - py * halfW };
      const rP0 = { x: node.x - px * halfW, y: node.y - py * halfW };
      const rP3 = { x: other.x - px * halfW, y: other.y - py * halfW };
      const rb = catmullRomToBezier(rP0.x, rP0.y, rS.x, rS.y, rE.x, rE.y, rP3.x, rP3.y);
      const rSt = transform(rS.x, rS.y);
      const rEt = transform(rE.x, rE.y);
      const rC1 = transform(rb.cp1x, rb.cp1y);
      const rC2 = transform(rb.cp2x, rb.cp2y);
      page.drawSvgPath(
        `M ${rSt.x} ${-rSt.y} C ${rC1.x} ${-rC1.y} ${rC2.x} ${-rC2.y} ${rEt.x} ${-rEt.y}`,
        svgOpts,
      );
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

      const svgOpts = { borderColor: rgb(0, 0, 0), borderWidth: wallThickness, borderLineCap: 1 };

      if (span > Math.PI * 0.95) {
        // Split at midpoint for large spans (dead-end cap)
        const midAngle = (arcStart + arcEnd) / 2;
        drawJunctionBezier(page, cx, cy, halfW, arcStart, midAngle, transform, svgOpts);
        drawJunctionBezier(page, cx, cy, halfW, midAngle, arcEnd, transform, svgOpts);
      } else {
        drawJunctionBezier(page, cx, cy, halfW, arcStart, arcEnd, transform, svgOpts);
      }
    }
  }
}

/** Cubic Bezier approximation of a circular arc segment on the halfW circle. */
function drawJunctionBezier(page, cx, cy, halfW, aStart, aEnd, transform, svgOpts) {
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
  page.drawSvgPath(
    `M ${p1T.x} ${-p1T.y} C ${c1T.x} ${-c1T.y} ${c2T.x} ${-c2T.y} ${p2T.x} ${-p2T.y}`,
    svgOpts,
  );
}

/**
 * Draw curvy organic maze. Returns stats for footer.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} maze
 * @param {object} layoutResult
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

  // Boundary walls (straight lines — same as jagged)
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
