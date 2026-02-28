/**
 * Polar (circular) maze grid: concentric rings with radial wedges.
 * Ring 0 = center (one cell). Rings 1..maxRing have wedge count per ring (fixed or variable).
 * Directions: INWARD (toward center), OUTWARD (toward edge), CW, CCW.
 * With variable wedges, one inner cell can connect to two outer cells; OUTWARD is an array of 1 or 2 walls.
 */

const MAX_WEDGES = 64;

export const POLAR_DIRECTIONS = {
  INWARD: 0,
  OUTWARD: 1,
  CW: 2,
  CCW: 3,
};

const OPPOSITE = {
  [POLAR_DIRECTIONS.INWARD]: POLAR_DIRECTIONS.OUTWARD,
  [POLAR_DIRECTIONS.OUTWARD]: POLAR_DIRECTIONS.INWARD,
  [POLAR_DIRECTIONS.CW]: POLAR_DIRECTIONS.CCW,
  [POLAR_DIRECTIONS.CCW]: POLAR_DIRECTIONS.CW,
};

/**
 * Single cell in the polar grid: (ring, wedge).
 * Ring 0 has only wedge 0 (center). Ring r >= 1 has wedges 0..wedgesAtRing(r)-1.
 * walls.OUTWARD is an array (length 1 or 2) for variable wedges.
 */
export class PolarCell {
  constructor(ring, wedge, outwardWallCount = 1) {
    this.ring = ring;
    this.wedge = wedge;
    this.walls = {
      [POLAR_DIRECTIONS.INWARD]: true,
      [POLAR_DIRECTIONS.OUTWARD]: Array.from({ length: outwardWallCount }, () => true),
      [POLAR_DIRECTIONS.CW]: true,
      [POLAR_DIRECTIONS.CCW]: true,
    };
    this.visited = false;
  }

  removeWall(direction, outwardIndex = 0) {
    if (direction === POLAR_DIRECTIONS.OUTWARD) {
      this.walls[POLAR_DIRECTIONS.OUTWARD][outwardIndex] = false;
    } else {
      this.walls[direction] = false;
    }
  }

  hasWall(direction, outwardIndex = 0) {
    if (direction === POLAR_DIRECTIONS.OUTWARD) {
      return this.walls[POLAR_DIRECTIONS.OUTWARD][outwardIndex];
    }
    return this.walls[direction];
  }

  markVisited() {
    this.visited = true;
  }

  isVisited() {
    return this.visited;
  }
}

/**
 * Wedge index at "top" of circle (angle π/2). Angle 0 = right, CCW positive.
 */
function topWedgeForWedges(wedges) {
  return Math.floor(wedges / 4);
}

/**
 * Validate optional wedgeCounts array: length, ring 0 === 1, all >= 1, and each ring an integer multiple of prior.
 * @param {number} rings
 * @param {number[]} [wedgeCounts]
 * @throws {Error} if wedgeCounts is provided but invalid
 */
function validateWedgeCounts(rings, wedgeCounts) {
  if (!Array.isArray(wedgeCounts)) return;
  if (wedgeCounts.length !== rings) {
    throw new Error(`PolarGrid wedgeCounts length (${wedgeCounts.length}) must equal rings (${rings})`);
  }
  if (wedgeCounts[0] !== 1) {
    throw new Error(`PolarGrid wedgeCounts[0] must be 1 (center), got ${wedgeCounts[0]}`);
  }
  for (let r = 0; r < rings; r++) {
    if (wedgeCounts[r] < 1 || !Number.isInteger(wedgeCounts[r])) {
      throw new Error(`PolarGrid wedgeCounts[${r}] must be a positive integer, got ${wedgeCounts[r]}`);
    }
  }
  for (let r = 1; r < rings; r++) {
    if (wedgeCounts[r] % wedgeCounts[r - 1] !== 0) {
      throw new Error(
        `PolarGrid wedgeCounts[${r}] (${wedgeCounts[r]}) must be an integer multiple of wedgeCounts[${r - 1}] (${wedgeCounts[r - 1]})`
      );
    }
  }
}

/**
 * Polar grid: rings (including center) and wedges per ring (fixed or variable).
 * wedgeMultiplier > 1: ring r has baseWedges * (wedgeMultiplier ^ (r-1)) wedges, capped at MAX_WEDGES.
 * Optional wedgeCounts: explicit per-ring counts; must satisfy integer-ratio rule (outer ring count = integer multiple of inner).
 * Start = outer ring at top. Finish = center room (0, 0).
 */
export class PolarGrid {
  constructor(rings, baseWedges, wedgeMultiplier = 1, wedgeCounts = undefined) {
    if (rings < 2) throw new Error('PolarGrid requires at least 2 rings (center + 1 ring)');
    if (baseWedges < 2) throw new Error('PolarGrid requires at least 2 base wedges');

    this.rings = rings;
    this.baseWedges = baseWedges;
    this.wedgeMultiplier = Math.max(1, Math.min(wedgeMultiplier, 4));
    this.maxRing = rings - 1;

    validateWedgeCounts(rings, wedgeCounts);

    /** Wedge count for ring r (r >= 0). From wedgeCounts if valid, else baseWedges * multiplier^(r-1), capped. */
    this._wedgeCounts = [];
    if (Array.isArray(wedgeCounts) && wedgeCounts.length === rings) {
      for (let r = 0; r < rings; r++) this._wedgeCounts[r] = wedgeCounts[r];
    } else {
      for (let r = 0; r < rings; r++) {
        const count = r === 0 ? 1 : Math.min(baseWedges * Math.pow(this.wedgeMultiplier, r - 1), MAX_WEDGES);
        this._wedgeCounts[r] = count;
      }
    }

    /** @type {PolarCell[][]} cells[ring][wedge]; ring 0 has only cells[0][0] */
    this.cells = [];
    for (let r = 0; r < rings; r++) {
      const W = this.wedgesAtRing(r);
      const outwardCount = r === 0 ? 1 : (r < this.maxRing ? this.outwardNeighborCount(r) : 1);
      this.cells[r] = [];
      for (let w = 0; w < W; w++) {
        this.cells[r][w] = new PolarCell(r, w, outwardCount);
      }
    }

    const outerWedges = this.wedgesAtRing(this.maxRing);
    const topW = topWedgeForWedges(outerWedges);
    this.start = { ring: this.maxRing, wedge: topW };
    this.finish = { ring: 0, wedge: 0 };
  }

  /** Wedge count for ring r. */
  wedgesAtRing(r) {
    if (r < 0 || r >= this.rings) return 0;
    return this._wedgeCounts[r];
  }

  /** Number of outward neighbors from ring r (1 or 2 when outer ring has more wedges). */
  outwardNeighborCount(r) {
    if (r >= this.maxRing) return 1;
    const innerW = this.wedgesAtRing(r);
    const outerW = this.wedgesAtRing(r + 1);
    return Math.max(1, Math.floor(outerW / innerW));
  }

  /** For backward compatibility: wedge count of ring 1 (base). */
  get wedges() {
    return this.wedgesAtRing(1);
  }

  getCell(ring, wedge) {
    if (ring < 0 || ring >= this.rings) return null;
    if (ring === 0) return wedge === 0 ? this.cells[0][0] : null;
    const W = this.wedgesAtRing(ring);
    if (wedge < 0 || wedge >= W) return null;
    return this.cells[ring][wedge];
  }

  /**
   * Inner wedge index for cell (ring, wedge): the wedge in the inner ring that (ring, wedge) connects to.
   */
  innerWedgeFor(ring, wedge) {
    if (ring <= 1) return 0;
    const innerW = this.wedgesAtRing(ring - 1);
    const myW = this.wedgesAtRing(ring);
    return Math.floor((wedge * innerW) / myW);
  }

  /**
   * Outward neighbor(s). Returns array of { ring, wedge } (length 1 or 2), or empty when at maxRing.
   */
  getOutwardNeighbors(ring, wedge) {
    if (ring === 0) return [{ ring: 1, wedge: 0 }];
    if (ring >= this.maxRing) return [];
    const innerW = this.wedgesAtRing(ring);
    const outerW = this.wedgesAtRing(ring + 1);
    const ratio = outerW / innerW;
    const out = [];
    for (let i = 0; i < ratio; i++) {
      out.push({ ring: ring + 1, wedge: wedge * ratio + i });
    }
    return out;
  }

  /**
   * Neighbor(s) in the given direction. Returns array (empty, one, or two elements).
   */
  getNeighbor(ring, wedge, direction) {
    if (ring === 0) {
      if (direction === POLAR_DIRECTIONS.OUTWARD) return [{ ring: 1, wedge: 0 }];
      return [];
    }
    const W = this.wedgesAtRing(ring);
    switch (direction) {
      case POLAR_DIRECTIONS.INWARD:
        return ring === 1 ? [{ ring: 0, wedge: 0 }] : [{ ring: ring - 1, wedge: this.innerWedgeFor(ring, wedge) }];
      case POLAR_DIRECTIONS.OUTWARD:
        return this.getOutwardNeighbors(ring, wedge);
      case POLAR_DIRECTIONS.CW:
        return [{ ring, wedge: (wedge + 1) % W }];
      case POLAR_DIRECTIONS.CCW:
        return [{ ring, wedge: (wedge - 1 + W) % W }];
      default:
        return [];
    }
  }

  getNeighbors(ring, wedge) {
    const out = [];
    const cell = this.getCell(ring, wedge);
    if (!cell) return out;

    for (const dir of Object.values(POLAR_DIRECTIONS)) {
      const neighbors = this.getNeighbor(ring, wedge, dir);
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (!n) continue;
        const hasWall = dir === POLAR_DIRECTIONS.OUTWARD ? cell.hasWall(dir, i) : cell.hasWall(dir);
        if (!hasWall) out.push(n);
      }
    }
    return out;
  }

  /**
   * Neighbors that are adjacent (have a wall) and not yet visited. For recursive-backtracker.
   * @returns {Array<{ ring: number, wedge: number }>}
   */
  getUnvisitedNeighbors(ring, wedge) {
    const out = [];
    const cell = this.getCell(ring, wedge);
    if (!cell) return out;

    for (const dir of Object.values(POLAR_DIRECTIONS)) {
      const neighbors = this.getNeighbor(ring, wedge, dir);
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (!n) continue;
        const hasWall = dir === POLAR_DIRECTIONS.OUTWARD ? cell.hasWall(dir, i) : cell.hasWall(dir);
        if (!hasWall) continue;
        const neighborCell = this.getCell(n.ring, n.wedge);
        if (neighborCell && !neighborCell.isVisited()) out.push(n);
      }
    }
    return out;
  }

  /**
   * Linear index for cell (ring, wedge) for union-find. 0 = center; then ring 1..maxRing in order.
   */
  cellToIndex(ring, wedge) {
    if (ring === 0) return 0;
    let idx = 1;
    for (let r = 1; r < ring; r++) idx += this.wedgesAtRing(r);
    return idx + wedge;
  }

  removeWallBetween(cell1, cell2) {
    const r1 = cell1.ring;
    const w1 = cell1.wedge;
    const r2 = cell2.ring;
    const w2 = cell2.wedge;

    if (r2 < r1) {
      cell1.removeWall(POLAR_DIRECTIONS.INWARD);
      cell2.removeWall(POLAR_DIRECTIONS.OUTWARD, this.outwardIndexFromInner(cell2, r1, w1));
      return;
    }
    if (r2 > r1) {
      const idx = this.outwardIndexFromInner(cell1, r2, w2);
      cell1.removeWall(POLAR_DIRECTIONS.OUTWARD, idx);
      cell2.removeWall(POLAR_DIRECTIONS.INWARD);
      return;
    }
    const W = this.wedgesAtRing(r1);
    if ((w2 - w1 + W) % W === 1) {
      cell1.removeWall(POLAR_DIRECTIONS.CW);
      cell2.removeWall(POLAR_DIRECTIONS.CCW);
    } else if ((w1 - w2 + W) % W === 1) {
      cell1.removeWall(POLAR_DIRECTIONS.CCW);
      cell2.removeWall(POLAR_DIRECTIONS.CW);
    }
  }

  /** Index into inner cell's OUTWARD wall array that connects to (outerRing, outerWedge). */
  outwardIndexFromInner(innerCell, outerRing, outerWedge) {
    const innerW = this.wedgesAtRing(outerRing - 1);
    const outerW = this.wedgesAtRing(outerRing);
    const ratio = outerW / innerW;
    const base = innerCell.wedge * ratio;
    const idx = outerWedge - base;
    return Math.max(0, Math.min(Math.floor(idx), ratio - 1));
  }

  /** Open entrance: outer boundary at start (top of circle) so player can enter. */
  openEntrance() {
    const startCell = this.getCell(this.maxRing, this.start.wedge);
    if (startCell) startCell.removeWall(POLAR_DIRECTIONS.OUTWARD, 0);
  }

  /** Open exit: passage from ring 1 into center room (wedge 0) so player can reach finish. */
  openExit() {
    const center = this.getCell(0, 0);
    const outer = this.getCell(1, 0);
    if (center && outer) {
      center.removeWall(POLAR_DIRECTIONS.OUTWARD, 0);
      outer.removeWall(POLAR_DIRECTIONS.INWARD);
    }
  }

  getTotalCells() {
    let total = 1;
    for (let r = 1; r < this.rings; r++) total += this.wedgesAtRing(r);
    return total;
  }

  resetVisited() {
    for (let r = 0; r < this.rings; r++) {
      for (const c of this.cells[r]) c.visited = false;
    }
  }
}
