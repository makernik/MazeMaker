/**
 * Circular radial boundaries: even rings by default, taper on the higher levels.
 */

import { describe, it, expect } from 'vitest';
import { polarBoundaryFractions } from '../src/maze/polarRadii.js';
import { getDifficultyPreset } from '../src/utils/constants.js';
import { getLayoutForMaze } from '../src/pdf/layout.js';
import { generatePolarMaze } from '../src/maze/polarGenerator.js';

function mazeRingWidths(fractions) {
  const widths = [];
  for (let i = 2; i < fractions.length; i++) widths.push(fractions[i] - fractions[i - 1]);
  return widths;
}

describe('polarBoundaryFractions', () => {
  it('keeps historical even rings when ratio is 1', () => {
    const n = 6;
    const fractions = polarBoundaryFractions(n, 1, 1.8);
    expect(fractions[0]).toBe(0);
    expect(fractions[1]).toBeCloseTo(1 / n, 12);
    expect(fractions[fractions.length - 1]).toBe(1);
    const widths = mazeRingWidths(fractions);
    for (const width of widths) expect(width).toBeCloseTo(widths[0], 12);
  });

  it('makes each outer ring narrower than the ring inside it', () => {
    const fractions = polarBoundaryFractions(17, 0.94, 1.8);
    const widths = mazeRingWidths(fractions);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
    expect(fractions[1]).toBeGreaterThan(widths[0]);
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});

describe('circular level spacing', () => {
  const evenLevels = ['3', '4-5', '6-8'];
  const taperedLevels = ['9-11', '12-14', '15-17', '18+'];

  it('leaves Intro through Medium on even rings', () => {
    for (const age of evenLevels) {
      const preset = getDifficultyPreset(age);
      expect(preset.polarRingRatio).toBeUndefined();
      const maze = generatePolarMaze({ ageRange: age, seed: 3 });
      const layout = getLayoutForMaze(maze);
      const widths = mazeRingWidths(layout.ringRadii.map((r) => r / layout.maxRadius));
      for (const width of widths) expect(width).toBeCloseTo(widths[0], 8);
      expect(layout.roomRadius).toBeCloseTo(layout.maxRadius / maze.polarGrid.maxRing, 8);
    }
  });

  it('tapers Hard through Epic, with Epic the finest at the rim', () => {
    const outerFraction = {};
    for (const age of taperedLevels) {
      const maze = generatePolarMaze({ ageRange: age, seed: 3 });
      const layout = getLayoutForMaze(maze);
      const fractions = layout.ringRadii.map((r) => r / layout.maxRadius);
      const widths = mazeRingWidths(fractions);
      for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
      expect(fractions[1]).toBeGreaterThan(widths[0]);
      expect(layout.ringRadii[layout.ringRadii.length - 1]).toBeCloseTo(layout.maxRadius, 8);
      const even = (1 - 1 / maze.polarGrid.maxRing) / maze.polarGrid.maxRing;
      outerFraction[age] = widths[widths.length - 1] / even;
    }
    expect(outerFraction['18+']).toBeLessThan(outerFraction['15-17']);
    expect(outerFraction['15-17']).toBeLessThan(outerFraction['12-14']);
    expect(outerFraction['12-14']).toBeLessThan(outerFraction['9-11']);
    expect(outerFraction['9-11']).toBeLessThan(1);
  });
});
