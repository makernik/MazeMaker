/**
 * MakerNik Maze Generator - Main Entry
 * 
 * Wires up UI controls and orchestrates maze generation + PDF export.
 */

import { generateMazes } from './maze/generator.js';
import { validateMaze } from './maze/solver.js';
import { renderMazesToPdf, downloadPdf } from './pdf/renderer.js';
import { generateSeed } from './utils/rng.js';

// DOM elements
const ageRangeSelect = document.getElementById('age-range');
const mazeStyleSelect = document.getElementById('maze-style');
const themeSelect = document.getElementById('theme');
const quantitySlider = document.getElementById('quantity');
const quantityDisplay = document.getElementById('quantity-display');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');

/**
 * Get current form values
 */
function getFormValues() {
  return {
    ageRange: ageRangeSelect.value,
    mazeStyle: mazeStyleSelect.value,
    theme: themeSelect.value,
    quantity: parseInt(quantitySlider.value, 10),
  };
}

/**
 * Update status message
 */
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/**
 * Handle quantity slider change
 */
quantitySlider.addEventListener('input', () => {
  quantityDisplay.textContent = quantitySlider.value;
});

/**
 * Generate mazes and create PDF
 */
async function generateAndDownload() {
  const values = getFormValues();
  console.log('Generate clicked with values:', values);
  
  setStatus('Generating mazes...');
  generateBtn.disabled = true;
  
  try {
    // Generate a base seed for this batch
    const baseSeed = generateSeed();
    console.log('Base seed:', baseSeed);
    
    // Generate mazes
    const result = generateMazes({
      ageRange: values.ageRange,
      quantity: values.quantity,
      baseSeed,
    });
    
    console.log(`Generated ${result.mazes.length} mazes`);
    
    // Validate all mazes
    setStatus('Validating mazes...');
    let validCount = 0;
    for (const maze of result.mazes) {
      if (validateMaze(maze.grid)) {
        validCount++;
      } else {
        console.warn('Invalid maze detected, seed:', maze.seed);
      }
    }
    
    if (validCount !== result.mazes.length) {
      throw new Error(`Only ${validCount}/${result.mazes.length} mazes are valid`);
    }
    
    // Render to PDF
    setStatus('Rendering PDF...');
    const pdfBytes = await renderMazesToPdf({
      mazes: result.mazes,
      style: values.mazeStyle,
      ageRange: values.ageRange,
    });
    
    // Download
    const filename = `mazes-${values.ageRange}-${values.quantity}pk.pdf`;
    downloadPdf(pdfBytes, filename);
    
    setStatus(`Downloaded ${values.quantity} maze(s)!`);
    console.log('PDF generated successfully');
    
  } catch (error) {
    console.error('Generation failed:', error);
    setStatus('Generation failed. Please try again.', true);
  } finally {
    generateBtn.disabled = false;
  }
}

/**
 * Handle generate button click
 */
generateBtn.addEventListener('click', generateAndDownload);

// Initialize
console.log('MakerNik Maze Generator loaded');
