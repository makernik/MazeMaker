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
