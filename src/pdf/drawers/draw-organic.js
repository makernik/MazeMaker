/**
 * Organic maze drawer: corridor walls, labels, solution overlay.
 * Shared interface: drawWalls (returns stats for footer), drawLabels, drawSolutionOverlay.
 */

import { rgb } from 'pdf-lib';

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
  const junctionR = halfW * 1.05;
  const halfOpenAngle = Math.asin(Math.min(halfW / junctionR, 1));
  const geometricTrim = Math.sqrt(junctionR * junctionR - halfW * halfW);
  const drawnEdges = new Set();

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
      const trimA = Math.min(geometricTrim, dist * 0.45);
      const trimB = Math.min(geometricTrim, dist * 0.45);
      const ax = node.x + ux * trimA;
      const ay = node.y + uy * trimA;
      const bx = other.x - ux * trimB;
      const by = other.y - uy * trimB;
      page.drawLine({
        start: transform(ax + px * halfW, ay + py * halfW),
        end: transform(bx + px * halfW, by + py * halfW),
        thickness: wallThickness,
        color: rgb(0, 0, 0),
        lineCap: 1,
      });
      page.drawLine({
        start: transform(ax - px * halfW, ay - py * halfW),
        end: transform(bx - px * halfW, by - py * halfW),
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
      const startAngle = curr.angle + halfOpenAngle;
      let endAngle = next.angle - halfOpenAngle;
      if (i === n - 1) endAngle += 2 * Math.PI;
      const span = endAngle - startAngle;
      if (span < 0.02) continue;
      if (span < 0) {
        const t1 = geometricTrim;
        const rx = cx + Math.cos(curr.angle) * t1 + Math.sin(curr.angle) * halfW;
        const ry = cy + Math.sin(curr.angle) * t1 - Math.cos(curr.angle) * halfW;
        const t2 = geometricTrim;
        const lx = cx + Math.cos(next.angle) * t2 - Math.sin(next.angle) * halfW;
        const ly = cy + Math.sin(next.angle) * t2 + Math.cos(next.angle) * halfW;
        page.drawLine({
          start: transform(rx, ry),
          end: transform(lx, ly),
          thickness: wallThickness,
          color: rgb(0, 0, 0),
          lineCap: 1,
        });
      } else if (Math.abs(span - Math.PI) < 0.01) {
        const midAngle = (startAngle + endAngle) / 2;
        const p1 = transform(cx + junctionR * Math.cos(startAngle), cy + junctionR * Math.sin(startAngle));
        const pm = transform(cx + junctionR * Math.cos(midAngle), cy + junctionR * Math.sin(midAngle));
        const p2 = transform(cx + junctionR * Math.cos(endAngle), cy + junctionR * Math.sin(endAngle));
        const r = junctionR * scale;
        const arcOpts = { borderColor: rgb(0, 0, 0), borderWidth: wallThickness, borderLineCap: 1 };
        page.drawSvgPath(`M ${p1.x} ${-p1.y} A ${r} ${r} 0 0 0 ${pm.x} ${-pm.y}`, arcOpts);
        page.drawSvgPath(`M ${pm.x} ${-pm.y} A ${r} ${r} 0 0 0 ${p2.x} ${-p2.y}`, arcOpts);
      } else {
        const p1 = transform(cx + junctionR * Math.cos(startAngle), cy + junctionR * Math.sin(startAngle));
        const p2 = transform(cx + junctionR * Math.cos(endAngle), cy + junctionR * Math.sin(endAngle));
        const r = junctionR * scale;
        const largeArc = span > Math.PI ? 1 : 0;
        page.drawSvgPath(`M ${p1.x} ${-p1.y} A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${-p2.y}`, {
          borderColor: rgb(0, 0, 0),
          borderWidth: wallThickness,
          borderLineCap: 1,
        });
      }
    }
  }

  const bw = maze.boundsWidth;
  const bh = maze.boundsHeight;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  const lineOpts = { thickness: wallThickness, color: rgb(0, 0, 0), lineCap: 1 };
  const halfThick = lineThickness / 2;
  page.drawLine({ start: transform(startPos.x - halfW, bh + halfThick), end: transform(startPos.x - halfW, startPos.y + geometricTrim - halfThick), ...lineOpts });
  page.drawLine({ start: transform(startPos.x + halfW, bh + halfThick), end: transform(startPos.x + halfW, startPos.y + geometricTrim - halfThick), ...lineOpts });
  page.drawLine({ start: transform(finishPos.x - halfW, 0 - halfThick), end: transform(finishPos.x - halfW, finishPos.y - geometricTrim + halfThick), ...lineOpts });
  page.drawLine({ start: transform(finishPos.x + halfW, 0 - halfThick), end: transform(finishPos.x + halfW, finishPos.y - geometricTrim + halfThick), ...lineOpts });
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
