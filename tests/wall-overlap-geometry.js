/**
 * Wall-overlap oracle for Jagged and Curvy strokes.
 *
 * Records the draw calls the PDF and preview backends receive, samples
 * curves to polylines, and flags geometry that is not a join at a shared
 * endpoint.
 *
 * Tolerances are in maze points (generator space). Page-space checks
 * multiply by the layout scale, so the PDF page and the smaller preview
 * canvas use the same physical rule.
 *
 *   endpointEps           0.50   Endpoints this close are the same join.
 *   crossEndpointIgnore   0.35   A crossing this close to an endpoint is a join.
 *   collinearSin          0.02   About 1.15°. Steeper than this is not collinear.
 *   collinearDist         0.35   Max separation for a collinear overlap.
 *   collinearMinOverlap   0.75   Shorter collinear runs are join noise.
 *   inkSlop               0.08   Ink must overlap by more than this.
 *                                Touching (centerline distance == stroke width)
 *                                is not an overlap.
 *   passageSlop           0.12   Wall ink must cover the passage centerline by
 *                                more than this to count as blocked.
 *   curveFlatness         0.30   Max sagitta when sampling cubics and arcs.
 *   siteGrid              6.00   Findings closer than this are one site.
 *   miterZone             max(2 * strokeWidth, 1.5)
 *                            A stroke overlap whose closest point is inside
 *                            this ball around a real wall endpoint is a miter
 *                            or round cap, unless the wall bodies are still
 *                            within a stroke of each other outside the ball.
 *   passageMiter          A passage that only grazes the round cap at a wall
 *                            end is not blocked. It is blocked when the
 *                            centerline comes inside the inner 20% of that
 *                            stroke, or when a wall body (not just the cap)
 *                            comes closer than half the stroke.
 *
 * Stroke rule: two strokes overlap when the distance between centerlines is
 * less than (w1 + w2) / 2. For equal widths that is "distance < stroke width".
 * Touching exactly (distance == stroke width) is not an overlap.
 * Endpoints that meet, including a round cap at a miter, are joins.
 */

import { deflateSync, crc32 } from 'node:zlib';

export const TOLERANCES = {
  endpointEps: 0.5,
  crossEndpointIgnore: 0.35,
  collinearSin: 0.02,
  collinearDist: 0.35,
  collinearMinOverlap: 0.75,
  inkSlop: 0.08,
  passageSlop: 0.12,
  curveFlatness: 0.3,
  siteGrid: 6,
};

const KIND_CROSSING = 'crossing';
const KIND_COLLINEAR = 'collinear-overlap';
const KIND_STROKE = 'stroke-overlap';
const KIND_PASSAGE = 'passage-blocked';
const KIND_SOLUTION = 'solution-blocked';

/**
 * Backend with the same draw calls as the PDF and canvas backends.
 * `finish()` returns wall centerline segments in page space.
 *
 * @param {{ flatness?: number, frameLineCount?: number }} [options]
 */
export function createRecordingBackend(options = {}) {
  const flatness = options.flatness ?? TOLERANCES.curveFlatness;
  const frameLineCount = options.frameLineCount ?? 10;
  const segments = [];
  let width = 1;
  let opacity = 1;
  let dash = null;
  let cmds = [];
  let pathOpen = false;
  let pathId = 1;
  const lineSegmentIndexes = [];
  const stack = [];

  function solid() {
    return opacity >= 1 && !(dash && dash.length);
  }

  function pushSegment(x1, y1, x2, y2, id) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx * dx + dy * dy < 1e-12) return;
    segments.push({
      id: segments.length,
      pathId: id,
      index: 0,
      x1, y1, x2, y2,
      w: width,
      role: 'wall',
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      minY: Math.min(y1, y2),
      maxY: Math.max(y1, y2),
    });
  }

  function emitChain(points, id) {
    let index = 0;
    const start = segments.length;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const before = segments.length;
      pushSegment(a.x, a.y, b.x, b.y, id);
      if (segments.length > before) {
        segments[segments.length - 1].index = index;
        index += 1;
      }
    }
    if (segments.length > start) {
      segments[start].head = true;
      segments[segments.length - 1].tail = true;
    }
  }

  function flattenCubic(p0, p1, p2, p3, out, depth) {
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const len = Math.hypot(dx, dy);
    const deviation = (p) => {
      if (len < 1e-9) return Math.hypot(p.x - p0.x, p.y - p0.y);
      return Math.abs((p.x - p0.x) * dy - (p.y - p0.y) * dx) / len;
    };
    if (depth > 10 || (deviation(p1) <= flatness && deviation(p2) <= flatness)) {
      out.push(p3);
      return;
    }
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const p01 = mid(p0, p1);
    const p12 = mid(p1, p2);
    const p23 = mid(p2, p3);
    const p012 = mid(p01, p12);
    const p123 = mid(p12, p23);
    const p0123 = mid(p012, p123);
    flattenCubic(p0, p01, p012, p0123, out, depth + 1);
    flattenCubic(p0123, p123, p23, p3, out, depth + 1);
  }

  function flattenQuadratic(p0, p1, p2, out) {
    const c1 = {
      x: p0.x + (2 / 3) * (p1.x - p0.x),
      y: p0.y + (2 / 3) * (p1.y - p0.y),
    };
    const c2 = {
      x: p2.x + (2 / 3) * (p1.x - p2.x),
      y: p2.y + (2 / 3) * (p1.y - p2.y),
    };
    flattenCubic(p0, c1, c2, p2, out, 0);
  }

  function flattenArc(cx, cy, r, a0, a1, out) {
    const span = a1 - a0;
    if (!(r > 0) || Math.abs(span) < 1e-8) return;
    const step = Math.min(Math.PI / 6, Math.max(0.05, Math.sqrt((8 * flatness) / r)));
    const n = Math.max(1, Math.ceil(Math.abs(span) / step));
    for (let i = 1; i <= n; i++) {
      const a = a0 + span * (i / n);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }

  function flushPath() {
    if (!pathOpen || !solid() || cmds.length === 0) {
      cmds = [];
      pathOpen = false;
      return;
    }
    const points = [];
    let cx = 0;
    let cy = 0;
    let pen = false;
    const id = pathId++;
    for (const cmd of cmds) {
      if (cmd.t === 'M') {
        if (points.length > 1) emitChain(points, id);
        points.length = 0;
        points.push({ x: cmd.x, y: cmd.y });
        cx = cmd.x;
        cy = cmd.y;
        pen = true;
      } else if (cmd.t === 'L' && pen) {
        points.push({ x: cmd.x, y: cmd.y });
        cx = cmd.x;
        cy = cmd.y;
      } else if (cmd.t === 'C' && pen) {
        const start = { x: cx, y: cy };
        flattenCubic(start, cmd.c1, cmd.c2, cmd.p, points, 0);
        cx = cmd.p.x;
        cy = cmd.p.y;
      } else if (cmd.t === 'Q' && pen) {
        const start = { x: cx, y: cy };
        flattenQuadratic(start, cmd.c, cmd.p, points);
        cx = cmd.p.x;
        cy = cmd.p.y;
      } else if (cmd.t === 'A') {
        const start = {
          x: cmd.cx + cmd.r * Math.cos(cmd.a0),
          y: cmd.cy + cmd.r * Math.sin(cmd.a0),
        };
        if (!pen || Math.hypot(start.x - cx, start.y - cy) > flatness) {
          if (points.length > 1) emitChain(points, id);
          points.length = 0;
          points.push(start);
        }
        flattenArc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, points);
        const end = points[points.length - 1];
        cx = end.x;
        cy = end.y;
        pen = true;
      }
    }
    if (points.length > 1) emitChain(points, id);
    cmds = [];
    pathOpen = false;
  }

  const backend = {
    type: 'record',
    setStroke(_color, nextWidth) {
      width = nextWidth;
    },
    line(x1, y1, x2, y2) {
      flushPath();
      if (!solid()) return;
      const id = pathId++;
    const before = segments.length;
    pushSegment(x1, y1, x2, y2, id);
    if (segments.length > before) {
      segments[segments.length - 1].head = true;
      segments[segments.length - 1].tail = true;
      lineSegmentIndexes.push(segments.length - 1);
    }
    },
    beginPath() {
      flushPath();
      pathOpen = true;
      cmds = [];
    },
    moveTo(x, y) {
      pathOpen = true;
      cmds.push({ t: 'M', x, y });
    },
    lineTo(x, y) {
      pathOpen = true;
      cmds.push({ t: 'L', x, y });
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      pathOpen = true;
      cmds.push({
        t: 'C',
        c1: { x: cp1x, y: cp1y },
        c2: { x: cp2x, y: cp2y },
        p: { x, y },
      });
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      pathOpen = true;
      cmds.push({ t: 'Q', c: { x: cpx, y: cpy }, p: { x, y } });
    },
    arc(cx, cy, r, startAngle, endAngle) {
      pathOpen = true;
      cmds.push({ t: 'A', cx, cy, r, a0: startAngle, a1: endAngle });
    },
    stroke() {
      flushPath();
    },
    drawText() {},
    measureText(str) {
      return String(str).length * 5;
    },
    withScreenTransform(fn) { fn(); },
    save() {
      stack.push({ width, opacity, dash });
    },
    restore() {
      const s = stack.pop();
      if (!s) return;
      width = s.width;
      opacity = s.opacity;
      dash = s.dash;
    },
    setDash(pattern) {
      dash = pattern && pattern.length ? pattern : null;
    },
    setOpacity(value) {
      opacity = value ?? 1;
    },
  };

  return {
    backend,
    finish() {
      flushPath();
      if (frameLineCount > 0 && lineSegmentIndexes.length >= frameLineCount) {
        const start = lineSegmentIndexes.length - frameLineCount;
        for (let i = start; i < lineSegmentIndexes.length; i++) {
          segments[lineSegmentIndexes[i]].role = 'frame';
        }
      }
      return segments;
    },
  };
}

function orient(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function sgn(v) {
  if (v > 1e-7) return 1;
  if (v < -1e-7) return -1;
  return 0;
}

/**
 * Strict interior crossing. Touching at an endpoint returns null.
 * @returns {{ x: number, y: number, t: number, u: number, distFromEnd: number }|null}
 */
export function properCrossing(a, b) {
  const o1 = sgn(orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1));
  const o2 = sgn(orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2));
  const o3 = sgn(orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1));
  const o4 = sgn(orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2));
  if (o1 * o2 >= 0 || o3 * o4 >= 0) return null;
  const den = (a.x1 - a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 - b.x2);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((a.x1 - b.x1) * (b.y1 - b.y2) - (a.y1 - b.y1) * (b.x1 - b.x2)) / den;
  const u = ((a.x1 - b.x1) * (a.y1 - a.y2) - (a.y1 - b.y1) * (a.x1 - a.x2)) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  const x = a.x1 + t * (a.x2 - a.x1);
  const y = a.y1 + t * (a.y2 - a.y1);
  const distFromEnd = Math.min(
    Math.hypot(x - a.x1, y - a.y1),
    Math.hypot(x - a.x2, y - a.y2),
    Math.hypot(x - b.x1, y - b.y1),
    Math.hypot(x - b.x2, y - b.y2),
  );
  return { x, y, t, u, distFromEnd };
}

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-18) {
    t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return { dist: Math.hypot(px - x, py - y), t, x, y };
}

export function segmentDistance(a, b) {
  const hit = properCrossing(a, b);
  if (hit) return { dist: 0, x: hit.x, y: hit.y, aT: hit.t, bT: hit.u };
  const c1 = pointSegDist(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2);
  const c2 = pointSegDist(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2);
  const c3 = pointSegDist(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2);
  const c4 = pointSegDist(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2);
  let best = c1;
  let which = 1;
  if (c2.dist < best.dist) { best = c2; which = 2; }
  if (c3.dist < best.dist) { best = c3; which = 3; }
  if (c4.dist < best.dist) { best = c4; which = 4; }
  if (which <= 2) {
    return {
      dist: best.dist,
      x: best.x,
      y: best.y,
      aT: which === 1 ? 0 : 1,
      bT: best.t,
    };
  }
  return {
    dist: best.dist,
    x: best.x,
    y: best.y,
    aT: best.t,
    bT: which === 3 ? 0 : 1,
  };
}

function shareEndpoint(a, b, eps) {
  const e2 = eps * eps;
  const near = (x1, y1, x2, y2) => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= e2;
  };
  return near(a.x1, a.y1, b.x1, b.y1)
    || near(a.x1, a.y1, b.x2, b.y2)
    || near(a.x2, a.y2, b.x1, b.y1)
    || near(a.x2, a.y2, b.x2, b.y2);
}

function endpointTouchesSegment(a, b, eps) {
  return pointSegDist(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2).dist <= eps
    || pointSegDist(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2).dist <= eps
    || pointSegDist(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2).dist <= eps
    || pointSegDist(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2).dist <= eps;
}

/**
 * Length of the overlapping run when two segments lie on the same line.
 * Returns 0 when they are not collinear within the tolerances.
 */
export function collinearOverlapLength(a, b, scale) {
  const dax = a.x2 - a.x1;
  const day = a.y2 - a.y1;
  const dbx = b.x2 - b.x1;
  const dby = b.y2 - b.y1;
  const la = Math.hypot(dax, day);
  const lb = Math.hypot(dbx, dby);
  if (la < 1e-6 || lb < 1e-6) return 0;
  const cross = Math.abs(dax * dby - day * dbx);
  if (cross / (la * lb) > TOLERANCES.collinearSin) return 0;
  const lineDist = Math.abs((b.x1 - a.x1) * day - (b.y1 - a.y1) * dax) / la;
  if (lineDist > TOLERANCES.collinearDist * scale) return 0;
  const ux = dax / la;
  const uy = day / la;
  const proj = (x, y) => (x - a.x1) * ux + (y - a.y1) * uy;
  let b0 = proj(b.x1, b.y1);
  let b1 = proj(b.x2, b.y2);
  if (b0 > b1) {
    const swap = b0;
    b0 = b1;
    b1 = swap;
  }
  const lo = Math.max(0, b0);
  const hi = Math.min(la, b1);
  return Math.max(0, hi - lo);
}

function endClearance(seg, x, y) {
  return Math.min(
    Math.hypot(x - seg.x1, y - seg.y1),
    Math.hypot(x - seg.x2, y - seg.y2),
  );
}

function withEnds(seg, x1, y1, x2, y2) {
  return {
    x1, y1, x2, y2,
    w: seg.w,
    role: seg.role,
    pathId: seg.pathId,
    index: seg.index,
    minX: Math.min(x1, x2),
    maxX: Math.max(x1, x2),
    minY: Math.min(y1, y2),
    maxY: Math.max(y1, y2),
  };
}

/**
 * Portions of a segment outside the round-cap ball around an anchor.
 * A join lives inside that ball. What remains is the wall body.
 */
function outsideCap(seg, ax, ay, radius) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const fx = seg.x1 - ax;
  const fy = seg.y1 - ay;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let lo = null;
  let hi = null;
  if (a > 1e-12) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t0 = (-b - s) / (2 * a);
      const t1 = (-b + s) / (2 * a);
      lo = Math.max(0, Math.min(t0, t1));
      hi = Math.min(1, Math.max(t0, t1));
      if (lo > hi) {
        lo = null;
        hi = null;
      }
    }
  }
  const pieces = [];
  const push = (u, v) => {
    if (v - u < 1e-4) return;
    pieces.push(withEnds(
      seg,
      seg.x1 + dx * u,
      seg.y1 + dy * u,
      seg.x1 + dx * v,
      seg.y1 + dy * v,
    ));
  };
  if (lo == null) {
    const mx = (seg.x1 + seg.x2) / 2;
    const my = (seg.y1 + seg.y2) / 2;
    const inside = (mx - ax) * (mx - ax) + (my - ay) * (my - ay) < radius * radius;
    if (!inside) push(0, 1);
    return pieces;
  }
  if (lo > 0) push(0, lo);
  if (hi < 1) push(hi, 1);
  return pieces;
}

/**
 * True when the strokes still overlap outside the miter ball around `anchor`.
 * A corner join lives inside that ball. Parallel walls stay close past it.
 */
function bodiesOverlap(a, b, anchorX, anchorY, ball, strokeLimit) {
  const farA = outsideCap(a, anchorX, anchorY, ball);
  const farB = outsideCap(b, anchorX, anchorY, ball);
  if (farA.length === 0 || farB.length === 0) return false;
  for (let i = 0; i < farA.length; i++) {
    for (let j = 0; j < farB.length; j++) {
      if (segmentDistance(farA[i], farB[j]).dist < strokeLimit) return true;
    }
  }
  return false;
}

function collectWallEnds(walls) {
  const ends = [];
  for (let i = 0; i < walls.length; i++) {
    const seg = walls[i];
    if (seg.head) ends.push(seg.x1, seg.y1);
    if (seg.tail) ends.push(seg.x2, seg.y2);
  }
  return ends;
}

function buildEndIndex(ends, cell) {
  const grid = new Map();
  for (let i = 0; i < ends.length; i += 2) {
    const cx = Math.floor(ends[i] / cell);
    const cy = Math.floor(ends[i + 1] / cell);
    const key = (cx + 8000) * 20000 + (cy + 8000);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(ends[i], ends[i + 1]);
  }
  return { grid, cell };
}

function nearestEnd(x, y, index, maxDist) {
  const { grid, cell } = index;
  const reach = Math.ceil(maxDist / cell);
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const max2 = maxDist * maxDist;
  let best = max2;
  let ax = 0;
  let ay = 0;
  let found = false;
  for (let oy = -reach; oy <= reach; oy++) {
    for (let ox = -reach; ox <= reach; ox++) {
      const bucket = grid.get((cx + ox + 8000) * 20000 + (cy + oy + 8000));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i += 2) {
        const dx = bucket[i] - x;
        const dy = bucket[i + 1] - y;
        const d = dx * dx + dy * dy;
        if (d <= best) {
          best = d;
          ax = bucket[i];
          ay = bucket[i + 1];
          found = true;
        }
      }
    }
  }
  return found ? { x: ax, y: ay } : null;
}

function bboxFar(a, b, pad) {
  return a.maxX + pad < b.minX
    || b.maxX + pad < a.minX
    || a.maxY + pad < b.minY
    || b.maxY + pad < a.minY;
}

/**
 * @param {object[]} walls
 * @param {object[]} passages
 * @param {number} scale
 */
export function analyzeSegments(walls, passages, scale) {
  const s = scale > 0 ? scale : 1;
  const endpointEps = TOLERANCES.endpointEps * s;
  const crossIgnore = TOLERANCES.crossEndpointIgnore * s;
  const collinearMin = TOLERANCES.collinearMinOverlap * s;
  const inkSlop = TOLERANCES.inkSlop * s;
  const passageSlop = TOLERANCES.passageSlop * s;
  const site = TOLERANCES.siteGrid * s;

  const wallEnds = buildEndIndex(collectWallEnds(walls), Math.max(8 * s, 4));
  const counts = {
    [KIND_CROSSING]: 0,
    [KIND_COLLINEAR]: 0,
    [KIND_STROKE]: 0,
    [KIND_PASSAGE]: 0,
    [KIND_SOLUTION]: 0,
  };
  const roleCounts = {};
  const examples = [];
  const exampleCounts = {};
  const sites = new Set();
  let pairs = 0;

  function add(kind, a, b, x, y, dist) {
    pairs += 1;
    counts[kind] += 1;
    const roles = a.role <= b.role ? `${a.role}:${b.role}` : `${b.role}:${a.role}`;
    const roleKey = `${kind}:${roles}`;
    roleCounts[roleKey] = (roleCounts[roleKey] ?? 0) + 1;
    const gx = Math.round(x / site);
    const gy = Math.round(y / site);
    const siteId = `${kind}:${gx}:${gy}`;
    const freshSite = !sites.has(siteId);
    sites.add(siteId);
    const kept = exampleCounts[kind] ?? 0;
    if (freshSite && kept < 6) {
      exampleCounts[kind] = kept + 1;
      examples.push({
        kind,
        x, y, dist,
        roles,
        samePath: a.pathId === b.pathId,
        indexGap: Math.abs(a.index - b.index),
        endClearance: Math.min(endClearance(a, x, y), endClearance(b, x, y)),
        w1: a.w,
        w2: b.w,
        ax1: a.x1, ay1: a.y1, ax2: a.x2, ay2: a.y2,
        bx1: b.x1, by1: b.y1, bx2: b.x2, by2: b.y2,
      });
    }
  }

  let maxW = 1;
  for (let i = 0; i < walls.length; i++) {
    if (walls[i].w > maxW) maxW = walls[i].w;
  }
  const cell = Math.max(12 * s, maxW * 4);
  const grid = new Map();

  function keyOf(cx, cy) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  function touchCells(seg, into) {
    const dist = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    const steps = Math.max(1, Math.ceil(dist / cell));
    let prev = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor((seg.x1 + (seg.x2 - seg.x1) * t) / cell);
      const cy = Math.floor((seg.y1 + (seg.y2 - seg.y1) * t) / cell);
      const k = `${cx},${cy}`;
      if (k === prev) continue;
      prev = k;
      into.push(cx, cy);
    }
  }

  for (let i = 0; i < walls.length; i++) {
    const cells = [];
    touchCells(walls[i], cells);
    for (let c = 0; c < cells.length; c += 2) {
      const k = keyOf(cells[c], cells[c + 1]);
      let bucket = grid.get(k);
      if (!bucket) {
        bucket = [];
        grid.set(k, bucket);
      }
      bucket.push(i);
    }
  }

  const seen = new Set();
  const SHIFT = 2_000_003;

  function eachNearby(seg, visit) {
    const cells = [];
    touchCells(seg, cells);
    const local = new Set();
    for (let c = 0; c < cells.length; c += 2) {
      const cx = cells[c];
      const cy = cells[c + 1];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = grid.get(keyOf(cx + ox, cy + oy));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) local.add(bucket[b]);
        }
      }
    }
    for (const index of local) visit(index);
  }

  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    eachNearby(a, (j) => {
      if (j <= i) return;
      const pairKey = i * SHIFT + j;
      if (seen.has(pairKey)) return;
      seen.add(pairKey);
      const b = walls[j];
      const pad = (a.w + b.w) * 0.5;
      if (bboxFar(a, b, pad)) return;

      const samePath = a.pathId === b.pathId;
      if (samePath && Math.abs(a.index - b.index) <= 1) return;

      const hit = properCrossing(a, b);
      if (hit && hit.distFromEnd > crossIgnore) {
        add(KIND_CROSSING, a, b, hit.x, hit.y, 0);
        return;
      }

      const overlap = collinearOverlapLength(a, b, s);
      if (overlap > collinearMin) {
        const mid = segmentDistance(a, b);
        add(KIND_COLLINEAR, a, b, mid.x, mid.y, mid.dist);
        return;
      }

      if (shareEndpoint(a, b, endpointEps)) return;
      if (a.role === 'frame' && b.role === 'frame' && endpointTouchesSegment(a, b, endpointEps)) {
        return;
      }
      if (samePath) return;

      const close = segmentDistance(a, b);
      const capReach = (a.w + b.w) / 2;
      const limit = capReach - inkSlop;
      if (close.dist < limit) {
        // Two stroke widths: far enough for a sharp miter to separate,
        // close enough that a wall ending in the middle of another still counts.
        const zone = Math.max(capReach * 2, 1.5 * s);
        const anchor = nearestEnd(close.x, close.y, wallEnds, zone);
        if (!anchor || bodiesOverlap(a, b, anchor.x, anchor.y, zone, limit)) {
          add(KIND_STROKE, a, b, close.x, close.y, close.dist);
        }
      }
    });
  }

  for (let p = 0; p < passages.length; p++) {
    const pass = passages[p];
    eachNearby(pass, (j) => {
      const wall = walls[j];
      const limit = wall.w / 2 - passageSlop;
      if (bboxFar(pass, wall, Math.max(0, limit))) return;
      const close = segmentDistance(pass, wall);
      // The closest point is on `wall` (second argument): bT.
      // A round cap at a wall end covers a disc of radius stroke/2. Grazing
      // that cap at a miter is the corner, not a blocked passage. A wall end
      // that reaches the centerline (well inside the cap) still counts.
      const endDist = Math.min(
        Math.hypot(close.x - wall.x1, close.y - wall.y1),
        Math.hypot(close.x - wall.x2, close.y - wall.y2),
      );
      // Within one stroke of a wall end the hit is the round cap at a miter.
      // Count it only when the centerline is inside the inner half of that cap.
      const miterCap = endDist <= wall.w && close.dist > wall.w * 0.2;
      if (close.dist < limit && !miterCap) {
        add(KIND_PASSAGE, pass, wall, close.x, close.y, close.dist);
        if (pass.solution) {
          counts[KIND_SOLUTION] += 1;
          const gx = Math.round(close.x / site);
          const gy = Math.round(close.y / site);
          sites.add(`${KIND_SOLUTION}:${gx}:${gy}`);
        }
      }
    });
  }

  const siteCounts = {};
  for (const key of sites) {
    const kind = key.slice(0, key.indexOf(':'));
    siteCounts[kind] = (siteCounts[kind] ?? 0) + 1;
  }

  return {
    counts,
    roleCounts,
    pairs,
    sites: sites.size,
    siteCounts,
    examples,
  };
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length - 4, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function stamp(data, imgW, imgH, x, y, rad, rgba) {
  const r = Math.ceil(rad);
  const x0 = Math.floor(x - r);
  const y0 = Math.floor(y - r);
  const r2 = rad * rad;
  for (let iy = y0; iy <= y0 + r * 2; iy++) {
    if (iy < 0 || iy >= imgH) continue;
    for (let ix = x0; ix <= x0 + r * 2; ix++) {
      if (ix < 0 || ix >= imgW) continue;
      const dx = ix + 0.5 - x;
      const dy = iy + 0.5 - y;
      if (dx * dx + dy * dy > r2) continue;
      const o = (iy * imgW + ix) * 4;
      data[o] = rgba[0];
      data[o + 1] = rgba[1];
      data[o + 2] = rgba[2];
      data[o + 3] = 255;
    }
  }
}

function paintSegment(data, imgW, imgH, seg, rgba, map) {
  const a = map(seg.x1, seg.y1);
  const b = map(seg.x2, seg.y2);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len));
  const rad = Math.max(0.6, (seg.w || 1) * map.zoom * 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stamp(data, imgW, imgH, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, rad, rgba);
  }
}

/**
 * Rasterize page-space strokes (y-up) to a PNG. Highlights are drawn on top.
 *
 * @param {object} opts
 * @param {number} opts.pageWidth
 * @param {number} opts.pageHeight
 * @param {object[]} opts.walls
 * @param {object[]} [opts.highlights]
 * @param {{ x: number, y: number, w: number, h: number, zoom?: number }} [opts.crop] page y-up
 * @returns {Buffer}
 */
export function renderOverlapPng(opts) {
  const { pageWidth, pageHeight, walls, highlights = [], crop } = opts;
  const zoom = crop?.zoom ?? 1;
  const originX = crop ? crop.x : 0;
  const originY = crop ? crop.y : 0;
  const worldW = crop ? crop.w : pageWidth;
  const worldH = crop ? crop.h : pageHeight;
  const imgW = Math.max(1, Math.round(worldW * zoom));
  const imgH = Math.max(1, Math.round(worldH * zoom));
  const data = new Uint8Array(imgW * imgH * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const map = (x, y) => ({
    x: (x - originX) * zoom,
    y: (originY + worldH - y) * zoom,
  });
  map.zoom = zoom;
  const black = [0, 0, 0, 255];
  for (let i = 0; i < walls.length; i++) paintSegment(data, imgW, imgH, walls[i], black, map);
  const red = [196, 24, 24, 255];
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    paintSegment(data, imgW, imgH, {
      x1: h.ax1, y1: h.ay1, x2: h.ax2, y2: h.ay2, w: h.w1 || 1,
    }, red, map);
    paintSegment(data, imgW, imgH, {
      x1: h.bx1, y1: h.by1, x2: h.bx2, y2: h.by2, w: h.w2 || 1,
    }, red, map);
    const p = map(h.x, h.y);
    stamp(data, imgW, imgH, p.x, p.y, Math.max(1.25, 0.9 * zoom), red);
  }
  return encodePng(imgW, imgH, data);
}

function svgEsc(n) {
  return Math.round(n * 100) / 100;
}

/**
 * SVG of the same page-space strokes, y flipped so Start is at the top.
 * @returns {string}
 */
export function renderOverlapSvg(opts) {
  const { pageWidth, pageHeight, walls, highlights = [], crop } = opts;
  const originX = crop ? crop.x : 0;
  const originY = crop ? crop.y : 0;
  const worldW = crop ? crop.w : pageWidth;
  const worldH = crop ? crop.h : pageHeight;
  const flipY = (y) => originY + worldH - y;
  const line = (x1, y1, x2, y2, stroke, width) =>
    `<line x1="${svgEsc(x1 - originX)}" y1="${svgEsc(flipY(y1))}" x2="${svgEsc(x2 - originX)}" y2="${svgEsc(flipY(y2))}" stroke="${stroke}" stroke-width="${svgEsc(width)}" stroke-linecap="round"/>`;
  const parts = [];
  parts.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    parts.push(line(w.x1, w.y1, w.x2, w.y2, '#111', w.w || 1));
  }
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    parts.push(line(h.ax1, h.ay1, h.ax2, h.ay2, '#c41818', Math.max(h.w1 || 1, 1.4)));
    parts.push(line(h.bx1, h.by1, h.bx2, h.by2, '#c41818', Math.max(h.w2 || 1, 1.4)));
    const cx = h.x - originX;
    const cy = flipY(h.y);
    parts.push(`<circle cx="${svgEsc(cx)}" cy="${svgEsc(cy)}" r="3.5" fill="#c41818"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${svgEsc(worldW)}" height="${svgEsc(worldH)}" viewBox="0 0 ${svgEsc(worldW)} ${svgEsc(worldH)}">${parts.join('')}</svg>\n`;
}
