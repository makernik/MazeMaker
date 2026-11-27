/**
 * Keep organic wall strokes at least one stroke width apart, plus a small margin.
 *
 * Filler edges that cannot honor that clearance are closed. Curvy bows keep the
 * D-023 shape and are scaled down only where the full bow would break it.
 * Straight Jagged corridors are unchanged.
 */

import { curvyBowOffset, curvyPoint } from '../pdf/drawers/organic-geometry.js';

/** Extra maze-points beyond one stroke width between wall centerlines. */
export const WALL_GAP_MARGIN = 2;

const BOW_STEP = 2;

export function edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function strokeGap(lineThickness) {
  return lineThickness + WALL_GAP_MARGIN;
}

function searchPad(halfW, lineThickness) {
  return 2 * halfW + lineThickness + WALL_GAP_MARGIN + 1.8 * halfW;
}

function sharesNode(a, b) {
  if (a.border || b.border) return false;
  return a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b;
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
  return Math.hypot(px - x, py - y);
}

function segDist(a, b) {
  const o1 = (b.x1 - a.x1) * (a.y2 - a.y1) - (b.y1 - a.y1) * (a.x2 - a.x1);
  const o2 = (b.x2 - a.x1) * (a.y2 - a.y1) - (b.y2 - a.y1) * (a.x2 - a.x1);
  const o3 = (a.x1 - b.x1) * (b.y2 - b.y1) - (a.y1 - b.y1) * (b.x2 - b.x1);
  const o4 = (a.x2 - b.x1) * (b.y2 - b.y1) - (a.y2 - b.y1) * (b.x2 - b.x1);
  if (o1 * o2 < 0 && o3 * o4 < 0) return 0;
  return Math.min(
    pointSegDist(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2),
    pointSegDist(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2),
    pointSegDist(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2),
    pointSegDist(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2),
  );
}

function openSegments(graph) {
  const segs = [];
  if (!graph) return segs;
  const seen = new Set();
  for (const node of graph.nodes) {
    for (const nid of node.neighbors) {
      if (graph.hasWall(node.id, nid)) continue;
      const key = edgeKey(node.id, nid);
      if (seen.has(key)) continue;
      seen.add(key);
      const other = graph.getNode(nid);
      if (!other) continue;
      segs.push({
        key,
        a: node.id,
        b: nid,
        x1: node.x,
        y1: node.y,
        x2: other.x,
        y2: other.y,
        border: false,
        filler: false,
      });
    }
  }
  return segs;
}

function borderSegments(width, height) {
  return [
    { key: 'border-b', a: -1, b: -2, x1: 0, y1: 0, x2: width, y2: 0, border: true },
    { key: 'border-t', a: -3, b: -4, x1: 0, y1: height, x2: width, y2: height, border: true },
    { key: 'border-l', a: -5, b: -6, x1: 0, y1: 0, x2: 0, y2: height, border: true },
    { key: 'border-r', a: -7, b: -8, x1: width, y1: 0, x2: width, y2: height, border: true },
  ];
}

function buildGrid(segs, cell) {
  const map = new Map();
  for (const seg of segs) {
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    const steps = Math.max(1, Math.ceil(len / cell));
    let prev = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor((seg.x1 + (seg.x2 - seg.x1) * t) / cell);
      const cy = Math.floor((seg.y1 + (seg.y2 - seg.y1) * t) / cell);
      const key = `${cx},${cy}`;
      if (key === prev) continue;
      prev = key;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push(seg);
    }
  }
  return { map, cell };
}

function nearby(grid, seg, pad) {
  const reach = Math.max(1, Math.ceil(pad / grid.cell));
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  const steps = Math.max(1, Math.ceil(len / grid.cell));
  const seen = new Set();
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.floor((seg.x1 + (seg.x2 - seg.x1) * t) / grid.cell);
    const cy = Math.floor((seg.y1 + (seg.y2 - seg.y1) * t) / grid.cell);
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) {
        const bucket = grid.map.get(`${cx + ox},${cy + oy}`);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const other = bucket[k];
          if (seen.has(other)) continue;
          seen.add(other);
          out.push(other);
        }
      }
    }
  }
  return out;
}

function fullCrest(seg, halfW) {
  if (seg.border) return 0;
  const off = curvyBowOffset(seg.x1, seg.y1, seg.x2, seg.y2, halfW, 1);
  return Math.hypot(off.x, off.y) * 0.75;
}

function bowPolyline(seg, scale, halfW) {
  if (seg.border || scale <= 0) {
    return [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];
  }
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  const steps = Math.max(2, Math.ceil(len / BOW_STEP));
  const pts = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curvyPoint(seg.x1, seg.y1, seg.x2, seg.y2, halfW, t, scale);
    pts[i] = p;
  }
  return pts;
}

function chordNormal(seg, halfW) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * halfW, y: (dx / len) * halfW };
}

function shiftPoly(pts, vx, vy) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) out[i] = { x: pts[i].x + vx, y: pts[i].y + vy };
  return out;
}

/** Both wall centerlines. The drawer shifts the centerline by the chord normal. */
function wallPolylines(seg, scale, halfW) {
  const center = bowPolyline(seg, seg.border ? 0 : scale, halfW);
  if (seg.border) return [center];
  const n = chordNormal(seg, halfW);
  return [shiftPoly(center, n.x, n.y), shiftPoly(center, -n.x, -n.y)];
}

function polySegs(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    out.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y });
  }
  return out;
}

function polylinesClear(mine, theirs, need) {
  for (let a = 0; a < mine.length; a++) {
    const as = polySegs(mine[a]);
    for (let b = 0; b < theirs.length; b++) {
      const bs = polySegs(theirs[b]);
      for (let i = 0; i < as.length; i++) {
        for (let j = 0; j < bs.length; j++) {
          if (segDist(as[i], bs[j]) < need) return false;
        }
      }
    }
  }
  return true;
}

function sharedJoint(seg, other) {
  if (seg.a === other.a || seg.a === other.b) return { x: seg.x1, y: seg.y1 };
  if (seg.b === other.a || seg.b === other.b) return { x: seg.x2, y: seg.y2 };
  return null;
}

function awayFromJoint(pts, joint, radius) {
  if (!joint) return [pts];
  const r2 = radius * radius;
  const runs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].x - joint.x;
    const dy = pts[i].y - joint.y;
    if (dx * dx + dy * dy <= r2) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
    } else {
      cur.push(pts[i]);
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

function bowClears(seg, scale, others, halfW, lineThickness) {
  const need = strokeGap(lineThickness);
  const jointR = halfW + lineThickness;
  const mine = wallPolylines(seg, scale, halfW);
  for (let n = 0; n < others.length; n++) {
    const other = others[n];
    if (other === seg || other.key === seg.key) continue;
    const joint = sharesNode(seg, other) ? sharedJoint(seg, other) : null;
    if (other.border && joint) continue;
    const mineRuns = joint ? mine.flatMap((pts) => awayFromJoint(pts, joint, jointR)) : mine;
    if (mineRuns.length === 0) continue;
    const theirsAll = other._fullWalls || wallPolylines(other, other.border ? 0 : 1, halfW);
    const theirs = joint ? theirsAll.flatMap((pts) => awayFromJoint(pts, joint, jointR)) : theirsAll;
    if (theirs.length === 0) continue;
    if (!polylinesClear(mineRuns, theirs, need)) return false;
    if (!other.border) {
      const arc = halfW + need;
      const nodes = [{ x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 }];
      for (let r = 0; r < mineRuns.length; r++) {
        for (let p = 0; p < mineRuns[r].length; p++) {
          for (let k = 0; k < nodes.length; k++) {
            if (joint && nodes[k].x === joint.x && nodes[k].y === joint.y) continue;
            const dx = mineRuns[r][p].x - nodes[k].x;
            const dy = mineRuns[r][p].y - nodes[k].y;
            if (dx * dx + dy * dy < arc * arc) return false;
          }
        }
      }
    }
  }
  return true;
}

function scaleForSegment(seg, candidates, halfW, lineThickness) {
  const crest = fullCrest(seg, halfW);
  const relevant = [];
  for (let i = 0; i < candidates.length; i++) {
    const other = candidates[i];
    if (other === seg || other.key === seg.key) continue;
    const theirCrest = other.border ? 0 : (other._crest ?? fullCrest(other, halfW));
    const need = 2 * halfW + strokeGap(lineThickness);
    if (segDist(seg, other) >= need + crest + theirCrest) continue;
    relevant.push(other);
  }
  if (relevant.length === 0) return 1;
  if (bowClears(seg, 1, relevant, halfW, lineThickness)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (bowClears(seg, mid, relevant, halfW, lineThickness)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Close filler edges that would draw on top of a carved corridor, another
 * filler corridor, or the outer border. The main maze is left as carved.
 *
 * @param {object} fillerGraph
 * @param {object} mainGraph
 * @param {number} halfW
 * @param {number} lineThickness
 * @param {number} boundsWidth
 * @param {number} boundsHeight
 */
export function pruneCloseFillerEdges(fillerGraph, mainGraph, halfW, lineThickness, boundsWidth, boundsHeight) {
  if (!fillerGraph) return;
  const main = openSegments(mainGraph);
  const filler = openSegments(fillerGraph);
  for (let i = 0; i < filler.length; i++) filler[i].filler = true;
  if (filler.length === 0) return;
  const borders = borderSegments(boundsWidth, boundsHeight);
  const need = strokeGap(lineThickness);
  const cell = Math.max(8, 2 * halfW + need);
  const grid = buildGrid(main.concat(filler, borders), cell);
  const drop = [];
  for (let i = 0; i < filler.length; i++) {
    const seg = filler[i];
    const mine = wallPolylines(seg, 0, halfW);
    const near = nearby(grid, seg, 2 * halfW + need);
    let bad = false;
    for (let k = 0; k < near.length && !bad; k++) {
      const other = near[k];
      if (other.key === seg.key || sharesNode(seg, other)) continue;
      const theirs = wallPolylines(other, 0, halfW);
      if (!polylinesClear(mine, theirs, need)) bad = true;
    }
    if (bad) drop.push(seg);
  }
  // Junction arcs sit on a circle of radius halfW. A chord of that arc can
  // cut into a nearby wall even when the straight corridor walls are clear.
  const arcLimit = halfW + need;
  const wallPieces = [];
  const sources = main.concat(filler, borders);
  for (let i = 0; i < sources.length; i++) {
    const polys = wallPolylines(sources[i], 0, halfW);
    for (let p = 0; p < polys.length; p++) {
      for (let k = 1; k < polys[p].length; k++) {
        wallPieces.push({
          x1: polys[p][k - 1].x,
          y1: polys[p][k - 1].y,
          x2: polys[p][k].x,
          y2: polys[p][k].y,
          a: sources[i].a,
          b: sources[i].b,
          border: sources[i].border,
          filler: sources[i].filler,
        });
      }
    }
  }
  const wallGrid = buildGrid(wallPieces, cell);
  const doomed = new Set();
  const point = (x, y) => ({ x1: x, y1: y, x2: x, y2: y });
  function tooClose(x, y, selfId) {
    const hits = nearby(wallGrid, point(x, y), arcLimit);
    for (let i = 0; i < hits.length; i++) {
      const w = hits[i];
      if (w.a === selfId || w.b === selfId) continue;
      if (pointSegDist(x, y, w.x1, w.y1, w.x2, w.y2) < arcLimit) return w;
    }
    return null;
  }
  for (let i = 0; i < fillerGraph.nodes.length; i++) {
    const node = fillerGraph.nodes[i];
    if (tooClose(node.x, node.y, node.id)) doomed.add(node.id);
  }
  for (let i = 0; i < filler.length; i++) {
    if (doomed.has(filler[i].a) || doomed.has(filler[i].b)) drop.push(filler[i]);
  }
  for (let i = 0; i < mainGraph.nodes.length; i++) {
    const node = mainGraph.nodes[i];
    const hits = nearby(wallGrid, point(node.x, node.y), arcLimit);
    for (let h = 0; h < hits.length; h++) {
      const w = hits[h];
      if (!w.filler || w.a === node.id || w.b === node.id) continue;
      if (pointSegDist(node.x, node.y, w.x1, w.y1, w.x2, w.y2) < arcLimit) {
        drop.push({ key: edgeKey(w.a, w.b) });
      }
    }
  }
  for (let i = 0; i < drop.length; i++) {
    fillerGraph.walls.add(drop[i].key);
  }
}

/**
 * Per-edge Curvy amplitude scale in [0, 1]. 1 keeps the D-023 bow.
 * Cached on the maze for the wall drawer, the solution line, and play.
 *
 * @param {object} maze
 * @param {number} halfW
 * @param {number} lineThickness
 * @returns {Map<string, number>}
 */
export function ensureBowScales(maze, halfW, lineThickness) {
  if (maze.bowScales && maze._bowHalfW === halfW && maze._bowThick === lineThickness) {
    return maze.bowScales;
  }
  const segs = openSegments(maze.graph).concat(openSegments(maze.fillerGraph));
  const borders = borderSegments(maze.boundsWidth, maze.boundsHeight);
  const maxCrest = 1.8 * halfW;
  const need = strokeGap(lineThickness);
  const cell = Math.max(8, 2 * halfW + need);
  const grid = buildGrid(segs.concat(borders), cell);
  const queryPad = 2 * halfW + need + maxCrest * 2;
  for (let i = 0; i < segs.length; i++) {
    segs[i]._crest = fullCrest(segs[i], halfW);
    segs[i]._fullWalls = wallPolylines(segs[i], 1, halfW);
  }
  for (let i = 0; i < borders.length; i++) {
    borders[i]._crest = 0;
    borders[i]._fullWalls = wallPolylines(borders[i], 0, halfW);
  }
  const scales = new Map();
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const candidates = nearby(grid, seg, queryPad);
    scales.set(seg.key, scaleForSegment(seg, candidates, halfW, lineThickness));
  }
  maze.bowScales = scales;
  maze._bowHalfW = halfW;
  maze._bowThick = lineThickness;
  return scales;
}

/**
 * @param {Map<string, number>|undefined} scales
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function bowScaleFor(scales, a, b) {
  if (!scales) return 1;
  const value = scales.get(edgeKey(a, b));
  return value == null ? 1 : value;
}
