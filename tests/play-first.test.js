/**
 * Play-first screen: remembered level and style, reseed rules,
 * and a print pack whose first page is the maze on screen.
 */

import { describe, it, expect } from 'vitest';
import { generateMaze } from '../src/maze/generator.js';
import { generateOrganicMaze } from '../src/maze/organic-generator.js';
import { generateSquaresMaze } from '../src/maze/rooms-generator.js';
import { getDifficultyPreset } from '../src/utils/constants.js';
import { playSessionPlan } from '../src/play/config.js';
import {
  DEFAULT_PLAY_PREFERENCES,
  PLAY_PREFERENCE_KEY,
  loadPlayPreferences,
  savePlayPreferences,
} from '../src/settings/preferences.js';
import { assemblePrintPack } from '../src/print/pack.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    data,
  };
}

function gridSignature(grid, rows, cols) {
  const bits = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const walls = grid.getCell(row, col).walls;
      bits.push(`${walls[0] ? 1 : 0}${walls[1] ? 1 : 0}${walls[2] ? 1 : 0}${walls[3] ? 1 : 0}`);
    }
  }
  return bits.join('');
}

function organicSignature(maze) {
  return maze.graph.nodes
    .map((node) => {
      const neighbors = node.neighbors
        .map((neighbor) => (typeof neighbor === 'object' ? neighbor.id : neighbor))
        .slice()
        .sort((a, b) => a - b);
      return `${node.id}:${neighbors.join(',')}`;
    })
    .join('|');
}

describe('play preferences', () => {
  it('uses Easy and Classic when nothing is stored', () => {
    expect(loadPlayPreferences(memoryStorage())).toEqual(DEFAULT_PLAY_PREFERENCES);
    expect(loadPlayPreferences(null)).toEqual({ ageRange: '4-5', mazeStyle: 'classic' });
  });

  it('round-trips level and style and drops anything else', () => {
    const storage = memoryStorage();
    savePlayPreferences(storage, {
      ageRange: '9-11',
      mazeStyle: 'curvy',
      seed: 12345,
      stroke: [1, 2, 3],
    });
    expect(JSON.parse(storage.data[PLAY_PREFERENCE_KEY])).toEqual({
      ageRange: '9-11',
      mazeStyle: 'curvy',
    });
    expect(loadPlayPreferences(storage)).toEqual({ ageRange: '9-11', mazeStyle: 'curvy' });
  });

  it('falls back to the default for an invalid level or style', () => {
    const storage = memoryStorage({
      [PLAY_PREFERENCE_KEY]: JSON.stringify({ ageRange: 'nope', mazeStyle: 'squares' }),
    });
    expect(loadPlayPreferences(storage)).toEqual({ ageRange: '4-5', mazeStyle: 'squares' });

    storage.setItem(PLAY_PREFERENCE_KEY, '{');
    expect(loadPlayPreferences(storage)).toEqual(DEFAULT_PLAY_PREFERENCES);
  });
});

describe('play regenerate', () => {
  it('rolls a new seed when the level or style changes', () => {
    const rolls = [];
    const level = playSessionPlan({
      previousKey: '4-5|classic',
      ageRange: '9-11',
      mazeStyle: 'classic',
      reason: 'level',
      currentSeed: 40,
      rollSeed: () => {
        rolls.push('level');
        return 41;
      },
    });
    const style = playSessionPlan({
      previousKey: '9-11|classic',
      ageRange: '9-11',
      mazeStyle: 'jagged',
      reason: 'style',
      currentSeed: 41,
      rollSeed: () => {
        rolls.push('style');
        return 42;
      },
    });

    expect(level).toEqual({ key: '9-11|classic', regenerate: true, seed: 41 });
    expect(style).toEqual({ key: '9-11|jagged', regenerate: true, seed: 42 });
    expect(rolls).toEqual(['level', 'style']);
  });

  it('rolls a new seed for New maze and keeps the seed when the maze stays', () => {
    let calls = 0;
    const rolled = playSessionPlan({
      previousKey: '4-5|classic',
      ageRange: '4-5',
      mazeStyle: 'classic',
      reason: 'new',
      currentSeed: 7,
      rollSeed: () => {
        calls += 1;
        return 8;
      },
    });
    const kept = playSessionPlan({
      previousKey: '4-5|classic',
      ageRange: '4-5',
      mazeStyle: 'classic',
      reason: 'open',
      currentSeed: 7,
      rollSeed: () => {
        calls += 1;
        return 99;
      },
    });

    expect(rolled).toEqual({ key: '4-5|classic', regenerate: true, seed: 8 });
    expect(kept).toEqual({ key: '4-5|classic', regenerate: false, seed: 7 });
    expect(calls).toBe(1);
  });
});

describe('print pack includes the on-screen maze', () => {
  const playedSeed = 424242;
  const baseSeed = 900001;

  it('puts the played classic maze on page 1 and keeps the same geometry', () => {
    const preset = getDifficultyPreset('4-5');
    const played = generateMaze({
      ageRange: '4-5',
      seed: playedSeed,
      algorithm: preset.algorithm,
    });
    const included = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'classic',
      quantity: 3,
      baseSeed,
      includeCurrent: true,
      currentMaze: played,
    });
    const plain = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'classic',
      quantity: 3,
      baseSeed,
      includeCurrent: false,
    });
    const again = generateMaze({
      ageRange: '4-5',
      seed: played.seed,
      algorithm: preset.algorithm,
    });

    expect(included.mazes).toHaveLength(3);
    expect(included.includedCurrent).toBe(true);
    expect(included.mazes[0]).toBe(played);
    expect(included.mazes[0].seed).toBe(playedSeed);
    expect(gridSignature(played.grid, played.rows, played.cols)).toBe(
      gridSignature(again.grid, again.rows, again.cols)
    );
    expect(gridSignature(played.grid, played.rows, played.cols)).not.toBe(
      gridSignature(plain.mazes[0].grid, plain.mazes[0].rows, plain.mazes[0].cols)
    );
    expect(included.mazes[1].seed).toBe(plain.mazes[1].seed);
    expect(included.mazes[2].seed).toBe(baseSeed + 2);
    expect(gridSignature(included.mazes[1].grid, included.mazes[1].rows, included.mazes[1].cols)).toBe(
      gridSignature(plain.mazes[1].grid, plain.mazes[1].rows, plain.mazes[1].cols)
    );
    expect(included.filename).toBe('mazes-4-5-3pk.pdf');
  });

  it('matches a full pack from the same base seed when the option is off', () => {
    const preset = getDifficultyPreset('4-5');
    const pack = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'classic',
      quantity: 2,
      baseSeed,
      includeCurrent: false,
      currentMaze: generateMaze({ ageRange: '4-5', seed: playedSeed, algorithm: preset.algorithm }),
    });
    expect(pack.includedCurrent).toBe(false);
    expect(pack.mazes.map((maze) => maze.seed)).toEqual([baseSeed, baseSeed + 1]);
    expect(pack.mazes[0]).not.toBe(pack.mazes[1]);
  });

  it('keeps squares, circular, and jagged page 1 on the played seed', () => {
    const squares = generateSquaresMaze({ ageRange: '4-5', seed: playedSeed });
    const squaresPack = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'squares',
      quantity: 2,
      baseSeed,
      includeCurrent: true,
      currentMaze: squares,
    });
    const squaresAgain = generateSquaresMaze({ ageRange: '4-5', seed: playedSeed });
    expect(squaresPack.mazes[0]).toBe(squares);
    expect(squaresPack.mazes[0].seed).toBe(playedSeed);
    expect(squaresPack.mazes[1].seed).toBe(baseSeed + 1);
    expect(gridSignature(squares.outerGrid, squares.rows, squares.cols)).toBe(
      gridSignature(squaresAgain.outerGrid, squaresAgain.rows, squaresAgain.cols)
    );
    expect(squaresPack.filename).toBe('mazes-squares-4-5-2pk.pdf');

    const jagged = generateOrganicMaze({ ageRange: '4-5', seed: playedSeed });
    const jaggedPack = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'jagged',
      quantity: 2,
      baseSeed,
      includeCurrent: true,
      currentMaze: jagged,
    });
    const jaggedAgain = generateOrganicMaze({ ageRange: '4-5', seed: playedSeed });
    expect(jaggedPack.mazes[0].seed).toBe(playedSeed);
    expect(organicSignature(jagged)).toBe(organicSignature(jaggedAgain));
    expect(jaggedPack.mazes[1].seed).toBe(baseSeed + 1);
    expect(jaggedPack.styleForPdf).toBe('jagged');

    const circular = { layout: 'polar', seed: playedSeed, ageRange: '4-5' };
    const circularPack = assemblePrintPack({
      ageRange: '4-5',
      mazeStyle: 'circular',
      quantity: 1,
      baseSeed,
      includeCurrent: true,
      currentMaze: circular,
    });
    expect(circularPack.mazes).toEqual([circular]);
    expect(circularPack.mazes[0].seed).toBe(playedSeed);
    expect(circularPack.styleForPdf).toBe('classic');
    expect(circularPack.filename).toBe('mazes-circular-4-5-1pk.pdf');
  });

  it('leaves later pages of an older level on the same seeds when page 1 is replaced', () => {
    const preset = getDifficultyPreset('12-14');
    const played = generateMaze({
      ageRange: '12-14',
      seed: playedSeed,
      algorithm: preset.algorithm,
    });
    const included = assemblePrintPack({
      ageRange: '12-14',
      mazeStyle: 'classic',
      quantity: 3,
      baseSeed,
      includeCurrent: true,
      currentMaze: played,
    });
    const plain = assemblePrintPack({
      ageRange: '12-14',
      mazeStyle: 'classic',
      quantity: 3,
      baseSeed,
      includeCurrent: false,
    });
    expect(included.mazes[0]).toBe(played);
    expect(included.mazes.slice(1).map((maze) => [maze.seed, maze.algorithm])).toEqual(
      plain.mazes.slice(1).map((maze) => [maze.seed, maze.algorithm])
    );
  });
});
