// Mate: pieces attack where their shadow falls. A piece is a polycube pinned above a board cell by
// its origin cube; its attack set is the board projection of all its cubes, minus the anchor.
// A move is a one-cell slide or a quarter-turn about a world axis through the origin cube.
// Puzzles: find the one move that leaves the red king with no safe square.
import { rotateCell, MOVES, type Cell, type Move } from '../polycube.ts';

export type P = readonly [number, number];
export const key = (p: P) => `${p[0]},${p[1]}`;
export const SLIDES: Record<string, P> = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] };
export type Action = { type: 'turn'; move: Move } | { type: 'slide'; dir: keyof typeof SLIDES };
export const ACTIONS: readonly Action[] = [
  ...MOVES.map((move) => ({ type: 'turn', move }) as Action),
  ...(Object.keys(SLIDES) as (keyof typeof SLIDES)[]).map((dir) => ({ type: 'slide', dir }) as Action),
];
export const actionLabel = (a: Action) => (a.type === 'turn' ? `turn ${a.move.axis.toUpperCase()}${a.move.dir > 0 ? '+' : '−'}` : `slide ${a.dir.toUpperCase().replace('-', '−')}`);

/** Base shapes; cell 0 is the origin cube (the pivot, pinned above the anchor). */
export const SHAPES: Record<string, Cell[]> = {
  L3: [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
  I3: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
  T4: [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1]],
  S4: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 1]],
  L4: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]],
  Y4: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
};

export interface Piece { cells: Cell[]; anchor: P }
export interface State { n: number; king: P; pieces: Piece[] }
export interface Puzzle extends State { answer: { piece: number; action: Action } }

const onBoard = (n: number, p: P) => p[0] >= 0 && p[1] >= 0 && p[0] < n && p[1] < n;

/** Board cells this piece attacks: its shadow minus its own anchor, clipped to the board. */
export function attacks(n: number, pc: Piece): Set<string> {
  const out = new Set<string>();
  for (const [x, , z] of pc.cells) {
    const p: P = [x + pc.anchor[0], z + pc.anchor[1]];
    if ((x || z) && onBoard(n, p)) out.add(key(p));
  }
  return out;
}
export function allAttacks(s: State): Set<string> {
  const out = new Set<string>();
  for (const pc of s.pieces) for (const k of attacks(s.n, pc)) out.add(k);
  return out;
}

/** Where a piece's cubes physically sit: grounded so its lowest cube rests on the board. */
export function worldCells(pc: Piece): Cell[] {
  const minY = Math.min(...pc.cells.map((c) => c[1]));
  return pc.cells.map((c) => [c[0] + pc.anchor[0], c[1] - minY, c[2] + pc.anchor[1]]);
}
/** Physically possible: no two cubes in one cell, and nothing on the king's own cell at ground level. */
export function valid(s: State): boolean {
  const seen = new Set<string>();
  for (const pc of s.pieces) for (const c of worldCells(pc)) {
    const k = c.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    if (c[0] === s.king[0] && c[2] === s.king[1] && c[1] === 0) return false;
  }
  return true;
}

const NEIGH: readonly P[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Squares the king could step to: on the board and not under a piece. */
export const kingSquares = (s: State): P[] => NEIGH.map((d) => [s.king[0] + d[0], s.king[1] + d[1]] as P).filter((p) => onBoard(s.n, p) && !s.pieces.some((pc) => key(pc.anchor) === key(p)));
export const inCheck = (s: State) => allAttacks(s).has(key(s.king));
export function isMate(s: State) {
  const att = allAttacks(s);
  return att.has(key(s.king)) && kingSquares(s).every((p) => att.has(key(p)));
}

/** Apply an action to piece i, or null if illegal (slides off the board or onto something). */
export function apply(s: State, i: number, a: Action): State | null {
  const pc = s.pieces[i];
  let next: Piece;
  if (a.type === 'turn') next = { cells: pc.cells.map((c) => rotateCell(c, a.move)), anchor: pc.anchor };
  else {
    const d = SLIDES[a.dir];
    const anchor: P = [pc.anchor[0] + d[0], pc.anchor[1] + d[1]];
    if (!onBoard(s.n, anchor) || key(anchor) === key(s.king) || s.pieces.some((o, j) => j !== i && key(o.anchor) === key(anchor))) return null;
    next = { cells: pc.cells, anchor };
  }
  const out = { ...s, pieces: s.pieces.map((o, j) => (j === i ? next : o)) };
  return valid(out) ? out : null;
}

export function matingMoves(s: State): { piece: number; action: Action }[] {
  const out: { piece: number; action: Action }[] = [];
  s.pieces.forEach((_, i) => { for (const a of ACTIONS) { const t = apply(s, i, a); if (t && isMate(t)) out.push({ piece: i, action: a }); } });
  return out;
}

export interface Spec { n: number; pieces: number; answer: 'any' | 'turn' | 'tilt'; shapes: string[] }
/** Difficulty by level: the answer must be a turn, then a turn about a horizontal axis (the shadow changes shape), then three pieces. */
export function spec(level: number): Spec {
  if (level < 2) return { n: 5, pieces: 2, answer: 'any', shapes: ['L3', 'I3', 'T4', 'L4'] };
  if (level < 4) return { n: 5, pieces: 2, answer: 'turn', shapes: ['L3', 'T4', 'L4', 'S4'] };
  if (level < 6) return { n: 6, pieces: 2, answer: 'tilt', shapes: ['L3', 'T4', 'L4', 'S4', 'Y4'] };
  return { n: 6, pieces: 3, answer: 'tilt', shapes: ['L3', 'T4', 'L4', 'S4', 'Y4'] };
}

const fits = (sp: Spec, a: Action) => sp.answer === 'any' || (a.type === 'turn' && (sp.answer === 'turn' || a.move.axis !== 'y'));

/** Deterministic for a seed; if the strict answer kind cannot be found, relax it rather than fail a daily. */
export function makePuzzle(sp: Spec, rng: () => number): Puzzle {
  const p = search(sp, rng, 12000);
  if (p) return p;
  if (sp.answer === 'tilt') return makePuzzle({ ...sp, answer: 'turn' }, rng);
  if (sp.answer === 'turn') return makePuzzle({ ...sp, answer: 'any' }, rng);
  throw new Error('no puzzle');
}

function search(sp: Spec, rng: () => number, tries: number): Puzzle | null {
  const rnd = (k: number) => Math.floor(rng() * k);
  for (let t = 0; t < tries; t++) {
    const n = sp.n;
    const taken = new Set<string>();
    // A king needs every escape covered, so with few pieces it lives near an edge; pieces start close by.
    const edge = () => (rng() < 0.5 ? 0 : n - 1);
    const king: P = rng() < 0.55 ? [edge(), rnd(n)] : rng() < 0.5 ? [rnd(n), edge()] : [1 + rnd(n - 2), 1 + rnd(n - 2)];
    taken.add(key(king));
    const pieces: Piece[] = [];
    while (pieces.length < sp.pieces) {
      const anchor: P = [king[0] + rnd(5) - 2, king[1] + rnd(5) - 2];
      if (!onBoard(n, anchor) || taken.has(key(anchor))) continue;
      taken.add(key(anchor));
      let cells = SHAPES[sp.shapes[rnd(sp.shapes.length)]];
      for (let t = rnd(4); t > 0; t--) { const m = MOVES[rnd(MOVES.length)]; cells = cells.map((c) => rotateCell(c, m)); }
      pieces.push({ cells, anchor });
    }
    const s: State = { n, king, pieces };
    if (!valid(s) || isMate(s)) continue;
    const mates = matingMoves(s);
    if (mates.length !== 1 || !fits(sp, mates[0].action)) continue;
    return { ...s, answer: mates[0] };
  }
  return null;
}
