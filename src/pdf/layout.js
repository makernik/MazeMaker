/**
 * PDF Layout Configuration
 *
 * US Letter page layout with margins and footer positioning.
 * getLayoutForMaze computes per-maze layout (transform, cellSize, etc.) for the drawer pipeline.
 */

// US Letter dimensions in points (72 points = 1 inch)
export const PAGE_WIDTH = 8.5 * 72;  // 612 points
export const PAGE_HEIGHT = 11 * 72;  // 792 points

// Margins (0.5 inch minimum)
export const MARGIN = 0.5 * 72;  // 36 points

// Printable area
export const PRINTABLE_WIDTH = PAGE_WIDTH - (2 * MARGIN);
export const PRINTABLE_HEIGHT = PAGE_HEIGHT - (2 * MARGIN);

// Footer
export const FOOTER_TEXT = 'Generated with MakerNik Maze Tool';
export const FOOTER_URL = 'makernik.com';
export const FOOTER_HEIGHT = 24;  // points

const MAZE_TOP_MARGIN = 20;

/**
 * Compute layout result for a maze (grid or organic). Used by renderer to get transform, cellSize, etc.
 *
 * @param {object} maze - Maze object (grid: rows, cols, grid, preset; organic: layout, boundsWidth, boundsHeight, preset)
 * @param {object} [pageOptions] - { mazeWidth?, mazeHeight?, style? }. Defaults use PRINTABLE_* and FOOTER_HEIGHT.
 * @returns {object} Layout result: layoutType, lineThickness, and type-specific fields (grid: offsetX, offsetY, cellSize; organic: transform, scale, boundsWidth, boundsHeight)
 */
export function getLayoutForMaze(maze, pageOptions = {}) {
  const mazeWidth = pageOptions.mazeWidth ?? PRINTABLE_WIDTH;
  const mazeHeight = pageOptions.mazeHeight ?? (PRINTABLE_HEIGHT - FOOTER_HEIGHT - MAZE_TOP_MARGIN);
  const style = pageOptions.style ?? 'square';
  const lineThickness = maze.preset?.lineThickness ?? 2;

  if (maze.layout === 'organic') {
    const { boundsWidth, boundsHeight } = maze;
    const scale = Math.min(mazeWidth / boundsWidth, mazeHeight / boundsHeight);
    const actualMazeWidth = boundsWidth * scale;
    const actualMazeHeight = boundsHeight * scale;
    const offsetX = MARGIN + (PRINTABLE_WIDTH - actualMazeWidth) / 2;
    const offsetY = PAGE_HEIGHT - MARGIN - actualMazeHeight;
    const transform = (x, y) => ({
      x: offsetX + x * scale,
      y: offsetY + y * scale,
    });
    return {
      layoutType: 'organic',
      lineThickness,
      transform,
      scale,
      boundsWidth,
      boundsHeight,
    };
  }

  const cellWidth = mazeWidth / maze.cols;
  const cellHeight = mazeHeight / maze.rows;
  const cellSize = Math.min(cellWidth, cellHeight);
  const actualMazeWidth = cellSize * maze.cols;
  const actualMazeHeight = cellSize * maze.rows;
  const offsetX = MARGIN + (PRINTABLE_WIDTH - actualMazeWidth) / 2;
  const offsetY = PAGE_HEIGHT - MARGIN - actualMazeHeight;
  return {
    layoutType: 'grid',
    lineThickness,
    style,
    offsetX,
    offsetY,
    cellSize,
  };
}
