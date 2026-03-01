/**
 * Draw-rooms (Squares) smoke test: drawWalls on canvas backend without throwing.
 */

import { describe, it, expect } from 'vitest';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import { getLayoutForMaze } from '../src/pdf/layout.js';
import { getDrawer } from '../src/pdf/drawers/index.js';
import { createCanvasBackend, createPdfBackend } from '../src/pdf/drawers/draw-backend.js';
import * as squaresDrawer from '../src/pdf/drawers/draw-rooms.js';

describe('draw-rooms (Squares)', () => {
  it('drawWalls on canvas backend does not throw', () => {
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 9000 });
    const layoutResult = getLayoutForMaze(maze, { style: 'squares' });
    const canvas = typeof document !== 'undefined' && document.createElement('canvas');
    if (!canvas) {
      // Node without DOM: skip canvas test (smoke still validated via PDF in pdf.test)
      return;
    }
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const backend = createCanvasBackend(ctx);
    expect(() => {
      squaresDrawer.drawWalls(backend, maze, layoutResult);
    }).not.toThrow();
  });

  it('drawWalls on PDF backend does not throw (full smoke)', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const maze = generateSquaresMaze({ ageRange: '4-5', seed: 9001 });
    const layoutResult = getLayoutForMaze(maze, { style: 'squares' });
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const backend = createPdfBackend(page, { font, boldFont });
    const drawer = getDrawer('squares');
    expect(() => {
      drawer.drawWalls(backend, maze, layoutResult);
    }).not.toThrow();
  });
});
