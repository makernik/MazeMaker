/**
 * Organic maze generator: circle packing + graph + DFS spanning tree.
 * Returns maze object with layout 'organic'.
 */

import { createRng, generateSeed } from '../utils/rng.js';
import { getDifficultyPreset } from '../utils/constants.js';
import { packCircles, computeNeighbors } from './circle-packing.js';
import { buildOrganicGraph } from './organic-graph.js';
import { PRINTABLE_WIDTH, PRINTABLE_HEIGHT, FOOTER_HEIGHT } from '../pdf/layout.js';

const MAZE_TOP_MARGIN = 20;

/**
 * Generate an organic (non-grid) maze.
 *
 * @param {object} config
 * @param {string} config.ageRange - Age range for preset (cell count from grid size)
 * @param {number} [config.seed] - Seed for determinism
 * @returns {object} Maze with layout: 'organic', graph, nodePositions, startId, finishId, preset, seed, algorithm, boundsWidth, boundsHeight
 */
export function generateOrganicMaze(config) {
  const { ageRange, seed = generateSeed() } = config;
  const preset = getDifficultyPreset(ageRange);
  const targetCount = preset.organicNodeCount || (preset.gridWidth || 10) * (preset.gridHeight || 14);

  const boundsWidth = PRINTABLE_WIDTH;
  const boundsHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - MAZE_TOP_MARGIN;

  const rng = createRng(seed);
  const { circles } = packCircles({
    width: boundsWidth,
    height: boundsHeight,
    targetCount,
    seed,
  });

  const neighborMap = computeNeighbors(circles);
  const graph = buildOrganicGraph(circles, neighborMap);

  const carvedIds = organicDFS(graph, rng);
  const startId = chooseStartInTopFromSet(graph, boundsHeight, carvedIds);
  const finishId = chooseFinishInBottomFromSet(graph, boundsHeight, carvedIds);

  const nodePositions = new Map();
  for (const node of graph.nodes) {
    nodePositions.set(node.id, { x: node.x, y: node.y });
  }

  return {
    layout: 'organic',
    graph,
    nodePositions,
    startId,
    finishId,
    preset,
    seed,
    algorithm: 'dfs',
    boundsWidth,
    boundsHeight,
    ageRange,
    connectedCount: carvedIds.size,
  };
}

/**
 * Recursive backtracker (DFS) on graph: carve spanning tree by removing walls.
 * @returns {Set<number>} Set of node ids in the carved component (so start/finish can be chosen from it).
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
