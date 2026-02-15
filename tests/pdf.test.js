/**
 * PDF Renderer Tests
 * 
 * Tests for PDF generation without errors.
 */

import { describe, it, expect } from 'vitest';
import { renderMazesToPdf, renderSingleMaze } from '../src/pdf/renderer.js';
import { generateMaze, generateMazes } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';

describe('PDF Renderer', () => {
  it('generates a valid PDF document', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 12345 });
    const pdfBytes = await renderSingleMaze(maze, 'square');
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(0);
    
    // Check PDF magic bytes (%PDF-)
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
  
  it('generates PDF with multiple pages', async () => {
    const result = generateMazes({ ageRange: '9-11', quantity: 3, baseSeed: 5000 });
    const pdfBytes = await renderMazesToPdf({
      mazes: result.mazes,
      style: 'square',
      ageRange: '9-11',
    });
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    // Multi-page PDFs are significantly larger
    expect(pdfBytes.length).toBeGreaterThan(2000);
  });
  
  it('renders maze with square style', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 11111 });
    const pdfBytes = await renderSingleMaze(maze, 'square');
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000); // Should have content
  });
  
  it('renders maze with rounded style', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 22222 });
    const pdfBytes = await renderSingleMaze(maze, 'rounded');
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });
  
  it('handles young age range (arrows)', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 33333 });
    const pdfBytes = await renderMazesToPdf({
      mazes: [maze],
      style: 'square',
      ageRange: '4-5',
    });
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });
  
  it('handles older age range (text labels)', async () => {
    const maze = generateMaze({ ageRange: '9-11', seed: 44444 });
    const pdfBytes = await renderMazesToPdf({
      mazes: [maze],
      style: 'square',
      ageRange: '9-11',
    });
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    // PDF with text labels should have font embedded (larger file)
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });
  
  it('generates PDF with footer', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 55555 });
    const pdfBytes = await renderSingleMaze(maze);
    
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    // PDF with footer text should include font data
    expect(pdfBytes.length).toBeGreaterThan(500);
  });
  
  it('produces deterministic output for same maze', async () => {
    const maze1 = generateMaze({ ageRange: '4-5', seed: 66666 });
    const maze2 = generateMaze({ ageRange: '4-5', seed: 66666 });
    
    const pdf1 = await renderSingleMaze(maze1, 'square');
    const pdf2 = await renderSingleMaze(maze2, 'square');
    
    // PDFs should be identical
    expect(pdf1.length).toBe(pdf2.length);
    expect(Array.from(pdf1)).toEqual(Array.from(pdf2));
  });

  it('renders organic maze', async () => {
    const maze = generateOrganicMaze({ ageRange: '4-5', seed: 88880 });
    const pdfBytes = await renderSingleMaze(maze, 'square');
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces deterministic PDF for same organic maze', async () => {
    const maze1 = generateOrganicMaze({ ageRange: '4-5', seed: 88881 });
    const maze2 = generateOrganicMaze({ ageRange: '4-5', seed: 88881 });
    const pdf1 = await renderSingleMaze(maze1, 'square');
    const pdf2 = await renderSingleMaze(maze2, 'square');
    expect(pdf1.length).toBe(pdf2.length);
    expect(Array.from(pdf1)).toEqual(Array.from(pdf2));
  });
  
  it('generates different PDFs for different mazes', async () => {
    const maze1 = generateMaze({ ageRange: '4-5', seed: 77777 });
    const maze2 = generateMaze({ ageRange: '4-5', seed: 88888 });
    
    const pdf1 = await renderSingleMaze(maze1, 'square');
    const pdf2 = await renderSingleMaze(maze2, 'square');
    
    // PDFs should be different (at least in some bytes)
    expect(Array.from(pdf1)).not.toEqual(Array.from(pdf2));
  });
  
  it('renders with shapes theme (corner decorations)', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 99990 });
    const pdfBytes = await renderMazesToPdf({
      mazes: [maze],
      style: 'square',
      ageRange: '4-5',
      theme: 'shapes',
    });
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  it('renders with animals theme (corner decorations)', async () => {
    const maze = generateMaze({ ageRange: '4-5', seed: 99991 });
    const pdfBytes = await renderMazesToPdf({
      mazes: [maze],
      style: 'square',
      ageRange: '4-5',
      theme: 'animals',
    });
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  it('generates larger PDF for harder difficulty', async () => {
    const easyMaze = generateMaze({ ageRange: '4-5', seed: 99999 });
    const hardMaze = generateMaze({ ageRange: '9-11', seed: 99999 });
    
    const easyPdf = await renderSingleMaze(easyMaze, 'square');
    const hardPdf = await renderSingleMaze(hardMaze, 'square');
    
    // Harder maze has more cells = more lines = larger PDF
    expect(hardPdf.length).toBeGreaterThan(easyPdf.length);
  });
});
