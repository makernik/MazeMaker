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
const form = document.getElementById('maze-form');
const quantitySlider = document.getElementById('quantity');
const quantityDisplay = document.getElementById('quantity-display');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');

/**
 * Get current form values from radio buttons and slider
 */
function getFormValues() {
  const formData = new FormData(form);
  return {
    ageRange: formData.get('age-range'),
    mazeStyle: formData.get('maze-style'),
    theme: formData.get('theme'),
    quantity: parseInt(formData.get('quantity'), 10),
  };
}

/**
 * Update status message
 */
function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.classList.remove('error', 'success');
  if (type === 'error') {
    statusEl.classList.add('error');
  } else if (type === 'success') {
    statusEl.classList.add('success');
  }
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
async function generateAndDownload(event) {
  event.preventDefault();
  
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
    
    setStatus(`Downloaded ${values.quantity} maze${values.quantity > 1 ? 's' : ''}!`, 'success');
    console.log('PDF generated successfully');
    
  } catch (error) {
    console.error('Generation failed:', error);
    setStatus('Generation failed. Please try again.', 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

/**
 * Handle form submission
 */
form.addEventListener('submit', generateAndDownload);

// Initialize
console.log('MakerNik Maze Generator loaded');
