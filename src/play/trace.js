/**
 * Logical progress along a perfect-maze solution.
 * Ink geometry stays outside this module. Cells are opaque string keys.
 */

import { PLAY_HINT_DECISIONS } from './tolerance.js';

/**
 * @returns {{ started: boolean, furthest: number, stack: string[], solved: boolean }}
 */
export function createTrace() {
  return { started: false, furthest: 0, stack: [], solved: false };
}

/**
 * @param {string} key
 * @param {Map<string, string[]>} neighbors
 * @returns {boolean}
 */
export function isBranch(key, neighbors) {
  return (neighbors.get(key)?.length ?? 0) >= 3;
}

/**
 * Accept one corridor cell. Backtracking pops. Wrong branches do not advance
 * the furthest correct solution index.
 *
 * @param {ReturnType<typeof createTrace>} trace
 * @param {string[]} solution
 * @param {Map<string, string[]>} neighbors
 * @param {string|null} cell
 */
export function applyCell(trace, solution, neighbors, cell) {
  if (cell == null || trace.solved || solution.length === 0) return trace;

  if (!trace.started) {
    if (cell !== solution[0]) return trace;
    return {
      started: true,
      furthest: 0,
      stack: [solution[0]],
      solved: solution.length === 1,
    };
  }

  const top = trace.stack[trace.stack.length - 1];
  if (cell === top) return trace;
  const adjacent = neighbors.get(top);
  if (!adjacent || !adjacent.includes(cell)) return trace;

  let stack;
  if (trace.stack.length >= 2 && cell === trace.stack[trace.stack.length - 2]) {
    stack = trace.stack.slice(0, -1);
  } else {
    stack = trace.stack.concat(cell);
  }

  let prefix = 0;
  while (
    prefix < solution.length &&
    prefix < stack.length &&
    stack[prefix] === solution[prefix]
  ) {
    prefix += 1;
  }

  let furthest = trace.furthest;
  if (stack.length === prefix) {
    furthest = Math.max(furthest, prefix - 1);
  }

  const solved = prefix === solution.length && stack.length === solution.length;
  return { started: true, furthest, stack, solved };
}

/**
 * Solution keys from the furthest correct cell through `decisions` branches.
 * Includes the correct step out of the last branch. Draws through the finish
 * when fewer branches remain.
 *
 * @param {string[]} solution
 * @param {number} furthest
 * @param {(key: string) => boolean} isBranchAt
 * @param {number} [decisions]
 * @returns {string[]}
 */
export function hintKeys(solution, furthest, isBranchAt, decisions = PLAY_HINT_DECISIONS) {
  if (!solution.length) return [];
  const last = solution.length - 1;
  const start = Math.max(0, Math.min(furthest, last));
  if (start === last) return [solution[last]];

  const out = [];
  let seen = 0;
  for (let i = start; i <= last; i++) {
    out.push(solution[i]);
    if (i < last && isBranchAt(solution[i])) seen += 1;
    if (seen >= decisions) {
      if (i < last) out.push(solution[i + 1]);
      break;
    }
  }
  return out;
}

/**
 * Points from just after `from` through `to`, spaced at most `step` apart.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} step
 * @returns {{x:number,y:number}[]}
 */
export function subdivide(from, to, step) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !(step > 0) || dist <= step) return [{ x: to.x, y: to.y }];
  const n = Math.ceil(dist / step);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  return out;
}

/**
 * Classify samples along a stroke segment and advance the trace.
 * `from` is omitted on a new stroke so a lifted finger cannot cut across.
 *
 * @param {ReturnType<typeof createTrace>} trace
 * @param {{ solution: string[], neighbors: Map<string, string[]>, locate: Function, sampleStep: number }} model
 * @param {number} tolerance
 * @param {{x:number,y:number}|null} from
 * @param {{x:number,y:number}} to
 * @param {boolean} bridge
 */
export function consumeSegment(trace, model, tolerance, from, to, bridge) {
  const samples = bridge && from ? subdivide(from, to, model.sampleStep) : [to];
  let current = trace.stack.length ? trace.stack[trace.stack.length - 1] : null;
  let next = trace;
  for (let i = 0; i < samples.length; i++) {
    const key = model.locate(samples[i], current, tolerance);
    if (!key) continue;
    const updated = applyCell(next, model.solution, model.neighbors, key);
    next = updated;
    if (next.stack.length && next.stack[next.stack.length - 1] === key) {
      current = key;
    }
  }
  return next;
}
