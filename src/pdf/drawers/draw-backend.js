/**
 * Rendering backend abstraction for maze drawers.
 * Normalizes pdf-lib (PDFPage) and Canvas2D (CanvasRenderingContext2D)
 * behind a common drawing contract so each drawer is written once.
 */

import { rgb } from 'pdf-lib';

function lineCapToNum(cap) {
  if (cap === 'round') return 1;
  if (cap === 'square') return 2;
  return 0; // butt
}

function cssColorToRgb(color) {
  if (!color || color === '#000' || color === '#000000') return rgb(0, 0, 0);
  if (color.startsWith('#')) {
    const hex = color.length === 4
      ? color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color.slice(1);
    const n = parseInt(hex, 16);
    return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
  }
  return rgb(0, 0, 0);
}

/**
 * Create a drawing backend wrapping a pdf-lib PDFPage.
 *
 * Path operations (beginPath / moveTo / lineTo / arc / bezierCurveTo /
 * quadraticCurveTo) accumulate an SVG path string.  stroke() emits it via
 * page.drawSvgPath().  line() is a shortcut that calls page.drawLine().
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {{ font?: import('pdf-lib').PDFFont, boldFont?: import('pdf-lib').PDFFont }} [fonts]
 */
export function createPdfBackend(page, fonts = {}) {
  let _path = '';
  let _color = rgb(0, 0, 0);
  let _width = 1;
  let _cap = 1;
  let _dashArray = undefined;
  let _opacity = undefined;
  const _stateStack = [];

  const _font = fonts.font;
  const _boldFont = fonts.boldFont;

  return {
    type: 'pdf',

    setStroke(color, width, lineCap) {
      _color = cssColorToRgb(color);
      _width = width;
      _cap = lineCapToNum(lineCap ?? 'round');
    },

    line(x1, y1, x2, y2) {
      const opts = { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: _width, color: _color, lineCap: _cap };
      if (_dashArray) opts.dashArray = _dashArray;
      if (_opacity != null) opts.opacity = _opacity;
      page.drawLine(opts);
    },

    beginPath() { _path = ''; },
    moveTo(x, y) { _path += `M ${x} ${-y} `; },
    lineTo(x, y) { _path += `L ${x} ${-y} `; },

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      _path += `C ${cp1x} ${-cp1y} ${cp2x} ${-cp2y} ${x} ${-y} `;
    },

    quadraticCurveTo(cpx, cpy, x, y) {
      _path += `Q ${cpx} ${-cpy} ${x} ${-y} `;
    },

    arc(cx, cy, r, startAngle, endAngle) {
      const sx = cx + r * Math.cos(startAngle);
      const sy = cy + r * Math.sin(startAngle);
      if (!_path) _path = `M ${sx} ${-sy} `;

      const span = endAngle - startAngle;
      if (Math.abs(span - Math.PI) < 0.01) {
        const mid = (startAngle + endAngle) / 2;
        const mx = cx + r * Math.cos(mid);
        const my = cy + r * Math.sin(mid);
        const ex = cx + r * Math.cos(endAngle);
        const ey = cy + r * Math.sin(endAngle);
        _path += `A ${r} ${r} 0 0 0 ${mx} ${-my} `;
        _path += `A ${r} ${r} 0 0 0 ${ex} ${-ey} `;
      } else {
        const ex = cx + r * Math.cos(endAngle);
        const ey = cy + r * Math.sin(endAngle);
        const largeArc = span > Math.PI ? 1 : 0;
        _path += `A ${r} ${r} 0 ${largeArc} 0 ${ex} ${-ey} `;
      }
    },

    stroke() {
      if (!_path) return;
      const opts = { borderColor: _color, borderWidth: _width, borderLineCap: _cap };
      if (_dashArray) opts.borderDashArray = _dashArray;
      if (_opacity != null) opts.opacity = _opacity;
      page.drawSvgPath(_path.trim(), opts);
      _path = '';
    },

    drawText(str, x, y, opts = {}) {
      const font = opts.bold ? _boldFont : _font;
      page.drawText(str, { x, y, size: opts.fontSize ?? 10, font, color: rgb(0, 0, 0) });
    },

    measureText(str, opts = {}) {
      const font = opts.bold ? _boldFont : _font;
      return font.widthOfTextAtSize(str, opts.fontSize ?? 10);
    },

    withScreenTransform(fn) { fn(); },

    save() {
      _stateStack.push({ color: _color, width: _width, cap: _cap, dashArray: _dashArray, opacity: _opacity });
    },
    restore() {
      const s = _stateStack.pop();
      if (s) { _color = s.color; _width = s.width; _cap = s.cap; _dashArray = s.dashArray; _opacity = s.opacity; }
    },
    setDash(pattern) { _dashArray = pattern && pattern.length ? pattern : undefined; },
    setOpacity(value) { _opacity = value; },
  };
}

/**
 * Create a drawing backend wrapping a CanvasRenderingContext2D.
 *
 * All path methods are thin pass-throughs to the native canvas API.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function createCanvasBackend(ctx) {
  return {
    type: 'canvas',

    setStroke(color, width, lineCap) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = lineCap ?? 'round';
    },

    line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },

    beginPath() { ctx.beginPath(); },
    moveTo(x, y) { ctx.moveTo(x, y); },
    lineTo(x, y) { ctx.lineTo(x, y); },

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    },

    quadraticCurveTo(cpx, cpy, x, y) {
      ctx.quadraticCurveTo(cpx, cpy, x, y);
    },

    arc(cx, cy, r, startAngle, endAngle) {
      ctx.arc(cx, cy, r, startAngle, endAngle);
    },

    stroke() { ctx.stroke(); },

    drawText(str, x, y, opts = {}) {
      const weight = opts.bold ? 'bold ' : '';
      ctx.font = `${weight}${opts.fontSize ?? 10}px Inter, sans-serif`;
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
    },

    measureText(str, opts = {}) {
      const weight = opts.bold ? 'bold ' : '';
      ctx.font = `${weight}${opts.fontSize ?? 10}px Inter, sans-serif`;
      return ctx.measureText(str).width;
    },

    withScreenTransform(fn) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      fn();
      ctx.restore();
    },

    save() { ctx.save(); },
    restore() { ctx.restore(); },
    setDash(pattern) { ctx.setLineDash(pattern ?? []); },
    setOpacity(value) { ctx.globalAlpha = value ?? 1; },
  };
}
