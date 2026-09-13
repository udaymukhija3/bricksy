// Discrete polycube geometry. Everything here is exact integer math so the
// logical state can never drift from what the player predicted.

export type Cell = readonly [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export interface Move {
  readonly axis: Axis;
  readonly dir: 1 | -1;
}

export const AXES: readonly Axis[] = ['x', 'y', 'z'];
export const MOVES: readonly Move[] = AXES.flatMap((axis) => [
  { axis, dir: 1 as const },
  { axis, dir: -1 as const },
]);

export const moveLabel = (m: Move) => `${m.axis.toUpperCase()}${m.dir > 0 ? '+' : '−'}`;

/** Right-hand rotation of a lattice point by 90° about a *world* axis. */
export function rotateCell(c: Cell, m: Move): Cell {
  const [x, y, z] = c;
  const s = m.dir;
  switch (m.axis) {
    case 'x': return [x, -s * z + 0, s * y + 0]; // +90: Y → Z
    case 'y': return [s * z + 0, y, -s * x + 0]; // +90: Z → X
    case 'z': return [-s * y + 0, s * x + 0, z]; // +90: X → Y
  }
}

export const applyMoves = (cells: Cell[], moves: readonly Move[]): Cell[] =>
  moves.reduce((cs, m) => cs.map((c) => rotateCell(c, m)), cells);

export const bboxMin = (cells: Cell[]): Cell =>
  [0, 1, 2].map((i) => Math.min(...cells.map((c) => c[i]))) as unknown as Cell;

export const extents = (cells: Cell[]): Cell =>
  [0, 1, 2].map((i) => Math.max(...cells.map((c) => c[i])) - Math.min(...cells.map((c) => c[i]))) as unknown as Cell;

const cmp = (a: Cell, b: Cell) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Translate so the bounding box starts at the origin, then sort. Orientation-preserving. */
export function normalize(cells: Cell[]): Cell[] {
  const [mx, my, mz] = bboxMin(cells);
  return cells.map(([x, y, z]) => [x - mx, y - my, z - mz] as Cell).sort(cmp);
}

export const shapeKey = (cells: Cell[]) => normalize(cells).map((c) => c.join(',')).join(';');
export const isPlanar = (cells: Cell[]) => extents(cells).some((e) => e === 0);

export interface Orientation {
  cells: Cell[];
  key: string;
  dist: number;
  path: Move[];
}

/** BFS over every orientation reachable by quarter-turns, with a shortest path to each. */
export function orientations(start: Cell[]): Orientation[] {
  const cells = normalize(start);
  const root: Orientation = { cells, key: shapeKey(cells), dist: 0, path: [] };
  const seen = new Map<string, Orientation>([[root.key, root]]);
  const queue = [root];
  while (queue.length) {
    const o = queue.shift()!;
    for (const m of MOVES) {
      const next = normalize(o.cells.map((c) => rotateCell(c, m)));
      const key = shapeKey(next);
      if (seen.has(key)) continue;
      const n: Orientation = { cells: next, key, dist: o.dist + 1, path: [...o.path, m] };
      seen.set(key, n);
      queue.push(n);
    }
  }
  return [...seen.values()];
}

/** True when no rotation other than identity maps the shape onto itself (all 24 orientations distinct). */
export const hasTrivialSymmetry = (cells: Cell[]) => orientations(cells).length === 24;

const DIRS: readonly Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Random connected polycube of n cells, grown by attaching to random faces. */
export function randomPolycube(n: number, rng: () => number): Cell[] {
  const cells: Cell[] = [[0, 0, 0]];
  const taken = new Set(['0,0,0']);
  while (cells.length < n) {
    const base = cells[Math.floor(rng() * cells.length)];
    const d = DIRS[Math.floor(rng() * DIRS.length)];
    const c: Cell = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
    const k = c.join(',');
    if (taken.has(k)) continue;
    taken.add(k);
    cells.push(c);
  }
  return normalize(cells);
}
