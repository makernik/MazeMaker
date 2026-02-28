/**
 * Polar maze generator: Prim's, recursive-backtracker, or Kruskal's on PolarGrid.
 * Supports fixed or variable wedges (polarWedgeMultiplier in preset).
 * Deterministic given seed.
 */

import { PolarGrid, POLAR_DIRECTIONS } from './polarGrid.js';
import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset, ALGORITHM_IDS, OLDER_AGE_RANGES_FOR_RANDOMIZER } from '../utils/constants.js';

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

function recursiveBacktrackerGeneratePolar(grid, rng) {
  const stack = [{ ring: 0, wedge: 0 }];
  const startCell = grid.getCell(0, 0);
  startCell.markVisited();

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const currentCell = grid.getCell(current.ring, current.wedge);
    const neighbors = grid.getUnvisitedNeighbors(current.ring, current.wedge);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    rng.shuffle(neighbors);
    const next = neighbors[0];
    const nextCell = grid.getCell(next.ring, next.wedge);
    grid.removeWallBetween(currentCell, nextCell);
    nextCell.markVisited();
    stack.push(next);
  }
}

function makeUnionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  function find(i) {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i, j) {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }
  return { find, union };
}

function kruskalGeneratePolar(grid, rng) {
  const edges = [];
  for (let ring = 0; ring < grid.rings; ring++) {
    const W = grid.wedgesAtRing(ring);
    for (let wedge = 0; wedge < W; wedge++) {
      const cell = grid.getCell(ring, wedge);
      if (!cell) continue;
      for (const dir of Object.values(POLAR_DIRECTIONS)) {
        const neighbors = grid.getNeighbor(ring, wedge, dir);
        for (const n of neighbors) {
          const id1 = grid.cellToIndex(ring, wedge);
          const id2 = grid.cellToIndex(n.ring, n.wedge);
          if (id1 < id2) edges.push({ ring, wedge, nRing: n.ring, nWedge: n.wedge });
        }
      }
    }
  }
  rng.shuffle(edges);
  const n = grid.getTotalCells();
  const uf = makeUnionFind(n);

  for (const { ring, wedge, nRing, nWedge } of edges) {
    const id1 = grid.cellToIndex(ring, wedge);
    const id2 = grid.cellToIndex(nRing, nWedge);
    if (uf.find(id1) !== uf.find(id2)) {
      const cell = grid.getCell(ring, wedge);
      const neighbor = grid.getCell(nRing, nWedge);
      grid.removeWallBetween(cell, neighbor);
      uf.union(id1, id2);
    }
  }

  for (let ring = 0; ring < grid.rings; ring++) {
    const W = grid.wedgesAtRing(ring);
    for (let wedge = 0; wedge < W; wedge++) {
      const cell = grid.getCell(ring, wedge);
      if (cell) cell.markVisited();
    }
  }
}

/**
 * @param {object} config - { ageRange, seed?, algorithm? }
 * @returns {object} Maze with layout: 'polar', polarGrid, seed, ageRange, preset, start, finish
 */
export function generatePolarMaze(config) {
  const { ageRange, seed = generateSeed(), algorithm: configAlgo } = config;
  const preset = getDifficultyPreset(ageRange);
  const algorithm = configAlgo ?? preset.algorithm ?? 'prim';
  const polarRings = preset.polarRings ?? 5;
  const polarBaseWedges = preset.polarBaseWedges ?? 6;
  const polarWedgeMultiplier = preset.polarWedgeMultiplier ?? 1;

  const grid = new PolarGrid(polarRings, polarBaseWedges, polarWedgeMultiplier);
  const rng = createRng(seed);

  if (algorithm === 'recursive-backtracker') {
    recursiveBacktrackerGeneratePolar(grid, rng);
  } else if (algorithm === 'kruskal') {
    kruskalGeneratePolar(grid, rng);
  } else {
    primGeneratePolar(grid, rng);
  }

  grid.openEntrance();
  grid.openExit();

  return {
    layout: 'polar',
    polarGrid: grid,
    seed,
    ageRange,
    preset,
    algorithm,
    start: { ...grid.start },
    finish: { ...grid.finish },
  };
}

/**
 * @param {object} config - { ageRange, quantity, baseSeed?, algorithm?, useAlgorithmRandomizerForOlderAges? }
 * @returns {object[]} Array of polar mazes
 */
export function generatePolarMazes(config) {
  const {
    ageRange,
    quantity = 1,
    baseSeed = generateSeed(),
    algorithm: configAlgo,
    useAlgorithmRandomizerForOlderAges = false,
  } = config;
  const preset = getDifficultyPreset(ageRange);
  const useRandomizer =
    useAlgorithmRandomizerForOlderAges &&
    quantity > 1 &&
    OLDER_AGE_RANGES_FOR_RANDOMIZER.includes(ageRange);
  const mazes = [];
  for (let i = 0; i < quantity; i++) {
    let algo = preset.algorithm ?? configAlgo ?? 'prim';
    if (useRandomizer && i > 0) {
      const rng = createRng(baseSeed + i);
      const idx = rng.randomInt(0, ALGORITHM_IDS.length - 1);
      algo = ALGORITHM_IDS[idx];
    }
    mazes.push(generatePolarMaze({ ageRange, seed: baseSeed + i, algorithm: algo }));
  }
  return mazes;
}
