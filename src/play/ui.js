/**
 * Play mode on the existing page.
 * One maze, freehand marker, no saved stats.
 */

import { generateMaze } from '../maze/generator.js';
import { generateOrganicMaze } from '../maze/organic-generator.js';
import { generatePolarMaze } from '../maze/polarGenerator.js';
import { generateSquaresMaze } from '../maze/rooms-generator.js';
import { getLayoutForMaze } from '../pdf/layout.js';
import { getDrawer, getDrawerKey } from '../pdf/drawers/index.js';
import { createCanvasBackend } from '../pdf/drawers/draw-backend.js';
import { getDifficultyPreset } from '../utils/constants.js';
import { generateSeed } from '../utils/rng.js';
import { SOLVE_PAUSE_MS, clampPlayTolerance } from './tolerance.js';
import {
  addPointer,
  clearPath,
  createPlayState,
  setHintVisible,
  setPlayLayout,
  setTolerance,
} from './session.js';
import { clientToLocal, drawPlayInk } from './view.js';

/**
 * @param {{ getFormValues: Function, noteSeed?: Function, redrawPreview: Function }} options
 */
export function initPlay(options) {
  const { getFormValues, noteSeed, redrawPreview } = options;
  const layoutEl = document.querySelector('.app-layout');
  const canvas = document.getElementById('sample-preview-canvas');
  const stage = document.getElementById('play-stage');
  const label = document.getElementById('preview-label');
  const controls = document.getElementById('play-controls');
  const toleranceInput = document.getElementById('play-tolerance');
  const toleranceOutput = document.getElementById('play-tolerance-display');
  const hintBtn = document.getElementById('play-hint');
  const clearBtn = document.getElementById('play-clear');
  const playStatus = document.getElementById('play-status');
  const celebrate = document.getElementById('play-celebrate');

  const toleranceByLevel = new Map();
  let active = false;
  let state = null;
  let configKey = '';
  let drawing = false;
  let celebrating = false;
  let pauseTimer = 0;
  let failures = 0;

  function toleranceFor(ageRange) {
    if (toleranceByLevel.has(ageRange)) return toleranceByLevel.get(ageRange);
    return getDifficultyPreset(ageRange).playTolerance;
  }

  function syncToleranceControl() {
    const ageRange = getFormValues().ageRange;
    const value = toleranceFor(ageRange);
    toleranceInput.value = String(value);
    toleranceOutput.textContent = value.toFixed(2);
  }

  function setPlayStatus(message, type) {
    playStatus.textContent = message;
    playStatus.classList.remove('error', 'success');
    if (type) playStatus.classList.add(type);
  }

  function currentConfigKey() {
    const values = getFormValues();
    return `${values.ageRange}|${values.mazeStyle}`;
  }

  function layoutOptions() {
    const values = getFormValues();
    const style = values.mazeStyle === 'circular' ? 'classic' : values.mazeStyle;
    const margin = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    return getLayoutForMaze(state.maze, {
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      margin,
      style,
    });
  }

  function fitCanvas() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = rect.width >= 40 ? rect.width : 560;
    const cssHeight = rect.height >= 40 ? rect.height : 720;
    const width = Math.max(2, Math.floor(cssWidth * dpr));
    const height = Math.max(2, Math.floor(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function render() {
    if (!state) return;
    fitCanvas();
    const values = getFormValues();
    const layout = layoutOptions();
    state = setPlayLayout(state, layout);
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, -1, 0, h);
    const drawer = getDrawer(getDrawerKey(state.maze, values.mazeStyle));
    const backend = createCanvasBackend(ctx);
    const ageRange = values.ageRange;
    const useArrows = ageRange === '3' || ageRange === '4-5' || ageRange === '6-8';
    drawer.drawWalls(backend, state.maze, layout);
    drawer.drawLabels(backend, state.maze, layout, { useArrows, canvasHeight: h });
    drawPlayInk(ctx, state);
    ctx.restore();
  }

  function endCelebration() {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = 0;
    }
    celebrating = false;
    if (celebrate) celebrate.hidden = true;
    hintBtn.disabled = false;
    clearBtn.disabled = false;
    toleranceInput.disabled = false;
  }

  function fail(error) {
    failures += 1;
    console.error('Generation failed:', error);
    setPlayStatus(
      failures >= 2
        ? 'Generation failed again. Check the console for details.'
        : 'Generation failed. Please try again.',
      'error'
    );
  }

  function generatePlayMaze(values, seed) {
    if (values.mazeStyle === 'circular') return generatePolarMaze({ ageRange: values.ageRange, seed });
    if (values.mazeStyle === 'squares') return generateSquaresMaze({ ageRange: values.ageRange, seed });
    if (values.mazeStyle === 'jagged' || values.mazeStyle === 'curvy') {
      const maze = generateOrganicMaze({ ageRange: values.ageRange, seed });
      if (values.mazeStyle === 'curvy') maze.organicCurve = 'curvy';
      return maze;
    }
    const preset = getDifficultyPreset(values.ageRange);
    return generateMaze({ ageRange: values.ageRange, seed, algorithm: preset.algorithm });
  }

  function reseed() {
    endCelebration();
    const values = getFormValues();
    syncToleranceControl();
    const seed = generateSeed();
    try {
      const maze = generatePlayMaze(values, seed);
      fitCanvas();
      const style = values.mazeStyle === 'circular' ? 'classic' : values.mazeStyle;
      const margin = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
      const layout = getLayoutForMaze(maze, {
        pageWidth: canvas.width,
        pageHeight: canvas.height,
        margin,
        style,
      });
      state = createPlayState(maze, layout, toleranceFor(values.ageRange));
      configKey = currentConfigKey();
      failures = 0;
      if (noteSeed) noteSeed(seed);
      setPlayStatus('Draw from Start to Finish.');
      render();
    } catch (error) {
      fail(error);
    }
  }

  function maybeSolved() {
    if (!state?.trace.solved || celebrating) return;
    celebrating = true;
    drawing = false;
    hintBtn.disabled = true;
    clearBtn.disabled = true;
    toleranceInput.disabled = true;
    state = setHintVisible(state, false);
    if (celebrate) celebrate.hidden = false;
    setPlayStatus('Solved', 'success');
    render();
    pauseTimer = window.setTimeout(() => {
      pauseTimer = 0;
      celebrating = false;
      reseed();
    }, SOLVE_PAUSE_MS);
  }

  function onPointerDown(event) {
    if (!active || celebrating || !state) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    const local = clientToLocal(canvas, event.clientX, event.clientY, state.view);
    state = addPointer(state, local, 'start');
    render();
    maybeSolved();
  }

  function onPointerMove(event) {
    if (!drawing || !active || celebrating || !state) return;
    const local = clientToLocal(canvas, event.clientX, event.clientY, state.view);
    const stroke = state.strokes[state.strokes.length - 1];
    const prev = stroke && stroke[stroke.length - 1];
    if (prev) {
      const dx = (local.x ?? 0) - (prev.x ?? 0);
      const dy = (local.y ?? 0) - (prev.y ?? 0);
      if (Math.hypot(dx, dy) < state.topology.sampleStep * 0.35) return;
    }
    state = addPointer(state, local, 'move');
    render();
    maybeSolved();
  }

  function onPointerUp(event) {
    if (!drawing) return;
    drawing = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  toleranceInput.addEventListener('input', () => {
    const values = getFormValues();
    const value = clampPlayTolerance(toleranceInput.value);
    toleranceByLevel.set(values.ageRange, value);
    toleranceOutput.textContent = value.toFixed(2);
    if (!active || !state || celebrating) return;
    state = setTolerance(state, value);
    render();
    maybeSolved();
  });

  hintBtn.addEventListener('click', () => {
    if (!active || !state || celebrating) return;
    const show = !state.hintVisible;
    state = setHintVisible(state, show);
    setPlayStatus(show ? 'Hint shows the next two turns.' : 'Draw from Start to Finish.');
    render();
  });

  clearBtn.addEventListener('click', () => {
    if (!active || !state || celebrating) return;
    state = clearPath(state);
    setPlayStatus('Draw from Start to Finish.');
    render();
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => {
    if (active) event.preventDefault();
  });

  const resizeObserver = new ResizeObserver(() => {
    if (!active || !state || celebrating) return;
    render();
  });
  resizeObserver.observe(stage);

  function setMode(mode) {
    active = mode === 'play';
    layoutEl.classList.toggle('mode-play', active);
    controls.hidden = !active;
    canvas.style.touchAction = active ? 'none' : '';
    if (label) label.textContent = active ? 'Draw the path' : 'Sample output';
    canvas.setAttribute(
      'aria-label',
      active ? 'Maze. Draw a path from Start to Finish.' : 'Sample maze preview'
    );
    if (!active) {
      endCelebration();
      drawing = false;
      canvas.width = 560;
      canvas.height = 720;
      redrawPreview();
      return;
    }
    syncToleranceControl();
    if (!state || configKey !== currentConfigKey()) reseed();
    else render();
  }

  syncToleranceControl();

  return {
    isActive() {
      return active;
    },
    setMode,
    onConfigChange() {
      if (!active) return;
      reseed();
    },
  };
}
