/**
 * Shared miter-joint geometry for organic maze drawers.
 *
 * Replaces the old fixed junctionR / geometricTrim approach with a
 * closed-form formula derived from the gap angle between adjacent passages.
 *
 *   trimDist    = halfW / tan(alpha / 2)   (along corridor direction)
 *   miterRadius = halfW / sin(alpha / 2)   (radial distance from node center)
 */

const MIN_GAP = 0.01;

/**
 * Trim distance along the corridor direction for a wall bordering a gap of
 * angle `gapAngle` (radians). Returns 0 when gapAngle >= PI (straight-through).
 * @param {number} gapAngle
 * @param {number} halfW
 * @returns {number}
 */
export function miterTrim(gapAngle, halfW) {
  const half = Math.max(gapAngle, MIN_GAP) / 2;
  if (half >= Math.PI / 2) return 0;
  return halfW / Math.tan(half);
}

/**
 * Radial distance from node center to the miter point for a gap of angle
 * `gapAngle`. Used as the arc radius when drawing junction wall sections.
 * @param {number} gapAngle
 * @param {number} halfW
 * @returns {number}
 */
export function miterRadius(gapAngle, halfW) {
  const half = Math.max(gapAngle, MIN_GAP) / 2;
  return halfW / Math.sin(half);
}

/**
 * Compute per-wall trim distances for every passage at a node.
 *
 * Passages must be sorted by angle (ascending). Each passage gets a leftTrim
 * (from the gap on its CCW side) and a rightTrim (from the gap on its CW side).
 *
 * @param {Array<{nid: number, angle: number}>} passages - sorted by angle
 * @param {number} halfW
 * @returns {Map<number, {leftTrim: number, rightTrim: number}>}
 */
export function computeNodeTrims(passages, halfW) {
  const trims = new Map();
  const n = passages.length;

  if (n === 0) return trims;

  if (n === 1) {
    const gap = 2 * Math.PI;
    const trim = miterTrim(gap, halfW);
    trims.set(passages[0].nid, { leftTrim: trim, rightTrim: trim });
    return trims;
  }

  const gapAngles = [];
  for (let i = 0; i < n; i++) {
    const curr = passages[i];
    const next = passages[(i + 1) % n];
    let gap = next.angle - curr.angle;
    if (i === n - 1) gap += 2 * Math.PI;
    if (gap < 0) gap += 2 * Math.PI;
    gapAngles.push(gap);
  }

  for (let i = 0; i < n; i++) {
    const leftGap = gapAngles[i];
    const rightGap = gapAngles[(i - 1 + n) % n];
    trims.set(passages[i].nid, {
      leftTrim: miterTrim(leftGap, halfW),
      rightTrim: miterTrim(rightGap, halfW),
    });
  }

  return trims;
}

/**
 * Convert a uniform Catmull-Rom segment (P0→P1→P2→P3) to cubic Bezier
 * control points for the P1→P2 sub-curve.
 *
 * @returns {{ cp1x: number, cp1y: number, cp2x: number, cp2y: number }}
 */
export function catmullRomToBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
  return {
    cp1x: p1x + (p2x - p0x) / 6,
    cp1y: p1y + (p2y - p0y) / 6,
    cp2x: p2x - (p3x - p1x) / 6,
    cp2y: p2y - (p3y - p1y) / 6,
  };
}

/**
 * Deterministic ±1 from the canonical (ordered) endpoints.
 * Rounding keeps the sign stable for the same segment.
 * @returns {1|-1}
 */
function bowSign(x0, y0, x1, y1) {
  const ix0 = Math.round(x0 * 10);
  const iy0 = Math.round(y0 * 10);
  const ix1 = Math.round(x1 * 10);
  const iy1 = Math.round(y1 * 10);
  let h = Math.imul(ix0, 374761393);
  h ^= Math.imul(iy0, 668265263);
  h ^= Math.imul(ix1, 1274126177);
  h ^= Math.imul(iy1, 2246822519);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h & 1) === 0 ? 1 : -1;
}

/**
 * Lateral offset added to both cubic controls of a Curvy corridor.
 * Endpoint order does not change the vector.
 *
 * Amplitude is 20% of the segment, capped at 2.4 × half the corridor.
 * The crest (t = 0.5) sits at 0.75 × this offset from the straight chord.
 *
 * @returns {{ x: number, y: number }}
 */
export function curvyBowOffset(ax, ay, bx, by, halfW) {
  let x0 = ax;
  let y0 = ay;
  let x1 = bx;
  let y1 = by;
  if (ax > bx || (ax === bx && ay > by)) {
    x0 = bx;
    y0 = by;
    x1 = ax;
    y1 = ay;
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const amp = Math.min(dist * 0.2, halfW * 2.4);
  const px = -dy / dist;
  const py = dx / dist;
  const sign = bowSign(x0, y0, x1, y1);
  return { x: px * amp * sign, y: py * amp * sign };
}

function cubicAt(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + tt * t * p3x,
    y: uu * u * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + tt * t * p3y,
  };
}

/**
 * Two cubics for the bowed segment from (ax, ay) to (bx, by).
 * Each cubic leaves its junction along the chord and they meet at the crest.
 * The crest sits 0.75 × `curvyBowOffset` off the straight chord.
 *
 * @returns {Array<{ cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number }>}
 */
export function curvySegmentCubics(ax, ay, bx, by, halfW) {
  const off = curvyBowOffset(ax, ay, bx, by, halfW);
  const dx = bx - ax;
  const dy = by - ay;
  const mx = (ax + bx) / 2 + off.x * 0.75;
  const my = (ay + by) / 2 + off.y * 0.75;
  return [
    {
      cp1x: ax + dx * 0.25,
      cp1y: ay + dy * 0.25,
      cp2x: mx - dx * 0.25,
      cp2y: my - dy * 0.25,
      x: mx,
      y: my,
    },
    {
      cp1x: mx + dx * 0.25,
      cp1y: my + dy * 0.25,
      cp2x: bx - dx * 0.25,
      cp2y: by - dy * 0.25,
      x: bx,
      y: by,
    },
  ];
}

/**
 * Point at parameter t on the bowed centerline.
 * @param {number} t in [0, 1]
 * @returns {{ x: number, y: number }}
 */
export function curvyPoint(ax, ay, bx, by, halfW, t) {
  const cubics = curvySegmentCubics(ax, ay, bx, by, halfW);
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    return cubicAt(ax, ay, cubics[0].cp1x, cubics[0].cp1y, cubics[0].cp2x, cubics[0].cp2y, cubics[0].x, cubics[0].y, clamped * 2);
  }
  const mid = cubics[0];
  const end = cubics[1];
  return cubicAt(mid.x, mid.y, end.cp1x, end.cp1y, end.cp2x, end.cp2y, end.x, end.y, (clamped - 0.5) * 2);
}

/**
 * Adaptive phantom extension factor for Catmull-Rom endpoint tangents.
 * Short segments get less extension to avoid overshoot; long segments
 * get slightly more to maintain flow.
 *
 * @param {number} segmentLength
 * @param {number} halfW - corridor half-width (geometric reference scale)
 * @returns {number} factor in [0.2, 0.7]
 */
export function phantomFactor(segmentLength, halfW) {
  if (segmentLength < halfW * 3) return 0.2;
  if (segmentLength > halfW * 8) return 0.7;
  return 0.5;
}

/**
 * Decompose a carved maze graph into maximal chains ("threads") of
 * degree-2 pass-through nodes, bookended by junctions or dead ends.
 *
 * @param {Map<number, Array<{nid: number, angle: number}>>} nodePassages
 * @param {{ nodes: Array, getNode: Function }} graph
 * @param {Set<number>} [forceEndpoints] - IDs always treated as chain endpoints
 * @returns {Array<number[]>} array of node-ID chains
 */
export function extractThreads(nodePassages, graph, forceEndpoints = new Set()) {
  const realDegree = new Map();
  for (const node of graph.nodes) {
    const passages = nodePassages.get(node.id);
    if (!passages) { realDegree.set(node.id, 0); continue; }
    let count = 0;
    for (const p of passages) { if (p.nid >= 0) count++; }
    realDegree.set(node.id, count);
  }

  const isEndpoint = (id) => forceEndpoints.has(id) || realDegree.get(id) !== 2;

  const visited = new Set();
  const threads = [];

  for (const node of graph.nodes) {
    if (!isEndpoint(node.id)) continue;
    const passages = nodePassages.get(node.id);
    if (!passages) continue;

    for (const { nid } of passages) {
      if (nid < 0) continue;
      const key = node.id < nid ? `${node.id}-${nid}` : `${nid}-${node.id}`;
      if (visited.has(key)) continue;

      const thread = [node.id];
      let curr = nid;
      let prev = node.id;

      while (true) {
        const ek = prev < curr ? `${prev}-${curr}` : `${curr}-${prev}`;
        visited.add(ek);
        thread.push(curr);
        if (isEndpoint(curr)) break;

        const cp = nodePassages.get(curr);
        if (!cp) break;
        let next = -1;
        for (const p of cp) {
          if (p.nid >= 0 && p.nid !== prev) { next = p.nid; break; }
        }
        if (next < 0) break;
        prev = curr;
        curr = next;
      }

      threads.push(thread);
    }
  }

  return threads;
}

/**
 * Insert a virtual wobbled midpoint into 2-node dead-end threads so the
 * Catmull-Rom spline has a real interior control point to curve through.
 *
 * @param {Array<number[]>} threads
 * @param {Map<number, Array<{nid: number, angle: number}>>} nodePassages
 * @param {Map<number, {x: number, y: number}>} posMap - mutable; virtual entries added
 * @param {number} halfW
 * @returns {Array<number[]>} enhanced threads (same references for unchanged ones)
 */
export function enhanceDeadEndThreads(threads, nodePassages, posMap, halfW) {
  const minLength = halfW * 4;
  const enhanced = [];

  for (const thread of threads) {
    if (thread.length !== 2) { enhanced.push(thread); continue; }

    const p0 = nodePassages.get(thread[0]);
    const p1 = nodePassages.get(thread[1]);
    const realDeg0 = p0 ? p0.filter(p => p.nid >= 0).length : 0;
    const realDeg1 = p1 ? p1.filter(p => p.nid >= 0).length : 0;
    if (realDeg0 !== 1 && realDeg1 !== 1) { enhanced.push(thread); continue; }

    const pos0 = posMap.get(thread[0]);
    const pos1 = posMap.get(thread[1]);
    if (!pos0 || !pos1) { enhanced.push(thread); continue; }

    const dx = pos1.x - pos0.x;
    const dy = pos1.y - pos0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minLength) { enhanced.push(thread); continue; }

    const perpX = -dy / dist;
    const perpY = dx / dist;
    const offset = dist * 0.1;
    const variation = Math.sin(thread[0] * 0.7 + thread[1] * 0.3);

    const virtualId = -(Math.abs(thread[0]) * 100003 + Math.abs(thread[1]));
    posMap.set(virtualId, {
      x: (pos0.x + pos1.x) / 2 + perpX * offset * variation,
      y: (pos0.y + pos1.y) / 2 + perpY * offset * variation,
    });

    enhanced.push([thread[0], virtualId, thread[1]]);
  }

  return enhanced;
}

/**
 * Compute corridor width and halfW from the average edge distance in a graph.
 * Shared by drawers and the organic generator (for filler placement).
 *
 * @param {{ nodes: Array, getNode: Function }} graph
 * @param {number} [lineThickness=1.5] - wall stroke thickness (from layout; default is safe for generation-time callers)
 * @returns {{ corridorWidth: number, halfW: number, avgDist: number }}
 */
export function computeCorridorWidth(graph, lineThickness = 1.5) {
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
  return { corridorWidth, halfW, avgDist };
}

/**
 * Compute passage directions and per-wall miter trims for every node in a
 * graph.  Shared by jagged and curvy drawers.
 *
 * @param {{ nodes: Array, hasWall: Function, getNode: Function }} graph
 * @param {number} halfW
 * @returns {{ nodePassages: Map, allNodeTrims: Map }}
 */
export function prepareGraphData(graph, halfW) {
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
