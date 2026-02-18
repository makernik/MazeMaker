/**
 * One-time script: create public/samples/ and a minimal 1x1 PNG placeholder.
 * Run: node scripts/create-sample-placeholder.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const samplesDir = path.join(root, 'public', 'samples');
const minimalPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

fs.mkdirSync(samplesDir, { recursive: true });
fs.writeFileSync(path.join(samplesDir, '3-rounded.png'), minimalPng);
fs.writeFileSync(path.join(samplesDir, '4-5-rounded.png'), minimalPng);
console.log('Created public/samples/3-rounded.png and 4-5-rounded.png');
