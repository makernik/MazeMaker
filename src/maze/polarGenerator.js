/**
 * Polar maze generator: Prim's on PolarGrid.
 * Supports fixed or variable wedges (polarWedgeMultiplier in preset).
 * Deterministic given seed.
 */

import { PolarGrid, POLAR_DIRECTIONS } from './polarGrid.js';
import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset } from '../utils/constants.js';

function addPolarWallsToList(grid, cell, walls) {
  const { ring, wedge } = cell;
  for (const dir of Object.values(POLAR_DIRECTIONS)) {
    const neighbors = grid.getNeighbor(ring, wedge, dir);
    for (const n of neighbors) {
      const neighbor = grid.getCell(n.ring, n.wedge);
      if (neighbor && !neighbor.isVisited()) {
        walls.push({ cell, neighbor });
      }
    }
  }
}

function primGeneratePolar(grid, rng) {
  const walls = [];
  const startCell = grid.getCell(0, 0);
  startCell.markVisited();
  addPolarWallsToList(grid, startCell, walls);

  while (walls.length > 0) {
    const idx = rng.randomInt(0, walls.length - 1);
    const { cell, neighbor } = walls[idx];

    if (!neighbor.isVisited()) {
      grid.removeWallBetween(cell, neighbor);
      neighbor.markVisited();
      addPolarWallsToList(grid, neighbor, walls);
    }

    walls[idx] = walls[walls.length - 1];
    walls.pop();
  }
}

/**
 * @param {object} config - { ageRange, seed?, quantity?, baseSeed? }
 * @returns {object} Maze with layout: 'polar', polarGrid, seed, ageRange, preset, start, finish
 */
export function generatePolarMaze(config) {
  const { ageRange, seed = generateSeed() } = config;
  const preset = getDifficultyPreset(ageRange);
  const polarRings = preset.polarRings ?? 5;
  const polarBaseWedges = preset.polarBaseWedges ?? 6;
  const polarWedgeMultiplier = preset.polarWedgeMultiplier ?? 1;

  const grid = new PolarGrid(polarRings, polarBaseWedges, polarWedgeMultiplier);
  const rng = createRng(seed);
  primGeneratePolar(grid, rng);

  grid.openEntrance();
  grid.openExit();

  return {
    layout: 'polar',
    polarGrid: grid,
    seed,
    ageRange,
    preset,
    algorithm: 'prim',
    start: { ...grid.start },
    finish: { ...grid.finish },
  };
}

/**
 * @param {object} config - { ageRange, seed?, quantity, baseSeed? }
 * @returns {object[]} Array of polar mazes
 */
export function generatePolarMazes(config) {
  const { ageRange, quantity = 1, baseSeed = generateSeed() } = config;
  const mazes = [];
  for (let i = 0; i < quantity; i++) {
    mazes.push(generatePolarMaze({ ageRange, seed: baseSeed + i }));
  }
  return mazes;
}
