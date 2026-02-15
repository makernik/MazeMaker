/**
 * Tests for organic graph and organic generator.
 */

import { describe, it, expect } from 'vitest';
import { packCircles, computeNeighbors } from '../src/maze/circle-packing.js';
import { buildOrganicGraph } from '../src/maze/organic-graph.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { solveMaze, validateMaze } from '../src/maze/solver.js';

describe('Organic graph', () => {
  it('builds graph from circles with all walls closed', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 15, seed: 1 });
    const neighbors = computeNeighbors(circles);
    const graph = buildOrganicGraph(circles, neighbors);
    expect(graph.nodes.length).toBe(15);
    for (const node of graph.nodes) {
      for (const nid of node.neighbors) {
        expect(graph.hasWall(node.id, nid)).toBe(true);
      }
    }
  });

  it('getNeighbors and hasWall/removeWall work', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 12, seed: 2 });
    const neighbors = computeNeighbors(circles);
    const graph = buildOrganicGraph(circles, neighbors);
    const id = graph.nodes[0].id;
    const adj = graph.getNeighbors(id);
    if (adj.length > 0) {
      const nid = adj[0];
      expect(graph.hasWall(id, nid)).toBe(true);
      graph.removeWall(id, nid);
      expect(graph.hasWall(id, nid)).toBe(false);
    }
  });

  it('chooseStartInTopRegion and chooseFinishInBottomRegion return valid node ids', () => {
    const { circles } = packCircles({ width: 200, height: 200, targetCount: 20, seed: 3 });
    const neighbors = computeNeighbors(circles);
    const graph = buildOrganicGraph(circles, neighbors);
    const startId = graph.chooseStartInTopRegion(200, 0.2);
    const finishId = graph.chooseFinishInBottomRegion(200, 0.2);
    expect(graph.getNode(startId)).not.toBeNull();
    expect(graph.getNode(finishId)).not.toBeNull();
  });
});

describe('Organic generator', () => {
  it('returns maze with layout organic and required fields', () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 100 });
    expect(maze.layout).toBe('organic');
    expect(maze.graph).toBeDefined();
    expect(maze.nodePositions).toBeDefined();
    expect(maze.startId).toBeDefined();
    expect(maze.finishId).toBeDefined();
    expect(maze.preset).toBeDefined();
    expect(maze.seed).toBe(100);
    expect(maze.algorithm).toBe('dfs');
    expect(maze.graph.getNode(maze.startId)).not.toBeNull();
    expect(maze.graph.getNode(maze.finishId)).not.toBeNull();
  });

  it('produces solvable organic maze', () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 200 });
    expect(validateMaze(maze)).toBe(true);
    const solution = solveMaze(maze);
    expect(solution).not.toBeNull();
    expect(solution.solved).toBe(true);
    expect(solution.path[0]).toBe(maze.startId);
    expect(solution.path[solution.path.length - 1]).toBe(maze.finishId);
  });

  it('is deterministic for same seed', () => {
    const a = generateOrganicMaze({ ageRange: '6-8', seed: 300 });
    const b = generateOrganicMaze({ ageRange: '6-8', seed: 300 });
    expect(a.startId).toBe(b.startId);
    expect(a.finishId).toBe(b.finishId);
    expect(a.graph.nodes.length).toBe(b.graph.nodes.length);
  });
});
