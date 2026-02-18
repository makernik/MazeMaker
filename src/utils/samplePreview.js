/**
 * Sample preview: derive static sample image path from form state.
 * Samples are maze-only app assets in public/samples/; no solver.
 * Filename-safe: 18+ -> 18plus for asset path.
 */

const SAMPLE_EXT = '.png';

/**
 * Filename-safe token for age-range value (e.g. 18+ -> 18plus).
 * @param {string} ageRange - Form value: 3, 4-5, 6-8, 9-11, 12-14, 15-17, 18+
 * @returns {string}
 */
export function sampleTokenForAgeRange(ageRange) {
  if (!ageRange) return '';
  return ageRange.replace('+', 'plus');
}

/**
 * Sample image path (no leading slash) for given level and maze style.
 * Used as img src with base so Vite serves from public/samples/.
 * @param {string} ageRange - Form value
 * @param {string} mazeStyle - Form value: rounded, organic, square
 * @returns {string} Path like "samples/4-5-rounded.png" or "samples/18plus-organic.png"
 */
export function getSampleImagePath(ageRange, mazeStyle) {
  const token = sampleTokenForAgeRange(ageRange);
  if (!token || !mazeStyle) return '';
  return `samples/${token}-${mazeStyle}${SAMPLE_EXT}`;
}
