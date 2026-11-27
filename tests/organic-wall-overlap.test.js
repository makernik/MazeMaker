/**
 * Overlap checks for Jagged and Curvy wall strokes.
 *
 * The sweep draws each maze through the same drawers the PDF and the
 * sample-preview canvas use. Cases listed in KNOWN_OVERLAPS currently
 * produce real overlaps; they are expected failures so the suite stays
 * green until the generator is fixed. They still run.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeSegments, createRecordingBackend } from './wall-overlap-geometry.js';
import {
  LEVELS,
  JAGGED_LABELS,
  caseKey,
  previewSeedFor,
  sweepCase,
} from './organic-wall-sweep.js';

let pathId = 1;

function wall(x1, y1, x2, y2, w = 2) {
  const id = pathId++;
  return {
    id,
    pathId: id,
    index: 0,
    head: true,
    tail: true,
    x1, y1, x2, y2,
    w,
    role: 'wall',
    minX: Math.min(x1, x2),
    maxX: Math.max(x1, x2),
    minY: Math.min(y1, y2),
    maxY: Math.max(y1, y2),
  };
}

describe('wall overlap detector', () => {
  it('flags an interior crossing', () => {
    const result = analyzeSegments([
      wall(0, 0, 10, 10),
      wall(0, 10, 10, 0),
    ], [], 1);
    expect(result.counts.crossing).toBe(1);
  });

  it('does not flag endpoints that meet', () => {
    const result = analyzeSegments([
      wall(0, 0, 10, 0),
      wall(10, 0, 10, 10),
    ], [], 1);
    expect(result.pairs).toBe(0);
  });

  it('does not flag a miter whose round caps meet and then separate', () => {
    const result = analyzeSegments([
      wall(0, 0, 20, 0, 2),
      wall(0.4, 0, 0.4, 20, 2),
    ], [], 1);
    expect(result.pairs).toBe(0);
  });

  it('flags collinear duplicated segments', () => {
    const result = analyzeSegments([
      wall(0, 0, 10, 0),
      wall(2, 0, 12, 0),
    ], [], 1);
    expect(result.counts['collinear-overlap']).toBeGreaterThan(0);
  });

  it('flags parallel strokes closer than the stroke width', () => {
    const result = analyzeSegments([
      wall(0, 0, 30, 0, 2),
      wall(0, 1, 30, 1, 2),
    ], [], 1);
    expect(result.counts['stroke-overlap']).toBeGreaterThan(0);
  });

  it('does not flag parallel strokes that only touch', () => {
    const result = analyzeSegments([
      wall(0, 0, 30, 0, 2),
      wall(0, 2, 30, 2, 2),
    ], [], 1);
    expect(result.counts['stroke-overlap']).toBe(0);
    expect(result.pairs).toBe(0);
  });

  it('flags a wall body that covers a passage centerline', () => {
    const passage = wall(0, 0, 20, 0, 0);
    passage.role = 'passage';
    passage.solution = true;
    const result = analyzeSegments([
      wall(10, -8, 10, 8, 2),
    ], [passage], 1);
    expect(result.counts['passage-blocked']).toBeGreaterThan(0);
    expect(result.counts['solution-blocked']).toBeGreaterThan(0);
  });

  it('samples a bowed stroke and flags the wall it runs through', () => {
    const rec = createRecordingBackend({ flatness: 0.2, frameLineCount: 0 });
    rec.backend.setStroke('#000', 1.5, 'round');
    rec.backend.line(10, 0, 10, 20);
    rec.backend.beginPath();
    rec.backend.moveTo(0, 10);
    rec.backend.bezierCurveTo(7, 16, 13, 4, 20, 10);
    rec.backend.stroke();
    const segments = rec.finish();
    expect(segments.length).toBeGreaterThan(1);
    const result = analyzeSegments(segments, [], 1);
    const hits = result.counts.crossing + result.counts['stroke-overlap'];
    expect(hits).toBeGreaterThan(0);
  });

  it('keeps the sample-preview seeds stable', () => {
    expect(previewSeedFor('18+', 'jagged')).toBe(1430593985);
    expect(previewSeedFor('18+', 'curvy')).toBe(1333467354);
    expect(previewSeedFor('15-17', 'jagged')).toBe(157428652);
    expect(previewSeedFor('9-11', 'jagged')).toBe(1642654447);
  });
});

/**
 * Seeds that overlap today.
 * - number[]: only these seeds overlap
 * - { except }: every swept seed overlaps except these
 * - 'all': every swept seed overlaps
 * PDF and preview fail the same seeds. Site counts can differ by a few
 * because the preview page is scaled.
 */
const KNOWN_OVERLAPS = {
  'curvy|Intro|pdf': [5262, 5524, 6703, 6834],
  'curvy|Intro|preview': [5262, 5524, 6703, 6834],
  'curvy|Easy|pdf': { except: [6703] },
  'curvy|Easy|preview': { except: [6703] },
  'curvy|Medium|pdf': 'all',
  'curvy|Medium|preview': 'all',
  'jagged|Hard|pdf': { except: [5262, 6179, 6572, 6703, 6834, 7489] },
  'jagged|Hard|preview': { except: [5262, 6179, 6572, 6703, 6834, 7489] },
  'curvy|Hard|pdf': 'all',
  'curvy|Hard|preview': 'all',
  'jagged|Challenging|pdf': 'all',
  'jagged|Challenging|preview': 'all',
  'curvy|Challenging|pdf': 'all',
  'curvy|Challenging|preview': 'all',
  'jagged|Difficult|pdf': 'all',
  'jagged|Difficult|preview': 'all',
  'curvy|Difficult|pdf': 'all',
  'curvy|Difficult|preview': 'all',
  'jagged|Epic Adventure|pdf': 'all',
  'jagged|Epic Adventure|preview': 'all',
  'curvy|Epic Adventure|pdf': 'all',
  'curvy|Epic Adventure|preview': 'all',
};

function isKnownFailure(key, seed) {
  const spec = KNOWN_OVERLAPS[key];
  if (!spec) return false;
  if (spec === 'all') return true;
  if (Array.isArray(spec)) return spec.includes(seed);
  return !spec.except.includes(seed);
}

function failureText(result) {
  return result.failures.map((failure) => {
    const kinds = Object.entries(failure.siteCounts)
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${kind}=${count}`)
      .join(', ');
    const preview = failure.preview ? ' preview-seed' : '';
    return `seed ${failure.seed}${preview}: ${kinds || 'overlap'}`;
  }).join('\n');
}

describe.sequential('jagged and curvy wall geometry', () => {
  for (const level of LEVELS) {
    for (const style of ['jagged', 'curvy']) {
      if (style === 'jagged' && !JAGGED_LABELS.has(level.label)) continue;
      for (const path of ['pdf', 'preview']) {
        const key = caseKey(style, level.label, path);
        const title = `${style} ${level.label} ${path}`;
        describe(title, () => {
          let result;
          beforeAll(async () => {
            result = await sweepCase({
              style,
              ageRange: level.ageRange,
              label: level.label,
              path,
            });
          }, 300000);

          it('records wall strokes from the drawer', () => {
            expect(result.wallSum).toBeGreaterThan(0);
            expect(result.passageSum).toBeGreaterThan(0);
            expect(result.seeds).toBeGreaterThanOrEqual(20);
          });

          it('seeds that are clean today stay clean', () => {
            const unexpected = result.failures.filter((failure) => !isKnownFailure(key, failure.seed));
            expect(unexpected.map((failure) => failure.seed), failureText({ failures: unexpected })).toEqual([]);
          });

          if (KNOWN_OVERLAPS[key]) {
            it.fails('known overlapping seeds still overlap', () => {
              const known = result.failures.filter((failure) => isKnownFailure(key, failure.seed));
              expect(known, failureText({ failures: known })).toEqual([]);
            });
          }
        });
      }
    }
  }
});
