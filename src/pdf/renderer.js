/**
 * PDF Renderer
 * 
 * Renders mazes to PDF using pdf-lib with vector paths.
 * Supports square and rounded corner styles.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DIRECTIONS } from '../maze/grid.js';
import { solveMaze } from '../maze/solver.js';
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
import { shapeImageFiles } from '../themes/shapes.js';
import { animalImageFiles } from '../themes/animals.js';

const DECOR_INSET = 28;
const DECOR_SIZE = 12;

/** Base URL for theme images (same-origin in browser; empty in Node so fetch may skip) */
function getThemesBase() {
  if (typeof window !== 'undefined' && window.location) return window.location.origin;
  return '';
}

/**
 * Render mazes to a PDF document
 * 
 * @param {object} config - Rendering configuration
 * @param {object[]} config.mazes - Array of maze objects from generator
 * @param {string} config.style - 'square' or 'rounded'
 * @param {string} config.ageRange - Age range for label style
 * @param {string} [config.theme] - 'none', 'shapes', or 'animals' (corner decorations only)
 * @param {boolean} [config.debugMode] - If true, footer shows difficulty/age; solution drawn when showSolution is true
 * @param {boolean} [config.showSolution] - When debugMode, if true draw solver path overlay (prove capabilities)
 * @returns {Promise<Uint8Array>} PDF document as bytes
 */
export async function renderMazesToPdf(config) {
  const { mazes, style = 'square', ageRange = '9-13', theme = 'none', debugMode = false, showSolution = false } = config;
  
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  /** @type {Map<string, import('pdf-lib').PDFImage>} cache of image path -> embedded image */
  const imageEmbedCache = new Map();
  
  // Embed font for text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Render each maze on its own page
  for (const maze of mazes) {
    // Per-maze age range for label style (arrows vs text); fallback to config when all mazes share one range
    const mazeAgeRange = maze.ageRange ?? ageRange;
    const useArrows = mazeAgeRange === '3-5' || mazeAgeRange === '6-8';
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

    // Debug: draw solver path overlay when requested (prove capabilities; uncheck to test difficulty)
    if (debugMode && showSolution) {
      const solution = solveMaze(maze.grid);
      if (solution && solution.path.length > 1) {
        drawSolverOverlay(page, maze.grid, solution.path, {
          offsetX,
          offsetY,
          cellSize,
        });
      }
    }

    // Theme decorations: image-based, in margin corners only (never inside maze area)
    if (theme === 'shapes' && shapeImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/shapes/', shapeImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    } else if (theme === 'animals' && animalImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/animals/', animalImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    }

    // Draw footer (include difficulty + age range in debug mode)
    drawFooter(page, font, debugMode ? { label: maze.preset.label, ageRange: maze.ageRange } : null);
  }
  
  // Save and return PDF bytes
  return await pdfDoc.save();
}

/**
 * Draw the maze grid on a PDF page
 */
function drawMaze(page, grid, options) {
  const { offsetX, offsetY, cellSize, lineThickness, style } = options;
  const isRounded = style === 'rounded';
  // Rounded: use 2x thickness so round line caps are visible at corners (cap radius = half thickness)
  const effectiveThickness = isRounded ? Math.max(lineThickness * 2, 6) : lineThickness;
  
  // Draw walls for each cell
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.getCell(row, col);
      const x = offsetX + col * cellSize;
      // PDF y-coordinates are bottom-up, so we flip
      const y = offsetY + (grid.rows - 1 - row) * cellSize;
      
      // Draw each wall if it exists
      if (cell.hasWall(DIRECTIONS.TOP)) {
        drawWall(page, x, y + cellSize, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.BOTTOM)) {
        drawWall(page, x, y, x + cellSize, y, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.LEFT)) {
        drawWall(page, x, y, x, y + cellSize, effectiveThickness, isRounded);
      }
      if (cell.hasWall(DIRECTIONS.RIGHT)) {
        drawWall(page, x + cellSize, y, x + cellSize, y + cellSize, effectiveThickness, isRounded);
      }
    }
  }
}

/**
 * Draw a wall line.
 * Rounded style uses round line caps so segment ends (and corners where two walls meet) appear rounded.
 */
function drawWall(page, x1, y1, x2, y2, thickness, isRounded) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(0, 0, 0),
    lineCap: isRounded ? 1 : 0, // 1 = round cap (radius = thickness/2), 0 = butt
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
 * Draw solver path overlay (debug only). Path through cell centers, dashed gray line.
 */
function drawSolverOverlay(page, grid, path, options) {
  const { offsetX, offsetY, cellSize } = options;
  const rows = grid.rows;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    // Cell center in PDF coords (y flipped)
    const x1 = offsetX + (prev.col + 0.5) * cellSize;
    const y1 = offsetY + (rows - 1 - prev.row + 0.5) * cellSize;
    const x2 = offsetX + (curr.col + 0.5) * cellSize;
    const y2 = offsetY + (rows - 1 - curr.row + 0.5) * cellSize;

    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1.5,
      color: rgb(0.4, 0.4, 0.4),
      opacity: 0.7,
      dashArray: [4, 4],
    });
  }
}

/**
 * Draw one image in each corner, strictly outside maze boundaries.
 * Top two: in the top margin strip. Bottom two: in strip below maze.
 * Images are fetched from base + subPath + file; missing images are skipped (no throw).
 * @param {import('pdf-lib').PDFPage} page
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {string} base - Origin (e.g. window.location.origin) or '' for Node
 * @param {string} subPath - e.g. '/themes/shapes/' or '/themes/animals/'
 * @param {string[]} imageFiles - Filenames in order (one per corner, rotated)
 * @param {Map<string, import('pdf-lib').PDFImage>} cache - Reuse embeds across pages
 * @param {number} inset - Distance from page edge to decoration center
 * @param {number} maxSize - Max width/height in points
 */
async function drawCornerImageDecorations(page, pdfDoc, base, subPath, imageFiles, cache, inset, maxSize) {
  const topY = PAGE_HEIGHT - MARGIN / 2;
  const bottomY = MARGIN + maxSize;
  const corners = [
    { x: MARGIN + inset, y: topY },
    { x: PAGE_WIDTH - MARGIN - inset, y: topY },
    { x: MARGIN + inset, y: bottomY },
    { x: PAGE_WIDTH - MARGIN - inset, y: bottomY },
  ];
  for (let i = 0; i < corners.length; i++) {
    const file = imageFiles[i % imageFiles.length];
    const path = base + subPath + file;
    let image = cache.get(path);
    if (!image) {
      const bytes = await fetchThemeImage(path);
      if (!bytes) continue;
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        try {
          image = await pdfDoc.embedJpg(bytes);
        } catch {
          continue;
        }
      }
      cache.set(path, image);
    }
    const corner = corners[i];
    const w = image.width;
    const h = image.height;
    const scale = Math.min(maxSize / w, maxSize / h, 1);
    const drawW = w * scale;
    const drawH = h * scale;
    page.drawImage(image, {
      x: corner.x - drawW / 2,
      y: corner.y - drawH / 2,
      width: drawW,
      height: drawH,
    });
  }
}

/**
 * Fetch theme image bytes (same-origin). Returns null on failure (caller skips drawing).
 * @param {string} url - Full URL or path
 * @returns {Promise<Uint8Array | null>}
 */
async function fetchThemeImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Draw the footer on a page.
 * @param {PDFPage} page
 * @param {PDFFont} font
 * @param {{ label: string, ageRange: string } | null} debugInfo - When set (debug mode), append difficulty label and age range to footer
 */
function drawFooter(page, font, debugInfo = null) {
  const fontSize = 8;
  const footerY = MARGIN / 2;

  let text = `${FOOTER_TEXT} • ${FOOTER_URL}`;
  if (debugInfo) {
    text += ` • ${debugInfo.label} • ${debugInfo.ageRange}`;
  }
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
