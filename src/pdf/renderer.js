/**
 * PDF Renderer
 * 
 * Renders mazes to PDF using pdf-lib with vector paths.
 * Supports square, rounded, and curvy (Bezier) corner styles.
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
 * @param {string} config.style - 'square', 'rounded', or 'organic'
 * @param {string} config.ageRange - Age range for label style
 * @param {string} [config.theme] - 'none', 'shapes', or 'animals' (corner decorations only)
 * @param {boolean} [config.debugMode] - If true, footer shows difficulty/age; solution drawn when showSolution is true
 * @param {boolean} [config.showSolution] - When debugMode, if true draw solver path overlay (prove capabilities)
 * @returns {Promise<Uint8Array>} PDF document as bytes
 */
export async function renderMazesToPdf(config) {
  const { mazes, style = 'square', ageRange = '9-11', theme = 'none', debugMode = false, showSolution = false } = config;
  
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  /** @type {Map<string, import('pdf-lib').PDFImage>} cache of image path -> embedded image */
  const imageEmbedCache = new Map();
  
  // Embed font for text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Render each maze on its own page
  for (const maze of mazes) {
    const mazeAgeRange = maze.ageRange ?? ageRange;
    const useArrows = mazeAgeRange === '3' || mazeAgeRange === '4-5' || mazeAgeRange === '6-8';
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const mazeHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - 20;
    const mazeWidth = PRINTABLE_WIDTH;
    const lineThickness = maze.preset.lineThickness;
    // #region agent log
    const isOrganic = maze.layout === 'organic';
    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renderer.js:loop',message:'maze layout and style',data:{layout:maze.layout,style,hasGrid:!!maze.grid,branchTaken:isOrganic?'organic':'grid',layoutType:typeof maze.layout},timestamp:Date.now(),hypothesisId:'C,D,H4'})}).catch(()=>{});
    // #endregion

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

      drawOrganicMaze(page, maze, { transform, lineThickness, scale });
      if (debugMode && showSolution) {
        const solution = solveMaze(maze);
        if (solution && solution.path.length > 1) {
          drawOrganicSolverOverlay(page, maze, solution.path, { transform });
        }
      }
      drawOrganicLabels(page, maze, { transform, useArrows, font, boldFont });
    } else {
      const cellWidth = mazeWidth / maze.cols;
      const cellHeight = mazeHeight / maze.rows;
      const cellSize = Math.min(cellWidth, cellHeight);
      const actualMazeWidth = cellSize * maze.cols;
      const actualMazeHeight = cellSize * maze.rows;
      const offsetX = MARGIN + (PRINTABLE_WIDTH - actualMazeWidth) / 2;
      const offsetY = PAGE_HEIGHT - MARGIN - actualMazeHeight;

      drawMaze(page, maze.grid, {
        offsetX,
        offsetY,
        cellSize,
        lineThickness,
        style,
      });
      drawLabels(page, maze.grid, {
        offsetX,
        offsetY,
        cellSize,
        useArrows,
        font,
        boldFont,
      });
      if (debugMode && showSolution) {
        const solution = solveMaze(maze);
        if (solution && solution.path.length > 1) {
          drawSolverOverlay(page, maze.grid, solution.path, {
            offsetX,
            offsetY,
            cellSize,
          });
        }
      }
    }

    if (theme === 'shapes' && shapeImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/shapes/', shapeImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    } else if (theme === 'animals' && animalImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/animals/', animalImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    }
    drawFooter(page, font, debugMode ? { label: maze.preset.label, ageRange: maze.ageRange, algorithm: maze.algorithm ?? maze.preset.algorithm } : null);
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
  const effectiveThickness = isRounded ? lineThickness * 2 : lineThickness;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.getCell(row, col);
      const x = offsetX + col * cellSize;
      const y = offsetY + (grid.rows - 1 - row) * cellSize;
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
 * Square style: extend segment by half thickness at each end so butt-capped strokes overlap at corners and close gaps.
 */
function drawWall(page, x1, y1, x2, y2, thickness, isRounded) {
  let startX = x1;
  let startY = y1;
  let endX = x2;
  let endY = y2;
  if (!isRounded) {
    const half = thickness / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    startX = x1 - ux * half;
    startY = y1 - uy * half;
    endX = x2 + ux * half;
    endY = y2 + uy * half;
  }
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness,
    color: rgb(0, 0, 0),
    lineCap: isRounded ? 1 : 0, // 1 = round cap (radius = thickness/2), 0 = butt
  });
}

/**
 * Draw organic maze: for each closed wall, draw the circular arc on the cell boundary
 * (the arc between the two chord endpoints that faces the neighbor). Uses drawSvgPath;
 * pdf-lib flips Y so path coords use (x, -y) for PDF (x, y).
 */
function drawOrganicMaze(page, maze, options) {
  const { transform, lineThickness, scale } = options;
  const { graph } = maze;
  const thickness = lineThickness;

  for (const node of graph.nodes) {
    for (const nid of node.neighbors) {
      if (nid <= node.id) continue;
      if (!graph.hasWall(node.id, nid)) continue;
      const other = graph.getNode(nid);
      if (!other) continue;
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const ux = dx / d;
      const uy = dy / d;
      const tx = node.x + ux * node.r;
      const ty = node.y + uy * node.r;
      const halfLen = Math.min(node.r, other.r) * 0.85;
      const px = -uy * halfLen;
      const py = ux * halfLen;
      const q1 = transform(tx - px, ty - py);
      const q2 = transform(tx + px, ty + py);
      const qMid = transform(tx, ty);
      const cx = transform(node.x, node.y).x;
      const cy = transform(node.x, node.y).y;
      const r = node.r * scale;
      const a1 = Math.atan2(q1.y - cy, q1.x - cx);
      const a2 = Math.atan2(q2.y - cy, q2.x - cx);
      const aMid = Math.atan2(qMid.y - cy, qMid.x - cx);
      const twoPi = 2 * Math.PI;
      const dCCW = ((a2 - a1) % twoPi + twoPi) % twoPi;
      const dMid = ((aMid - a1) % twoPi + twoPi) % twoPi;
      const useCCW = dMid > 1e-6 && dMid < dCCW - 1e-6;
      const largeArc = useCCW ? (dCCW > Math.PI ? 1 : 0) : (twoPi - dCCW > Math.PI ? 1 : 0);
      const sweep = useCCW ? 1 : 0;
      const svgPath = `M ${q1.x} ${-q1.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${q2.x} ${-q2.y}`;
      page.drawSvgPath(svgPath, {
        borderColor: rgb(0, 0, 0),
        borderWidth: thickness,
        borderLineCap: 1,
      });
    }
  }
}

/**
 * Draw start/finish labels for organic maze (at node positions).
 */
function drawOrganicLabels(page, maze, options) {
  const { transform, useArrows, font, boldFont } = options;
  const startPos = maze.nodePositions.get(maze.startId);
  const finishPos = maze.nodePositions.get(maze.finishId);
  if (!startPos || !finishPos) return;
  const startX = transform(startPos.x, startPos.y).x;
  const startY = transform(startPos.x, startPos.y).y;
  const finishX = transform(finishPos.x, finishPos.y).x;
  const finishY = transform(finishPos.x, finishPos.y).y;

  if (useArrows) {
    drawArrow(page, startX, startY + 15, startX, startY, 8);
    // Finish: arrow from below pointing up into the cell so the head is visible at path end
    drawArrow(page, finishX, finishY - 15, finishX, finishY, 8);
  } else {
    const fontSize = 10;
    const startText = 'Start';
    const startTextWidth = boldFont.widthOfTextAtSize(startText, fontSize);
    page.drawText(startText, {
      x: startX - startTextWidth / 2,
      y: startY + 5,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
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
 * Draw solver path overlay for organic maze (path = list of node ids).
 * Smooth curve through nodes using quadratic Bezier (control at each interior node).
 * pdf-lib drawSvgPath flips Y, so path coords use (x, -y) for PDF (x, y).
 */
function drawOrganicSolverOverlay(page, maze, path, options) {
  const { transform } = options;
  const points = [];
  for (let i = 0; i < path.length; i++) {
    const pos = maze.nodePositions.get(path[i]);
    if (!pos) return;
    points.push(transform(pos.x, pos.y));
  }
  if (points.length < 2) return;
  if (points.length === 2) {
    page.drawLine({
      start: points[0],
      end: points[1],
      thickness: 1.5,
      color: rgb(0.4, 0.4, 0.4),
      opacity: 0.7,
      dashArray: [4, 4],
    });
    return;
  }
  const toSvg = (p) => `${p.x} ${-p.y}`;
  const parts = [`M ${toSvg(points[0])}`];
  for (let i = 1; i < points.length - 1; i++) {
    parts.push(`Q ${toSvg(points[i])} ${toSvg(points[i + 1])}`);
  }
  const svgPath = parts.join(' ');
  page.drawSvgPath(svgPath, {
    x: 0,
    y: 0,
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1.5,
    borderDashArray: [4, 4],
    opacity: 0.7,
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
 * Format algorithm id for footer display
 * @param {string} [algorithmId]
 * @returns {string}
 */
function formatAlgorithmLabel(algorithmId) {
  if (algorithmId === 'prim') return 'Prim';
  if (algorithmId === 'recursive-backtracker') return 'Recursive backtracker';
  if (algorithmId === 'kruskal') return 'Kruskal';
  return algorithmId || 'Prim';
}

/**
 * Draw the footer on a page.
 * @param {PDFPage} page
 * @param {PDFFont} font
 * @param {{ label: string, ageRange: string, algorithm?: string } | null} debugInfo - When set (debug mode), append difficulty, age range, algorithm to footer
 */
function drawFooter(page, font, debugInfo = null) {
  const fontSize = 8;
  const footerY = MARGIN / 2;

  let text = `${FOOTER_TEXT} • ${FOOTER_URL}`;
  if (debugInfo) {
    text += ` • ${debugInfo.label} • ${debugInfo.ageRange} • ${formatAlgorithmLabel(debugInfo.algorithm)}`;
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
