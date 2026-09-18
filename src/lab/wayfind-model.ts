// Wayfind: a maze you see from above for a few seconds, then walk from the inside. Pure model:
// generation (perfect maze + a few loops so wall-following is a bad strategy), distances to
// the goal, corridor auto-walk between decision cells, and grading of each decision.

/** Block-grid coordinates (x, z): walls are cells too. Rooms sit at odd coordinates. */
export type P = readonly [number, number];
/** 0 = north (−z), 1 = east (+x), 2 = south (+z), 3 = west (−x). */
export type Heading = 0 | 1 | 2 | 3;
export const HEAD_VEC: readonly P[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export type Rel = 'left' | 'forward' | 'right' | 'back';
export const REL_TURN: Record<Rel, number> = { forward: 0, right: 1, back: 2, left: 3 };
export const key = (p: P) => `${p[0]},${p[1]}`;
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const same = (a: P, b: P) => a[0] === b[0] && a[1] === b[1];

export interface Maze {
  rooms: number;
  size: number;
  open: string[];
  start: P;
  goal: P;
  heading: Heading;
  /** BFS distance to the goal from every open cell. */
  dist: Record<string, number>;
  /** Decisions along one shortest walk. */
  par: number;
}

export const headingOf = (from: P, to: P): Heading => HEAD_VEC.findIndex((v) => same(add(from, v), to)) as Heading;
export const turnTo = (h: Heading, rel: Rel): Heading => ((h + REL_TURN[rel]) & 3) as Heading;
export const relOf = (h: Heading, to: Heading): Rel => (['forward', 'right', 'back', 'left'] as Rel[])[(to - h + 4) & 3];

export function neighbours(open: Set<string>, c: P): P[] {
  return HEAD_VEC.map((v) => add(c, v)).filter((n) => open.has(key(n)));
}
/** A cell where the walk stops for a decision: a junction, a dead end, or the goal. */
export const isDecision = (open: Set<string>, c: P, goal: P) => same(c, goal) || neighbours(open, c).length !== 2;

export function generate(rooms: number, loops: number, rng: () => number, headingMode: 'north' | 'random' = 'north'): Maze {
  const size = rooms * 2 + 1;
  const open = new Set<string>();
  const cell = (rx: number, rz: number): P => [rx * 2 + 1, rz * 2 + 1];
  // Iterative recursive backtracker over rooms.
  const seen = new Set<string>();
  const stack: P[] = [[Math.floor(rng() * rooms), Math.floor(rng() * rooms)]];
  seen.add(key(stack[0]));
  open.add(key(cell(...stack[0])));
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const opts = HEAD_VEC.map((v) => add(cur, v)).filter((n) => n[0] >= 0 && n[1] >= 0 && n[0] < rooms && n[1] < rooms && !seen.has(key(n)));
    if (!opts.length) { stack.pop(); continue; }
    const next = opts[Math.floor(rng() * opts.length)];
    seen.add(key(next));
    open.add(key(cell(...next)));
    open.add(key([cur[0] + next[0] + 1, cur[1] + next[1] + 1])); // the door between them
    stack.push(next);
  }
  // Loops: open a few extra doors between adjacent rooms.
  const doors: P[] = [];
  for (let x = 1; x < size - 1; x++) for (let z = 1; z < size - 1; z++) if ((x % 2) !== (z % 2) && !open.has(key([x, z]))) doors.push([x, z]);
  for (let i = 0; i < loops && doors.length; i++) open.add(key(doors.splice(Math.floor(rng() * doors.length), 1)[0]));
  // Start: a random room. Goal: far from the start, preferably an interior room.
  const start = cell(Math.floor(rng() * rooms), Math.floor(rng() * rooms));
  const fromStart = bfs(open, start);
  const far = Math.max(...Object.values(fromStart));
  const interior = (p: P) => p[0] > 1 && p[1] > 1 && p[0] < size - 2 && p[1] < size - 2;
  let cands = [...open].map((k) => k.split(',').map(Number) as unknown as P).filter((p) => p[0] % 2 === 1 && p[1] % 2 === 1 && fromStart[key(p)] >= far * 0.6);
  if (cands.some(interior) && rooms >= 5) cands = cands.filter(interior);
  const goal = cands[Math.floor(rng() * cands.length)];
  const dist = bfs(open, goal);
  const heading = (headingMode === 'random' ? Math.floor(rng() * 4) : 0) as Heading;
  const m: Maze = { rooms, size, open: [...open], start, goal, heading, dist, par: 0 };
  return { ...m, par: shortestWalk(m).length };
}

export function bfs(open: Set<string>, from: P): Record<string, number> {
  const dist: Record<string, number> = { [key(from)]: 0 };
  const q: P[] = [from];
  for (let i = 0; i < q.length; i++) for (const n of neighbours(open, q[i])) if (!(key(n) in dist)) { dist[key(n)] = dist[key(q[i])] + 1; q.push(n); }
  return dist;
}

export interface Walk { path: P[]; end: P; heading: Heading; atGoal: boolean; deadEnd: boolean }

/** Step into `to` from `from`, then follow the corridor until the next decision cell. */
export function walk(m: Maze, from: P, to: P): Walk {
  const open = new Set(m.open);
  const path: P[] = [to];
  let prev = from, cur = to;
  while (!isDecision(open, cur, m.goal)) {
    const next = neighbours(open, cur).find((n) => !same(n, prev))!;
    prev = cur; cur = next;
    path.push(cur);
  }
  return { path, end: cur, heading: headingOf(prev, cur), atGoal: same(cur, m.goal), deadEnd: neighbours(open, cur).length === 1 && !same(cur, m.goal) };
}

/** Was stepping from c into n a step along a shortest route? */
export const good = (m: Maze, c: P, n: P) => m.dist[key(n)] < m.dist[key(c)];

/** The decisions (as relative directions) of one shortest walk from the start. */
export function shortestWalk(m: Maze): Rel[] {
  const open = new Set(m.open);
  const out: Rel[] = [];
  let cur = m.start, h = m.heading;
  while (!same(cur, m.goal)) {
    const n = neighbours(open, cur).find((x) => good(m, cur, x))!;
    out.push(relOf(h, headingOf(cur, n)));
    const w = walk(m, cur, n);
    cur = w.end; h = w.heading;
  }
  return out;
}

export interface Spec { rooms: number; loops: number; showMs: number; heading: 'north' | 'random'; cut: boolean }
/** Difficulty by level: bigger mazes, less time, then a start heading that no longer matches the map's up. */
export function spec(level: number): Spec {
  const t: Spec[] = [
    { rooms: 4, loops: 0, showMs: 4000, heading: 'north', cut: false },
    { rooms: 4, loops: 1, showMs: 4000, heading: 'north', cut: false },
    { rooms: 5, loops: 1, showMs: 4000, heading: 'north', cut: true },
    { rooms: 5, loops: 1, showMs: 3500, heading: 'random', cut: true },
    { rooms: 5, loops: 2, showMs: 3500, heading: 'random', cut: true },
    { rooms: 6, loops: 2, showMs: 3000, heading: 'random', cut: true },
    { rooms: 6, loops: 3, showMs: 3000, heading: 'random', cut: true },
    { rooms: 7, loops: 3, showMs: 3000, heading: 'random', cut: true },
  ];
  return t[Math.min(level, t.length - 1)];
}
