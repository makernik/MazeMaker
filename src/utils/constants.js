/**
 * Difficulty Presets and Constants
 *
 * Age-based difficulty configuration:
 * - Grid size (fewer cells = easier)
 * - Cell size (larger = easier to trace)
 * - Line thickness (thicker = easier to see)
 * - algorithm: which maze generator to use ('prim' | 'recursive-backtracker' | 'kruskal'; more can be added in generator.js)
 */

/** Supported algorithm ids (generator.js branches on these) */
export const ALGORITHMS = {
  PRIM: 'prim',
  RECURSIVE_BACKTRACKER: 'recursive-backtracker',
  KRUSKAL: 'kruskal',
};

/** Ordered list of all algorithm ids (for randomizer and debug "1 of each") */
export const ALGORITHM_IDS = Object.values(ALGORITHMS);

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
    organicNodeCount: 20,
  },
  '4-5': {
    gridWidth: 7,
    gridHeight: 8,
    cellSize: 60,
    lineThickness: 4,
    label: 'Easy',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
    organicNodeCount: 35,
  },
  '6-8': {
    gridWidth: 10,
    gridHeight: 14,
    cellSize: 30,
    lineThickness: 4,
    label: 'Medium',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
    organicNodeCount: 70,
  },
  '9-11': {
    gridWidth: 12,
    gridHeight: 18,
    cellSize: 24,
    lineThickness: 2,
    label: 'Hard',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 120,
  },
  '12-14': {
    gridWidth: 14,
    gridHeight: 20,
    cellSize: 24,
    lineThickness: 2,
    label: 'Challenging',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 180,
  },
  '15-17': {
    gridWidth: 24,
    gridHeight: 30,
    cellSize: 20,
    lineThickness: 2,
    label: 'Difficult',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 300,
  },
  '18+': {
    gridWidth: 36,
    gridHeight: 42,
    cellSize: 12,
    lineThickness: 1,
    label: 'Epic Adventure',
    algorithm: ALGORITHMS.PRIM,
    organicNodeCount: 500,
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
