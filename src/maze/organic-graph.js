/**
 * Organic maze graph: nodes (circles) with explicit neighbor lists and wall state.
 * Built from circle packing output.
 */

import { computeNeighbors } from './circle-packing.js';

function edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/**
 * Build graph from packed circles. All walls start closed.
 *
 * @param {Array<{ id: number, x: number, y: number, r: number }>} circles
 * @param {Map<number, number[]>} neighborMap - id -> neighbor ids (from computeNeighbors)
 * @returns {OrganicGraph}
 */
export function buildOrganicGraph(circles, neighborMap) {
  const nodes = circles.map(c => ({
    id: c.id,
    x: c.x,
    y: c.y,
    r: c.r,
    neighbors: neighborMap.get(c.id) || [],
  }));

  const walls = new Set();
  for (const node of nodes) {
    for (const nid of node.neighbors) {
      if (nid > node.id) walls.add(edgeKey(node.id, nid));
    }
  }

  return new OrganicGraph(nodes, walls);
}

/**
 * Organic graph: nodes with positions and neighbor lists; walls stored as edge keys.
 */
export class OrganicGraph {
  constructor(nodes, walls) {
    this.nodes = nodes;
    this.walls = walls;
    this._byId = new Map(nodes.map(n => [n.id, n]));
  }

  getNode(id) {
    return this._byId.get(id) ?? null;
  }

  getNeighbors(id) {
    const node = this._byId.get(id);
    return node ? node.neighbors : [];
  }

  hasWall(id1, id2) {
    return this.walls.has(edgeKey(id1, id2));
  }

  removeWall(id1, id2) {
    this.walls.delete(edgeKey(id1, id2));
  }

  /**
   * Choose start node: in top region (e.g. top 20% by y). PDF y is bottom-up so "top" = max y.
   * @param {number} boundsHeight
   * @param {number} topFraction - e.g. 0.2 = top 20%
   * @returns {number} node id
   */
  chooseStartInTopRegion(boundsHeight, topFraction = 0.2) {
    const threshold = boundsHeight * (1 - topFraction);
    const candidates = this.nodes.filter(n => n.y >= threshold);
    if (candidates.length === 0) return this.nodes[0].id;
    return candidates.reduce((best, n) => (n.y > best.y ? n : best), candidates[0]).id;
  }

  /**
   * Choose finish node: in bottom region (e.g. bottom 20% by y). "Bottom" = min y.
   * @param {number} boundsHeight
   * @param {number} bottomFraction - e.g. 0.2 = bottom 20%
   * @returns {number} node id
   */
  chooseFinishInBottomRegion(boundsHeight, bottomFraction = 0.2) {
    const threshold = boundsHeight * bottomFraction;
    const candidates = this.nodes.filter(n => n.y <= threshold);
    if (candidates.length === 0) return this.nodes[this.nodes.length - 1].id;
    return candidates.reduce((best, n) => (n.y < best.y ? n : best), candidates[0]).id;
  }
}
