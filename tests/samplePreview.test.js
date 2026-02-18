/**
 * Sample preview path logic.
 * Samples are static app assets; path keyed by level + maze style; 18+ -> 18plus.
 */

import { describe, it, expect } from 'vitest';
import { getSampleImagePath, sampleTokenForAgeRange } from '../src/utils/samplePreview.js';

describe('samplePreview', () => {
  describe('sampleTokenForAgeRange', () => {
    it('maps 18+ to 18plus', () => {
      expect(sampleTokenForAgeRange('18+')).toBe('18plus');
    });
    it('leaves other age ranges unchanged', () => {
      expect(sampleTokenForAgeRange('3')).toBe('3');
      expect(sampleTokenForAgeRange('4-5')).toBe('4-5');
      expect(sampleTokenForAgeRange('9-11')).toBe('9-11');
    });
    it('returns empty string for empty input', () => {
      expect(sampleTokenForAgeRange('')).toBe('');
      expect(sampleTokenForAgeRange(null)).toBe('');
    });
  });

  describe('getSampleImagePath', () => {
    it('returns path for level and style', () => {
      expect(getSampleImagePath('4-5', 'rounded')).toBe('samples/4-5-rounded.png');
      expect(getSampleImagePath('9-11', 'organic')).toBe('samples/9-11-organic.png');
      expect(getSampleImagePath('3', 'square')).toBe('samples/3-square.png');
    });
    it('uses 18plus for 18+ level', () => {
      expect(getSampleImagePath('18+', 'organic')).toBe('samples/18plus-organic.png');
      expect(getSampleImagePath('18+', 'rounded')).toBe('samples/18plus-rounded.png');
    });
    it('returns empty string when ageRange or mazeStyle missing', () => {
      expect(getSampleImagePath('', 'rounded')).toBe('');
      expect(getSampleImagePath('4-5', '')).toBe('');
      expect(getSampleImagePath(null, 'organic')).toBe('');
    });
  });
});
