/**
 * Maze Grid Data Structure
 * 
 * Represents the maze as a grid of cells with walls.
 * Each cell has four walls: top, right, bottom, left
 */

// Wall directions
export const DIRECTIONS = {
  TOP: 0,
  RIGHT: 1,
  BOTTOM: 2,
  LEFT: 3,
};

// Direction offsets for moving between cells [row, col]
export const DIRECTION_OFFSETS = {
  [DIRECTIONS.TOP]: [-1, 0],
  [DIRECTIONS.RIGHT]: [0, 1],
  [DIRECTIONS.BOTTOM]: [1, 0],
  [DIRECTIONS.LEFT]: [0, -1],
};

// Opposite directions
export const OPPOSITE = {
  [DIRECTIONS.TOP]: DIRECTIONS.BOTTOM,
  [DIRECTIONS.RIGHT]: DIRECTIONS.LEFT,
  [DIRECTIONS.BOTTOM]: DIRECTIONS.TOP,
  [DIRECTIONS.LEFT]: DIRECTIONS.RIGHT,
};

/**
 * A single cell in the maze grid
 */
export class Cell {
  constructor(row, col) {
    this.row = row;
    this.col = col;
    // All walls start intact
    this.walls = {
      [DIRECTIONS.TOP]: true,
      [DIRECTIONS.RIGHT]: true,
      [DIRECTIONS.BOTTOM]: true,
      [DIRECTIONS.LEFT]: true,
    };
    // Track if cell has been visited during generation
    this.visited = false;
  }
  
  /**
   * Remove a wall in the given direction
   */
  removeWall(direction) {
    this.walls[direction] = false;
  }
  
  /**
   * Check if a wall exists in the given direction
   */
  hasWall(direction) {
    return this.walls[direction];
  }
  
  /**
   * Mark cell as visited
   */
  markVisited() {
    this.visited = true;
  }
  
  /**
   * Check if cell has been visited
   */
  isVisited() {
    return this.visited;
  }
}

/**
 * Maze Grid
 * 
 * A 2D grid of cells representing the maze structure.
 * Start is always top-left (0, 0)
 * Finish is always bottom-right (rows-1, cols-1)
 */
export class MazeGrid {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.cells = [];
    
    // Initialize grid with cells
    for (let row = 0; row < rows; row++) {
      this.cells[row] = [];
      for (let col = 0; col < cols; col++) {
        this.cells[row][col] = new Cell(row, col);
      }
    }
    
    // Define start and finish positions
    this.start = { row: 0, col: 0 };
    this.finish = { row: rows - 1, col: cols - 1 };
  }
  
  /**
   * Get a cell at the given position
   */
  getCell(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return null;
    }
    return this.cells[row][col];
  }
  
  /**
   * Check if a position is valid
   */
  isValidPosition(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }
  
  /**
   * Get the neighbor cell in the given direction
   */
  getNeighbor(row, col, direction) {
    const [dRow, dCol] = DIRECTION_OFFSETS[direction];
    return this.getCell(row + dRow, col + dCol);
  }
  
  /**
   * Get all unvisited neighbors of a cell
   */
  getUnvisitedNeighbors(row, col) {
    const neighbors = [];
    
    for (const direction of Object.values(DIRECTIONS)) {
      const neighbor = this.getNeighbor(row, col, direction);
      if (neighbor && !neighbor.isVisited()) {
        neighbors.push({ cell: neighbor, direction });
      }
    }
    
    return neighbors;
  }
  
  /**
   * Remove walls between two adjacent cells
   */
  removeWallBetween(cell1, cell2) {
    const rowDiff = cell2.row - cell1.row;
    const colDiff = cell2.col - cell1.col;
    
    let direction;
    if (rowDiff === -1) direction = DIRECTIONS.TOP;
    else if (rowDiff === 1) direction = DIRECTIONS.BOTTOM;
    else if (colDiff === -1) direction = DIRECTIONS.LEFT;
    else if (colDiff === 1) direction = DIRECTIONS.RIGHT;
    else return; // Not adjacent
    
    cell1.removeWall(direction);
    cell2.removeWall(OPPOSITE[direction]);
  }
  
  /**
   * Open the entrance (top wall of start cell)
   */
  openEntrance() {
    const startCell = this.getCell(this.start.row, this.start.col);
    startCell.removeWall(DIRECTIONS.TOP);
  }
  
  /**
   * Open the exit (bottom wall of finish cell)
   */
  openExit() {
    const finishCell = this.getCell(this.finish.row, this.finish.col);
    finishCell.removeWall(DIRECTIONS.BOTTOM);
  }
  
  /**
   * Reset visited state for all cells (useful for solving)
   */
  resetVisited() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells[row][col].visited = false;
      }
    }
  }
  
  /**
   * Check if two cells are connected (no wall between them)
   */
  areConnected(row1, col1, row2, col2) {
    const cell1 = this.getCell(row1, col1);
    const cell2 = this.getCell(row2, col2);
    
    if (!cell1 || !cell2) return false;
    
    const rowDiff = row2 - row1;
    const colDiff = col2 - col1;
    
    // Must be adjacent
    if (Math.abs(rowDiff) + Math.abs(colDiff) !== 1) return false;
    
    let direction;
    if (rowDiff === -1) direction = DIRECTIONS.TOP;
    else if (rowDiff === 1) direction = DIRECTIONS.BOTTOM;
    else if (colDiff === -1) direction = DIRECTIONS.LEFT;
    else direction = DIRECTIONS.RIGHT;
    
    return !cell1.hasWall(direction);
  }
}
