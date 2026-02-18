/**
 * PDF Renderer
 * 
 * Renders mazes to PDF using pdf-lib with vector paths.
 * Supports square, classic (rounded corners), and organic styles.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
  getLayoutForMaze,
} from './layout.js';
import { getDrawer } from './drawers/index.js';
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
 * @param {string} config.style - 'square', 'classic', or 'organic'
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
  const mazeHeight = PRINTABLE_HEIGHT - FOOTER_HEIGHT - 20;
  const mazeWidth = PRINTABLE_WIDTH;

  for (const maze of mazes) {
    const mazeAgeRange = maze.ageRange ?? ageRange;
    const useArrows = mazeAgeRange === '3' || mazeAgeRange === '4-5' || mazeAgeRange === '6-8';
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const layoutResult = getLayoutForMaze(maze, { mazeWidth, mazeHeight, style });

    const drawer = getDrawer(layoutResult.layoutType);
    const organicStats = drawer.drawWalls(page, maze, layoutResult);
    drawer.drawLabels(page, maze, layoutResult, { useArrows, font, boldFont });
    if (debugMode && showSolution) {
      const solution = solveMaze(maze);
      if (solution && solution.path.length > 1) {
        drawer.drawSolutionOverlay(page, maze, solution.path, layoutResult);
      }
    }

    if (theme === 'shapes' && shapeImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/shapes/', shapeImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    } else if (theme === 'animals' && animalImageFiles.length > 0) {
      await drawCornerImageDecorations(page, pdfDoc, getThemesBase(), '/themes/animals/', animalImageFiles, imageEmbedCache, DECOR_INSET, DECOR_SIZE);
    }
    drawFooter(page, font, debugMode ? {
      label: maze.preset.label,
      ageRange: maze.ageRange,
      algorithm: maze.algorithm ?? maze.preset.algorithm,
      seed: maze.seed,
      style: maze.layout === 'organic' ? 'organic' : style,
      nodeCount: maze.layout === 'organic' ? maze.graph.nodes.length : undefined,
      connectedCount: maze.layout === 'organic' ? maze.connectedCount : undefined,
      corridorWidth: organicStats?.corridorWidth,
      avgDist: organicStats?.avgDist,
    } : null);
  }
  
  // Save and return PDF bytes
  return await pdfDoc.save();
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
 * @param {object|null} debugInfo - When set (debug mode), append diagnostic fields to footer
 */
function drawFooter(page, font, debugInfo = null) {
  const fontSize = 8;
  const footerY = MARGIN / 2;

  let text = `${FOOTER_TEXT} • ${FOOTER_URL}`;
  if (debugInfo) {
    text += ` • ${debugInfo.label} • ${debugInfo.ageRange} • ${formatAlgorithmLabel(debugInfo.algorithm)}`;
    text += ` • ${debugInfo.style}`;
    if (debugInfo.seed != null) text += ` • seed:${debugInfo.seed}`;
    if (debugInfo.nodeCount != null) {
      text += ` • nodes:${debugInfo.connectedCount ?? '?'}/${debugInfo.nodeCount}`;
    }
    if (debugInfo.corridorWidth != null) text += ` • cw:${debugInfo.corridorWidth.toFixed(1)}`;
    if (debugInfo.avgDist != null) text += ` • avg:${debugInfo.avgDist.toFixed(1)}`;
  }
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  page.drawText(text, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: footerY,
    size: fontSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
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
