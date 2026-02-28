/**
 * Wilson's algorithm: loop-erased random walk for maze generation.
 * Topology-agnostic; works with grid or polar via an adapter.
 *
 * Performance note: Wilson's can be slow on large grids because early random walks
 * (when little of the maze is carved yet) can loop for a long time before hitting
 * a visited cell. No step limits are applied; behavior remains correct. If generation
 * feels slow on big presets (e.g. 18+ grid), this is expected.
 */

/**
 * Run Wilson's algorithm to carve a spanning tree on the adapter's graph.
 * @param {object} adapter - { getAllKeys, getAdjacentKeys, removeWallBetween, markVisited, isVisited }
 * @param {object} rng - Seeded RNG with random(), weightedChoice not required; use pick for neighbor
 * @returns {void}
 */
export function runWilsons(adapter, rng) {
  const keys = adapter.getAllKeys();
  if (keys.length === 0) return;

  adapter.markVisited(keys[0]);

  const unvisited = () => keys.filter((k) => !adapter.isVisited(k));

  while (unvisited().length > 0) {
    const startKeys = unvisited();
    const start = startKeys[rng.randomInt(0, startKeys.length - 1)];

    const path = [start];
    let current = start;

    while (!adapter.isVisited(current)) {
      const neighbors = adapter.getAdjacentKeys(current);
      if (neighbors.length === 0) break;
      const next = neighbors[rng.randomInt(0, neighbors.length - 1)];

      if (adapter.isVisited(next)) {
        path.push(next);
        break;
      }

      const idx = path.indexOf(next);
      if (idx >= 0) {
        path.length = idx + 1;
        current = next;
      } else {
        path.push(next);
        current = next;
      }
    }

    for (let i = 0; i < path.length - 1; i++) {
      adapter.removeWallBetween(path[i], path[i + 1]);
      adapter.markVisited(path[i]);
    }
    adapter.markVisited(path[path.length - 1]);
  }
}
