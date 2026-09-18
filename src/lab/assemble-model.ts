// Assemble: a target volume cut into a few odd parts, each shown in a scrambled orientation.
// You assign every part turns and an anchor cell before anything moves; the parts then fly in
// one by one and the first collision stops the build. Pure model with a generator and a checker.
import { applyMoves, normalize, shapeKey, randomPolycube, MOVES, type Cell, type Move } from '../polycube.ts';

export const cellKey = (c: Cell) => c.join(',');
const sub = (a: Cell, b: Cell): Cell => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addC = (a: Cell, b: Cell): Cell => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const DIRS: readonly Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export interface Part {
  /** Cells as shown in the tray, relative to the handle (cell 0 is always [0,0,0]). */
  cells: Cell[];
  /** One solution: turns that orient the part, and the target cell the handle lands on. */
  solution: { moves: Move[]; anchor: Cell };
}
export interface Puzzle { target: Cell[]; parts: Part[] }
export interface Plan { moves: Move[]; anchor: Cell | null }

/** Cut `target` into k connected parts by growing k regions from random seeds. Null if a part is too small/large. */
export function cut(target: Cell[], k: number, minSize: number, maxSize: number, rng: () => number): Cell[][] | null {
  const keys = new Set(target.map(cellKey));
  const owner = new Map<string, number>();
  const seeds: Cell[] = [];
  while (seeds.length < k) {
    const c = target[Math.floor(rng() * target.length)];
    if (!owner.has(cellKey(c))) { owner.set(cellKey(c), seeds.length); seeds.push(c); }
  }
  const frontier: Cell[][] = seeds.map((s) => [s]);
  let left = target.length - k;
  while (left > 0) {
    // Pick a region at random that can still grow; smaller regions first to keep sizes even.
    const order = frontier.map((_, i) => i).sort((a, b) => frontier[a].length - frontier[b].length || rng() - 0.5);
    let grew = false;
    for (const i of order) {
      const cands: Cell[] = [];
      for (const c of frontier[i]) for (const d of DIRS) { const n = addC(c, d); if (keys.has(cellKey(n)) && !owner.has(cellKey(n))) cands.push(n); }
      if (!cands.length) continue;
      const n = cands[Math.floor(rng() * cands.length)];
      owner.set(cellKey(n), i);
      frontier[i].push(n);
      left--; grew = true;
      break;
    }
    if (!grew) return null;
  }
  const parts = frontier;
  if (parts.some((p) => p.length < minSize || p.length > maxSize)) return null;
  return parts;
}

const inverse = (moves: Move[]): Move[] => [...moves].reverse().map((m) => ({ axis: m.axis, dir: m.dir > 0 ? -1 : 1 }));

export interface Spec { n: number; k: number; scramble: number }
/** Difficulty by level: more parts, bigger targets, parts shown further from their placed orientation. */
export function spec(level: number): Spec {
  const t: Spec[] = [
    { n: 5, k: 2, scramble: 1 }, { n: 6, k: 2, scramble: 1 }, { n: 6, k: 2, scramble: 2 },
    { n: 7, k: 3, scramble: 1 }, { n: 8, k: 3, scramble: 2 }, { n: 8, k: 3, scramble: 2 },
    { n: 9, k: 3, scramble: 3 }, { n: 10, k: 3, scramble: 3 },
  ];
  // Beyond the table (endless only): four parts.
  if (level >= t.length + 2) return { n: 11 + Math.min(2, level - t.length - 2), k: 4, scramble: 3 };
  return t[Math.min(level, t.length - 1)];
}

export function makePuzzle(sp: Spec, rng: () => number): Puzzle {
  for (let tries = 0; tries < 400; tries++) {
    const target = randomPolycube(sp.n, rng);
    const pieces = cut(target, sp.k, 2, 4, rng);
    if (!pieces) continue;
    const parts: Part[] = [];
    for (const placed of pieces) {
      const handle = placed[0];
      const rel = placed.map((c) => sub(c, handle));
      // Scramble: a random turn sequence whose inverse is one solution. Insist the shown shape differs.
      let shown: Cell[] = rel, scramble: Move[] = [];
      for (let s = 0; s < 20; s++) {
        scramble = Array.from({ length: sp.scramble }, () => MOVES[Math.floor(rng() * MOVES.length)]);
        shown = applyMoves(rel, scramble);
        if (sp.scramble === 0 || shapeKey(shown) !== shapeKey(rel)) break;
      }
      parts.push({ cells: shown, solution: { moves: inverse(scramble), anchor: handle } });
    }
    return { target, parts };
  }
  throw new Error('no puzzle');
}

export interface Outcome { ok: boolean; placed: Cell[][]; failedAt: number; reason: '' | 'outside' | 'overlap' | 'no-anchor' }

/** Where each part lands under `plans`, in order; the first collision ends the build. */
export function build(p: Puzzle, plans: Plan[]): Outcome {
  const target = new Set(p.target.map(cellKey));
  const filled = new Set<string>();
  const placed: Cell[][] = [];
  for (let i = 0; i < p.parts.length; i++) {
    const plan = plans[i];
    if (!plan?.anchor) return { ok: false, placed, failedAt: i, reason: 'no-anchor' };
    const cells = applyMoves(p.parts[i].cells, plan.moves).map((c) => addC(c, plan.anchor!));
    placed.push(cells);
    if (cells.some((c) => !target.has(cellKey(c)))) return { ok: false, placed, failedAt: i, reason: 'outside' };
    if (cells.some((c) => filled.has(cellKey(c)))) return { ok: false, placed, failedAt: i, reason: 'overlap' };
    for (const c of cells) filled.add(cellKey(c));
  }
  return { ok: true, placed, failedAt: -1, reason: '' };
}

export const normalizeParts = (parts: Cell[][]) => parts.map((p) => normalize(p));
