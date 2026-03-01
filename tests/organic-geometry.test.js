import { describe, it, expect } from 'vitest';
import { miterTrim, miterRadius, computeNodeTrims, catmullRomToBezier } from '../src/pdf/drawers/organic-geometry.js';

const PI = Math.PI;
const HALF_W = 10;

describe('miterTrim', () => {
  it('returns halfW for a 90-degree gap', () => {
    expect(miterTrim(PI / 2, HALF_W)).toBeCloseTo(HALF_W, 5);
  });

  it('returns halfW * sqrt(3) for a 60-degree gap', () => {
    expect(miterTrim(PI / 3, HALF_W)).toBeCloseTo(HALF_W * Math.sqrt(3), 5);
  });

  it('returns halfW / sqrt(3) for a 120-degree gap', () => {
    expect(miterTrim(2 * PI / 3, HALF_W)).toBeCloseTo(HALF_W / Math.sqrt(3), 5);
  });

  it('returns 0 for a 180-degree gap (straight-through)', () => {
    expect(miterTrim(PI, HALF_W)).toBe(0);
  });

  it('returns 0 for gaps larger than 180 degrees', () => {
    expect(miterTrim(3 * PI / 2, HALF_W)).toBe(0);
    expect(miterTrim(2 * PI, HALF_W)).toBe(0);
  });

  it('handles very small gap angles without blowing up', () => {
    const result = miterTrim(0.001, HALF_W);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });
});

describe('miterRadius', () => {
  it('returns halfW * sqrt(2) for a 90-degree gap', () => {
    expect(miterRadius(PI / 2, HALF_W)).toBeCloseTo(HALF_W * Math.SQRT2, 5);
  });

  it('returns 2 * halfW for a 60-degree gap', () => {
    expect(miterRadius(PI / 3, HALF_W)).toBeCloseTo(2 * HALF_W, 5);
  });

  it('returns halfW / sin(60) for a 120-degree gap', () => {
    expect(miterRadius(2 * PI / 3, HALF_W)).toBeCloseTo(HALF_W / Math.sin(PI / 3), 5);
  });

  it('returns halfW for a 180-degree gap', () => {
    expect(miterRadius(PI, HALF_W)).toBeCloseTo(HALF_W, 5);
  });

  it('handles very small gap angles without blowing up', () => {
    const result = miterRadius(0.001, HALF_W);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(HALF_W);
  });
});

describe('computeNodeTrims', () => {
  it('returns empty map for zero passages', () => {
    const result = computeNodeTrims([], HALF_W);
    expect(result.size).toBe(0);
  });

  it('returns zero trims for a single passage (dead end)', () => {
    const passages = [{ nid: 1, angle: 0 }];
    const result = computeNodeTrims(passages, HALF_W);
    expect(result.size).toBe(1);
    const t = result.get(1);
    expect(t.leftTrim).toBe(0);
    expect(t.rightTrim).toBe(0);
  });

  it('returns symmetric trims for two passages 180 degrees apart', () => {
    const passages = [
      { nid: 1, angle: 0 },
      { nid: 2, angle: PI },
    ];
    const result = computeNodeTrims(passages, HALF_W);
    expect(result.size).toBe(2);
    const t1 = result.get(1);
    const t2 = result.get(2);
    expect(t1.leftTrim).toBe(0);
    expect(t1.rightTrim).toBe(0);
    expect(t2.leftTrim).toBe(0);
    expect(t2.rightTrim).toBe(0);
  });

  it('returns correct trims for two passages at 45 degrees', () => {
    const passages = [
      { nid: 1, angle: 0 },
      { nid: 2, angle: PI / 4 },
    ];
    const result = computeNodeTrims(passages, HALF_W);
    const narrowGap = PI / 4;
    const wideGap = 2 * PI - PI / 4;
    const narrowTrim = miterTrim(narrowGap, HALF_W);
    const wideTrim = miterTrim(wideGap, HALF_W);
    const t1 = result.get(1);
    expect(t1.leftTrim).toBeCloseTo(narrowTrim, 5);
    expect(t1.rightTrim).toBeCloseTo(wideTrim, 5);
    const t2 = result.get(2);
    expect(t2.leftTrim).toBeCloseTo(wideTrim, 5);
    expect(t2.rightTrim).toBeCloseTo(narrowTrim, 5);
  });

  it('returns equal trims for three passages at 120-degree intervals', () => {
    const passages = [
      { nid: 1, angle: 0 },
      { nid: 2, angle: 2 * PI / 3 },
      { nid: 3, angle: 4 * PI / 3 },
    ];
    const result = computeNodeTrims(passages, HALF_W);
    const expectedTrim = miterTrim(2 * PI / 3, HALF_W);
    for (const nid of [1, 2, 3]) {
      const t = result.get(nid);
      expect(t.leftTrim).toBeCloseTo(expectedTrim, 5);
      expect(t.rightTrim).toBeCloseTo(expectedTrim, 5);
    }
  });

  it('handles virtual boundary passages (negative nids)', () => {
    const passages = [
      { nid: -1, angle: PI / 2 },
      { nid: 5, angle: -PI / 4 },
      { nid: 8, angle: PI },
    ];
    const result = computeNodeTrims(passages, HALF_W);
    expect(result.size).toBe(3);
    expect(result.has(-1)).toBe(true);
    expect(result.has(5)).toBe(true);
    expect(result.has(8)).toBe(true);
  });
});

describe('catmullRomToBezier', () => {
  it('returns collinear control points for collinear input', () => {
    const r = catmullRomToBezier(0, 0, 10, 0, 20, 0, 30, 0);
    expect(r.cp1x).toBeCloseTo(10 + 20 / 6, 5);
    expect(r.cp1y).toBeCloseTo(0, 5);
    expect(r.cp2x).toBeCloseTo(20 - 20 / 6, 5);
    expect(r.cp2y).toBeCloseTo(0, 5);
  });

  it('produces symmetric control points for symmetric input', () => {
    const r = catmullRomToBezier(0, 0, 10, 10, 20, 10, 30, 0);
    expect(r.cp1x).toBeCloseTo(10 + 20 / 6, 5);
    expect(r.cp1y).toBeCloseTo(10 + 10 / 6, 5);
    expect(r.cp2x).toBeCloseTo(20 - 20 / 6, 5);
    expect(r.cp2y).toBeCloseTo(10 + 10 / 6, 5);
  });

  it('cp1 lies between P1 and P2 for a forward-moving curve', () => {
    const r = catmullRomToBezier(0, 0, 5, 5, 15, 5, 20, 0);
    expect(r.cp1x).toBeGreaterThan(5);
    expect(r.cp1x).toBeLessThan(15);
  });

  it('all values are finite', () => {
    const r = catmullRomToBezier(100, 200, 110, 210, 120, 200, 130, 190);
    expect(Number.isFinite(r.cp1x)).toBe(true);
    expect(Number.isFinite(r.cp1y)).toBe(true);
    expect(Number.isFinite(r.cp2x)).toBe(true);
    expect(Number.isFinite(r.cp2y)).toBe(true);
  });
});
