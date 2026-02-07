/**
 * Difficulty Presets and Constants
 * 
 * Age-based difficulty configuration:
 * - Grid size (fewer cells = easier)
 * - Cell size (larger = easier to trace)
 * - Line thickness (thicker = easier to see)
 */

/**
 * Difficulty presets by age range
 * Ages 6-8 maps to 3-5, ages 14-17 maps to 9-13
 */
export const DIFFICULTY_PRESETS = {
  '3-5': {
    gridWidth: 7,
    gridHeight: 8,
    cellSize: 60,       // points (~10% more cells: 7×8 = 56 vs 6×8 = 48)
    lineThickness: 4,   // points
    label: 'Easy',
  },
  '6-8': {
    // Maps to 3-5 preset
    gridWidth: 10,
    gridHeight: 14,
    cellSize: 30,
    lineThickness: 4,
    label: 'Medium',
  },
  '9-13': {
    gridWidth: 14,
    gridHeight: 20,
    cellSize: 24,       // points
    lineThickness: 2,   // points
    label: 'Hard',
  },
  '14-17': {
    // Maps to 9-13 preset
    gridWidth: 24,
    gridHeight: 30,
    cellSize: 20,
    lineThickness: 2,
    label: 'Difficult',
  },
};

/**
 * Get difficulty preset for age range
 */
export function getDifficultyPreset(ageRange) {
  return DIFFICULTY_PRESETS[ageRange] || DIFFICULTY_PRESETS['9-13'];
}

/**
 * Default quantity
 */
export const DEFAULT_QUANTITY = 5;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;
