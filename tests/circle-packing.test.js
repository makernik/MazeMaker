/**
 * Tests for circle packing (organic maze layout).
 */

import { describe, it, expect } from 'vitest';
import { packCircles, computeNeighbors } from '../src/maze/circle-packing.js';

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
