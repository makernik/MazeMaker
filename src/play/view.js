/**
 * Draw the freehand marker and the hint overlay in layout space.
 * The canvas context is expected to already use PDF-style y-up coordinates.
 */

import { currentHintKeys } from './session.js';

/**
 * Map a pointer event into maze-local coordinates.
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ fromLayout: Function }} view
 */
export function clientToLocal(canvas, clientX, clientY, view) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  return view.fromLayout(x, canvas.height - y);
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
  ctx.strokeStyle = '#1E293B';
  ctx.fillStyle = '#1E293B';
  ctx.globalAlpha = 0.9;
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
