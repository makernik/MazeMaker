/**
 * Organic maze canvas drawer: same layout contract as draw-organic.js (transform, scale, lineThickness).
 * Draws to CanvasRenderingContext2D. Caller must set ctx transform for y-up (e.g. setTransform(1,0,0,-1,0,canvas.height)).
 */

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
      const trimA = Math.min(geometricTrim, dist * 0.45);
      const trimB = Math.min(geometricTrim, dist * 0.45);
      const ax = node.x + ux * trimA;
      const ay = node.y + uy * trimA;
      const bx = other.x - ux * trimB;
      const by = other.y - uy * trimB;
      const s1 = transform(ax + px * halfW, ay + py * halfW);
      const e1 = transform(bx + px * halfW, by + py * halfW);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.stroke();
      const s2 = transform(ax - px * halfW, ay - py * halfW);
      const e2 = transform(bx - px * halfW, by - py * halfW);
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
        const r = transform(rx, ry);
        const l = transform(lx, ly);
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(l.x, l.y);
        ctx.stroke();
      } else {
        const center = transform(cx, cy);
        const r = junctionR * scale;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, startAngle, endAngle);
        ctx.stroke();
      }
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

  line(startPos.x - halfW, bh + halfThick, startPos.x - halfW, startPos.y + geometricTrim - halfThick);
  line(startPos.x + halfW, bh + halfThick, startPos.x + halfW, startPos.y + geometricTrim - halfThick);
  line(finishPos.x - halfW, 0 - halfThick, finishPos.x - halfW, finishPos.y - geometricTrim + halfThick);
  line(finishPos.x + halfW, 0 - halfThick, finishPos.x + halfW, finishPos.y - geometricTrim + halfThick);
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
