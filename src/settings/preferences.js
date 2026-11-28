/**
 * Last chosen level and style. Seeds, strokes, and mazes are not stored.
 * See D-028.
 */

export const PLAY_PREFERENCE_KEY = 'mazemaker.play';

export const DEFAULT_PLAY_PREFERENCES = {
  ageRange: '4-5',
  mazeStyle: 'classic',
};

const AGE_RANGES = new Set(['3', '4-5', '6-8', '9-11', '12-14', '15-17', '18+']);
const MAZE_STYLES = new Set(['classic', 'jagged', 'curvy', 'circular', 'squares']);

/**
 * @param {object} [value]
 * @returns {{ ageRange: string, mazeStyle: string }}
 */
export function normalizePlayPreferences(value) {
  const ageRange = AGE_RANGES.has(value?.ageRange)
    ? value.ageRange
    : DEFAULT_PLAY_PREFERENCES.ageRange;
  const mazeStyle = MAZE_STYLES.has(value?.mazeStyle)
    ? value.mazeStyle
    : DEFAULT_PLAY_PREFERENCES.mazeStyle;
  return { ageRange, mazeStyle };
}

/**
 * @param {{ getItem: (key: string) => string | null } | null | undefined} storage
 * @returns {{ ageRange: string, mazeStyle: string }}
 */
export function loadPlayPreferences(storage) {
  if (!storage) return { ...DEFAULT_PLAY_PREFERENCES };
  try {
    const raw = storage.getItem(PLAY_PREFERENCE_KEY);
    if (!raw) return { ...DEFAULT_PLAY_PREFERENCES };
    return normalizePlayPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAY_PREFERENCES };
  }
}

/**
 * @param {{ setItem: (key: string, value: string) => void } | null | undefined} storage
 * @param {object} prefs
 */
export function savePlayPreferences(storage, prefs) {
  if (!storage) return;
  const safe = normalizePlayPreferences(prefs);
  storage.setItem(PLAY_PREFERENCE_KEY, JSON.stringify(safe));
}
