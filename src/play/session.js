/**
 * Play session state. Strokes are raw pointer samples in maze-local coordinates.
 * The logical trace is derived from those samples and the current forgiveness.
 */

import { clampPlayTolerance } from './tolerance.js';
import { createTrace, consumeSegment, hintKeys, isBranch } from './trace.js';
import { buildPlayModel, buildView } from './model.js';

/**
 * @param {object} maze
 * @param {object} layoutResult
 * @param {number} tolerance
 */
export function createPlayState(maze, layoutResult, tolerance) {
  const { topology, view } = buildPlayModel(maze, layoutResult);
  return {
    maze,
    topology,
    view,
    tolerance: clampPlayTolerance(tolerance),
    strokes: [],
    trace: createTrace(),
    hintVisible: false,
  };
}

/**
 * Replace the canvas mapping after a resize. The stroke and trace stay.
 * @param {ReturnType<typeof createPlayState>} state
 * @param {object} layoutResult
 */
export function setPlayLayout(state, layoutResult) {
  return { ...state, view: buildView(state.maze, layoutResult) };
}

/**
 * @param {ReturnType<typeof createPlayState>} state
 * @param {{x?: number, y?: number, nx?: number, ny?: number}} localPoint
 * @param {'start'|'move'} phase
 */
export function addPointer(state, localPoint, phase) {
  if (state.trace.solved) return state;
  const strokes = state.strokes.map((stroke) => stroke.slice());
  let from = null;
  let bridge = false;
  if (phase === 'move' && strokes.length > 0) {
    const last = strokes[strokes.length - 1];
    from = last[last.length - 1] || null;
    last.push(localPoint);
    bridge = true;
  } else {
    strokes.push([localPoint]);
  }
  const trace = consumeSegment(state.trace, state.topology, state.tolerance, from, localPoint, bridge);
  return { ...state, strokes, trace };
}

/**
 * Drop the ink and the walk. The maze and seed stay.
 * @param {ReturnType<typeof createPlayState>} state
 */
export function clearPath(state) {
  return { ...state, strokes: [], trace: createTrace(), hintVisible: false };
}

/**
 * @param {ReturnType<typeof createPlayState>} state
 * @param {number} tolerance
 */
export function setTolerance(state, tolerance) {
  const nextTolerance = clampPlayTolerance(tolerance);
  let trace = createTrace();
  for (const stroke of state.strokes) {
    for (let i = 0; i < stroke.length; i++) {
      const from = i === 0 ? null : stroke[i - 1];
      trace = consumeSegment(trace, state.topology, nextTolerance, from, stroke[i], i > 0);
    }
  }
  return {
    ...state,
    tolerance: nextTolerance,
    trace,
    hintVisible: trace.solved ? false : state.hintVisible,
  };
}

/**
 * @param {ReturnType<typeof createPlayState>} state
 * @param {boolean} visible
 */
export function setHintVisible(state, visible) {
  if (state.trace.solved) return { ...state, hintVisible: false };
  return { ...state, hintVisible: visible };
}

/**
 * @param {ReturnType<typeof createPlayState>} state
 * @returns {string[]}
 */
export function currentHintKeys(state) {
  const furthest = state.trace.started ? state.trace.furthest : 0;
  return hintKeys(
    state.topology.solution,
    furthest,
    (key) => isBranch(key, state.topology.neighbors)
  );
}
