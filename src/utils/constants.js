/**
 * Difficulty Presets and Constants
 *
 * Age-based difficulty configuration:
 * - Grid size (fewer cells = easier)
 * - Cell size (larger = easier to trace)
 * - Line thickness (thicker = easier to see)
 * - algorithm: which maze generator to use ('prim' | 'recursive-backtracker'; more can be added in generator.js)
 */

/** Supported algorithm ids (generator.js branches on these) */
export const ALGORITHMS = {
  PRIM: 'prim',
  RECURSIVE_BACKTRACKER: 'recursive-backtracker',
};

/**
 * Difficulty presets by age range.
 * Each preset includes algorithm; add new algorithms in generator.js and reference here.
 */
export const DIFFICULTY_PRESETS = {
  '3-5': {
    gridWidth: 7,
    gridHeight: 8,
    cellSize: 60,       // points (~10% more cells: 7×8 = 56 vs 6×8 = 48)
    lineThickness: 4,   // points
    label: 'Easy',
    algorithm: ALGORITHMS.PRIM,
  },
  '6-8': {
    gridWidth: 10,
    gridHeight: 14,
    cellSize: 30,
    lineThickness: 4,
    label: 'Medium',
    algorithm: ALGORITHMS.PRIM,
  },
  '9-13': {
    gridWidth: 14,
    gridHeight: 20,
    cellSize: 24,       // points
    lineThickness: 2,   // points
    label: 'Hard',
    algorithm: ALGORITHMS.PRIM,
  },
  '14-17': {
    gridWidth: 24,
    gridHeight: 30,
    cellSize: 20,
    lineThickness: 2,
    label: 'Difficult',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
  },
  '18+': {
    gridWidth: 36,
    gridHeight: 42,
    cellSize: 12,       // points
    lineThickness: 1, // points
    label: 'Extreme',
    algorithm: ALGORITHMS.RECURSIVE_BACKTRACKER,
  },
};

/**
 * Get difficulty preset for age range (includes algorithm).
 * Caller may use preset.algorithm for generation; defaults to 'prim' if missing.
 */
export function getDifficultyPreset(ageRange) {
  const preset = DIFFICULTY_PRESETS[ageRange] || DIFFICULTY_PRESETS['9-13'];
  return { ...preset, algorithm: preset.algorithm ?? ALGORITHMS.PRIM };
}

/**
 * Default quantity
 */
export const DEFAULT_QUANTITY = 5;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;
