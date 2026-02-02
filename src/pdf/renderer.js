/**
 * PDF Renderer
 * 
 * Renders mazes to PDF using pdf-lib with vector paths.
 * Supports square and rounded corner styles.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DIRECTIONS } from '../maze/grid.js';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  PRINTABLE_WIDTH,
  PRINTABLE_HEIGHT,
  FOOTER_TEXT,
  FOOTER_URL,
  FOOTER_HEIGHT,
} from './layout.js';

/**
 * Render mazes to a PDF document
 * 
 * @param {object} config - Rendering configuration
 * @param {object[]} config.mazes - Array of maze objects from generator
 * @param {string} config.style - 'square' or 'rounded'
 * @param {string} config.ageRange - Age range for label style
 * @returns {Promise<Uint8Array>} PDF document as bytes
 */
export async function renderMazesToPdf(config) {
  const { mazes, style = 'square', ageRange = '9-13' } = config;
  
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed font for text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Determine if young age (arrows) or older (text labels)
  const useArrows = ageRange === '3-5' || ageRange === '6-8';
  
  // Render each maze on its own page
  for (const maze of mazes) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    // Calculate maze dimensions to fit in printable area
    const mazeHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - 20; // Leave room for footer
    const mazeWidth = PRINTABLE_WIDTH;
    
    // Calculate cell size based on grid dimensions
    const cellWidth = mazeWidth / maze.cols;
    const cellHeight = mazeHeight / maze.rows;
    const cellSize = Math.min(cellWidth, cellHeight);
    
    // Center the maze horizontally
    const actualMazeWidth = cellSize * maze.cols;
    const actualMazeHeight = cellSize * maze.rows;
    const offsetX = MARGIN + (PRINTABLE_WIDTH - actualMazeWidth) / 2;
    const offsetY = PAGE_HEIGHT - MARGIN - actualMazeHeight;
    
    // Get line thickness from preset
    const lineThickness = maze.preset.lineThickness;
    
    // Draw the maze
    drawMaze(page, maze.grid, {
      offsetX,
      offsetY,
      cellSize,
      lineThickness,
      style,
    });
    
    // Draw start/finish labels
    drawLabels(page, maze.grid, {
      offsetX,
      offsetY,
      cellSize,
      useArrows,
      font,
      boldFont,
    });
    
    // Draw footer
    drawFooter(page, font);
  }
  
  // Save and return PDF bytes
  return await pdfDoc.save();
}

/**
 * Draw the maze grid on a PDF page
 */
function drawMaze(page, grid, options) {
  const { offsetX, offsetY, cellSize, lineThickness, style } = options;
  const cornerRadius = style === 'rounded' ? Math.min(cellSize * 0.15, 4) : 0;
  
  // Draw walls for each cell
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.getCell(row, col);
      const x = offsetX + col * cellSize;
      // PDF y-coordinates are bottom-up, so we flip
      const y = offsetY + (grid.rows - 1 - row) * cellSize;
      
      // Draw each wall if it exists
      if (cell.hasWall(DIRECTIONS.TOP)) {
        drawWall(page, x, y + cellSize, x + cellSize, y + cellSize, lineThickness, cornerRadius);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM)) {
        drawWall(page, x, y, x + cellSize, y, lineThickness, cornerRadius);
      }
      if (cell.hasWall(DIRECTIONS.LEFT)) {
        drawWall(page, x, y, x, y + cellSize, lineThickness, cornerRadius);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT)) {
        drawWall(page, x + cellSize, y, x + cellSize, y + cellSize, lineThickness, cornerRadius);
      }
    }
  }
}

/**
 * Draw a wall line
 */
function drawWall(page, x1, y1, x2, y2, thickness, cornerRadius) {
  // For now, draw simple lines (rounded corners would need more complex path logic)
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(0, 0, 0),
    lineCap: cornerRadius > 0 ? 1 : 0, // 1 = round cap, 0 = butt cap
  });
}

/**
 * Draw start/finish labels
 */
function drawLabels(page, grid, options) {
  const { offsetX, offsetY, cellSize, useArrows, font, boldFont } = options;
  
  // Start position (top-left, entrance is above)
  const startX = offsetX + cellSize / 2;
  const startY = offsetY + (grid.rows - 1) * cellSize + cellSize + 5;
  
  // Finish position (bottom-right, exit is below)
  const finishX = offsetX + (grid.cols - 1) * cellSize + cellSize / 2;
  const finishY = offsetY - 5;
  
  if (useArrows) {
    // Draw arrows for young ages
    drawArrow(page, startX, startY + 15, startX, startY, 8); // Down arrow at start
    drawArrow(page, finishX, finishY, finishX, finishY - 15, 8); // Down arrow at finish
  } else {
    // Draw text labels for older ages
    const fontSize = 10;
    
    // "Start" label above entrance
    const startText = 'Start';
    const startTextWidth = boldFont.widthOfTextAtSize(startText, fontSize);
    page.drawText(startText, {
      x: startX - startTextWidth / 2,
      y: startY + 5,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // "Finish" label below exit
    const finishText = 'Finish';
    const finishTextWidth = boldFont.widthOfTextAtSize(finishText, fontSize);
    page.drawText(finishText, {
      x: finishX - finishTextWidth / 2,
      y: finishY - fontSize - 5,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Draw an arrow
 */
function drawArrow(page, x1, y1, x2, y2, headSize) {
  // Draw the line
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  
  // Calculate arrow head direction
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngle = Math.PI / 6; // 30 degrees
  
  // Arrow head lines
  const head1X = x2 - headSize * Math.cos(angle - headAngle);
  const head1Y = y2 - headSize * Math.sin(angle - headAngle);
  const head2X = x2 - headSize * Math.cos(angle + headAngle);
  const head2Y = y2 - headSize * Math.sin(angle + headAngle);
  
  page.drawLine({
    start: { x: x2, y: y2 },
    end: { x: head1X, y: head1Y },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  
  page.drawLine({
    start: { x: x2, y: y2 },
    end: { x: head2X, y: head2Y },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
}

/**
 * Draw the footer on a page
 */
function drawFooter(page, font) {
  const fontSize = 8;
  const footerY = MARGIN / 2;
  
  // Combined footer text
  const text = `${FOOTER_TEXT} • ${FOOTER_URL}`;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  
  page.drawText(text, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: footerY,
    size: fontSize,
    font,
    color: rgb(0.4, 0.4, 0.4), // Gray
  });
}

/**
 * Download PDF to user's device
 * 
 * @param {Uint8Array} pdfBytes - PDF document bytes
 * @param {string} filename - Download filename
 */
export function downloadPdf(pdfBytes, filename = 'mazes.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Render a single maze and return PDF bytes
 * Convenience function for debugging
 */
export async function renderSingleMaze(maze, style = 'square') {
  return renderMazesToPdf({
    mazes: [maze],
    style,
    ageRange: maze.ageRange,
  });
}
