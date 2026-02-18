/**
 * Circle packing for organic maze layout.
 * Deterministic particle-style packing: variable radii (breaks hex pattern), repel overlaps.
 * Uses spatial hashing for O(n) per-iteration performance.
 * Same seed → same layout.
 */

import { createRng } from '../utils/rng.js';

// ---------------------------------------------------------------------------
// Spatial grid — fast cell-based neighbor lookup
// ---------------------------------------------------------------------------

class SpatialGrid {
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} cellSize - must be >= max interaction distance
   */
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.cells = new Array(this.cols * this.rows);
  }

  _key(cx, cy) {
    return cy * this.cols + cx;
  }

  /** Populate grid from circles array. */
  build(circles) {
    this.cells.fill(null);
    for (let i = 0; i < circles.length; i++) {
      const cx = Math.max(0, Math.min(this.cols - 1, (circles[i].x / this.cellSize) | 0));
      const cy = Math.max(0, Math.min(this.rows - 1, (circles[i].y / this.cellSize) | 0));
      const key = this._key(cx, cy);
      const cell = this.cells[key];
      if (cell) cell.push(i);
      else this.cells[key] = [i];
    }
  }

  /** Return indices of circles in the same cell + 8 neighbors. */
  getNearby(x, y) {
    const cx = Math.max(0, Math.min(this.cols - 1, (x / this.cellSize) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (y / this.cellSize) | 0));
    const result = [];
    const minCy = cy > 0 ? cy - 1 : 0;
    const maxCy = cy < this.rows - 1 ? cy + 1 : cy;
    const minCx = cx > 0 ? cx - 1 : 0;
    const maxCx = cx < this.cols - 1 ? cx + 1 : cx;
    for (let ny = minCy; ny <= maxCy; ny++) {
      for (let nx = minCx; nx <= maxCx; nx++) {
        const cell = this.cells[this._key(nx, ny)];
        if (cell) {
          for (let k = 0; k < cell.length; k++) result.push(cell[k]);
        }
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Pack circles
// ---------------------------------------------------------------------------

/**
 * Pack circles into a rectangle. Deterministic given seed.
 *
 * @param {object} options
 * @param {number} options.width - Bounds width (points)
 * @param {number} options.height - Bounds height (points)
 * @param {number} options.targetCount - Number of circles
 * @param {number} options.seed - Seed for RNG
 * @param {number} [options.maxIterations] - Repulsion iterations (default: capped at 500)
 * @returns {{ circles: Array<{ id: number, x: number, y: number, r: number }> }}
 */
export function packCircles(options) {
  const {
    width,
    height,
    targetCount,
    seed,
    maxIterations = Math.min(500, Math.max(200, Math.ceil(targetCount * 2.5))),
  } = options;

  const rng = createRng(seed);

  const area = width * height;
  const baseR = Math.sqrt((area * 0.4) / (targetCount * Math.PI));
  const minR = Math.max(4, baseR * 0.5);
  const maxR = Math.max(minR + 2, baseR * 1.4);

  const circles = [];
  const padding = maxR + 2;

  for (let id = 0; id < targetCount; id++) {
    const t = id / Math.max(1, targetCount - 1);
    const rand = rng.random();
    const r = minR + (maxR - minR) * (0.6 + 0.4 * (t * 0.3 + rand * 0.7));
    const x = padding + rng.randomFloat(0, width - 2 * padding);
    const y = padding + rng.randomFloat(0, height - 2 * padding);
    circles.push({ id, x, y, r: Math.max(minR, r) });
  }

  // Cell size covers max interaction distance: touching + attraction range
  const cellSize = Math.max(1, 2 * maxR * 1.5);
  const grid = new SpatialGrid(width, height, cellSize);

  for (let iter = 0; iter < maxIterations; iter++) {
    grid.build(circles);
    let totalDisplacement = 0;
    for (let i = 0; i < circles.length; i++) {
      const a = circles[i];
      let fx = 0;
      let fy = 0;
      const nearby = grid.getNearby(a.x, a.y);
      for (let k = 0; k < nearby.length; k++) {
        const j = nearby[k];
        if (i === j) continue;
        const b = circles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const overlap = a.r + b.r - dist;
        const attractRange = Math.max(2, (a.r + b.r) * 0.4);
        if (overlap > -attractRange) {
          const f = overlap / dist;
          const strength = overlap > 0 ? 1 : 0.1;
          fx += (dx / dist) * f * strength;
          fy += (dy / dist) * f * strength;
        }
      }
      const damp = 0.5;
      const newX = Math.max(a.r, Math.min(width - a.r - 1, a.x + fx * damp));
      const newY = Math.max(a.r, Math.min(height - a.r - 1, a.y + fy * damp));
      totalDisplacement += Math.abs(newX - a.x) + Math.abs(newY - a.y);
      a.x = newX;
      a.y = newY;
    }
    if (totalDisplacement < 0.1) break;
  }

  return { circles };
}

// ---------------------------------------------------------------------------
// Neighbor detection
// ---------------------------------------------------------------------------

/**
 * Build neighbor list for each circle: i and j are neighbors if circles touch (within epsilon).
 *
 * @param {Array<{ id: number, x: number, y: number, r: number }>} circles
 * @returns {Map<number, number[]>} node id -> array of neighbor ids
 */
export function computeNeighbors(circles) {
  let maxR = 0;
  for (let i = 0; i < circles.length; i++) {
    if (circles[i].r > maxR) maxR = circles[i].r;
  }
  // Max neighbor distance: (a.r + b.r) * 1.05 + 2
  const cellSize = Math.max(1, 2 * maxR * 1.1 + 4);

  let maxX = 0, maxY = 0;
  for (let i = 0; i < circles.length; i++) {
    if (circles[i].x > maxX) maxX = circles[i].x;
    if (circles[i].y > maxY) maxY = circles[i].y;
  }

  const grid = new SpatialGrid(maxX + maxR + 1, maxY + maxR + 1, cellSize);
  grid.build(circles);

  const neighborMap = new Map();
  for (let i = 0; i < circles.length; i++) {
    neighborMap.set(circles[i].id, []);
  }
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i];
    const list = neighborMap.get(a.id);
    const nearby = grid.getNearby(a.x, a.y);
    for (let k = 0; k < nearby.length; k++) {
      const j = nearby[k];
      if (j <= i) continue;
      const b = circles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= a.r + b.r + Math.max(2, (a.r + b.r) * 0.05)) {
        list.push(b.id);
        neighborMap.get(b.id).push(a.id);
      }
    }
  }
  return neighborMap;
}

// ---------------------------------------------------------------------------
// Connectivity repair
// ---------------------------------------------------------------------------

/**
 * Ensure all circles form a single connected component.
 * Mutates circle positions in place. Deterministic.
 *
 * @param {Array<{ id: number, x: number, y: number, r: number }>} circles
 * @param {number} width - Bounds width
 * @param {number} height - Bounds height
 */
export function ensureConnected(circles, width, height) {
  const MAX_ROUNDS = 20;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const neighbors = computeNeighbors(circles);
    const components = findComponents(circles, neighbors);
    if (components.length <= 1) return;

    components.sort((a, b) => b.length - a.length);
    const mainSet = new Set(components[0]);
    const byId = new Map(circles.map(c => [c.id, c]));

    for (let ci = 1; ci < components.length; ci++) {
      const orphanIds = components[ci];
      let bestDist = Infinity;
      let bestOrphan = null;
      let bestMain = null;

      for (const oid of orphanIds) {
        const o = byId.get(oid);
        for (const mid of mainSet) {
          const m = byId.get(mid);
          const dx = o.x - m.x;
          const dy = o.y - m.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestDist) {
            bestDist = d;
            bestOrphan = o;
            bestMain = m;
          }
        }
      }

      if (bestOrphan && bestMain) {
        const dx = bestOrphan.x - bestMain.x;
        const dy = bestOrphan.y - bestMain.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const touchDist = bestMain.r + bestOrphan.r;
        bestOrphan.x = bestMain.x + (dx / dist) * touchDist;
        bestOrphan.y = bestMain.y + (dy / dist) * touchDist;
        bestOrphan.x = Math.max(bestOrphan.r, Math.min(width - bestOrphan.r - 1, bestOrphan.x));
        bestOrphan.y = Math.max(bestOrphan.r, Math.min(height - bestOrphan.r - 1, bestOrphan.y));
        for (const oid of orphanIds) mainSet.add(oid);
      }
    }

    relaxCircles(circles, width, height, 50);
  }
}

/**
 * Find connected components via BFS on neighbor map.
 * @returns {Array<number[]>} Each element is an array of circle ids in one component.
 */
function findComponents(circles, neighbors) {
  const visited = new Set();
  const components = [];
  for (const c of circles) {
    if (visited.has(c.id)) continue;
    const component = [];
    const queue = [c.id];
    visited.add(c.id);
    while (queue.length > 0) {
      const cur = queue.shift();
      component.push(cur);
      for (const nid of (neighbors.get(cur) || [])) {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push(nid);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Brief relaxation pass (repulsion only) using spatial grid.
 */
function relaxCircles(circles, width, height, iterations) {
  let maxR = 0;
  for (let i = 0; i < circles.length; i++) {
    if (circles[i].r > maxR) maxR = circles[i].r;
  }
  const cellSize = Math.max(1, 2 * maxR + 2);
  const grid = new SpatialGrid(width, height, cellSize);

  for (let iter = 0; iter < iterations; iter++) {
    grid.build(circles);
    let moved = false;
    for (let i = 0; i < circles.length; i++) {
      const a = circles[i];
      let fx = 0;
      let fy = 0;
      const nearby = grid.getNearby(a.x, a.y);
      for (let k = 0; k < nearby.length; k++) {
        const j = nearby[k];
        if (i === j) continue;
        const b = circles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const overlap = a.r + b.r - dist;
        if (overlap > 0) {
          fx += (dx / dist) * (overlap / dist);
          fy += (dy / dist) * (overlap / dist);
          moved = true;
        }
      }
      const damp = 0.5;
      a.x = Math.max(a.r, Math.min(width - a.r - 1, a.x + fx * damp));
      a.y = Math.max(a.r, Math.min(height - a.r - 1, a.y + fy * damp));
    }
    if (!moved) break;
  }
}
