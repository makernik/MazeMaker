/**
 * Curvy maze drawer: the same organic graph as jagged, with each open
 * corridor drawn as a cubic bow. Junction arcs stay circular.
 * Filler passages use the same bow. Labels match jagged.
 * All rendering goes through a DrawBackend (pdf or canvas).
 */

import {
  computeNodeTrims,
  computeCorridorWidth,
  prepareGraphData,
  curvyPoint,
  curvySegmentCubics,
} from './organic-geometry.js';
import { bowScaleFor, ensureBowScales } from '../../maze/corridor-clearance.js';

export { drawLabels } from './draw-organic.js';

/**
 * Wall follows the centerline bow, shifted by the chord normal.
 * A fresh cubic on the trimmed chord would reuse the full-edge crest and kink.
 */
function drawOffsetBow(backend, ax, ay, bx, by, halfW, ampScale, ox, oy, t0, t1, transform, bounds) {
  const span = Math.max(0, t1 - t0);
  const length = Math.hypot(bx - ax, by - ay) * span;
  const steps = Math.max(2, Math.ceil(length / 2));
  const pad = bounds.pad;
  let open = false;
  let drawn = 0;
  const finish = () => {
    if (open && drawn > 0) backend.stroke();
    open = false;
    drawn = 0;
  };
  for (let i = 0; i <= steps; i++) {
    const t = t0 + span * (i / steps);
    const p = curvyPoint(ax, ay, bx, by, halfW, t, ampScale);
    const x = p.x + ox;
    const y = p.y + oy;
    // The border already strokes the page edge. A wall lying in that stroke
    // is a second copy of the same line.
    const onBorder = x <= pad || y <= pad || x >= bounds.width - pad || y >= bounds.height - pad;
    if (onBorder) {
      finish();
      continue;
    }
    const q = transform(x, y);
    if (!open) {
      backend.beginPath();
      backend.moveTo(q.x, q.y);
      open = true;
    } else {
      backend.lineTo(q.x, q.y);
      drawn += 1;
    }
  }
  finish();
}

/**
 * Draw bowed corridor walls and circular junction arcs for a graph.
 */
function drawGraphCorridors(backend, graph, nodePassages, allNodeTrims, params) {
  const { transform, wallThickness, halfW, scale, bowScales, bounds } = params;
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
      // Use the real miter distance. A shorter cap draws the walls through the
      // intersection. Never start past the other end.
      const limit = dist * 0.98;
      const ltA = Math.min(aTrim ? aTrim.leftTrim : 0, limit);
      const rtA = Math.min(aTrim ? aTrim.rightTrim : 0, limit);
      const ltB = Math.min(bTrim ? bTrim.leftTrim : 0, limit);
      const rtB = Math.min(bTrim ? bTrim.rightTrim : 0, limit);
      const ampScale = bowScaleFor(bowScales, node.id, nid);
      const ox = px * halfW;
      const oy = py * halfW;
      // Pull each end in by half a point so a round cap covers the joint
      // without the stroke centerlines crossing just past the miter.
      const inset = 0.5 / dist;
      if (ltA + rtB < dist - 1.2) {
        drawOffsetBow(
          backend,
          node.x, node.y, other.x, other.y,
          halfW, ampScale, ox, oy,
          ltA / dist + inset, 1 - rtB / dist - inset,
          transform,
          bounds,
        );
      }
      if (rtA + ltB < dist - 1.2) {
        drawOffsetBow(
          backend,
          node.x, node.y, other.x, other.y,
          halfW, ampScale, -ox, -oy,
          rtA / dist + inset, 1 - ltB / dist - inset,
          transform,
          bounds,
        );
      }
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
  const bowScales = ensureBowScales(maze, halfW, lineThickness);

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
    transform,
    wallThickness,
    halfW,
    scale,
    bowScales,
    bounds: {
      width: maze.boundsWidth,
      height: maze.boundsHeight,
      pad: lineThickness,
    },
  };
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
  line(startPos.x - halfW, bh + halfThick, startPos.x - halfW, startPos.y + startVT.leftTrim);
  line(startPos.x + halfW, bh + halfThick, startPos.x + halfW, startPos.y + startVT.rightTrim);
  line(finishPos.x - halfW, 0 - halfThick, finishPos.x - halfW, finishPos.y - finishVT.rightTrim);
  line(finishPos.x + halfW, 0 - halfThick, finishPos.x + halfW, finishPos.y - finishVT.leftTrim);
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
 * Solution line follows the same cubic bow as the corridors.
 *
 * @param {object} backend
 * @param {object} maze
 * @param {number[]} path
 * @param {object} layoutResult
 */
export function drawSolutionOverlay(backend, maze, path, layoutResult) {
  const { transform, lineThickness } = layoutResult;
  const positions = [];
  for (let i = 0; i < path.length; i++) {
    const pos = maze.nodePositions.get(path[i]);
    if (!pos) return;
    positions.push(pos);
  }
  if (positions.length < 2) return;

  const { halfW } = computeCorridorWidth(maze.graph, lineThickness ?? 1.5);
  const bowScales = maze.bowScales ?? ensureBowScales(maze, halfW, lineThickness ?? 1.5);

  backend.save();
  backend.setStroke('#666', 1.5, 'butt');
  backend.setDash([4, 4]);
  backend.setOpacity(0.7);
  backend.beginPath();
  const first = transform(positions[0].x, positions[0].y);
  backend.moveTo(first.x, first.y);
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i];
    const b = positions[i + 1];
    const cubics = curvySegmentCubics(
      a.x,
      a.y,
      b.x,
      b.y,
      halfW,
      bowScaleFor(bowScales, path[i], path[i + 1]),
    );
    for (let c = 0; c < cubics.length; c++) {
      const seg = cubics[c];
      const c1 = transform(seg.cp1x, seg.cp1y);
      const c2 = transform(seg.cp2x, seg.cp2y);
      const end = transform(seg.x, seg.y);
      backend.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    }
  }
  backend.stroke();
  backend.restore();
}
