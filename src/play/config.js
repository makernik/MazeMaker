/**
 * When the on-screen maze is rolled again.
 * Start over is not a reason here: it clears the stroke and keeps the seed.
 */

/**
 * @param {string} ageRange
 * @param {string} mazeStyle
 * @returns {string}
 */
export function playConfigKey(ageRange, mazeStyle) {
  return `${ageRange}|${mazeStyle}`;
}

/**
 * @param {object} request
 * @param {string} request.previousKey
 * @param {string} request.ageRange
 * @param {string} request.mazeStyle
 * @param {string} request.reason - 'level' | 'style' | 'new' | 'solved' | 'open'
 * @param {number} request.currentSeed
 * @param {() => number} request.rollSeed
 * @returns {{ key: string, regenerate: boolean, seed: number }}
 */
export function playSessionPlan(request) {
  const key = playConfigKey(request.ageRange, request.mazeStyle);
  const regenerate =
    request.reason === 'new' ||
    request.reason === 'solved' ||
    request.previousKey !== key;
  return {
    key,
    regenerate,
    seed: regenerate ? request.rollSeed() : request.currentSeed,
  };
}
