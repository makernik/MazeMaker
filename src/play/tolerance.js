/**
 * Play-mode wall forgiveness.
 * A value of 0.30 means the stroke may pass 30% of a corridor width beyond a wall
 * and still count as that corridor. Stored in memory only; nothing is written to disk.
 */

export const PLAY_TOLERANCE_MIN = 0.05;
export const PLAY_TOLERANCE_MAX = 0.6;
export const PLAY_TOLERANCE_STEP = 0.01;

/** How many branch decisions a hint draws, including the correct exit from the last one. */
export const PLAY_HINT_DECISIONS = 2;

/** Still celebration before the next maze. Not an animation. */
export const SOLVE_PAUSE_MS = 1600;

/**
 * Clamp a forgiveness value onto the slider step.
 * @param {number} value
 * @returns {number}
 */
export function clampPlayTolerance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PLAY_TOLERANCE_MIN;
  const steps = Math.round(n / PLAY_TOLERANCE_STEP);
  const stepped = steps * PLAY_TOLERANCE_STEP;
  const clamped = Math.min(PLAY_TOLERANCE_MAX, Math.max(PLAY_TOLERANCE_MIN, stepped));
  return Number(clamped.toFixed(2));
}
