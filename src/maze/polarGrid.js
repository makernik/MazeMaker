/**
 * Polar (circular) maze grid: concentric rings with radial wedges.
 * Ring 0 = center (one cell). Rings 1..maxRing have the same wedge count (fixed for now).
 * Directions: INWARD (toward center), OUTWARD (toward edge), CW, CCW.
 */

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
 * Ring 0 has only wedge 0 (center). Ring r >= 1 has wedges 0..numWedges-1.
 */
export class PolarCell {
  constructor(ring, wedge) {
    this.ring = ring;
    this.wedge = wedge;
    this.walls = {
      [POLAR_DIRECTIONS.INWARD]: true,
      [POLAR_DIRECTIONS.OUTWARD]: true,
      [POLAR_DIRECTIONS.CW]: true,
      [POLAR_DIRECTIONS.CCW]: true,
    };
    this.visited = false;
  }

  removeWall(direction) {
    this.walls[direction] = false;
  }

  hasWall(direction) {
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
 * Polar grid: rings (including center) and wedges per ring (fixed).
 * Start = outer ring at top (angle π/2). Finish = center room (0, 0).
 */
export class PolarGrid {
  constructor(rings, wedges) {
    if (rings < 2) throw new Error('PolarGrid requires at least 2 rings (center + 1 ring)');
    if (wedges < 2) throw new Error('PolarGrid requires at least 2 wedges');

    this.rings = rings;
    this.wedges = wedges;
    this.maxRing = rings - 1;

    /** @type {PolarCell[][]} cells[ring][wedge]; ring 0 has only cells[0][0] */
    this.cells = [];
    for (let r = 0; r < rings; r++) {
      const count = r === 0 ? 1 : wedges;
      this.cells[r] = [];
      for (let w = 0; w < count; w++) {
        this.cells[r][w] = new PolarCell(r, w);
      }
    }

    const topW = topWedgeForWedges(wedges);
    this.start = { ring: this.maxRing, wedge: topW };
    this.finish = { ring: 0, wedge: 0 };
  }

  getCell(ring, wedge) {
    if (ring < 0 || ring >= this.rings) return null;
    if (ring === 0) return wedge === 0 ? this.cells[0][0] : null;
    if (wedge < 0 || wedge >= this.wedges) return null;
    return this.cells[ring][wedge];
  }

  /**
   * Neighbor (ring, wedge) in the given direction, or null.
   */
  getNeighbor(ring, wedge, direction) {
    if (ring === 0) {
      if (direction === POLAR_DIRECTIONS.OUTWARD) return { ring: 1, wedge: 0 };
      return null;
    }
    switch (direction) {
      case POLAR_DIRECTIONS.INWARD:
        return ring === 1 ? { ring: 0, wedge: 0 } : { ring: ring - 1, wedge };
      case POLAR_DIRECTIONS.OUTWARD:
        return ring < this.maxRing ? { ring: ring + 1, wedge } : null;
      case POLAR_DIRECTIONS.CW:
        return { ring, wedge: (wedge + 1) % this.wedges };
      case POLAR_DIRECTIONS.CCW:
        return { ring, wedge: (wedge - 1 + this.wedges) % this.wedges };
      default:
        return null;
    }
  }

  getNeighbors(ring, wedge) {
    const out = [];
    for (const dir of Object.values(POLAR_DIRECTIONS)) {
      const n = this.getNeighbor(ring, wedge, dir);
      if (n) out.push(n);
    }
    return out;
  }

  removeWallBetween(cell1, cell2) {
    const r1 = cell1.ring;
    const w1 = cell1.wedge;
    const r2 = cell2.ring;
    const w2 = cell2.wedge;

    let dirFrom1;
    if (r2 < r1) dirFrom1 = POLAR_DIRECTIONS.INWARD;
    else if (r2 > r1) dirFrom1 = POLAR_DIRECTIONS.OUTWARD;
    else if ((w2 - w1 + this.wedges) % this.wedges === 1) dirFrom1 = POLAR_DIRECTIONS.CW;
    else if ((w1 - w2 + this.wedges) % this.wedges === 1) dirFrom1 = POLAR_DIRECTIONS.CCW;
    else return;

    cell1.removeWall(dirFrom1);
    cell2.removeWall(OPPOSITE[dirFrom1]);
  }

  /** Open entrance: outer boundary at start (top of circle) so player can enter. */
  openEntrance() {
    const startCell = this.getCell(this.maxRing, this.start.wedge);
    if (startCell) startCell.removeWall(POLAR_DIRECTIONS.OUTWARD);
  }

  /** Open exit: passage from ring 1 into center room (wedge 0) so player can reach finish. */
  openExit() {
    const center = this.getCell(0, 0);
    const outer = this.getCell(1, 0);
    if (center && outer) {
      center.removeWall(POLAR_DIRECTIONS.OUTWARD);
      outer.removeWall(POLAR_DIRECTIONS.INWARD);
    }
  }

  getTotalCells() {
    return 1 + (this.rings - 1) * this.wedges;
  }

  resetVisited() {
    for (let r = 0; r < this.rings; r++) {
      for (const c of this.cells[r]) c.visited = false;
    }
  }
}
