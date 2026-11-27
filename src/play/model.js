/**
 * Play model: solution, open-passage graph, and coordinate mapping.
 * Topology is independent of the canvas. View mapping follows the current layout.
 */

import { DIRECTIONS, DIRECTION_OFFSETS } from '../maze/grid.js';
import { solveMaze } from '../maze/solver.js';
import { computeCorridorWidth } from '../pdf/drawers/organic-geometry.js';
import { locateGrid, locateOrganic, locatePolar, gridKey, parseGridKey } from './locate.js';

/**
 * @param {object} maze
 * @param {object} layoutResult
 * @returns {{ topology: object, view: object }}
 */
export function buildPlayModel(maze, layoutResult) {
  const solution = solveMaze(maze);
  if (!solution || !solution.solved || !solution.path?.length) {
    throw new Error('Play maze is not solvable');
  }
  const topology = buildTopology(maze, solution.path);
  const view = buildView(maze, layoutResult);
  return { topology, view };
}

/**
 * @param {object} maze
 * @param {object} topology
 * @param {object} layoutResult
 */
export function buildView(maze, layoutResult) {
  if (maze.layout === 'organic') {
    const { offsetX, offsetY, scale } = layoutResult;
    const { corridorWidth } = computeCorridorWidth(maze.graph, layoutResult.lineThickness);
    return {
      markerWidth: Math.max(4, corridorWidth * scale * 0.45),
      toLayout(p) {
        return { x: offsetX + p.x * scale, y: offsetY + p.y * scale };
      },
      fromLayout(x, y) {
        return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
      },
    };
  }

  if (maze.layout === 'polar') {
    const { centerX, centerY, maxRadius, roomRadius } = layoutResult;
    const ringWidth = (maxRadius - roomRadius) / maze.polarGrid.maxRing;
    return {
      markerWidth: Math.max(4, ringWidth * 0.32),
      toLayout(p) {
        return { x: centerX + p.x * maxRadius, y: centerY + p.y * maxRadius };
      },
      fromLayout(x, y) {
        return { x: (x - centerX) / maxRadius, y: (y - centerY) / maxRadius };
      },
    };
  }

  const { offsetX, offsetY, cellSize } = layoutResult;
  const rows = maze.layout === 'squares' ? maze.outerGrid.rows : maze.grid.rows;
  let markerWidth = Math.max(4, cellSize * 0.3);
  if (maze.layout === 'squares') {
    const K = maze.roomsGrid?.roomOuterSize || 1;
    const S = maze.roomsGrid?.roomSubSize || 1;
    const sub = cellSize * (K / S);
    markerWidth = Math.max(3.5, Math.min(cellSize, sub) * 0.36);
  }
  return {
    markerWidth,
    toLayout(p) {
      return {
        x: offsetX + p.x * cellSize,
        y: offsetY + (rows - p.y) * cellSize,
      };
    },
    fromLayout(x, y) {
      return {
        x: (x - offsetX) / cellSize,
        y: rows - (y - offsetY) / cellSize,
      };
    },
  };
}

function buildTopology(maze, path) {
  if (maze.layout === 'organic') return organicTopology(maze, path);
  if (maze.layout === 'polar') return polarTopology(maze, path);
  if (maze.layout === 'squares') return squaresTopology(maze, path);
  return gridTopology(maze, path);
}

function gridTopology(maze, path) {
  const grid = maze.grid;
  const neighbors = new Map();
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const list = [];
      const cell = grid.getCell(r, c);
      for (const dir of Object.values(DIRECTIONS)) {
        if (cell.hasWall(dir)) continue;
        const [dr, dc] = DIRECTION_OFFSETS[dir];
        const nr = r + dr;
        const nc = c + dc;
        if (!grid.isValidPosition(nr, nc)) continue;
        list.push(gridKey(nr, nc));
      }
      neighbors.set(gridKey(r, c), list);
    }
  }
  const start = grid.start;
  const startKey = gridKey(start.row, start.col);
  const solution = path.map((p) => gridKey(p.row, p.col));
  return {
    solution,
    neighbors,
    sampleStep: 0.2,
    center(key) {
      const cell = parseGridKey(key);
      return { x: cell.col + 0.5, y: cell.row + 0.5 };
    },
    locate(point, currentKey, tolerance) {
      return locateGrid(grid, tolerance, point, currentKey, startKey);
    },
  };
}

function organicTopology(maze, path) {
  const graph = maze.graph;
  const { halfW } = computeCorridorWidth(graph);
  const neighbors = new Map();
  for (const node of graph.nodes) {
    const list = [];
    const nids = graph.getNeighbors(node.id);
    for (let i = 0; i < nids.length; i++) {
      if (!graph.hasWall(node.id, nids[i])) list.push(String(nids[i]));
    }
    neighbors.set(String(node.id), list);
  }
  return {
    solution: path.map((id) => String(id)),
    neighbors,
    sampleStep: Math.max(halfW * 0.3, 0.5),
    center(key) {
      const node = graph.getNode(Number(key));
      return { x: node.x, y: node.y };
    },
    locate(point, currentKey, tolerance) {
      return locateOrganic(graph, halfW, maze.startId, tolerance, point, currentKey);
    },
  };
}

function polarTopology(maze, path) {
  const grid = maze.polarGrid;
  const maxRing = grid.maxRing;
  const roomNorm = 1 / maxRing;
  const ringNorm = (1 - roomNorm) / maxRing;
  const geom = { roomNorm, ringNorm };
  const neighbors = new Map();
  for (let ring = 0; ring < grid.rings; ring++) {
    const wedges = grid.wedgesAtRing(ring);
    for (let wedge = 0; wedge < wedges; wedge++) {
      const list = grid.getNeighbors(ring, wedge).map((n) => `${n.ring},${n.wedge}`);
      neighbors.set(`${ring},${wedge}`, list);
    }
  }
  const start = maze.start ?? grid.start;
  return {
    solution: path.map((p) => `${p.ring},${p.wedge}`),
    neighbors,
    sampleStep: Math.max(ringNorm * 0.25, 0.02),
    center(key) {
      const [ring, wedge] = key.split(',').map(Number);
      if (ring === 0) return { x: 0, y: 0 };
      const radius = roomNorm + (ring - 0.5) * ringNorm;
      const step = (Math.PI * 2) / grid.wedgesAtRing(ring);
      const angle = (wedge + 0.5) * step;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    },
    locate(point, currentKey, tolerance) {
      return locatePolar(grid, geom, tolerance, { nx: point.x, ny: point.y }, currentKey, start);
    },
  };
}

function outerKey(row, col) {
  return `o:${row},${col}`;
}

function subKey(room, row, col) {
  return `s:${room.outerRow},${room.outerCol}:${row},${col}`;
}

function sameCell(a, b) {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

function isInterior(room, row, col) {
  return (
    row >= room.outerRow &&
    row < room.outerRow + room.outerSize &&
    col >= room.outerCol &&
    col < room.outerCol + room.outerSize
  );
}

function subEntranceKey(room, openingRow, openingCol) {
  const index = room.openingCells.findIndex((o) => o.row === openingRow && o.col === openingCol);
  if (index < 0) return null;
  const sub = index === 0 ? room.subStart : room.subFinish;
  if (!sub) return null;
  return subKey(room, sub.row, sub.col);
}

function squaresTopology(maze, path) {
  const grid = maze.outerGrid;
  const roomsGrid = maze.roomsGrid;
  const rooms = [...roomsGrid.roomCells.values()];
  const neighbors = new Map();

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (roomsGrid.isRoomCell(r, c)) continue;
      const list = [];
      const cell = grid.getCell(r, c);
      for (const dir of Object.values(DIRECTIONS)) {
        if (cell.hasWall(dir)) continue;
        const [dr, dc] = DIRECTION_OFFSETS[dir];
        const nr = r + dr;
        const nc = c + dc;
        if (!grid.isValidPosition(nr, nc)) continue;
        if (roomsGrid.isRoomCell(nr, nc)) {
          const room = roomsGrid.getRoomCell(nr, nc);
          const entrance = room ? subEntranceKey(room, r, c) : null;
          if (entrance && !list.includes(entrance)) list.push(entrance);
        } else {
          list.push(outerKey(nr, nc));
        }
      }
      for (const room of rooms) {
        for (let i = 0; i < room.openingCells.length; i++) {
          const opening = room.openingCells[i];
          if (!opening || opening.row !== r || opening.col !== c) continue;
          const sub = i === 0 ? room.subStart : room.subFinish;
          if (!sub) continue;
          const key = subKey(room, sub.row, sub.col);
          if (!list.includes(key)) list.push(key);
        }
      }
      neighbors.set(outerKey(r, c), list);
    }
  }

  for (const room of rooms) {
    const sub = room.subGrid;
    for (let r = 0; r < sub.rows; r++) {
      for (let c = 0; c < sub.cols; c++) {
        const list = [];
        const cell = sub.getCell(r, c);
        for (const dir of Object.values(DIRECTIONS)) {
          if (cell.hasWall(dir)) continue;
          const [dr, dc] = DIRECTION_OFFSETS[dir];
          const nr = r + dr;
          const nc = c + dc;
          if (!sub.isValidPosition(nr, nc)) continue;
          list.push(subKey(room, nr, nc));
        }
        if (room.subStart && room.subStart.row === r && room.subStart.col === c && room.openingCells[0]) {
          list.push(outerKey(room.openingCells[0].row, room.openingCells[0].col));
        }
        if (room.subFinish && room.subFinish.row === r && room.subFinish.col === c && room.openingCells[1]) {
          const exit = outerKey(room.openingCells[1].row, room.openingCells[1].col);
          if (!list.includes(exit)) list.push(exit);
        }
        neighbors.set(subKey(room, r, c), list);
      }
    }
  }

  const solution = expandSquaresPath(maze, path);
  let minSpan = 1;
  for (const room of rooms) {
    minSpan = Math.min(minSpan, room.outerSize / room.subGrid.rows);
  }

  const start = grid.start;
  const startKey = outerKey(start.row, start.col);

  return {
    solution,
    neighbors,
    sampleStep: Math.max(0.05, 0.2 * minSpan),
    center(key) {
      if (key.startsWith('o:')) {
        const cell = parseGridKey(key.slice(2));
        return { x: cell.col + 0.5, y: cell.row + 0.5 };
      }
      const parts = key.slice(2).split(':');
      const [or, oc] = parts[0].split(',').map(Number);
      const [sr, sc] = parts[1].split(',').map(Number);
      const room = rooms.find((item) => item.outerRow === or && item.outerCol === oc);
      const S = room.subGrid.rows;
      const K = room.outerSize;
      return {
        x: room.outerCol + ((sc + 0.5) / S) * K,
        y: room.outerRow + ((sr + 0.5) / S) * K,
      };
    },
    locate(point, currentKey, tolerance) {
      return locateSquares(maze, rooms, startKey, point, currentKey, tolerance);
    },
  };
}

function expandSquaresPath(maze, path) {
  const rooms = [...maze.roomsGrid.roomCells.values()];
  const keys = [];
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    const roomHere = maze.roomsGrid.getRoomCell(cell.row, cell.col);
    if (roomHere && isInterior(roomHere, cell.row, cell.col)) {
      keys.push(...subPathKeys(roomHere, path[i - 1], path[i + 1]));
      continue;
    }
    keys.push(outerKey(cell.row, cell.col));
    const next = path[i + 1];
    if (!next) continue;
    const linked = rooms.find((room) => {
      const [a, b] = room.openingCells;
      return (sameCell(a, cell) && sameCell(b, next)) || (sameCell(b, cell) && sameCell(a, next));
    });
    if (linked) keys.push(...subPathKeys(linked, cell, next));
  }
  return keys;
}

function subPathKeys(room, fromOuter, toOuter) {
  const forward = sameCell(room.openingCells[0], fromOuter) || sameCell(room.openingCells[1], toOuter);
  const ordered = forward ? room.subSolutionPath : [...room.subSolutionPath].reverse();
  return ordered.map((cell) => subKey(room, cell.row, cell.col));
}

function locateSquares(maze, rooms, startKey, point, currentKey, tolerance) {
  if (!currentKey) {
    const start = maze.outerGrid.start;
    if (pointInCell(point, start.row, start.col, tolerance)) return startKey;
    return null;
  }

  if (currentKey.startsWith('o:')) {
    const here = parseGridKey(currentKey.slice(2));
    const entered = enterLinkedRoom(rooms, here.row, here.col, point, tolerance);
    if (entered) return entered;

    const stepped = locateGrid(
      maze.outerGrid,
      tolerance,
      point,
      gridKey(here.row, here.col),
      gridKey(here.row, here.col)
    );
    if (!stepped) return null;
    if (stepped === gridKey(here.row, here.col)) return currentKey;

    const next = parseGridKey(stepped);
    if (maze.roomsGrid.isRoomCell(next.row, next.col)) {
      const room = maze.roomsGrid.getRoomCell(next.row, next.col);
      return subEntranceKey(room, here.row, here.col);
    }
    return outerKey(next.row, next.col);
  }

  const room = roomFromSubKey(rooms, currentKey);
  const subHere = parseGridKey(currentKey.split(':')[2]);
  const exit = exitRoom(room, subHere.row, subHere.col, point, tolerance);
  if (exit) return exit;

  const local = toSubPoint(room, point);
  const stepped = locateGrid(
    room.subGrid,
    tolerance,
    local,
    gridKey(subHere.row, subHere.col),
    gridKey(subHere.row, subHere.col)
  );
  if (!stepped) return null;
  const next = parseGridKey(stepped);
  return subKey(room, next.row, next.col);
}

function pointInCell(point, row, col, t) {
  return point.x >= col - t && point.x <= col + 1 + t && point.y >= row - t && point.y <= row + 1 + t;
}

function roomFromSubKey(rooms, key) {
  const [origin] = key.slice(2).split(':');
  const [or, oc] = origin.split(',').map(Number);
  return rooms.find((room) => room.outerRow === or && room.outerCol === oc);
}

function toSubPoint(room, point) {
  const S = room.subGrid.rows;
  const K = room.outerSize;
  return {
    x: ((point.x - room.outerCol) / K) * S,
    y: ((point.y - room.outerRow) / K) * S,
  };
}

function enterLinkedRoom(rooms, row, col, point, tolerance) {
  for (const room of rooms) {
    for (let i = 0; i < room.openingCells.length; i++) {
      const opening = room.openingCells[i];
      if (!opening || opening.row !== row || opening.col !== col) continue;
      const sub = i === 0 ? room.subStart : room.subFinish;
      if (!sub) continue;
      if (insideSubCell(room, sub.row, sub.col, point, tolerance)) {
        return subKey(room, sub.row, sub.col);
      }
    }
  }
  return null;
}

function insideSubCell(room, row, col, point, tolerance) {
  const S = room.subGrid.rows;
  const K = room.outerSize;
  const slack = tolerance * (K / S);
  const x0 = room.outerCol + (col / S) * K;
  const y0 = room.outerRow + (row / S) * K;
  const span = K / S;
  return (
    point.x >= x0 - slack &&
    point.x <= x0 + span + slack &&
    point.y >= y0 - slack &&
    point.y <= y0 + span + slack &&
    point.x >= room.outerCol - 1e-6 &&
    point.x <= room.outerCol + K + 1e-6 &&
    point.y >= room.outerRow - 1e-6 &&
    point.y <= room.outerRow + K + 1e-6
  );
}

function exitRoom(room, row, col, point, tolerance) {
  const exits = [];
  if (room.subStart && room.subStart.row === row && room.subStart.col === col && room.openingCells[0]) {
    exits.push(room.openingCells[0]);
  }
  if (room.subFinish && room.subFinish.row === row && room.subFinish.col === col && room.openingCells[1]) {
    exits.push(room.openingCells[1]);
  }
  for (const opening of exits) {
    const inside =
      point.x >= opening.col &&
      point.x <= opening.col + 1 &&
      point.y >= opening.row &&
      point.y <= opening.row + 1;
    if (inside) return outerKey(opening.row, opening.col);
  }
  return null;
}
