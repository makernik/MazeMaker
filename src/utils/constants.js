/**
 * Difficulty Presets and Constants
 *
 * Age-based difficulty configuration:
 * - Grid size (fewer cells = easier)
 * - Cell size (larger = easier to trace)
 * - Line thickness (thicker = easier to see)
 * - algorithm: which maze generator to use ('prim' | 'recursive-backtracker' | 'kruskal'; more can be added in generator.js)
 * - roomCount, roomSubSize, roomOuterSize: for Squares style (embedded rooms); see rooms-generator.js.
 *
 * Squares style: if preset cellSize < MIN_CELL_SIZE_SQUARES_PT, it is coerced to that minimum and
 * grid dimensions are recomputed so sub-mazes remain legible in print.
 */
export const MIN_CELL_SIZE_SQUARES_PT = 28;

/** Supported algorithm ids (generator.js branches on these) */
export const ALGORITHMS = {
  PRIM: 'prim',
  RECURSIVE_BACKTRACKER: 'recursive-backtracker',
  KRUSKAL: 'kruskal',
  WILSON: 'wilson',
};

/** Ordered list of all algorithm ids (for footer label and any "all algorithms" reference). */
export const ALGORITHM_IDS = Object.values(ALGORITHMS);

/** Algorithm ids for grid randomizer and "1 of each algorithm" (includes Wilson's). */
export const GRID_ALGORITHM_IDS = ['prim', 'recursive-backtracker', 'kruskal', 'wilson'];

/** Algorithm ids for polar randomizer and "1 of each" (Prim excluded; polar coerces prim to recursive-backtracker). */
export const POLAR_ALGORITHM_IDS = ['recursive-backtracker', 'kruskal', 'wilson'];

/** Algorithm ids for organic randomizer and "1 of each" (Wilson's excluded). */
export const ORGANIC_ALGORITHM_IDS = ['recursive-backtracker', 'prim', 'kruskal'];

/** Age ranges that use algorithm randomizer for additional mazes (quantity > 1). First maze always uses preset.algorithm. */
export const OLDER_AGE_RANGES_FOR_RANDOMIZER = ['12-14', '15-17', '18+'];

/**
 * Difficulty presets by age range.
 * Each preset includes algorithm; add new algorithms in generator.js and reference here.
 */
export const DIFFICULTY_PRESETS = {
  '3': {
    gridWidth: 6,
    gridHeight: 7,
    cellSize: 72,
    lineThickness: 4,
    label: 'Intro',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
    organicNodeCount: 30,
    organicFill: 0,
    polarRings: 4,
    polarBaseWedges: 5,
    polarWedgeMultiplier: 2,
    roomCount: 1,
    roomSubSize: 3,
    roomOuterSize: 3,
  },
  '4-5': {
    gridWidth: 7,
    gridHeight: 8,
    cellSize: 60,
    lineThickness: 4,
    label: 'Easy',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
    organicNodeCount: 80,
    organicFill: 0,
    polarRings: 5,
    polarBaseWedges: 6,
    polarWedgeMultiplier: 2,
    roomCount: 2,
    roomSubSize: 3,
    roomOuterSize: 3,
  },
  '6-8': {
    gridWidth: 10,
    gridHeight: 14,
    cellSize: 30,
    lineThickness: 4,
    label: 'Medium',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
    organicNodeCount: 120,
    organicFill: 0,
    polarRings: 6,
    polarBaseWedges: 6,
    polarWedgeMultiplier: 2,
    roomCount: 3,
    roomSubSize: 4,
    roomOuterSize: 3,
  },
  '9-11': {
    gridWidth: 12,
    gridHeight: 18,
    cellSize: 24,
    lineThickness: 2,
    label: 'Hard',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 400,
    organicFill: 1,
    polarRings: 9,
    polarBaseWedges: 6,
    polarWedgeMultiplier: 2,
    roomCount: 4,
    roomSubSize: 5,
    roomOuterSize: 3,
  },
  '12-14': {
    gridWidth: 14,
    gridHeight: 20,
    cellSize: 24,
    lineThickness: 2,
    label: 'Challenging',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 800,
    organicFill: 1,
    polarRings: 12,
    polarBaseWedges: 8,
    polarWedgeMultiplier: 2,
    roomCount: 5,
    roomSubSize: 6,
    roomOuterSize: 5,
  },
  '15-17': {
    gridWidth: 24,
    gridHeight: 30,
    cellSize: 20,
    lineThickness: 2,
    label: 'Difficult',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 1200,
    organicFill: 1,
    polarRings: 14,
    polarBaseWedges: 8,
    polarWedgeMultiplier: 2,
    roomCount: 6,
    roomSubSize: 7,
    roomOuterSize: 6,
  },
  '18+': {
    gridWidth: 36,
    gridHeight: 42,
    cellSize: 12,
    lineThickness: 1,
    label: 'Epic Adventure',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 1900,
    organicFill: 1,
    polarRings: 18,
    polarBaseWedges: 8,
    polarWedgeMultiplier: 5,
    roomCount: 8,
    roomSubSize: 8,
    roomOuterSize: 6,
  },
};

/**
 * Get difficulty preset for age range (includes algorithm).
 * Caller may use preset.algorithm for generation; defaults to 'prim' if missing.
 */
export function getDifficultyPreset(ageRange) {
  const preset = DIFFICULTY_PRESETS[ageRange] || DIFFICULTY_PRESETS['9-11'];
  return { ...preset, algorithm: preset.algorithm ?? ALGORITHMS.PRIM };
}

/**
 * Default quantity
 */
export const DEFAULT_QUANTITY = 5;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;
