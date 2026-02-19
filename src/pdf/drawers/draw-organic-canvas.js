/**
 * Organic maze canvas drawer: same layout contract as draw-organic.js (transform, scale, lineThickness).
 * Draws to CanvasRenderingContext2D. Caller must set ctx transform for y-up (e.g. setTransform(1,0,0,-1,0,canvas.height)).
 */

import { computeNodeTrims } from './organic-geometry.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} maze - Organic maze with graph, nodePositions, startId, finishId, boundsWidth, boundsHeight
 * @param {object} layoutResult - { transform, lineThickness, scale }
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

  const allNodeTrims = new Map();
  for (const node of graph.nodes) {
    const passages = nodePassages.get(node.id);
    if (passages && passages.length > 0) {
      allNodeTrims.set(node.id, computeNodeTrims(passages, halfW));
    }
  }

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
      const s1 = transform(node.x + ux * ltA + px * halfW, node.y + uy * ltA + py * halfW);
      const e1 = transform(other.x - ux * rtB + px * halfW, other.y - uy * rtB + py * halfW);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.stroke();
      const s2 = transform(node.x + ux * rtA - px * halfW, node.y + uy * rtA - py * halfW);
      const e2 = transform(other.x - ux * ltB - px * halfW, other.y - uy * ltB - py * halfW);
      ctx.beginPath();
      ctx.moveTo(s2.x, s2.y);
      ctx.lineTo(e2.x, e2.y);
      ctx.stroke();
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
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, arcStart, arcEnd);
      ctx.stroke();
    }
  }

  const bw = maze.boundsWidth;
  const bh = maze.boundsHeight;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  const halfThick = lineThickness / 2;

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

function drawArrow(ctx, x1, y1, x2, y2, headSize) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngle = Math.PI / 6;
  const head1X = x2 - headSize * Math.cos(angle - headAngle);
  const head1Y = y2 - headSize * Math.sin(angle - headAngle);
  const head2X = x2 - headSize * Math.cos(angle + headAngle);
  const head2Y = y2 - headSize * Math.sin(angle + headAngle);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(head1X, head1Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(head2X, head2Y);
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx - Caller has set y-up transform; we draw labels in screen space so text is right-side up.
 * @param {object} maze - Organic maze
 * @param {object} layoutResult - { transform, boundsWidth, boundsHeight }
 * @param {object} options - { useArrows, canvasHeight } (canvasHeight required for correct label position)
 */
export function drawLabels(ctx, maze, layoutResult, options = {}) {
  const { transform, boundsWidth, boundsHeight } = layoutResult;
  const boundaryTopLayout = transform(0, boundsHeight).y;
  const boundaryBottomLayout = transform(0, 0).y;
  const useArrows = options.useArrows ?? false;
  const canvasHeight = options.canvasHeight ?? 0;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  if (!startPos || !finishPos) return;
  const startX = transform(startPos.x, startPos.y).x;
  const finishX = transform(finishPos.x, finishPos.y).x;
  const toScreenY = (layoutY) => canvasHeight - layoutY;
  const boundaryTop = toScreenY(boundaryTopLayout);
  const boundaryBottom = toScreenY(boundaryBottomLayout);
  const gap = 4;
  const fontSize = 10;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  if (useArrows) {
    drawArrow(ctx, startX, boundaryTop - gap - 15, startX, boundaryTop - gap, 8);
    drawArrow(ctx, finishX, boundaryBottom + gap, finishX, boundaryBottom + gap + 15, 8);
  } else {
    const startText = 'Start';
    const startTextWidth = ctx.measureText(startText).width;
    ctx.fillText(startText, startX - startTextWidth / 2, boundaryTop - gap);
    const finishText = 'Finish';
    const finishTextWidth = ctx.measureText(finishText).width;
    ctx.fillText(finishText, finishX - finishTextWidth / 2, boundaryBottom + gap + fontSize);
  }
  ctx.restore();
}
