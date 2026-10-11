/**
 * Point-in-corridor tests. Coordinates are maze-local, not pixels.
 * Tolerance is a fraction of the local corridor width.
 */

import { DIRECTIONS } from '../maze/grid.js';

const GRID_DIRS = [
  { wall: DIRECTIONS.RIGHT, dr: 0, dc: 1 },
  { wall: DIRECTIONS.LEFT, dr: 0, dc: -1 },
  { wall: DIRECTIONS.BOTTOM, dr: 1, dc: 0 },
  { wall: DIRECTIONS.TOP, dr: -1, dc: 0 },
];

/**
 * @param {string|null} key
 * @returns {{ row: number, col: number }|null}
 */
export function parseGridKey(key) {
  if (!key) return null;
  const [row, col] = key.split(',').map(Number);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
}

export function gridKey(row, col) {
  return `${row},${col}`;
}

function inExpandedCell(x, y, row, col, t) {
  return x >= col - t && x <= col + 1 + t && y >= row - t && y <= row + 1 + t;
}

/**
 * Grid cell under a point. Stays in `currentKey` when the point is only
 * slightly past a wall. Steps into an open neighbor once the shared edge is crossed.
 *
 * @param {import('../maze/grid.js').MazeGrid} grid
 * @param {number} tolerance
 * @param {{x:number,y:number}} point - x is column float, y is row float (row 0 at the top)
 * @param {string|null} currentKey
 * @param {string} startKey
 * @returns {string|null}
 */
export function locateGrid(grid, tolerance, point, currentKey, startKey) {
  const t = tolerance;
  const { x, y } = point;

  if (!currentKey) {
    const start = parseGridKey(startKey);
    if (start && inExpandedCell(x, y, start.row, start.col, t)) return startKey;
    return null;
  }

  const here = parseGridKey(currentKey);
  if (!here) return null;
  const cell = grid.getCell(here.row, here.col);
  if (!cell) return null;

  let best = null;
  let bestPen = 0;

  for (let i = 0; i < GRID_DIRS.length; i++) {
    const dir = GRID_DIRS[i];
    if (cell.hasWall(dir.wall)) continue;
    const nr = here.row + dir.dr;
    const nc = here.col + dir.dc;
    if (!grid.isValidPosition(nr, nc)) continue;

    let crossed = false;
    let pen = 0;
    let lateral = false;
    if (dir.dc === 1) {
      crossed = x >= here.col + 1;
      pen = x - (here.col + 1);
      lateral = y >= here.row - t && y <= here.row + 1 + t && x <= nc + 1 + t;
    } else if (dir.dc === -1) {
      crossed = x <= here.col;
      pen = here.col - x;
      lateral = y >= here.row - t && y <= here.row + 1 + t && x >= nc - t;
    } else if (dir.dr === 1) {
      crossed = y >= here.row + 1;
      pen = y - (here.row + 1);
      lateral = x >= here.col - t && x <= here.col + 1 + t && y <= nr + 1 + t;
    } else {
      crossed = y <= here.row;
      pen = here.row - y;
      lateral = x >= here.col - t && x <= here.col + 1 + t && y >= nr - t;
    }

    if (crossed && lateral && pen >= bestPen) {
      bestPen = pen;
      best = gridKey(nr, nc);
    }
  }

  if (best) return best;
  if (inExpandedCell(x, y, here.row, here.col, t)) return currentKey;
  return null;
}

function distToSegment(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * vx + (point.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + vx * t), point.y - (a.y + vy * t));
}

/**
 * Organic corridor. Local coordinates are graph coordinates.
 * Claim radius is half the corridor plus `tolerance` times the full corridor width.
 *
 * @param {import('../maze/organic-graph.js').OrganicGraph} graph
 * @param {number} halfW
 * @param {number} startId
 * @param {number} tolerance
 * @param {{x:number,y:number}} point
 * @param {string|null} currentKey
 * @returns {string|null}
 */
export function locateOrganic(graph, halfW, startId, tolerance, point, currentKey) {
  const radius = halfW + tolerance * (halfW * 2);

  if (!currentKey) {
    const start = graph.getNode(startId);
    if (start && Math.hypot(point.x - start.x, point.y - start.y) <= radius) return String(startId);
    return null;
  }

  const id = Number(currentKey);
  const node = graph.getNode(id);
  if (!node) return null;

  let best = null;
  let bestAlong = 0.5;
  const nids = graph.getNeighbors(id);
  for (let i = 0; i < nids.length; i++) {
    const nid = nids[i];
    if (graph.hasWall(id, nid)) continue;
    const other = graph.getNode(nid);
    if (!other) continue;
    if (distToSegment(point, node, other) > radius) continue;
    const vx = other.x - node.x;
    const vy = other.y - node.y;
    const len2 = vx * vx + vy * vy || 1;
    const along = ((point.x - node.x) * vx + (point.y - node.y) * vy) / len2;
    if (along > bestAlong) {
      bestAlong = along;
      best = String(nid);
    }
  }
  if (best) return best;

  if (Math.hypot(point.x - node.x, point.y - node.y) <= radius) return currentKey;
  for (let i = 0; i < nids.length; i++) {
    const nid = nids[i];
    if (graph.hasWall(id, nid)) continue;
    const other = graph.getNode(nid);
    if (other && distToSegment(point, node, other) <= radius) return currentKey;
  }
  return null;
}

function normAngle(a) {
  const turn = Math.PI * 2;
  const t = a % turn;
  return t < 0 ? t + turn : t;
}

/** Signed smallest difference `to - from`, in (-PI, PI]. */
function angDiff(from, to) {
  let d = normAngle(to) - normAngle(from);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function polarKey(ring, wedge) {
  return `${ring},${wedge}`;
}

/**
 * @param {import('../maze/polarGrid.js').PolarGrid} grid
 * @param {{ roomNorm: number, ringNorm: number }} geom
 * @param {number} tolerance
 * @param {{ nx: number, ny: number }} point - offset from center, divided by maxRadius
 * @param {string|null} currentKey
 * @param {{ ring: number, wedge: number }} start
 * @returns {string|null}
 */
export function locatePolar(grid, geom, tolerance, point, currentKey, start) {
  const radius = Math.hypot(point.nx, point.ny);
  const angle = normAngle(Math.atan2(point.ny, point.nx));
  const radialSlack = tolerance * geom.ringNorm;

  if (!currentKey) {
    if (sectorContains(grid, geom, start.ring, start.wedge, radius, angle, radialSlack, tolerance)) {
      return polarKey(start.ring, start.wedge);
    }
    return null;
  }

  const [ring, wedge] = currentKey.split(',').map(Number);
  const cell = grid.getCell(ring, wedge);
  if (!cell) return null;

  const neighbors = grid.getNeighbors(ring, wedge);
  let best = null;
  let bestPen = 0;
  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i];
    const pen = penetration(grid, geom, ring, wedge, n, radius, angle, radialSlack, tolerance);
    if (pen > bestPen) {
      bestPen = pen;
      best = n;
    }
  }
  if (best && bestPen > 1e-8) return polarKey(best.ring, best.wedge);
  if (sectorContains(grid, geom, ring, wedge, radius, angle, radialSlack, tolerance)) return currentKey;
  return null;
}

function ringBand(geom, ring) {
  if (ring <= 0) return { inner: 0, outer: geom.roomNorm };
  const inner = geom.roomNorm + (ring - 1) * geom.ringNorm;
  return { inner, outer: geom.roomNorm + ring * geom.ringNorm };
}

function sectorContains(grid, geom, ring, wedge, radius, angle, radialSlack, tolerance) {
  const { inner, outer } = ringBand(geom, ring);
  if (radius < inner - radialSlack || radius > outer + radialSlack) return false;
  if (ring === 0) return true;
  const step = (Math.PI * 2) / grid.wedgesAtRing(ring);
  const slack = tolerance * step;
  const start = wedge * step;
  const rel = normAngle(angle - start);
  return rel <= step + slack || rel >= Math.PI * 2 - slack;
}

/**
 * How far `point` has crossed from `ring,wedge` into neighbor `n`.
 * Zero when the boundary has not been crossed.
 */
function penetration(grid, geom, ring, wedge, n, radius, angle, radialSlack, tolerance) {
  const step = ring === 0 ? (Math.PI * 2) / grid.wedgesAtRing(n.ring) : (Math.PI * 2) / grid.wedgesAtRing(ring);
  const angSlack = tolerance * step;
  const { inner, outer } = ringBand(geom, ring);

  if (n.ring === ring) {
    const W = grid.wedgesAtRing(ring);
    const forward = (wedge + 1) % W === n.wedge;
    const boundary = forward ? (wedge + 1) * step : wedge * step;
    const pen = forward ? angDiff(boundary, angle) : angDiff(angle, boundary);
    if (pen <= 1e-8) return 0;
    if (pen > step + angSlack) return 0;
    if (radius < inner - radialSlack || radius > outer + radialSlack) return 0;
    return pen;
  }

  if (n.ring > ring) {
    const pen = radius - outer;
    if (pen <= 1e-8) return 0;
    if (pen > geom.ringNorm + radialSlack) return 0;
    if (!angleNear(grid, n.ring, n.wedge, angle, tolerance)) return 0;
    return pen;
  }

  const pen = inner - radius;
  if (pen <= 1e-8) return 0;
  if (ring === 0) return 0;
  if (pen > (ring === 1 ? geom.roomNorm + radialSlack : geom.ringNorm + radialSlack)) return 0;
  if (n.ring === 0) {
    if (!angleNear(grid, ring, wedge, angle, tolerance)) return 0;
    return pen;
  }
  if (!angleNear(grid, n.ring, n.wedge, angle, tolerance)) return 0;
  return pen;
}

function angleNear(grid, ring, wedge, angle, tolerance) {
  if (ring === 0) return true;
  const step = (Math.PI * 2) / grid.wedgesAtRing(ring);
  const slack = tolerance * step;
  const rel = normAngle(angle - wedge * step);
  return rel <= step + slack || rel >= Math.PI * 2 - slack;
}
