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
