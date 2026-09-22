// Integer geometry for Shadows. Keep generation stable: existing dailies use these seeds.
import { randomPolycube, extents, type Cell } from '../polycube.ts';

export type Dims = { w: number; h: number; d: number };
export const VIEWS = ['top', 'front', 'right'] as const;
export type View = typeof VIEWS[number];
export type Projections = Record<View, Set<string>>;

/** Row zero is far/top; the right view runs from front (left) to back (right). */
export function project(cells: readonly Cell[], dims: Dims): Projections {
  const top = new Set<string>(), front = new Set<string>(), right = new Set<string>();
  for (const [x, y, z] of cells) {
    top.add(`${x},${z}`);
    front.add(`${x},${dims.h - 1 - y}`);
    right.add(`${dims.d - 1 - z},${dims.h - 1 - y}`);
  }
  return { top, front, right };
}

export function validCells(value: unknown, dims: Dims, max: number): value is Cell[] {
  if (!Array.isArray(value) || value.length > max) return false;
  const seen = new Set<string>();
  return value.every((c) => {
    if (!Array.isArray(c) || c.length !== 3 || !c.every(Number.isInteger)) return false;
    if (c.some((v, i) => v < 0 || v >= [dims.w, dims.h, dims.d][i])) return false;
    const key = c.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function assess(cells: Cell[], hidden: Cell[], dims: Dims) {
  const target = project(hidden, dims), mine = project(cells, dims);
  const diff = Object.fromEntries(VIEWS.map((view) => [view, {
    missing: new Set([...target[view]].filter((k) => !mine[view].has(k))),
    extra: new Set([...mine[view]].filter((k) => !target[view].has(k))),
  }])) as Record<View, { missing: Set<string>; extra: Set<string> }>;
  const badCells = VIEWS.reduce((sum, v) => sum + diff[v].missing.size + diff[v].extra.size, 0);
  const valid = validCells(cells, dims, hidden.length) && cells.length === hidden.length;
  const hiddenKeys = new Set(hidden.map((c) => c.join(',')));
  return { mine, target, diff, badCells, ok: valid && badCells === 0,
    same: valid && cells.every((c) => hiddenKeys.has(c.join(','))) };
}

export function makeCase(dims: Dims, n: number, rng: () => number) {
  for (let tries = 0; tries < 500; tries++) {
    const cells = randomPolycube(n, rng);
    const [ex, ey, ez] = extents(cells);
    if (ex >= dims.w || ey >= dims.h || ez >= dims.d) continue;
    if (ex === 0 || ey === 0 || ez === 0) continue;
    return cells;
  }
  throw new Error('no case');
}

export const setup = (level: number): { dims: Dims; n: number } =>
  level < 6 ? { dims: { w: 3, h: 3, d: 3 }, n: Math.min(8, 5 + Math.floor((level + 1) / 2)) }
    : level < 12 ? { dims: { w: 4, h: 3, d: 4 }, n: Math.min(10, 7 + Math.floor((level - 6) / 2)) }
      : { dims: { w: 4, h: 4, d: 4 }, n: Math.min(13, 10 + Math.floor((level - 12) / 2)) };
