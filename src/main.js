/**
 * MakerNik Maze Generator - Main Entry
 * 
 * Wires up UI controls and orchestrates maze generation + PDF export.
 */

import { generateMazes } from './maze/generator.js';
import { validateMaze } from './maze/solver.js';
import { renderMazesToPdf, downloadPdf } from './pdf/renderer.js';
import { getDifficultyPreset } from './utils/constants.js';
import { generateSeed } from './utils/rng.js';

// DOM elements
const form = document.getElementById('maze-form');
const quantitySlider = document.getElementById('quantity');
const quantityDisplay = document.getElementById('quantity-display');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');
const debugPanel = document.getElementById('debug-panel');
const debugSeedEl = document.getElementById('debug-seed');
const debugGridEl = document.getElementById('debug-grid');
const debugCellSizeEl = document.getElementById('debug-cell-size');
const debugLineThicknessEl = document.getElementById('debug-line-thickness');

// Debug mode state (hidden toggle: Ctrl+Shift+D or ?debug=1)
let debugMode = false;

// Consecutive generation failure count (for inline error messaging only)
let consecutiveFailures = 0;

function isDebugMode() {
  return debugMode;
}

function setDebugMode(on) {
  debugMode = !!on;
  debugPanel.hidden = !debugMode;

  if (debugMode) {
    quantitySlider.value = '1';
    quantityDisplay.textContent = '1';
  }

  // Update URL without reload (for sharing debug link)
  const url = new URL(window.location.href);
  if (debugMode) {
    url.searchParams.set('debug', '1');
  } else {
    url.searchParams.delete('debug');
  }
  window.history.replaceState({}, '', url);
}

function initDebugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') {
    setDebugMode(true);
  }
}

// Ctrl+Shift+D toggles debug
document.addEventListener('keydown', (e) => {
  if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
    e.preventDefault();
    setDebugMode(!debugMode);
  }
});

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
 * Update debug panel with last generation info
 */
function updateDebugPanel(mazes, baseSeed) {
  if (!debugMode || !mazes.length) return;
  const maze = mazes[0];
  const preset = maze.preset;

  debugSeedEl.textContent = String(maze.seed);
  if (mazes.length > 1) {
    debugSeedEl.textContent += ` (base: ${baseSeed}, +0…${mazes.length - 1})`;
  }
  debugGridEl.textContent = `${maze.cols} × ${maze.rows}`;
  debugCellSizeEl.textContent = `${preset.cellSize} pt`;
  debugLineThicknessEl.textContent = `${preset.lineThickness} pt`;
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
  generateBtn.setAttribute('aria-busy', 'true');

  try {
    const baseSeed = generateSeed();
    console.log('Base seed:', baseSeed);

    const preset = getDifficultyPreset(values.ageRange);
    const result = generateMazes({
      ageRange: values.ageRange,
      quantity: values.quantity,
      baseSeed,
      algorithm: preset.algorithm,
    });

    console.log(`Generated ${result.mazes.length} mazes`);

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

    setStatus('Rendering PDF...');
    const pdfBytes = await renderMazesToPdf({
      mazes: result.mazes,
      style: values.mazeStyle,
      ageRange: values.ageRange,
      theme: values.theme,
      debugMode: isDebugMode(),
    });

    const filename = `mazes-${values.ageRange}-${values.quantity}pk.pdf`;
    downloadPdf(pdfBytes, filename);

    consecutiveFailures = 0;
    updateDebugPanel(result.mazes, baseSeed);
    setStatus(`Downloaded ${values.quantity} maze${values.quantity > 1 ? 's' : ''}!`, 'success');
    console.log('PDF generated successfully');
  } catch (error) {
    consecutiveFailures += 1;
    console.error('Generation failed:', error);
    if (consecutiveFailures >= 2) {
      setStatus('Generation failed again. Check the console for details.', 'error');
    } else {
      setStatus('Generation failed. Please try again.', 'error');
    }
  } finally {
    generateBtn.disabled = false;
    generateBtn.removeAttribute('aria-busy');
  }
}

form.addEventListener('submit', generateAndDownload);

// Initialize: restore debug from URL
initDebugFromUrl();
console.log('MakerNik Maze Generator loaded');
