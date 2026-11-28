/**
 * Draw the freehand marker and the hint overlay in layout space.
 * The canvas context is expected to already use PDF-style y-up coordinates.
 */

import { currentHintKeys } from './session.js';

/**
 * Freehand path on the off-white maze ground.
 * #2563EB at full opacity is about 4.9:1 on #FAFAF8 and lighter than the #1E293B walls.
 * Canvas only — PDF drawers do not use this.
 */
export const PLAY_INK = '#2563EB';

/** How far above the canvas a stroke may begin. Covers the label over Start. */
export const PLAY_EDGE_SLOP_PX = 48;

/** Side margin. Kept inside the play surface so it does not reach the controls. */
export const PLAY_EDGE_SIDE_PX = 16;

/** Below the canvas. Small so the level menu and Hint stay tappable. */
export const PLAY_EDGE_BELOW_PX = 8;

/**
 * Map a client point into maze-local coordinates.
 * `rect` is the canvas border box in client pixels. The bitmap may be a
 * different size (device pixels). Points outside the rect still map.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} bitmapWidth
 * @param {number} bitmapHeight
 * @param {{ fromLayout: Function }} view
 */
export function mapClientToMaze(clientX, clientY, rect, bitmapWidth, bitmapHeight, view) {
  const scaleX = bitmapWidth / rect.width;
  const scaleY = bitmapHeight / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  return view.fromLayout(x, bitmapHeight - y);
}

/**
 * Map a pointer event into maze-local coordinates.
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ fromLayout: Function }} view
 */
export function clientToLocal(canvas, clientX, clientY, view) {
  const rect = canvas.getBoundingClientRect();
  return mapClientToMaze(clientX, clientY, rect, canvas.width, canvas.height, view);
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number, right?: number, bottom?: number, width?: number, height?: number }} rect
 */
export function pointInRect(clientX, clientY, rect) {
  if (!rect || rect.width === 0 || rect.height === 0) return false;
  const right = rect.right ?? rect.left + rect.width;
  const bottom = rect.bottom ?? rect.top + rect.height;
  return clientX >= rect.left && clientX <= right && clientY >= rect.top && clientY <= bottom;
}

/**
 * True on the canvas and in the margin above it, where a finger aiming at
 * Start otherwise misses the canvas and pulls to refresh.
 * The band below the canvas stays narrow so the controls are not captured.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number, right?: number, bottom?: number, width?: number, height?: number }} rect
 */
export function isNearPlayCanvas(clientX, clientY, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
  const right = rect.right ?? rect.left + rect.width;
  const bottom = rect.bottom ?? rect.top + rect.height;
  return (
    clientX >= rect.left - PLAY_EDGE_SIDE_PX &&
    clientX <= right + PLAY_EDGE_SIDE_PX &&
    clientY >= rect.top - PLAY_EDGE_SLOP_PX &&
    clientY <= bottom + PLAY_EDGE_BELOW_PX
  );
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state
 */
export function drawPlayInk(ctx, state) {
  const width = state.view.markerWidth;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PLAY_INK;
  ctx.fillStyle = PLAY_INK;
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;

  for (const stroke of state.strokes) {
    if (stroke.length === 0) continue;
    const first = state.view.toLayout(stroke[0]);
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = state.view.toLayout(stroke[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  if (state.hintVisible && !state.trace.solved) {
    drawHint(ctx, state, width);
  }
  ctx.restore();
}

function drawHint(ctx, state, markerWidth) {
  const keys = currentHintKeys(state);
  if (keys.length === 0) return;
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(1.75, markerWidth * 0.55);
  ctx.setLineDash([markerWidth * 0.85, markerWidth * 0.7]);
  ctx.beginPath();
  const start = state.view.toLayout(state.topology.center(keys[0]));
  ctx.moveTo(start.x, start.y);
  const bend = state.topology.bend;
  for (let i = 1; i < keys.length; i++) {
    const pts = bend ? bend(keys[i - 1], keys[i]) : null;
    if (pts && pts.length > 0) {
      for (let j = 0; j < pts.length; j++) {
        const p = state.view.toLayout(pts[j]);
        ctx.lineTo(p.x, p.y);
      }
    } else {
      const p = state.view.toLayout(state.topology.center(keys[i]));
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}
