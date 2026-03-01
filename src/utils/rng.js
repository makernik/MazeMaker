/**
 * Seeded Pseudo-Random Number Generator
 * 
 * Mulberry32 algorithm - fast, simple, deterministic.
 * Same seed always produces the same sequence.
 */

/**
 * Create a seeded random number generator using Mulberry32
 * @param {number} seed - Integer seed value
 * @returns {object} RNG interface with random(), randomInt(), randomFloat(), shuffle()
 */
export function createRng(seed) {
  // Ensure seed is a 32-bit integer
  let state = seed >>> 0;
  
  /**
   * Mulberry32 core function
   * Returns a float in [0, 1)
   */
  function random() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  
  /**
   * Get a random integer in range [min, max] (inclusive)
   */
  function randomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }
  
  /**
   * Get a random float in range [min, max)
   */
  function randomFloat(min, max) {
    return random() * (max - min) + min;
  }
  
  /**
   * Shuffle an array in place using Fisher-Yates
   */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /**
   * Pick a random element from an array
   */
  function pick(array) {
    return array[randomInt(0, array.length - 1)];
  }

  /**
   * Pick a random element with probability proportional to weights.
   * @param {Array} array - Elements to choose from
   * @param {number[]} weights - Non-negative weights, same length as array
   * @returns {*} The chosen element
   * @throws {Error} If array is empty or all weights are zero
   */
  function weightedChoice(array, weights) {
    if (array.length === 0) throw new Error('weightedChoice: array must not be empty');
    if (weights.length !== array.length) throw new Error('weightedChoice: weights length must equal array length');
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum <= 0) throw new Error('weightedChoice: at least one weight must be positive');
    let r = random() * sum;
    for (let i = 0; i < array.length; i++) {
      r -= weights[i];
      if (r < 0) return array[i];
    }
    return array[array.length - 1];
  }
  
  /**
   * Get current state (for debugging)
   */
  function getState() {
    return state;
  }
  
  return {
    random,
    randomInt,
    randomFloat,
    shuffle,
    pick,
    weightedChoice,
    getState,
  };
}

/**
 * Generate a random seed based on current time
 * Used when no seed is provided
 */
export function generateSeed() {
  return Date.now() ^ (Math.random() * 0xFFFFFFFF);
}
