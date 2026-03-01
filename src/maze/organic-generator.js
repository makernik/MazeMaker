/**
 * Organic maze generator: circle packing + graph + spanning tree.
 * Supports DFS (recursive backtracker), Prim's, and Kruskal's algorithms.
 * Returns maze object with layout 'organic'.
 */

import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset } from '../utils/constants.js';
import { packCircles, computeNeighbors, ensureConnected, generateCorridorFillers } from './circle-packing.js';
import { buildOrganicGraph } from './organic-graph.js';
import { computeCorridorWidth } from '../pdf/drawers/organic-geometry.js';
import { PRINTABLE_WIDTH, PRINTABLE_HEIGHT, FOOTER_HEIGHT } from '../pdf/layout.js';

const MAZE_TOP_MARGIN = 20;

/**
 * Generate an organic (non-grid) maze.
 *
 * @param {object} config
 * @param {string} config.ageRange - Age range for preset (cell count from grid size)
 * @param {number} [config.seed] - Seed for determinism
 * @param {string} [config.algorithm] - 'recursive-backtracker' | 'prim' | 'kruskal' (default: preset-mapped)
 * @returns {object} Maze with layout: 'organic', graph, nodePositions, startId, finishId, preset, seed, algorithm, boundsWidth, boundsHeight
 */
export function generateOrganicMaze(config) {
  const { ageRange, seed = generateSeed(), algorithm } = config;
  const preset = getDifficultyPreset(ageRange);
  const targetCount = preset.organicNodeCount || (preset.gridWidth || 10) * (preset.gridHeight || 14);
  let algo = algorithm || preset.algorithm || 'recursive-backtracker';
  // Organic does not support Wilson's; fallback to preset or recursive-backtracker
  if (algo === 'wilson') {
    algo = preset.algorithm && preset.algorithm !== 'wilson' ? preset.algorithm : 'recursive-backtracker';
  }

  const boundsWidth = PRINTABLE_WIDTH;
  const boundsHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - MAZE_TOP_MARGIN;

  const rng = createRng(seed);
  const { circles } = packCircles({
    width: boundsWidth,
    height: boundsHeight,
    targetCount,
    seed,
  });

  ensureConnected(circles, boundsWidth, boundsHeight);
  const neighborMap = computeNeighbors(circles);
  const graph = buildOrganicGraph(circles, neighborMap);

  let carvedIds;
  if (algo === 'prim') {
    carvedIds = organicPrim(graph, rng);
  } else if (algo === 'kruskal') {
    carvedIds = organicKruskal(graph, rng);
  } else {
    carvedIds = organicDFS(graph, rng);
  }

  const startId = chooseStartInTopFromSet(graph, boundsHeight, carvedIds);
  const finishId = chooseFinishInBottomFromSet(graph, boundsHeight, carvedIds);

  const nodePositions = new Map();
  for (const node of graph.nodes) {
    nodePositions.set(node.id, { x: node.x, y: node.y });
  }

  // Pass 2: decorative filler corridors alongside carved edges
  let fillerGraph = null;
  if (preset.organicFill) {
    const { halfW } = computeCorridorWidth(graph);
    const fillerSeed = seed + 99999;
    const { circles: fillerCircles, neighborMap: fillerNeighborMap } =
      generateCorridorFillers(graph, circles, boundsWidth, boundsHeight, halfW, fillerSeed);
    if (fillerCircles.length > 0) {
      fillerGraph = buildOrganicGraph(fillerCircles, fillerNeighborMap);
      const fillerRng = createRng(fillerSeed + 1);
      carveFillerPaths(fillerGraph, fillerRng);
    }
  }

  return {
    layout: 'organic',
    graph,
    fillerGraph,
    nodePositions,
    startId,
    finishId,
    preset,
    seed,
    algorithm: algo,
    boundsWidth,
    boundsHeight,
    ageRange,
    connectedCount: carvedIds.size,
  };
}

// ---------------------------------------------------------------------------
// Algorithm implementations for organic graphs
// ---------------------------------------------------------------------------

/**
 * Recursive backtracker (DFS): long winding passages.
 * @returns {Set<number>} carved node ids
 */
function organicDFS(graph, rng) {
  const visited = new Set();
  const stack = [];
  const startId = graph.nodes[rng.randomInt(0, graph.nodes.length - 1)].id;
  visited.add(startId);
  stack.push(startId);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = graph.getNeighbors(current).filter(nid => !visited.has(nid));
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    rng.shuffle(neighbors);
    const next = neighbors[0];
    graph.removeWall(current, next);
    visited.add(next);
    stack.push(next);
  }
  return visited;
}

/**
 * Prim's algorithm on organic graph: bushy dead-ends.
 * @returns {Set<number>} carved node ids
 */
function organicPrim(graph, rng) {
  const visited = new Set();
  const walls = [];
  const startId = graph.nodes[rng.randomInt(0, graph.nodes.length - 1)].id;
  visited.add(startId);

  for (const nid of graph.getNeighbors(startId)) {
    walls.push({ from: startId, to: nid });
  }

  while (walls.length > 0) {
    const idx = rng.randomInt(0, walls.length - 1);
    const wall = walls[idx];
    walls[idx] = walls[walls.length - 1];
    walls.pop();

    if (visited.has(wall.to)) continue;

    graph.removeWall(wall.from, wall.to);
    visited.add(wall.to);

    for (const nid of graph.getNeighbors(wall.to)) {
      if (!visited.has(nid)) {
        walls.push({ from: wall.to, to: nid });
      }
    }
  }
  return visited;
}

/**
 * Kruskal's algorithm on organic graph: uniform random spanning tree.
 * @returns {Set<number>} carved node ids
 */
function organicKruskal(graph, rng) {
  const idToIdx = new Map();
  graph.nodes.forEach((n, i) => idToIdx.set(n.id, i));
  const parent = graph.nodes.map((_, i) => i);
  function find(i) {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i, j) {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }

  const edges = [];
  for (const node of graph.nodes) {
    for (const nid of node.neighbors) {
      if (nid > node.id) {
        edges.push({ a: node.id, b: nid });
      }
    }
  }
  rng.shuffle(edges);

  for (const { a, b } of edges) {
    const ia = idToIdx.get(a);
    const ib = idToIdx.get(b);
    if (find(ia) !== find(ib)) {
      graph.removeWall(a, b);
      union(ia, ib);
    }
  }

  const visited = new Set();
  for (const node of graph.nodes) visited.add(node.id);
  return visited;
}

// ---------------------------------------------------------------------------
// Start / finish selection
// ---------------------------------------------------------------------------

function chooseStartInTopFromSet(graph, boundsHeight, nodeIds) {
  const threshold = boundsHeight * 0.8;
  let best = null;
  for (const id of nodeIds) {
    const node = graph.getNode(id);
    if (!node || node.y < threshold) continue;
    if (!best || node.y > best.y) best = node;
  }
  if (best) return best.id;
  const first = nodeIds.values().next().value;
  return first !== undefined ? first : graph.nodes[0].id;
}

function chooseFinishInBottomFromSet(graph, boundsHeight, nodeIds) {
  const threshold = boundsHeight * 0.2;
  let best = null;
  for (const id of nodeIds) {
    const node = graph.getNode(id);
    if (!node || node.y > threshold) continue;
    if (!best || node.y < best.y) best = node;
  }
  if (best) return best.id;
  const first = nodeIds.values().next().value;
  return first !== undefined ? first : graph.nodes[graph.nodes.length - 1].id;
}

/**
 * Carve DFS spanning trees in each connected component of the filler graph.
 * Creates decorative dead-end corridors disconnected from the main maze.
 */
function carveFillerPaths(graph, rng) {
  const visited = new Set();
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const stack = [node.id];
    visited.add(node.id);
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = graph.getNeighbors(current).filter(nid => !visited.has(nid));
      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }
      rng.shuffle(neighbors);
      const next = neighbors[0];
      graph.removeWall(current, next);
      visited.add(next);
      stack.push(next);
    }
  }
}
