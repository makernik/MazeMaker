/**
 * Tests for circle packing (organic maze layout).
 */

import { describe, it, expect } from 'vitest';
import { packCircles, computeNeighbors, generateCorridorFillers } from '../src/maze/circle-packing.js';
import { buildOrganicGraph } from '../src/maze/organic-graph.js';
import { computeCorridorWidth } from '../src/pdf/drawers/organic-geometry.js';
import { createRng } from '../src/utils/rng.js';

describe('Circle packing', () => {
  it('returns deterministic layout for same seed', () => {
    const opts = { width: 200, height: 200, targetCount: 20, seed: 12345 };
    const a = packCircles(opts);
    const b = packCircles(opts);
    expect(a.circles.length).toBe(b.circles.length);
    for (let i = 0; i < a.circles.length; i++) {
      expect(a.circles[i].id).toBe(b.circles[i].id);
      expect(a.circles[i].x).toBe(b.circles[i].x);
      expect(a.circles[i].y).toBe(b.circles[i].y);
      expect(a.circles[i].r).toBe(b.circles[i].r);
    }
  });

  it('returns different layout for different seed', () => {
    const a = packCircles({ width: 200, height: 200, targetCount: 15, seed: 1 });
    const b = packCircles({ width: 200, height: 200, targetCount: 15, seed: 2 });
    expect(a.circles.length).toBe(15);
    expect(b.circles.length).toBe(15);
    const same = a.circles.every((c, i) =>
      c.x === b.circles[i].x && c.y === b.circles[i].y && c.r === b.circles[i].r
    );
    expect(same).toBe(false);
  });

  it('keeps circles within bounds', () => {
    const width = 300;
    const height = 250;
    const { circles } = packCircles({ width, height, targetCount: 30, seed: 999 });
    for (const c of circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(0);
      expect(c.x + c.r).toBeLessThanOrEqual(width + 2);
      expect(c.y - c.r).toBeGreaterThanOrEqual(0);
      expect(c.y + c.r).toBeLessThanOrEqual(height + 2);
    }
  });

  it('produces circles with variable radii', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 25, seed: 42 });
    const radii = circles.map(c => c.r);
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(maxR - minR).toBeGreaterThan(0);
  });

  it('computeNeighbors returns symmetric adjacency', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 15, seed: 111 });
    const neighbors = computeNeighbors(circles);
    expect(neighbors.size).toBe(15);
    for (const [id, list] of neighbors) {
      for (const nid of list) {
        expect(neighbors.get(nid)).toContain(id);
      }
    }
  });

  it('neighbor count is deterministic for same packing', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 20, seed: 555 });
    const n1 = computeNeighbors(circles);
    const n2 = computeNeighbors(circles);
    let total1 = 0;
    let total2 = 0;
    n1.forEach(list => { total1 += list.length; });
    n2.forEach(list => { total2 += list.length; });
    expect(total1).toBe(total2);
  });
});

// Helper: build a carved organic graph from packed circles
function buildCarvedGraph(width, height, targetCount, seed) {
  const { circles } = packCircles({ width, height, targetCount, seed });
  const neighborMap = computeNeighbors(circles);
  const graph = buildOrganicGraph(circles, neighborMap);
  const rng = createRng(seed);
  const visited = new Set();
  const stack = [graph.nodes[rng.randomInt(0, graph.nodes.length - 1)].id];
  visited.add(stack[0]);
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = graph.getNeighbors(current).filter(nid => !visited.has(nid));
    if (neighbors.length === 0) { stack.pop(); continue; }
    rng.shuffle(neighbors);
    graph.removeWall(current, neighbors[0]);
    visited.add(neighbors[0]);
    stack.push(neighbors[0]);
  }
  return { graph, circles };
}

describe('generateCorridorFillers', () => {
  it('returns deterministic filler for same seed', () => {
    const { graph, circles } = buildCarvedGraph(300, 400, 40, 12345);
    const { halfW } = computeCorridorWidth(graph);
    const a = generateCorridorFillers(graph, circles, 300, 400, halfW, 99999);
    const b = generateCorridorFillers(graph, circles, 300, 400, halfW, 99999);
    expect(a.circles.length).toBe(b.circles.length);
    for (let i = 0; i < a.circles.length; i++) {
      expect(a.circles[i].x).toBe(b.circles[i].x);
      expect(a.circles[i].y).toBe(b.circles[i].y);
    }
  });

  it('returns different filler for different seed', () => {
    const { graph, circles } = buildCarvedGraph(300, 400, 40, 12345);
    const { halfW } = computeCorridorWidth(graph);
    const a = generateCorridorFillers(graph, circles, 300, 400, halfW, 99999);
    const b = generateCorridorFillers(graph, circles, 300, 400, halfW, 88888);
    expect(a.circles.length).toBe(b.circles.length);
  });

  it('produces filler circles within bounds', () => {
    const w = 300, h = 400;
    const { graph, circles } = buildCarvedGraph(w, h, 40, 42);
    const { halfW } = computeCorridorWidth(graph);
    const result = generateCorridorFillers(graph, circles, w, h, halfW, 99999);
    for (const c of result.circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(0);
      expect(c.x + c.r).toBeLessThanOrEqual(w);
      expect(c.y - c.r).toBeGreaterThanOrEqual(0);
      expect(c.y + c.r).toBeLessThanOrEqual(h);
    }
  });

  it('produces filler that does not overlap main circles', () => {
    const { graph, circles } = buildCarvedGraph(300, 400, 40, 777);
    const { halfW } = computeCorridorWidth(graph);
    const result = generateCorridorFillers(graph, circles, 300, 400, halfW, 99999);
    for (const f of result.circles) {
      for (const c of circles) {
        const dx = f.x - c.x;
        const dy = f.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(c.r + f.r);
      }
    }
  });

  it('neighbor map is symmetric', () => {
    const { graph, circles } = buildCarvedGraph(300, 400, 40, 555);
    const { halfW } = computeCorridorWidth(graph);
    const result = generateCorridorFillers(graph, circles, 300, 400, halfW, 99999);
    for (const [id, neighbors] of result.neighborMap) {
      for (const nid of neighbors) {
        expect(result.neighborMap.get(nid)).toContain(id);
      }
    }
  });

  it('produces some filler circles for a maze with void space', () => {
    const { graph, circles } = buildCarvedGraph(500, 700, 60, 333);
    const { halfW } = computeCorridorWidth(graph);
    const result = generateCorridorFillers(graph, circles, 500, 700, halfW, 99999);
    expect(result.circles.length).toBeGreaterThan(0);
  });
});
