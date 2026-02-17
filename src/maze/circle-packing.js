/**
 * Circle packing for organic maze layout.
 * Deterministic particle-style packing: variable radii (breaks hex pattern), repel overlaps.
 * Same seed → same layout.
 */

import { createRng } from '../utils/rng.js';

/**
 * Pack circles into a rectangle. Deterministic given seed.
 *
 * @param {object} options
 * @param {number} options.width - Bounds width (points)
 * @param {number} options.height - Bounds height (points)
 * @param {number} options.targetCount - Approximate number of circles (may end up slightly different if packing fails to fit all)
 * @param {number} options.seed - Seed for RNG
 * @param {number} [options.maxIterations=200] - Repulsion iterations
 * @returns {{ circles: Array<{ id: number, x: number, y: number, r: number }> }}
 */
export function packCircles(options) {
  const {
    width,
    height,
    targetCount,
    seed,
    maxIterations = 200,
  } = options;

  const rng = createRng(seed);

  // Base radius so that targetCount circles of roughly that size fit (area heuristic)
  const area = width * height;
  const baseR = Math.sqrt((area * 0.4) / (targetCount * Math.PI));
  const minR = Math.max(4, baseR * 0.5);
  const maxR = Math.max(minR + 2, baseR * 1.4);

  const circles = [];
  const padding = maxR + 2;

  for (let id = 0; id < targetCount; id++) {
    // Variable radius: mix of index and random to avoid regular hex
    const t = id / Math.max(1, targetCount - 1);
    const rand = rng.random();
    const r = minR + (maxR - minR) * (0.6 + 0.4 * (t * 0.3 + rand * 0.7));
    const x = padding + rng.randomFloat(0, width - 2 * padding);
    const y = padding + rng.randomFloat(0, height - 2 * padding);
    circles.push({ id, x, y, r: Math.max(minR, r) });
  }

  // Repel overlaps (deterministic: same order every time)
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (let i = 0; i < circles.length; i++) {
      const a = circles[i];
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < circles.length; j++) {
        if (i === j) continue;
        const b = circles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const overlap = a.r + b.r - dist;
        const attractRange = Math.max(2, (a.r + b.r) * 0.15);
        if (overlap > -attractRange) {
          const f = overlap / dist;
          const strength = overlap > 0 ? 1 : 0.1;
          fx += (dx / dist) * f * strength;
          fy += (dy / dist) * f * strength;
          if (overlap > 0) moved = true;
        }
      }
      // Keep in bounds
      const damp = 0.5;
      a.x = Math.max(a.r, Math.min(width - a.r - 1, a.x + fx * damp));
      a.y = Math.max(a.r, Math.min(height - a.r - 1, a.y + fy * damp));
    }
    if (!moved) break;
  }

  return { circles };
}

/**
 * Build neighbor list for each circle: i and j are neighbors if circles touch (within epsilon).
 *
 * @param {Array<{ id: number, x: number, y: number, r: number }>} circles
 * @returns {Map<number, number[]>} node id -> array of neighbor ids
 */
export function computeNeighbors(circles) {
  const neighborMap = new Map();
  for (let i = 0; i < circles.length; i++) {
    neighborMap.set(circles[i].id, []);
  }
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i];
    const list = neighborMap.get(a.id);
    for (let j = i + 1; j < circles.length; j++) {
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
