/**
 * RNG Tests
 * 
 * Tests for seeded PRNG determinism.
 */

import { describe, it, expect } from 'vitest';
import { createRng, generateSeed } from '../src/utils/rng.js';

describe('Seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);
    
    // Generate 100 random numbers from each
    const seq1 = Array.from({ length: 100 }, () => rng1.random());
    const seq2 = Array.from({ length: 100 }, () => rng2.random());
    
    expect(seq1).toEqual(seq2);
  });
  
  it('produces different sequences for different seeds', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(54321);
    
    const seq1 = Array.from({ length: 10 }, () => rng1.random());
    const seq2 = Array.from({ length: 10 }, () => rng2.random());
    
    expect(seq1).not.toEqual(seq2);
  });
  
  it('generates values in [0, 1) range', () => {
    const rng = createRng(99999);
    
    for (let i = 0; i < 1000; i++) {
      const value = rng.random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
  
  it('randomInt generates values in correct range', () => {
    const rng = createRng(42);
    
    for (let i = 0; i < 100; i++) {
      const value = rng.randomInt(5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
  
  it('randomFloat generates values in correct range', () => {
    const rng = createRng(777);
    
    for (let i = 0; i < 100; i++) {
      const value = rng.randomFloat(2.5, 7.5);
      expect(value).toBeGreaterThanOrEqual(2.5);
      expect(value).toBeLessThan(7.5);
    }
  });
  
  it('shuffle is deterministic with same seed', () => {
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    const rng1 = createRng(555);
    const rng2 = createRng(555);
    
    rng1.shuffle(arr1);
    rng2.shuffle(arr2);
    
    expect(arr1).toEqual(arr2);
  });
  
  it('pick is deterministic with same seed', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    
    const rng1 = createRng(888);
    const rng2 = createRng(888);
    
    const picks1 = Array.from({ length: 20 }, () => rng1.pick(arr));
    const picks2 = Array.from({ length: 20 }, () => rng2.pick(arr));
    
    expect(picks1).toEqual(picks2);
  });
  
  it('generateSeed returns different values on successive calls', () => {
    // Note: This test is probabilistic, but collisions are extremely unlikely
    const seeds = new Set();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateSeed());
    }
    // Should have at least 90 unique seeds (allowing for some timing collisions)
    expect(seeds.size).toBeGreaterThan(90);
  });
});
