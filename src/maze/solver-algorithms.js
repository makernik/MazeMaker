/**
 * Solver algorithm registry. Each algorithm is a function (adapter) => { path, length, solved }.
 * Only BFS is implemented; design allows future DFS, A*, etc. and UI/match-up (see DEFERRED_IDEAS).
 */

const registry = new Map();

/**
 * BFS using the adapter contract. Adapter must provide getStart, getFinish, getNeighbors, key.
 * getNeighbors must return deterministic order (see DEFERRED_IDEAS: deterministic neighbor order).
 *
 * @param {object} adapter - Maze adapter with getStart, getFinish, getNeighbors(state), key(state)
 * @returns {{ path: unknown[], length: number, solved: boolean }|null}
 */
function solveBFS(adapter) {
  const start = adapter.getStart();
  const finish = adapter.getFinish();
  const queue = [{ state: start, path: [start] }];
  const visited = new Set([adapter.key(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (adapter.key(current.state) === adapter.key(finish)) {
      return { path: current.path, length: current.path.length, solved: true };
    }
    const neighbors = adapter.getNeighbors(current.state);
    for (const nextState of neighbors) {
      const k = adapter.key(nextState);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ state: nextState, path: [...current.path, nextState] });
    }
  }
  return null;
}

registry.set('bfs', solveBFS);

/**
 * Get solver function for algorithm id.
 *
 * @param {string} [algorithmId] - 'bfs' or future 'dfs', 'astar'; default 'bfs'
 * @returns {(adapter: object) => { path: unknown[], length: number, solved: boolean }|null}
 */
export function getSolver(algorithmId = 'bfs') {
  const fn = registry.get(algorithmId);
  if (!fn) return registry.get('bfs');
  return fn;
}

/**
 * Get registered algorithm ids (for future UI or match-up).
 *
 * @returns {string[]}
 */
export function getRegisteredAlgorithmIds() {
  return Array.from(registry.keys());
}
