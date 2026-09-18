// Tight Fit model: a job's stages generated from one persistent item.
// Pure and testable; rendering lives in stages.ts.
import {
  applyMoves, bboxMin, extents, normalize, orientations, randomPolycube, rotateCell, shapeKey, isPlanar,
  MOVES, type Cell, type Move,
} from '../polycube.ts';
import { isDroppable, depthVariety, land, type PackPuzzle, type Stage as PackStage } from '../pack.ts';
import { placeSil, passes, plateFor, silhouette, type Wall } from '../smuggle-model.ts';

export const cellKey = (c: Cell) => c.join(',');
const inverse = (m: Move): Move => ({ axis: m.axis, dir: m.dir > 0 ? -1 : 1 });

/** A deterministic asymmetric item of n cubes (planar allowed at 4 — no non-planar tetracube is asymmetric). */
export function makeItem(cubes: number, rng: () => number): Cell[] {
  for (let tries = 0; tries < 500; tries++) {
    const s = randomPolycube(cubes, rng);
    if (cubes >= 5 && isPlanar(s)) continue;
    if (orientations(s).length === 24) return s;
  }
  throw new Error('no item');
}

// ---------------------------------------------------------------- load (the van)

const LOAD_STAGE: PackStage = { from: 0, name: 'Load', distance: 1, cubes: 4, marker: true, glass: true, randomCamera: false, nonPlanar: false, varyDepth: false };

/**
 * A van slot for `item` in its current orientation: the slot is the item in a
 * droppable orientation exactly `distance` turns away. Same shape as a pack puzzle.
 */
export function makeLoad(item: Cell[], distance: number, rng: () => number, marker = true): PackPuzzle {
  const piece = normalize(item);
  const all = orientations(piece);
  const droppable = all.filter((o) => isDroppable(o.cells));
  const wanted = droppable.filter((o) => o.dist === distance);
  const pool = wanted.length ? wanted : droppable.filter((o) => o.dist > 0);
  const varied = pool.filter((o) => depthVariety(o.cells) > 1);
  const from = varied.length && rng() < 0.6 ? varied : pool;
  const targetO = from[Math.floor(rng() * from.length)];
  const target = targetO.cells;
  const solution = targetO.path;
  const [ew, eh, ed] = extents(target);
  const MARGIN = 2;
  const mold = { w: ew + 1 + 2 * MARGIN, h: eh + 2, d: ed + 1 + 2 * MARGIN };
  const cavityOrigin: Cell = [MARGIN, mold.h - (eh + 1), MARGIN];
  const cavity = target.map(([x, y, z]) => [x + cavityOrigin[0], y + cavityOrigin[1], z + cavityOrigin[2]] as Cell);
  let markerPiece = -1, markerCavity = -1;
  if (marker) {
    markerPiece = 0;
    const rotated = applyMoves(piece, solution);
    const min = bboxMin(rotated);
    const mc = rotated[0];
    markerCavity = target.findIndex((c) => c[0] === mc[0] - min[0] && c[1] === mc[1] - min[1] && c[2] === mc[2] - min[2]);
  }
  return {
    id: shapeKey(piece).slice(0, 8), seed: 0, stage: { ...LOAD_STAGE, distance, cubes: piece.length, marker },
    piece, target, cavityOrigin, cavity, mold, solution, distance: targetO.dist, markerPiece, markerCavity,
    pose: { azimuth: 35, elevation: 34 },
  };
}

export { land };

// ---------------------------------------------------------------- doorway

export interface Doorway { wall: Wall; par: number }

/** A doorway the item's current silhouette cannot pass, needing about `distance` turns. */
export function makeDoorway(item: Cell[], distance: number, rng: () => number): Doorway {
  const cur = normalize(item);
  const curSil = placeSil(cur).keys;
  const all = orientations(cur).filter((o) => o.dist > 0);
  const cannotPass = all.filter((o) => ![...curSil].every((k) => placeSil(o.cells).keys.has(k)));
  const pool = cannotPass.filter((o) => o.dist === distance);
  const pick = (pool.length ? pool : cannotPass)[Math.floor(rng() * (pool.length ? pool.length : cannotPass.length))];
  const opening = placeSil(pick.cells).keys;
  const wall: Wall = { opening, plate: plateFor(opening), z: 0 };
  return { wall, par: doorPar(cur, wall) };
}

/** Fewest turns from the current orientation to any orientation that passes. */
export function doorPar(cur: Cell[], wall: Wall) {
  const os = orientations(cur);
  return Math.min(...os.filter((o) => passes(o.cells, wall)).map((o) => o.dist));
}

export { passes, silhouette };

// ---------------------------------------------------------------- corner (the van turns)

export interface Body { cells: Cell[]; name: string; color: number }
export interface Corner { n: number; fixed: Cell[]; bodies: Body[]; move: Move; final: Cell[][]; answer: number; socket: Cell }

/** Rigid bodies fall along g until any cell is blocked; nearest the new floor settles first. */
export function settleBodies(n: number, fixed: Cell[], bodies: Cell[][], g: Cell): Cell[][] {
  const solid = new Set(fixed.map(cellKey));
  const inside = (c: Cell) => c.every((v) => v >= 0 && v < n);
  const depth = (cells: Cell[]) => Math.max(...cells.map((c) => c[0] * g[0] + c[1] * g[1] + c[2] * g[2]));
  const order = bodies.map((b, i) => ({ i, d: depth(b) })).sort((a, b) => b.d - a.d);
  const out: Cell[][] = bodies.map((b) => b);
  for (const { i } of order) {
    let cells = bodies[i];
    for (;;) {
      const next = cells.map(([x, y, z]) => [x + g[0], y + g[1], z + g[2]] as Cell);
      if (!next.every(inside) || next.some((c) => solid.has(cellKey(c)))) break;
      cells = next;
    }
    out[i] = cells;
    for (const c of cells) solid.add(cellKey(c));
  }
  return out;
}

/** The cargo hold: the item plus a few others, resting; the van turns; which item lands in the socket? */
export function makeCorner(item: Cell[], others: Body[], rng: () => number, itemName = 'your item', itemColor = 0xf5a524): Corner {
  const n = 5;
  const bodiesIn: Body[] = [{ cells: normalize(item), name: itemName, color: itemColor }, ...others];
  for (let tries = 0; tries < 400; tries++) {
    const taken = new Set<string>();
    const fixed: Cell[] = [];
    while (fixed.length < 3) {
      const c: Cell = [Math.floor(rng() * n), Math.floor(rng() * n), Math.floor(rng() * n)];
      if (!taken.has(cellKey(c))) { taken.add(cellKey(c)); fixed.push(c); }
    }
    // Place each body at a random offset inside the hold without overlap, then let them rest.
    const placed: Cell[][] = [];
    let ok = true;
    for (const b of bodiesIn) {
      const [ex, ey, ez] = extents(b.cells);
      let done = false;
      for (let t = 0; t < 40 && !done; t++) {
        const o: Cell = [Math.floor(rng() * (n - ex)), Math.floor(rng() * (n - ey)), Math.floor(rng() * (n - ez))];
        const cells = b.cells.map(([x, y, z]) => [x + o[0], y + o[1], z + o[2]] as Cell);
        if (cells.every((c) => !taken.has(cellKey(c)))) { for (const c of cells) taken.add(cellKey(c)); placed.push(cells); done = true; }
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    const rest = settleBodies(n, fixed, placed, [0, -1, 0]);
    const move = MOVES[Math.floor(rng() * MOVES.length)];
    const g = rotateCell([0, -1, 0], inverse(move));
    const final = settleBodies(n, fixed, rest, g);
    const moved = final.filter((f, i) => shapeKey(f) !== shapeKey(rest[i]) || cellKey(bboxMin(f)) !== cellKey(bboxMin(rest[i]))).length;
    if (moved < 2) continue;
    const answer = Math.floor(rng() * bodiesIn.length);
    const finalCells = final[answer];
    const socket = finalCells[Math.floor(rng() * finalCells.length)];
    // The socket must be empty before the turn and reached only by the answer body.
    if (rest.some((b) => b.some((c) => cellKey(c) === cellKey(socket)))) continue;
    return { n, fixed, bodies: bodiesIn.map((b, i) => ({ ...b, cells: rest[i] })), move, final, answer, socket };
  }
  throw new Error('no corner');
}

export { rotateCell, inverse };
