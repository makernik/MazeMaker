/**
 * Polar maze generator: Prim's, recursive-backtracker, or Kruskal's on PolarGrid.
 * Supports fixed or variable wedges (polarWedgeMultiplier in preset).
 * Deterministic given seed.
 * DFS can use per-ring carve weights: outer rings favor angular (orbit), inner rings favor inward (funnel).
 */

import { PolarGrid, POLAR_DIRECTIONS } from './polarGrid.js';
import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset, POLAR_ALGORITHM_IDS, OLDER_AGE_RANGES_FOR_RANDOMIZER } from '../utils/constants.js';
import { runWilsons } from './wilsons.js';

const CARVE_WEIGHT_K = 1.5;

/**
 * Weight for choosing a carve direction at a given ring (used by DFS).
 * Outer rings get higher angular weight (orbit); inner rings get higher inward weight (funnel).
 * @param {number} ring - Current ring index (0 .. maxRing)
 * @param {number} direction - POLAR_DIRECTIONS value
 * @param {number} maxRing - Maximum ring index
 * @returns {number} Positive weight for weighted random choice
 */
export function getCarveWeight(ring, direction, maxRing) {
  if (maxRing <= 0) return 1;
  const t = ring / maxRing;
  switch (direction) {
    case POLAR_DIRECTIONS.INWARD:
      return 1 + (1 - t) * CARVE_WEIGHT_K;
    case POLAR_DIRECTIONS.OUTWARD:
      return 1;
    case POLAR_DIRECTIONS.CW:
    case POLAR_DIRECTIONS.CCW:
      return 1 + t * CARVE_WEIGHT_K;
    default:
      return 1;
  }
}

/**
 * Direction from cell 'from' to cell 'to' (for polar grid).
 * @param {import('./polarGrid.js').PolarGrid} grid
 * @param {{ ring: number, wedge: number }} from
 * @param {{ ring: number, wedge: number }} to
 * @returns {number} POLAR_DIRECTIONS value
 */
export function directionFromTo(grid, from, to) {
  const { ring: r, wedge: w } = from;
  const { ring: nr, wedge: nw } = to;
  if (nr < r) return POLAR_DIRECTIONS.INWARD;
  if (nr > r) return POLAR_DIRECTIONS.OUTWARD;
  const W = grid.wedgesAtRing(r);
  if ((nw - w + W) % W === 1) return POLAR_DIRECTIONS.CW;
  if ((w - nw + W) % W === 1) return POLAR_DIRECTIONS.CCW;
  return POLAR_DIRECTIONS.INWARD;
}

/**
 * Wilson's adapter for PolarGrid. getAdjacentKeys returns only symmetric neighbors
 * (center (0,0) is only adjacent to (1,0) in the grid's wall structure).
 */
function makePolarWilsonAdapter(grid) {
  return {
    getAllKeys() {
      const out = [];
      for (let r = 0; r < grid.rings; r++) {
        const W = grid.wedgesAtRing(r);
        for (let w = 0; w < W; w++) out.push(`${r},${w}`);
      }
      return out;
    },
    getAdjacentKeys(key) {
      const [r, w] = key.split(',').map(Number);
      const out = [];
      for (const dir of Object.values(POLAR_DIRECTIONS)) {
        const neighbors = grid.getNeighbor(r, w, dir);
        for (const n of neighbors) {
          const nKey = `${n.ring},${n.wedge}`;
          if (out.includes(nKey)) continue;
          let symmetric = false;
          for (const d of Object.values(POLAR_DIRECTIONS)) {
            const back = grid.getNeighbor(n.ring, n.wedge, d);
            if (back.some((b) => b.ring === r && b.wedge === w)) {
              symmetric = true;
              break;
            }
          }
          if (symmetric) out.push(nKey);
        }
      }
      return out;
    },
    removeWallBetween(k1, k2) {
      const [r1, w1] = k1.split(',').map(Number);
      const [r2, w2] = k2.split(',').map(Number);
      grid.removeWallBetween(grid.getCell(r1, w1), grid.getCell(r2, w2));
    },
    markVisited(key) {
      const [r, w] = key.split(',').map(Number);
      grid.getCell(r, w).markVisited();
    },
    isVisited(key) {
      const [r, w] = key.split(',').map(Number);
      return grid.getCell(r, w).isVisited();
    },
  };
}

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

    // Per-ring carve weights: outer rings favor angular (orbit), inner rings favor inward (funnel).
    const weights = neighbors.map((n) =>
      getCarveWeight(current.ring, directionFromTo(grid, current, n), grid.maxRing)
    );
    const next = rng.weightedChoice(neighbors, weights);
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
  let algorithm = configAlgo ?? preset.algorithm ?? 'prim';
  if (algorithm === 'prim') algorithm = 'recursive-backtracker';
  const polarRings = preset.polarRings ?? 5;
  const polarBaseWedges = preset.polarBaseWedges ?? 6;
  const polarWedgeMultiplier = preset.polarWedgeMultiplier ?? 1;

  const grid = new PolarGrid(polarRings, polarBaseWedges, polarWedgeMultiplier);
  const rng = createRng(seed);

  if (algorithm === 'recursive-backtracker') {
    recursiveBacktrackerGeneratePolar(grid, rng);
  } else if (algorithm === 'kruskal') {
    kruskalGeneratePolar(grid, rng);
  } else if (algorithm === 'wilson') {
    runWilsons(makePolarWilsonAdapter(grid), rng);
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
    if (algo === 'prim') algo = 'recursive-backtracker';
    if (useRandomizer && i > 0) {
      const rng = createRng(baseSeed + i);
      const idx = rng.randomInt(0, POLAR_ALGORITHM_IDS.length - 1);
      algo = POLAR_ALGORITHM_IDS[idx];
    }
    mazes.push(generatePolarMaze({ ageRange, seed: baseSeed + i, algorithm: algo }));
  }
  return mazes;
}
