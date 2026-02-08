/**
 * Maze Generator - Prim's and Recursive Backtracker (DFS)
 *
 * Generates perfect mazes (single solution, no loops).
 * - Prim's: short branching dead-ends, forgiving for younger children.
 * - Recursive Backtracker: long winding passages, more challenging.
 *
 * Prim's algorithm:
 * 1. Start with a grid full of walls
 * 2. Pick a random starting cell, mark it as part of the maze
 * 3. Add all walls of that cell to a wall list
 * 4. While there are walls in the list:
 *    a. Pick a random wall from the list
 *    b. If only one of the cells that the wall divides is visited:
 *       - Make the wall a passage
 *       - Mark the unvisited cell as part of the maze
 *       - Add the walls of the new cell to the wall list
 *    c. Remove the wall from the list
 *
 * Recursive Backtracker (iterative DFS):
 * 1. Start at a random cell, push onto stack
 * 2. While stack not empty: get unvisited neighbors, shuffle, pick one,
 *    remove wall, mark visited, push neighbor; if none, pop and backtrack
 *
 * Kruskal's (spanning tree):
 * 1. List all edges (walls between adjacent cells), shuffle
 * 2. Union-Find: for each edge, if the two cells are in different sets,
 *    remove the wall and union the sets. Yields a different "twisty" character.
 */

import { MazeGrid, DIRECTIONS, DIRECTION_OFFSETS, OPPOSITE } from './grid.js';
import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset, ALGORITHM_IDS, OLDER_AGE_RANGES_FOR_RANDOMIZER } from '../utils/constants.js';

/**
 * Wall entry for Prim's algorithm
 * Represents a wall between two cells
 */
class WallEntry {
  constructor(cell, direction) {
    this.cell = cell;
    this.direction = direction;
  }
}

/**
 * Generate a maze using the selected algorithm
 *
 * @param {object} config - Generation configuration
 * @param {string} config.ageRange - Age range ('3', '4-5', '6-8', '9-11', '12-14', '15-17', '18+')
 * @param {number} [config.seed] - Optional seed for deterministic generation
 * @param {string} [config.algorithm] - 'prim' | 'recursive-backtracker' | 'kruskal' (default 'prim')
 * @returns {object} Generated maze with grid and metadata
 */
export function generateMaze(config) {
  const { ageRange, seed = generateSeed(), algorithm = 'prim' } = config;

  // Get difficulty preset for age range
  const preset = getDifficultyPreset(ageRange);
  const { gridWidth, gridHeight } = preset;

  // Create RNG with seed
  const rng = createRng(seed);

  // Create empty grid
  const grid = new MazeGrid(gridHeight, gridWidth);

  if (algorithm === 'recursive-backtracker') {
    recursiveBacktrackerGenerate(grid, rng);
  } else if (algorithm === 'kruskal') {
    kruskalGenerate(grid, rng);
  } else {
    primGenerate(grid, rng);
  }

  // Open entrance and exit
  grid.openEntrance();
  grid.openExit();

  return {
    grid,
    seed,
    ageRange,
    preset,
    algorithm, // algorithm actually used (for debug footer; may differ from preset.algorithm in "1 of each" or randomizer)
    rows: gridHeight,
    cols: gridWidth,
  };
}

/**
 * Prim's maze generation algorithm
 * 
 * @param {MazeGrid} grid - The maze grid to populate
 * @param {object} rng - Seeded random number generator
 */
function primGenerate(grid, rng) {
  const walls = [];
  
  // Start from a random cell
  const startRow = rng.randomInt(0, grid.rows - 1);
  const startCol = rng.randomInt(0, grid.cols - 1);
  const startCell = grid.getCell(startRow, startCol);
  
  // Mark starting cell as visited and add its walls
  startCell.markVisited();
  addWallsToList(grid, startCell, walls);
  
  // Process walls until none remain
  while (walls.length > 0) {
    // Pick a random wall
    const wallIndex = rng.randomInt(0, walls.length - 1);
    const wall = walls[wallIndex];
    
    // Get the cell on the other side of this wall
    const [dRow, dCol] = DIRECTION_OFFSETS[wall.direction];
    const neighborRow = wall.cell.row + dRow;
    const neighborCol = wall.cell.col + dCol;
    const neighbor = grid.getCell(neighborRow, neighborCol);
    
    // If the neighbor exists and hasn't been visited
    if (neighbor && !neighbor.isVisited()) {
      // Remove the wall between the cells
      grid.removeWallBetween(wall.cell, neighbor);
      
      // Mark the neighbor as visited
      neighbor.markVisited();
      
      // Add the neighbor's walls to the list
      addWallsToList(grid, neighbor, walls);
    }
    
    // Remove this wall from the list (swap with last and pop for O(1))
    walls[wallIndex] = walls[walls.length - 1];
    walls.pop();
  }
}

/**
 * Recursive Backtracker (iterative DFS) maze generation
 *
 * @param {MazeGrid} grid - The maze grid to populate
 * @param {object} rng - Seeded random number generator
 */
function recursiveBacktrackerGenerate(grid, rng) {
  const stack = [];
  const startRow = rng.randomInt(0, grid.rows - 1);
  const startCol = rng.randomInt(0, grid.cols - 1);
  const startCell = grid.getCell(startRow, startCol);
  startCell.markVisited();
  stack.push({ row: startRow, col: startCol });

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const currentCell = grid.getCell(current.row, current.col);
    const neighbors = grid.getUnvisitedNeighbors(current.row, current.col);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    rng.shuffle(neighbors);
    const { cell: nextCell } = neighbors[0];
    grid.removeWallBetween(currentCell, nextCell);
    nextCell.markVisited();
    stack.push({ row: nextCell.row, col: nextCell.col });
  }
}

/**
 * Union-Find (disjoint set) for Kruskal's. Path compression only.
 */
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

/**
 * Kruskal's algorithm: shuffle all edges, then add each if it connects two disjoint sets.
 * Produces a different "twisty" character than Prim or Recursive Backtracker.
 *
 * @param {MazeGrid} grid - The maze grid to populate
 * @param {object} rng - Seeded random number generator
 */
function kruskalGenerate(grid, rng) {
  const { rows, cols } = grid;
  const edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) edges.push({ row: r, col: c, direction: DIRECTIONS.RIGHT });
      if (r < rows - 1) edges.push({ row: r, col: c, direction: DIRECTIONS.BOTTOM });
    }
  }
  rng.shuffle(edges);
  const n = rows * cols;
  const uf = makeUnionFind(n);
  const id = (r, c) => r * cols + c;

  for (const { row, col, direction } of edges) {
    const [dr, dc] = DIRECTION_OFFSETS[direction];
    const nr = row + dr;
    const nc = col + dc;
    const id1 = id(row, col);
    const id2 = id(nr, nc);
    if (uf.find(id1) !== uf.find(id2)) {
      const cell = grid.getCell(row, col);
      const neighbor = grid.getCell(nr, nc);
      grid.removeWallBetween(cell, neighbor);
      uf.union(id1, id2);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid.getCell(r, c).markVisited();
    }
  }
}

/**
 * Add all walls of a cell to the wall list
 * Only adds walls that lead to valid, unvisited cells
 * 
 * @param {MazeGrid} grid - The maze grid
 * @param {Cell} cell - The cell whose walls to add
 * @param {WallEntry[]} walls - The wall list to add to
 */
function addWallsToList(grid, cell, walls) {
  for (const direction of Object.values(DIRECTIONS)) {
    const [dRow, dCol] = DIRECTION_OFFSETS[direction];
    const neighborRow = cell.row + dRow;
    const neighborCol = cell.col + dCol;
    const neighbor = grid.getCell(neighborRow, neighborCol);
    
    // Only add walls that lead to valid, unvisited cells
    if (neighbor && !neighbor.isVisited()) {
      walls.push(new WallEntry(cell, direction));
    }
  }
}

/**
 * Generate multiple mazes
 *
 * @param {object} config - Generation configuration
 * @param {string} config.ageRange - Age range
 * @param {number} config.quantity - Number of mazes to generate
 * @param {number} [config.baseSeed] - Optional base seed (each maze gets baseSeed + index)
 * @param {string} [config.algorithm] - 'prim' | 'recursive-backtracker' | 'kruskal' (default 'prim'); used for first maze and when randomizer off
 * @param {boolean} [config.useAlgorithmRandomizerForOlderAges] - If true and ageRange is in OLDER_AGE_RANGES_FOR_RANDOMIZER, maze index > 0 uses deterministic random choice from ALGORITHM_IDS
 * @returns {object} Object with mazes array and metadata
 */
export function generateMazes(config) {
  const {
    ageRange,
    quantity,
    baseSeed = generateSeed(),
    algorithm = 'prim',
    useAlgorithmRandomizerForOlderAges = false,
  } = config;

  const preset = getDifficultyPreset(ageRange);
  const useRandomizer =
    useAlgorithmRandomizerForOlderAges &&
    quantity > 1 &&
    OLDER_AGE_RANGES_FOR_RANDOMIZER.includes(ageRange);

  const mazes = [];

  for (let i = 0; i < quantity; i++) {
    let algo = preset.algorithm ?? algorithm;
    if (useRandomizer && i > 0) {
      const rng = createRng(baseSeed + i);
      const idx = rng.randomInt(0, ALGORITHM_IDS.length - 1);
      algo = ALGORITHM_IDS[idx];
    }
    const maze = generateMaze({
      ageRange,
      seed: baseSeed + i,
      algorithm: algo,
    });
    mazes.push(maze);
  }

  return {
    mazes,
    baseSeed,
    ageRange,
    quantity,
  };
}
