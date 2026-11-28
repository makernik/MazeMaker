/**
 * Printable pack for the level and style on screen.
 * With includeCurrent, page 1 is the maze being played.
 * Later pages are the ones a pack of this quantity would have used
 * for those same slots and base seed.
 */

import { generateMazes } from '../maze/generator.js';
import { generateOrganicMaze } from '../maze/organic-generator.js';
import { generatePolarMazes } from '../maze/polarGenerator.js';
import { generateSquaresMaze } from '../maze/rooms-generator.js';
import {
  DEFAULT_QUANTITY,
  MAX_QUANTITY,
  MIN_QUANTITY,
  OLDER_AGE_RANGES_FOR_RANDOMIZER,
  getDifficultyPreset,
} from '../utils/constants.js';

export function isOrganicStyle(style) {
  return style === 'jagged' || style === 'curvy';
}

function clampQuantity(quantity) {
  const n = Math.round(Number(quantity));
  if (!Number.isFinite(n)) return DEFAULT_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, n));
}

function filenameFor(mazeStyle, ageRange, count) {
  if (mazeStyle === 'circular') return `mazes-circular-${ageRange}-${count}pk.pdf`;
  if (mazeStyle === 'squares') return `mazes-squares-${ageRange}-${count}pk.pdf`;
  if (isOrganicStyle(mazeStyle)) return `mazes-${mazeStyle}-${ageRange}-${count}pk.pdf`;
  return `mazes-${ageRange}-${count}pk.pdf`;
}

function generateStylePack({ ageRange, mazeStyle, quantity, baseSeed }) {
  if (mazeStyle === 'circular') {
    const preset = getDifficultyPreset(ageRange);
    const mazes = generatePolarMazes({
      ageRange,
      quantity,
      baseSeed,
      algorithm: preset.algorithm,
      useAlgorithmRandomizerForOlderAges: OLDER_AGE_RANGES_FOR_RANDOMIZER.includes(ageRange),
    });
    return { mazes, baseSeed, ageRange, quantity: mazes.length };
  }
  if (mazeStyle === 'squares') {
    const mazes = [];
    for (let i = 0; i < quantity; i++) {
      mazes.push(generateSquaresMaze({ ageRange, seed: baseSeed + i }));
    }
    return { mazes, baseSeed, ageRange, quantity: mazes.length };
  }
  if (isOrganicStyle(mazeStyle)) {
    const mazes = [];
    for (let i = 0; i < quantity; i++) {
      mazes.push(generateOrganicMaze({ ageRange, seed: baseSeed + i }));
    }
    return { mazes, baseSeed, ageRange, quantity: mazes.length };
  }
  const preset = getDifficultyPreset(ageRange);
  return generateMazes({
    ageRange,
    quantity,
    baseSeed,
    algorithm: preset.algorithm,
    useAlgorithmRandomizerForOlderAges: OLDER_AGE_RANGES_FOR_RANDOMIZER.includes(ageRange),
  });
}

/**
 * @param {object} config
 * @param {string} config.ageRange
 * @param {string} config.mazeStyle
 * @param {number} config.quantity
 * @param {number} config.baseSeed
 * @param {boolean} [config.includeCurrent]
 * @param {object | null} [config.currentMaze]
 */
export function assemblePrintPack(config) {
  const quantity = clampQuantity(config.quantity);
  const built = generateStylePack({
    ageRange: config.ageRange,
    mazeStyle: config.mazeStyle,
    quantity,
    baseSeed: config.baseSeed,
  });
  const include = Boolean(config.includeCurrent && config.currentMaze);
  const mazes = include ? built.mazes.slice() : built.mazes;
  if (include) mazes[0] = config.currentMaze;
  return {
    mazes,
    baseSeed: built.baseSeed,
    ageRange: built.ageRange,
    quantity: mazes.length,
    includedCurrent: include,
    styleForPdf: config.mazeStyle === 'circular' ? 'classic' : config.mazeStyle,
    filename: filenameFor(config.mazeStyle, config.ageRange, mazes.length),
  };
}
