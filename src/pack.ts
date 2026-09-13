// Prototype 1 model: a piece hovers over a mold with a cavity carved from the top.
// The cavity *is* the piece in some droppable orientation, so every round is
// solvable and (for asymmetric pieces) the fitting orientation is unique.
import {
  applyMoves, bboxMin, extents, isPlanar, normalize, orientations, randomPolycube, shapeKey,
  type Cell, type Move,
} from './polycube.ts';
import type { CameraPose } from './puzzle.ts';

export interface Stage {
  /** Score at which this stage begins. */
  from: number;
  name: string;
  distance: number;
  cubes: number;
  marker: boolean;
  /** Translucent mold: the cavity reads as a visible negative shape. Opaque makes depth-reading part of the task. */
  glass: boolean;
  randomCamera: boolean;
  nonPlanar: boolean;
  /** Prefer cavities whose columns have differing depths (harder to read than a flat footprint). */
  varyDepth: boolean;
}

export const STAGES: Stage[] = [
  { from: 0, name: 'One turn', distance: 1, cubes: 4, marker: true, glass: true, randomCamera: false, nonPlanar: false, varyDepth: false },
  { from: 3, name: 'Two turns', distance: 2, cubes: 4, marker: true, glass: true, randomCamera: false, nonPlanar: false, varyDepth: false },
  { from: 6, name: 'Deeper holes', distance: 2, cubes: 5, marker: false, glass: true, randomCamera: false, nonPlanar: true, varyDepth: true },
  { from: 9, name: 'New viewpoint', distance: 2, cubes: 5, marker: false, glass: true, randomCamera: true, nonPlanar: true, varyDepth: true },
  { from: 12, name: 'Three turns', distance: 3, cubes: 5, marker: false, glass: true, randomCamera: true, nonPlanar: true, varyDepth: true },
  { from: 16, name: 'Solid mold', distance: 3, cubes: 5, marker: false, glass: false, randomCamera: true, nonPlanar: true, varyDepth: true },
];

export const stageForScore = (score: number) => [...STAGES].reverse().find((s) => score >= s.from)!;

const MARGIN = 2;
export const cellKey = (c: Cell) => c.join(',');

/**
 * A cavity can only be filled from above if, in every (x,z) column, the piece's
 * cells form one contiguous run that reaches the piece's top layer.
 */
export function isDroppable(cells: Cell[]): boolean {
  const top = Math.max(...cells.map((c) => c[1]));
  const cols = new Map<string, number[]>();
  for (const [x, y, z] of cells) {
    const k = `${x},${z}`;
    (cols.get(k) ?? cols.set(k, []).get(k)!).push(y);
  }
  for (const ys of cols.values()) {
    ys.sort((a, b) => a - b);
    if (ys[ys.length - 1] !== top) return false;
    for (let i = 1; i < ys.length; i++) if (ys[i] !== ys[i - 1] + 1) return false;
  }
  return true;
}

/** Number of distinct column depths in a droppable orientation. */
export function depthVariety(cells: Cell[]): number {
  const depths = new Map<string, number>();
  for (const [x, , z] of cells) {
    const k = `${x},${z}`;
    depths.set(k, (depths.get(k) ?? 0) + 1);
  }
  return new Set(depths.values()).size;
}

export interface PackPuzzle {
  id: string;
  seed: number;
  stage: Stage;
  /** Piece in its starting orientation, normalised. */
  piece: Cell[];
  /** Piece in the fitting orientation, normalised. */
  target: Cell[];
  /** Where the target's min corner sits in mold coordinates. */
  cavityOrigin: Cell;
  /** Cavity cells in mold coordinates. */
  cavity: Cell[];
  /** Mold dimensions; mold cells are every lattice cell inside minus the cavity. */
  mold: { w: number; h: number; d: number };
  solution: Move[];
  distance: number;
  markerPiece: number;
  markerCavity: number;
  pose: CameraPose;
}

const DEFAULT_POSE: CameraPose = { azimuth: 35, elevation: 34 };

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function makePackPuzzle(stage: Stage, seed: number, rng: () => number, accept: (p: PackPuzzle) => boolean): PackPuzzle {
  let last: PackPuzzle | null = null;
  for (let tries = 0; tries < 400; tries++) {
    const shape = randomPolycube(stage.cubes, rng);
    if (stage.nonPlanar && isPlanar(shape)) continue;
    const all = orientations(shape);
    if (all.length !== 24) continue;

    let droppable = all.filter((o) => isDroppable(o.cells));
    if (!droppable.length) continue;
    if (stage.varyDepth) {
      const varied = droppable.filter((o) => depthVariety(o.cells) > 1);
      if (varied.length) droppable = varied;
    }
    const targetO = droppable[Math.floor(rng() * droppable.length)];

    // Shortest paths *from the target*; the start is any orientation at the wanted distance
    // and the solution is the reverse path (each turn inverted).
    const fromTarget = orientations(targetO.cells);
    const maxD = Math.max(...fromTarget.map((o) => o.dist));
    const distance = Math.min(stage.distance, maxD);
    const cands = fromTarget.filter((o) => o.dist === distance);
    const startO = cands[Math.floor(rng() * cands.length)];
    const solution: Move[] = [...startO.path].reverse().map((m) => ({ axis: m.axis, dir: m.dir > 0 ? -1 : 1 }));

    const piece = startO.cells;
    const target = targetO.cells;
    if (shapeKey(applyMoves(piece, solution)) !== shapeKey(target)) continue; // defensive

    const [ew, eh, ed] = extents(target);
    const mold = { w: ew + 1 + 2 * MARGIN, h: eh + 2, d: ed + 1 + 2 * MARGIN };
    const cavityOrigin: Cell = [MARGIN, mold.h - (eh + 1), MARGIN];
    const cavity = target.map(([x, y, z]) => [x + cavityOrigin[0], y + cavityOrigin[1], z + cavityOrigin[2]] as Cell);

    let markerPiece = -1, markerCavity = -1;
    if (stage.marker) {
      markerPiece = Math.floor(rng() * piece.length);
      const rotated = applyMoves(piece, solution);
      const min = bboxMin(rotated);
      const mc = rotated[markerPiece];
      markerCavity = target.findIndex((c) => c[0] === mc[0] - min[0] && c[1] === mc[1] - min[1] && c[2] === mc[2] - min[2]);
    }
    const pose: CameraPose = stage.randomCamera
      ? { azimuth: 90 * Math.floor(rng() * 4) + 15 + rng() * 60, elevation: 26 + rng() * 22 }
      : DEFAULT_POSE;

    last = {
      id: fnv(`${shapeKey(piece)}|${shapeKey(target)}|${pose.azimuth.toFixed(1)}`),
      seed, stage, piece, target, cavityOrigin, cavity, mold, solution, distance, markerPiece, markerCavity, pose,
    };
    if (accept(last) || tries > 300) return last;
  }
  if (last) return last;
  throw new Error('could not generate a pack puzzle');
}

export interface Landing {
  /** Where the piece's normalised cells end up, in mold coordinates. */
  origin: Cell;
  cells: Cell[];
  fits: boolean;
}

/**
 * Drop the piece (in whatever orientation `rotated` describes) straight down over the
 * cavity. It is centred on the cavity footprint, then falls until any cell meets solid.
 */
export function land(p: PackPuzzle, rotated: Cell[]): Landing {
  const n = normalize(rotated);
  const [nw, , nd] = extents(n);
  const [tw, , td] = extents(p.target);
  const ox = p.cavityOrigin[0] + Math.round((tw - nw) / 2);
  const oz = p.cavityOrigin[2] + Math.round((td - nd) / 2);
  const cavitySet = new Set(p.cavity.map(cellKey));

  // Lowest free cell in a column: cavity floor inside the hole, mold top on the slab, ground outside.
  const top = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= p.mold.w || z >= p.mold.d) return 0;
    let floor = p.mold.h;
    for (const c of p.cavity) if (c[0] === x && c[2] === z) floor = Math.min(floor, c[1]);
    return floor;
  };
  let oy = -Infinity;
  for (const [x, y, z] of n) oy = Math.max(oy, top(x + ox, z + oz) - y);

  const cells = n.map(([x, y, z]) => [x + ox, y + oy, z + oz] as Cell);
  const fits = cells.length === p.cavity.length && cells.every((c) => cavitySet.has(cellKey(c)));
  return { origin: [ox, oy, oz], cells, fits };
}
