/**
 * Normalized polar boundaries, center → outer edge.
 *
 * Index 0 is the center (0). Index 1 is the center-room edge.
 * Index r + 1 is the outer edge of maze ring r. The last index is 1.
 *
 * ratio 1 keeps the historical even maze rings (room = 1/maxRing,
 * remaining annulus split equally). ratio < 1 makes each ring outward
 * that fraction of the previous ring. roomScale is the center-room
 * width divided by the innermost maze ring. Same inputs → same fractions.
 *
 * @param {number} maxRing
 * @param {number} [ratio]
 * @param {number} [roomScale]
 * @returns {number[]}
 */
export function polarBoundaryFractions(maxRing, ratio = 1, roomScale = 1) {
  const n = maxRing;
  if (!(n >= 1)) throw new Error('polarBoundaryFractions requires maxRing >= 1');
  if (!(ratio > 0) || ratio === 1) {
    const room = 1 / n;
    const ringWidth = (1 - room) / n;
    const fractions = [0];
    for (let i = 0; i <= n; i++) fractions.push(room + i * ringWidth);
    fractions[fractions.length - 1] = 1;
    return fractions;
  }

  const scale = roomScale > 0 ? roomScale : 1;
  let weight = 1;
  let ringSum = 0;
  const weights = [];
  for (let r = 0; r < n; r++) {
    weights.push(weight);
    ringSum += weight;
    weight *= ratio;
  }
  const roomW = scale;
  const total = roomW + ringSum;
  const fractions = [0, roomW / total];
  let acc = roomW;
  for (let r = 0; r < n; r++) {
    acc += weights[r];
    fractions.push(acc / total);
  }
  fractions[fractions.length - 1] = 1;
  return fractions;
}
