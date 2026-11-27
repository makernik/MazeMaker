/**
 * Sweep Jagged and Curvy mazes through the real drawers and the overlap oracle.
 *
 * PDF uses the default US Letter layout. Preview uses the Generate-mode sample
 * canvas: 560×720 with a 32pt margin, matching updatePreviewCanvas in src/main.js.
 * The preview seed matches previewSeedFor in that file (not imported: main.js
 * touches the DOM).
 */

import fs from 'node:fs';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { solveMaze } from '../src/maze/solver.js';
import { getLayoutForMaze, PAGE_WIDTH, PAGE_HEIGHT } from '../src/pdf/layout.js';
import { getDrawer } from '../src/pdf/drawers/index.js';
import { computeCorridorWidth, curvyPoint } from '../src/pdf/drawers/organic-geometry.js';
import {
  TOLERANCES,
  createRecordingBackend,
  analyzeSegments,
  renderOverlapPng,
  renderOverlapSvg,
} from './wall-overlap-geometry.js';

export const PREVIEW_WIDTH = 560;
export const PREVIEW_HEIGHT = 720;
export const PREVIEW_MARGIN = 32;

export const LEVELS = [
  { ageRange: '3', label: 'Intro' },
  { ageRange: '4-5', label: 'Easy' },
  { ageRange: '6-8', label: 'Medium' },
  { ageRange: '9-11', label: 'Hard' },
  { ageRange: '12-14', label: 'Challenging' },
  { ageRange: '15-17', label: 'Difficult' },
  { ageRange: '18+', label: 'Epic Adventure' },
];

export const JAGGED_LABELS = new Set(['Hard', 'Challenging', 'Difficult', 'Epic Adventure']);

const mazeCache = new Map();

export function previewSeedFor(ageRange, mazeStyle) {
  const styleKey = mazeStyle === 'circular' ? 'polar' : (mazeStyle || '');
  let h = 0;
  const s = (ageRange || '') + '-' + styleKey;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h) || 1;
}

/** Twenty fixed seeds, plus the sample-preview seed when it is not already included. */
export function seedsFor(ageRange, style, count = 20) {
  const base = [];
  for (let i = 0; i < count; i++) base.push(5000 + i * 131);
  const previewSeed = previewSeedFor(ageRange, style);
  const seeds = base.includes(previewSeed) ? base.slice() : base.concat(previewSeed);
  return { seeds, previewSeed };
}

export function layoutFor(maze, style, path) {
  if (path === 'preview') {
    return getLayoutForMaze(maze, {
      pageWidth: PREVIEW_WIDTH,
      pageHeight: PREVIEW_HEIGHT,
      margin: PREVIEW_MARGIN,
      style,
    });
  }
  return getLayoutForMaze(maze, { style });
}

export function pageSizeFor(path) {
  if (path === 'preview') return { pageWidth: PREVIEW_WIDTH, pageHeight: PREVIEW_HEIGHT };
  return { pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT };
}

function mazeFor(ageRange, seed) {
  const key = `${ageRange}:${seed}`;
  let maze = mazeCache.get(key);
  if (!maze) {
    maze = generateOrganicMaze({ ageRange, seed });
    mazeCache.set(key, maze);
  }
  return maze;
}

function edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function solutionEdgeKeys(maze) {
  const solved = solveMaze(maze);
  const keys = new Set();
  if (!solved || !solved.path) return keys;
  for (let i = 1; i < solved.path.length; i++) {
    keys.add(edgeKey(solved.path[i - 1], solved.path[i]));
  }
  return keys;
}

function pushPassage(segments, x1, y1, x2, y2, solution) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx * dx + dy * dy < 1e-12) return;
  segments.push({
    id: segments.length,
    pathId: -1,
    index: 0,
    x1, y1, x2, y2,
    w: 0,
    role: 'passage',
    solution,
    minX: Math.min(x1, x2),
    maxX: Math.max(x1, x2),
    minY: Math.min(y1, y2),
    maxY: Math.max(y1, y2),
  });
}

function passageSegments(maze, layout, style, solutionEdges) {
  const { halfW } = computeCorridorWidth(maze.graph, layout.lineThickness);
  const step = 4;
  const segments = [];
  const seen = new Set();
  for (const node of maze.graph.nodes) {
    for (const nid of node.neighbors) {
      if (maze.graph.hasWall(node.id, nid)) continue;
      const key = edgeKey(node.id, nid);
      if (seen.has(key)) continue;
      seen.add(key);
      const other = maze.graph.getNode(nid);
      if (!other) continue;
      const dist = Math.hypot(other.x - node.x, other.y - node.y);
      const n = Math.max(1, Math.ceil(dist / step));
      let prev = null;
      const onSolution = solutionEdges.has(key);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const local = style === 'curvy'
          ? curvyPoint(node.x, node.y, other.x, other.y, halfW, t)
          : {
            x: node.x + (other.x - node.x) * t,
            y: node.y + (other.y - node.y) * t,
          };
        const p = layout.transform(local.x, local.y);
        if (prev) pushPassage(segments, prev.x, prev.y, p.x, p.y, onSolution);
        prev = p;
      }
    }
  }
  return segments;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function trimExample(example) {
  return {
    kind: example.kind,
    x: round(example.x),
    y: round(example.y),
    dist: round(example.dist),
    endClearance: round(example.endClearance),
    roles: example.roles,
    samePath: example.samePath,
    indexGap: example.indexGap,
    w1: round(example.w1),
    w2: round(example.w2),
  };
}

/**
 * Draw one maze and analyze it. Returns strokes when `capture` is set.
 */
export function inspectMaze({ style, ageRange, seed, path, capture = false }) {
  const maze = mazeFor(ageRange, seed);
  const layout = layoutFor(maze, style, path);
  const drawer = getDrawer(style);
  const rec = createRecordingBackend({
    flatness: Math.max(0.05, TOLERANCES.curveFlatness * layout.scale),
  });
  drawer.drawWalls(rec.backend, maze, layout);
  const walls = rec.finish();
  const passages = passageSegments(maze, layout, style, solutionEdgeKeys(maze));
  const analysis = analyzeSegments(walls, passages, layout.scale);
  const page = pageSizeFor(path);
  return {
    seed,
    walls: walls.length,
    passages: passages.length,
    analysis,
    pageWidth: page.pageWidth,
    pageHeight: page.pageHeight,
    captured: capture ? { walls, passages } : null,
  };
}

/**
 * @param {{ style: string, ageRange: string, label: string, path: string, seedCount?: number }} spec
 */
export async function sweepCase(spec) {
  const { style, ageRange, label, path, seedCount = 20 } = spec;
  const { seeds, previewSeed } = seedsFor(ageRange, style, seedCount);
  const failures = [];
  let wallSum = 0;
  let passageSum = 0;
  for (let i = 0; i < seeds.length; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    const seed = seeds[i];
    const inspected = inspectMaze({
      style,
      ageRange,
      seed,
      path,
      capture: false,
    });
    wallSum += inspected.walls;
    passageSum += inspected.passages;
    if (inspected.analysis.pairs > 0) {
      failures.push({
        style,
        label,
        ageRange,
        path,
        seed,
        preview: seed === previewSeed,
        pairs: inspected.analysis.pairs,
        sites: inspected.analysis.sites,
        counts: inspected.analysis.counts,
        siteCounts: inspected.analysis.siteCounts,
        roleCounts: inspected.analysis.roleCounts,
        examples: inspected.analysis.examples.slice(0, 8).map(trimExample),
      });
    }
  }
  return {
    style,
    label,
    ageRange,
    path,
    seeds: seeds.length,
    previewSeed,
    wallSum,
    passageSum,
    failures,
  };
}

export function caseKey(style, label, path) {
  return `${style}|${label}|${path}`;
}

/**
 * Write a full-page PNG, a zoomed PNG, and an SVG of one failing maze.
 * Red marks are overlap sites. Returns null when the maze is clean.
 */
export function saveFailureFigures(spec, dir) {
  const { style, ageRange, seed, path, prefix } = spec;
  const inspected = inspectMaze({ style, ageRange, seed, path, capture: true });
  if (inspected.analysis.pairs === 0) return null;
  fs.mkdirSync(dir, { recursive: true });
  const highlights = inspected.analysis.examples;
  const focus = highlights.reduce((best, item) => {
    if (!best) return item;
    if (item.kind === 'crossing' && best.kind !== 'crossing') return item;
    if (item.kind === best.kind && item.y > best.y) return item;
    return best;
  }, null);
  const page = {
    pageWidth: inspected.pageWidth,
    pageHeight: inspected.pageHeight,
    walls: inspected.captured.walls,
    highlights,
  };
  const fullPath = `${dir}/${prefix}-full.png`;
  const cropPath = `${dir}/${prefix}-crop.png`;
  const svgPath = `${dir}/${prefix}-crop.svg`;
  fs.writeFileSync(fullPath, renderOverlapPng(page));
  const crop = {
    x: focus.x - 42,
    y: focus.y - 42,
    w: 84,
    h: 84,
    zoom: 4,
  };
  fs.writeFileSync(cropPath, renderOverlapPng({ ...page, crop }));
  fs.writeFileSync(svgPath, renderOverlapSvg({ ...page, crop: { ...crop, zoom: 1 } }));
  return {
    fullPath,
    cropPath,
    svgPath,
    seed,
    style,
    path,
    focus: {
      kind: focus.kind,
      x: Math.round(focus.x * 10) / 10,
      y: Math.round(focus.y * 10) / 10,
      dist: Math.round(focus.dist * 100) / 100,
    },
    siteCounts: inspected.analysis.siteCounts,
  };
}

function parseArgs(argv) {
  const out = { seedCount: 20, images: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--images') out.images = true;
    else if (arg === '--style') out.style = argv[++i];
    else if (arg === '--level') out.level = argv[++i];
    else if (arg === '--path') out.path = argv[++i];
    else if (arg === '--seeds') out.seedCount = Number(argv[++i]);
    else if (arg === '--out') out.out = argv[++i];
  }
  return out;
}

function printCase(result) {
  const failedSeeds = result.failures.length;
  const status = failedSeeds === 0 ? 'pass' : 'FAIL';
  console.log(
    `${status}\t${result.style}\t${result.label}\t${result.path}\tseeds ${result.seeds}\tfailing ${failedSeeds}\tpreviewSeed ${result.previewSeed}`,
  );
  for (const failure of result.failures) {
    const kinds = Object.entries(failure.siteCounts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}:${n}`)
      .join(' ');
    console.log(
      `  seed ${failure.seed}${failure.preview ? ' preview' : ''}\tsites ${failure.sites}\tpairs ${failure.pairs}\t${kinds}`,
    );
    if (failure.examples[0]) {
      const ex = failure.examples[0];
      console.log(
        `    e.g. ${ex.kind} at (${ex.x},${ex.y}) dist ${ex.dist} endClear ${ex.endClearance} ${ex.roles} samePath ${ex.samePath} gap ${ex.indexGap} w ${ex.w1}/${ex.w2}`,
      );
    }
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('organic-wall-sweep.js');
if (isMain) {
  const args = parseArgs(process.argv);
  const styles = args.style ? [args.style] : ['jagged', 'curvy'];
  const paths = args.path ? [args.path] : ['pdf', 'preview'];
  const levels = LEVELS.filter((level) => !args.level || level.ageRange === args.level || level.label === args.level);
  const report = [];
  for (const level of levels) {
    for (const style of styles) {
      if (style === 'jagged' && !JAGGED_LABELS.has(level.label)) continue;
      for (const path of paths) {
        const started = Date.now();
        const result = await sweepCase({
          style,
          ageRange: level.ageRange,
          label: level.label,
          path,
          seedCount: args.seedCount,
        });
        printCase(result);
        console.log(`    ${Date.now() - started}ms`);
        report.push(result);
        if (args.images && path === 'preview' && result.failures.length > 0) {
          const previewFail = result.failures.find((item) => item.preview) ?? result.failures[0];
          const slug = `${style}-${level.ageRange.replace('+', 'plus')}`;
          const saved = saveFailureFigures({
            style,
            ageRange: level.ageRange,
            seed: previewFail.seed,
            path,
            prefix: `overlap-${slug}`,
          }, args.out ?? '/opt/cursor/artifacts');
          if (saved) console.log(`    image ${saved.cropPath}`);
        }
      }
    }
  }
  if (args.out) {
    fs.mkdirSync(args.out, { recursive: true });
    fs.writeFileSync(`${args.out}/overlap-report.json`, JSON.stringify(report, null, 2));
  }
}
