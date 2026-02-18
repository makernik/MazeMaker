/**
 * MakerNik Maze Generator - Main Entry
 * 
 * Wires up UI controls and orchestrates maze generation + PDF export.
 */

import { generateMaze, generateMazes } from './maze/generator.js';
import { generateOrganicMaze } from './maze/organic-generator.js';
import { validateMaze } from './maze/solver.js';
import { renderMazesToPdf, downloadPdf } from './pdf/renderer.js';
import { getLayoutForMaze } from './pdf/layout.js';
import { getCanvasDrawer } from './pdf/drawers/index.js';
import { getDifficultyPreset, DIFFICULTY_PRESETS, ALGORITHM_IDS, OLDER_AGE_RANGES_FOR_RANDOMIZER } from './utils/constants.js';
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
const debugOneOfEachCheckbox = document.getElementById('debug-one-of-each');
const debugShowSolutionCheckbox = document.getElementById('debug-show-solution');
const debugPreviewSeedInput = document.getElementById('debug-preview-seed');
const samplePreviewCanvas = document.getElementById('sample-preview-canvas');

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
    const values = getFormValues();
    if (debugPreviewSeedInput) {
      debugPreviewSeedInput.value = String(getPreviewSeed(values));
    }
    updatePreviewCanvas();
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
 * Get current form values from radio buttons and slider.
 * Reads checked radios explicitly so preview always reflects current selection.
 */
function getFormValues() {
  const ageRangeEl = form && form.querySelector('input[name="age-range"]:checked');
  const mazeStyleEl = form && form.querySelector('input[name="maze-style"]:checked');
  const themeEl = form && form.querySelector('input[name="theme"]:checked');
  const quantityEl = form && form.querySelector('#quantity');
  return {
    ageRange: ageRangeEl ? ageRangeEl.value : null,
    mazeStyle: mazeStyleEl ? mazeStyleEl.value : null,
    theme: themeEl ? themeEl.value : null,
    quantity: quantityEl ? parseInt(quantityEl.value, 10) : 1,
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
  if (maze.layout === 'organic') {
    debugGridEl.textContent = `organic, ${maze.graph.nodes.length} cells`;
  } else {
    debugGridEl.textContent = `${maze.cols} × ${maze.rows}`;
  }
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

/** Deterministic preview seed per level + style (no debug). */
function previewSeedFor(ageRange, mazeStyle) {
  let h = 0;
  const s = (ageRange || '') + '-' + (mazeStyle || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h) || 1;
}

/**
 * Seed used for preview: in debug mode use value from input if valid number; else deterministic per level+style.
 * @param {{ ageRange: string, mazeStyle: string }} [values] - Form values (defaults to getFormValues())
 */
function getPreviewSeed(values) {
  values = values ?? getFormValues();
  if (debugMode && debugPreviewSeedInput) {
    const n = parseInt(debugPreviewSeedInput.value.trim(), 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return previewSeedFor(values.ageRange, values.mazeStyle);
}

/**
 * Generate one maze for current form (and debug seed if set), draw to preview canvas.
 * Uses same layout transform as PDF (getLayoutForMaze with preview viewport size).
 */
function updatePreviewCanvas() {
  if (!samplePreviewCanvas) return;
  const values = getFormValues();
  const seed = getPreviewSeed(values);
  if (debugMode && debugPreviewSeedInput) {
    debugPreviewSeedInput.value = String(seed);
  }
  const isOrganic = values.mazeStyle === 'organic';
  const layoutType = isOrganic ? 'organic' : 'grid';
  const style = values.mazeStyle;
  const ageRange = values.ageRange;

  let maze;
  try {
    if (isOrganic) {
      maze = generateOrganicMaze({ ageRange, seed });
    } else {
      const preset = getDifficultyPreset(ageRange);
      maze = generateMaze({ ageRange, seed, algorithm: preset.algorithm });
    }
  } catch (e) {
    if (debugMode) console.warn('[preview] generation failed:', e);
    return;
  }

  const w = samplePreviewCanvas.width;
  const h = samplePreviewCanvas.height;
  const PREVIEW_MARGIN = 32;
  const layoutResult = getLayoutForMaze(maze, {
    pageWidth: w,
    pageHeight: h,
    margin: PREVIEW_MARGIN,
    style,
  });

  const ctx = samplePreviewCanvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, -1, 0, h);
  ctx.clearRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, -1, 0, h);

  const canvasDrawer = getCanvasDrawer(layoutResult.layoutType);
  const useArrows = ageRange === '3' || ageRange === '4-5' || ageRange === '6-8';
  canvasDrawer.drawWalls(ctx, maze, layoutResult);
  canvasDrawer.drawLabels(ctx, maze, layoutResult, { useArrows, canvasHeight: h });

  if (debugMode) {
    drawPreviewDebugOverlay(ctx, maze, layoutResult, h);
  }
  ctx.restore();
}

/**
 * Debug overlay on preview canvas: node IDs, neighbor counts, start/finish (organic).
 * Draw in screen space (y-down) so text and circles are right-side up.
 */
function drawPreviewDebugOverlay(ctx, maze, layoutResult, canvasHeight) {
  if (maze.layout === 'organic' && maze.graph && layoutResult.transform) {
    const { transform } = layoutResult;
    const toScreen = (x, y) => {
      const p = transform(x, y);
      return { x: p.x, y: canvasHeight - p.y };
    };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    for (const node of maze.graph.nodes) {
      const s = toScreen(node.x, node.y);
      ctx.fillText(String(node.id), s.x - 4, s.y + 4);
      ctx.fillText(`n:${node.neighbors.length}`, s.x - 6, s.y - 6);
    }
    const startPos = maze.nodePositions.get(maze.startId);
    const finishPos = maze.nodePositions.get(maze.finishId);
    if (startPos) {
      const s = toScreen(startPos.x, startPos.y);
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText('S', s.x - 3, s.y + 4);
    }
    if (finishPos) {
      const s = toScreen(finishPos.x, finishPos.y);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('F', s.x - 3, s.y + 4);
    }
    ctx.restore();
  }
}

/**
 * Handle quantity slider change
 */
quantitySlider.addEventListener('input', () => {
  quantityDisplay.textContent = quantitySlider.value;
});

/**
 * Sample preview: update when level or maze style changes
 */
form.addEventListener('change', (e) => {
  if (e.target.name === 'age-range' || e.target.name === 'maze-style') {
    updatePreviewCanvas();
  }
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:generateAndDownload',message:'form values',data:{mazeStyle:values.mazeStyle,ageRange:values.ageRange,quantity:values.quantity},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    let result;
    let styleForPdf = values.mazeStyle;
    let filename;
    const oneOfEach = debugMode && debugOneOfEachCheckbox && debugOneOfEachCheckbox.checked;

    if (oneOfEach) {
      const ageRangeKeys = Object.keys(DIFFICULTY_PRESETS);
      const mazes = [];
      if (values.mazeStyle === 'organic') {
        for (let l = 0; l < ageRangeKeys.length; l++) {
          mazes.push(generateOrganicMaze({
            ageRange: ageRangeKeys[l],
            seed: baseSeed + l,
          }));
        }
        styleForPdf = 'organic';
      } else {
        for (let a = 0; a < ALGORITHM_IDS.length; a++) {
          for (let l = 0; l < ageRangeKeys.length; l++) {
            const ageRange = ageRangeKeys[l];
            const maze = generateMaze({
              ageRange,
              seed: baseSeed + a * 100 + l,
              algorithm: ALGORITHM_IDS[a],
            });
            mazes.push(maze);
          }
        }
        styleForPdf = values.mazeStyle;
      }
      result = { mazes, baseSeed, ageRange: null, quantity: mazes.length };
      filename = `mazes-one-of-each-${values.mazeStyle}.pdf`;
    } else if (values.mazeStyle === 'organic') {
      const mazes = [];
      for (let i = 0; i < values.quantity; i++) {
        mazes.push(generateOrganicMaze({
          ageRange: values.ageRange,
          seed: baseSeed + i,
        }));
      }
      result = { mazes, baseSeed, ageRange: values.ageRange, quantity: mazes.length };
      styleForPdf = 'organic';
      filename = `mazes-organic-${values.ageRange}-${mazes.length}pk.pdf`;
      fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:branch',message:'branch taken',data:{branch:'organic'},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    } else {
      const preset = getDifficultyPreset(values.ageRange);
      result = generateMazes({
        ageRange: values.ageRange,
        quantity: values.quantity,
        baseSeed,
        algorithm: preset.algorithm,
        useAlgorithmRandomizerForOlderAges: OLDER_AGE_RANGES_FOR_RANDOMIZER.includes(values.ageRange),
      });
      filename = `mazes-${values.ageRange}-${result.mazes.length}pk.pdf`;
      fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:branch',message:'branch taken',data:{branch:'grid',mazeStyle:values.mazeStyle},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    }

    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:afterGen',message:'first maze layout',data:{layout:result.mazes[0].layout,styleForPdf},timestamp:Date.now(),hypothesisId:'C,E'})}).catch(()=>{});
    console.log(`Generated ${result.mazes.length} mazes`);

    setStatus('Validating mazes...');
    let validCount = 0;
    for (const maze of result.mazes) {
      if (validateMaze(maze)) {
        validCount++;
      } else {
        console.warn('Invalid maze detected, seed:', maze.seed);
      }
    }

    if (validCount !== result.mazes.length) {
      throw new Error(`Only ${validCount}/${result.mazes.length} mazes are valid`);
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:phase',message:'validation complete',data:{phase:'validationComplete'},timestamp:Date.now(),hypothesisId:'err1'})}).catch(()=>{});
    // #endregion

    setStatus('Rendering PDF...');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:phase',message:'render start',data:{phase:'renderStart'},timestamp:Date.now(),hypothesisId:'err2'})}).catch(()=>{});
    // #endregion
    const pdfBytes = await renderMazesToPdf({
      mazes: result.mazes,
      style: styleForPdf,
      ageRange: oneOfEach ? undefined : values.ageRange,
      theme: values.theme,
      debugMode: isDebugMode(),
      showSolution: debugMode && debugShowSolutionCheckbox ? debugShowSolutionCheckbox.checked : false,
    });

    downloadPdf(pdfBytes, filename);

    consecutiveFailures = 0;
    updateDebugPanel(result.mazes, baseSeed);
    setStatus(`Downloaded ${result.mazes.length} maze${result.mazes.length > 1 ? 's' : ''}!`, 'success');
    console.log('PDF generated successfully');
  } catch (error) {
    consecutiveFailures += 1;
    console.error('Generation failed:', error);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cdec83e-66f5-42f4-a73d-7ae225be8ab2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:catch',message:'generation failed',data:{errorMessage:String(error&&error.message),errorName:error&&error.name,stack:(error&&error.stack||'').slice(0,600)},timestamp:Date.now(),hypothesisId:'err0'})}).catch(()=>{});
    // #endregion
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

// Initialize: restore debug from URL, then live preview
initDebugFromUrl();
updatePreviewCanvas();
console.log('MakerNik Maze Generator loaded');
