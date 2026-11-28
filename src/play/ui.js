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
import { playConfigKey, playSessionPlan } from './config.js';
import { SOLVE_PAUSE_MS, clampPlayTolerance } from './tolerance.js';
import {
  addPointer,
  clearPath,
  createPlayState,
  setHintVisible,
  setPlayLayout,
  setTolerance,
} from './session.js';
import { fitPlayCanvas } from './fit.js';
import { clientToLocal, drawPlayInk, isNearPlayCanvas, pointInRect } from './view.js';

/**
 * @param {{ getFormValues: Function, noteSeed?: Function, redrawPreview: Function }} options
 */
export function initPlay(options) {
  const { getFormValues, noteSeed, redrawPreview } = options;
  const layoutEl = document.querySelector('.app-layout');
  const canvas = document.getElementById('sample-preview-canvas');
  const stage = document.getElementById('play-stage');
  const surface = document.querySelector('.sample-preview');
  const narrowQuery = window.matchMedia('(max-width: 768px)');
  const label = document.getElementById('preview-label');
  const controls = document.getElementById('play-controls');
  const toleranceInput = document.getElementById('play-tolerance');
  const toleranceOutput = document.getElementById('play-tolerance-display');
  const hintBtn = document.getElementById('play-hint');
  const clearBtn = document.getElementById('play-clear');
  const newBtn = document.getElementById('play-new');
  const printSheet = document.getElementById('print-sheet');
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
    return playConfigKey(values.ageRange, values.mazeStyle);
  }

  function sheetOpen() {
    return Boolean(printSheet?.open);
  }

  function layoutFor(maze, fit) {
    const values = getFormValues();
    const style = values.mazeStyle === 'circular' ? 'classic' : values.mazeStyle;
    return getLayoutForMaze(maze, {
      pageWidth: fit.pageWidth,
      pageHeight: fit.pageHeight,
      margin: fit.margin,
      style,
    });
  }

  /**
   * Size the bitmap to the stage. On a phone, grow the stage so a portrait
   * maze is limited by width instead of the leftover viewport height.
   * @param {object} maze
   */
  function applyFit(maze) {
    const narrow = narrowQuery.matches;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = rect.width >= 40 ? rect.width : 560;
    const cssHeight = rect.height >= 40 ? rect.height : 720;
    const fit = fitPlayCanvas(maze, cssWidth, cssHeight, dpr, { allowGrow: narrow });
    if (narrow) {
      const next = `${Math.round(fit.cssHeight * 100) / 100}px`;
      if (stage.style.height !== next) stage.style.height = next;
    } else if (stage.style.height) {
      stage.style.height = '';
    }
    if (canvas.width !== fit.pageWidth || canvas.height !== fit.pageHeight) {
      canvas.width = fit.pageWidth;
      canvas.height = fit.pageHeight;
    }
    return fit;
  }

  function render() {
    if (!state) return;
    const fit = applyFit(state.maze);
    const values = getFormValues();
    const layout = layoutFor(state.maze, fit);
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
    if (newBtn) newBtn.disabled = false;
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

  function reseed(reason) {
    endCelebration();
    const values = getFormValues();
    syncToleranceControl();
    const plan = playSessionPlan({
      previousKey: configKey,
      ageRange: values.ageRange,
      mazeStyle: values.mazeStyle,
      reason,
      currentSeed: state?.maze?.seed ?? 0,
      rollSeed: generateSeed,
    });
    if (!plan.regenerate && state) {
      configKey = plan.key;
      render();
      return;
    }
    const seed = plan.seed;
    try {
      const maze = generatePlayMaze(values, seed);
      const fit = applyFit(maze);
      const layout = layoutFor(maze, fit);
      state = createPlayState(maze, layout, toleranceFor(values.ageRange));
      configKey = plan.key;
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
    if (newBtn) newBtn.disabled = true;
    toleranceInput.disabled = true;
    state = setHintVisible(state, false);
    if (celebrate) celebrate.hidden = false;
    setPlayStatus('Solved', 'success');
    render();
    pauseTimer = window.setTimeout(() => {
      pauseTimer = 0;
      celebrating = false;
      reseed('solved');
    }, SOLVE_PAUSE_MS);
  }

  function isControlTarget(target) {
    return !!target?.closest?.('button, a, input, select, textarea, summary, label');
  }

  function touchBeginsPlay(clientX, clientY) {
    if (pointInRect(clientX, clientY, surface.getBoundingClientRect())) return true;
    return isNearPlayCanvas(clientX, clientY, canvas.getBoundingClientRect());
  }

  function onPointerDown(event) {
    if (!active || celebrating || !state || sheetOpen()) return;
    if (isControlTarget(event.target)) return;
    if (!touchBeginsPlay(event.clientX, event.clientY)) return;
    if (event.cancelable) event.preventDefault();
    surface.setPointerCapture(event.pointerId);
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
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
  }

  let blockingTouch = false;

  function onTouchStart(event) {
    if (!active || sheetOpen()) return;
    const t = event.touches[0];
    if (!t || isControlTarget(event.target)) {
      blockingTouch = false;
      return;
    }
    blockingTouch = touchBeginsPlay(t.clientX, t.clientY);
    if (blockingTouch && event.cancelable) event.preventDefault();
  }

  function onTouchMove(event) {
    if (!active || !blockingTouch) return;
    if (event.cancelable) event.preventDefault();
  }

  function onTouchEnd() {
    blockingTouch = false;
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

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (!active || celebrating) return;
      reseed('new');
    });
  }

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerUp);
  surface.addEventListener('contextmenu', (event) => {
    if (active) event.preventDefault();
  });
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);

  const resizeObserver = new ResizeObserver(() => {
    if (!active || !state || celebrating) return;
    render();
  });
  resizeObserver.observe(stage);
  narrowQuery.addEventListener('change', () => {
    if (!narrowQuery.matches) stage.style.height = '';
    if (!active || !state || celebrating) return;
    render();
  });

  function setMode(mode) {
    active = mode === 'play';
    layoutEl.classList.toggle('mode-play', active);
    document.documentElement.classList.toggle('play-mode', active);
    document.body.classList.toggle('play-mode', active);
    controls.hidden = !active;
    canvas.style.touchAction = active ? 'none' : '';
    if (!active) stage.style.height = '';
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
    if (!state || configKey !== currentConfigKey()) reseed('open');
    else render();
  }

  syncToleranceControl();

  return {
    isActive() {
      return active;
    },
    setMode,
    onConfigChange(reason = 'level') {
      if (!active) return;
      reseed(reason);
    },
    newMaze() {
      if (!active || celebrating) return;
      reseed('new');
    },
    getMaze() {
      return state?.maze ?? null;
    },
  };
}
