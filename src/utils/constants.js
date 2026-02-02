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
    gridWidth: 6,
    gridHeight: 8,
    cellSize: 60,       // points
    lineThickness: 4,   // points
    label: 'Easy',
  },
  '6-8': {
    // Maps to 3-5 preset
    gridWidth: 6,
    gridHeight: 8,
    cellSize: 60,
    lineThickness: 4,
    label: 'Easy',
  },
  '9-13': {
    gridWidth: 12,
    gridHeight: 16,
    cellSize: 30,       // points
    lineThickness: 2,   // points
    label: 'Medium',
  },
  '14-17': {
    // Maps to 9-13 preset
    gridWidth: 12,
    gridHeight: 16,
    cellSize: 30,
    lineThickness: 2,
    label: 'Medium',
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
