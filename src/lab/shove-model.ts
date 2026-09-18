// Shove: a room, one awkward crate, one socket. Push (never pull) and quarter-turn the crate
// into the socket. Pure lattice model with a BFS solver; levels are generated from the reachable
// state space so every one is solvable and has a known par.

/** Floor coordinates: x → screen right, z → screen down (toward the camera). */
export type P = readonly [number, number];
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Turn = 'cw' | 'ccw';
export type Move = Dir | Turn;

export const DIRS: Record<Dir, P> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const MOVES: readonly Move[] = ['up', 'down', 'left', 'right', 'cw', 'ccw'];
export const MOVE_GLYPH: Record<Move, string> = { up: '↑', down: '↓', left: '←', right: '→', cw: '↻', ccw: '↺' };
export const isTurn = (m: Move): m is Turn => m === 'cw' || m === 'ccw';

export const key = (p: P) => `${p[0]},${p[1]}`;
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const same = (a: P, b: P) => a[0] === b[0] && a[1] === b[1];

/** Crate shapes, cells relative to the pivot (always the first cell). */
export const SHAPES: Record<string, P[]> = {
  L3: [[0, 0], [1, 0], [0, 1]],
  L4: [[0, 0], [1, 0], [2, 0], [0, 1]],
  S4: [[0, 0], [1, 0], [0, 1], [-1, 1]],
  T4: [[0, 0], [-1, 0], [1, 0], [0, 1]],
};

/** Quarter-turn clockwise as seen from above (screen right → screen down). */
export const rotCW = (p: P): P => [-p[1], p[0]];
export function rotated(shape: P[], rot: number): P[] {
  let cells = shape;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cells = cells.map(rotCW);
  return cells;
}

export interface Crate { pivot: P; rot: number }
/** `box`: a second, one-cell crate that can only be pushed (never turned), with its own socket. */
export interface State { player: P; crate: Crate; box?: P }
export interface Level {
  w: number; h: number;
  walls: string[];
  shape: P[];
  start: State;
  socket: P[];
  boxSocket?: P;
  par: number;
  solution: Move[];
}

export const crateCells = (shape: P[], c: Crate) => rotated(shape, c.rot).map((p) => add(p, c.pivot));
export const stateKey = (s: State) => `${key(s.player)}|${key(s.crate.pivot)}|${s.crate.rot & 3}${s.box ? '|' + key(s.box) : ''}`;

const wallSets = new WeakMap<string[], Set<string>>();
const wallSet = (level: Level) => { let w = wallSets.get(level.walls); if (!w) { w = new Set(level.walls); wallSets.set(level.walls, w); } return w; };

/** One move. Returns the next state, or null when the move is blocked (the plan stops there). */
export function apply(level: Level, s: State, m: Move): State | null {
  const walls = wallSet(level);
  const free = (p: P) => p[0] >= 0 && p[1] >= 0 && p[0] < level.w && p[1] < level.h && !walls.has(key(p)) && !(s.box && same(p, s.box));
  const cells = crateCells(level.shape, s.crate);
  if (isTurn(m)) {
    // Turn the crate you are standing next to. Destination cells must be free and not under you.
    const adjacent = cells.some((c) => Object.values(DIRS).some((d) => same(add(c, d), s.player)));
    if (!adjacent) return null;
    const crate = { pivot: s.crate.pivot, rot: (s.crate.rot + (m === 'cw' ? 1 : 3)) & 3 };
    const next = crateCells(level.shape, crate);
    if (!next.every((c) => free(c) && !same(c, s.player))) return null;
    return { ...s, crate };
  }
  const d = DIRS[m];
  const np = add(s.player, d);
  if (s.box && same(np, s.box)) {
    // Push the box one step; it cannot enter a wall, the crate, or leave the room.
    const to = add(s.box, d);
    if (!free(to) || cells.some((c) => same(c, to))) return null;
    return { ...s, player: np, box: to };
  }
  if (!free(np)) return null;
  if (cells.some((c) => same(c, np))) {
    // Push: every crate cell moves one step; all destinations must be free (its own old cells count as free).
    const moved = cells.map((c) => add(c, d));
    if (!moved.every((c) => free(c) && !same(c, s.player))) return null;
    return { ...s, player: np, crate: { pivot: add(s.crate.pivot, d), rot: s.crate.rot } };
  }
  return { ...s, player: np };
}

export const solved = (level: Level, s: State) => {
  const cells = crateCells(level.shape, s.crate).map(key).sort().join(';');
  if (cells !== level.socket.map(key).sort().join(';')) return false;
  return !level.boxSocket || (!!s.box && same(s.box, level.boxSocket));
};

interface Node { s: State; dist: number; prev: Node | null; move: Move | null }

/** Full BFS from the start state. Returns every reachable node keyed by state. */
function explore(level: Level, cap = 60000) {
  const seen = new Map<string, Node>();
  const root: Node = { s: level.start, dist: 0, prev: null, move: null };
  seen.set(stateKey(root.s), root);
  const queue = [root];
  for (let qi = 0; qi < queue.length && seen.size < cap; qi++) {
    const n = queue[qi];
    for (const m of MOVES) {
      const s = apply(level, n.s, m);
      if (!s) continue;
      const k = stateKey(s);
      if (seen.has(k)) continue;
      const node: Node = { s, dist: n.dist + 1, prev: n, move: m };
      seen.set(k, node);
      queue.push(node);
    }
  }
  return seen;
}

const pathTo = (n: Node) => { const out: Move[] = []; for (let x: Node | null = n; x && x.move; x = x.prev) out.unshift(x.move); return out; };

/** Fewest moves to put the crate on the socket, with one shortest solution. Null if unsolvable. */
export function solve(level: Level): { par: number; solution: Move[] } | null {
  let best: Node | null = null;
  for (const n of explore(level).values()) if (solved(level, n.s) && (!best || n.dist < best.dist)) best = n;
  return best ? { par: best.dist, solution: pathTo(best) } : null;
}

export interface Spec { w: number; h: number; obstacles: number; shape: keyof typeof SHAPES; parMin: number; parMax: number; needTurn: boolean; box?: boolean }

/** Difficulty by level: bigger rooms, more clutter, longer solutions, a crate that must be turned, then a second box in the way. */
export function spec(level: number): Spec {
  if (level < 2) return { w: 6, h: 6, obstacles: 1, shape: 'L3', parMin: 3, parMax: 5, needTurn: false };
  if (level < 4) return { w: 6, h: 6, obstacles: 2, shape: 'L3', parMin: 5, parMax: 7, needTurn: false };
  if (level < 6) return { w: 7, h: 7, obstacles: 3, shape: 'L3', parMin: 7, parMax: 9, needTurn: true };
  if (level < 8) return { w: 7, h: 7, obstacles: 2, shape: 'L3', parMin: 8, parMax: 12, needTurn: true, box: true };
  if (level < 10) return { w: 8, h: 8, obstacles: 5, shape: level % 2 ? 'L4' : 'T4', parMin: 10, parMax: 14, needTurn: true };
  return { w: 8, h: 8, obstacles: 3, shape: level % 2 ? 'L4' : 'T4', parMin: 12, parMax: 18, needTurn: true, box: true };
}

/** Random room + crate + player; the socket is a crate configuration at the wanted distance. */
export function makeLevel(sp: Spec, rng: () => number): Level {
  const { w, h } = sp;
  const shape = SHAPES[sp.shape];
  const rnd = (n: number) => Math.floor(rng() * n);
  for (let tries = 0; tries < 300; tries++) {
    const walls = new Set<string>();
    for (let x = 0; x < w; x++) { walls.add(key([x, 0])); walls.add(key([x, h - 1])); }
    for (let z = 0; z < h; z++) { walls.add(key([0, z])); walls.add(key([w - 1, z])); }
    for (let i = 0; i < sp.obstacles; i++) walls.add(key([1 + rnd(w - 2), 1 + rnd(h - 2)]));
    const crate: Crate = { pivot: [1 + rnd(w - 2), 1 + rnd(h - 2)], rot: rnd(4) };
    const cells = crateCells(shape, crate);
    const inRoom = (p: P) => p[0] > 0 && p[1] > 0 && p[0] < w - 1 && p[1] < h - 1 && !walls.has(key(p));
    if (!cells.every(inRoom)) continue;
    let player: P = [1 + rnd(w - 2), 1 + rnd(h - 2)];
    if (!inRoom(player) || cells.some((c) => same(c, player))) continue;
    let box: P | undefined;
    if (sp.box) {
      box = [1 + rnd(w - 2), 1 + rnd(h - 2)];
      if (!inRoom(box) || cells.some((c) => same(c, box!)) || same(box, player)) continue;
    }
    const base: Level = { w, h, walls: [...walls], shape, start: { player, crate, ...(box ? { box } : {}) }, socket: [], par: 0, solution: [] };
    // Distinct crate (and box) configurations by their fewest-moves distance (over all player positions).
    const reach = explore(base, sp.box ? 120000 : 60000);
    const byConfig = new Map<string, Node>();
    for (const n of reach.values()) {
      const k = `${key(n.s.crate.pivot)}|${n.s.crate.rot & 3}${n.s.box ? '|' + key(n.s.box) : ''}`;
      const cur = byConfig.get(k);
      if (!cur || n.dist < cur.dist) byConfig.set(k, n);
    }
    const goals = [...byConfig.values()].filter((n) => n.dist >= sp.parMin && n.dist <= sp.parMax
      && (!sp.needTurn || (n.s.crate.rot & 3) !== (crate.rot & 3))
      && (!box || !same(n.s.box!, box))); // the box must have to move too
    if (!goals.length) continue;
    const goal = goals[rnd(goals.length)];
    const socket = crateCells(shape, goal.s.crate);
    const level: Level = { ...base, socket, ...(box ? { boxSocket: goal.s.box } : {}), par: goal.dist, solution: pathTo(goal) };
    // Sanity: the solver agrees with the pick (the socket may be reachable via a shorter route through another player position — that is the true par).
    const s = solve(level);
    if (!s || s.par < sp.parMin) continue;
    return { ...level, par: s.par, solution: s.solution };
  }
  throw new Error('no level');
}
