// Run with: npm test
import { apply, solve, solved, makeLevel, spec, crateCells, SHAPES, type Level, type State, type Move } from './shove-model.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A 6×5 room with border walls; L crate at (2,2) rot 0 → cells (2,2),(3,2),(2,3); player at (1,2).
const walls: string[] = [];
for (let i = 0; i < 6; i++) walls.push(`${i},0`, `${i},4`);
for (let i = 0; i < 5; i++) walls.push(`0,${i}`, `5,${i}`);
const lvl: Level = { w: 6, h: 5, walls, shape: SHAPES.L3, start: { player: [1, 2], crate: { pivot: [2, 2], rot: 0 } }, socket: [], par: 0, solution: [] };
const s0 = lvl.start;
check('push right moves crate and player', JSON.stringify(apply(lvl, s0, 'right')) === JSON.stringify({ player: [2, 2], crate: { pivot: [3, 2], rot: 0 } }));
check('push right again is blocked by the wall (cell (5,2))', apply(lvl, apply(lvl, s0, 'right')!, 'right') === null);
check('stepping into a wall is blocked', apply(lvl, s0, 'left') === null);
check('step up is free', apply(lvl, s0, 'up')?.player.join() === '1,1');
const t = apply(lvl, s0, 'ccw');
check('turn ccw from an adjacent cell', t !== null && t.crate.rot === 3);
check('cw turn about the pivot: (1,0)→(0,1), (0,1)→(−1,0)', JSON.stringify(crateCells(SHAPES.L3, { pivot: [2, 2], rot: 1 })) === JSON.stringify([[2, 2], [2, 3], [1, 2]]));
check('turn blocked when a destination cell is the player', apply(lvl, { player: [1, 2], crate: { pivot: [2, 2], rot: 0 } }, 'cw') === null);
check('turn not allowed from afar', apply(lvl, { player: [1, 1], crate: { pivot: [2, 2], rot: 0 } }, 'cw') === null);
check('four cw turns are the identity', crateCells(SHAPES.L3, { pivot: [2, 2], rot: 4 }).join(';') === crateCells(SHAPES.L3, { pivot: [2, 2], rot: 0 }).join(';'));

// Solver: a level whose socket is one push away has par 1.
const one: Level = { ...lvl, socket: crateCells(SHAPES.L3, { pivot: [3, 2], rot: 0 }) };
check('par 1 for a one-push socket', solve(one)?.par === 1);
check('solved() detects the socket', solved(one, apply(one, s0, 'right')!));

// Generator: every level solvable at exactly its par, solution replays, no shorter path, and the socket is not the start.
let n = 0, bad = 0, turnNeeded = 0, maxStates = 0;
for (let seed = 1; seed <= 25; seed++) {
  const rng = mulberry32(seed);
  for (const level of [0, 2, 4, 6, 8, 9]) {
    const sp = spec(level);
    const L = makeLevel(sp, rng);
    n++;
    let s: State | null = L.start;
    for (const m of L.solution) { s = s && apply(L, s, m); }
    if (!s || !solved(L, s) || L.solution.length !== L.par) bad++;
    if (L.par < sp.parMin || L.par > sp.parMax) bad++;
    if (solved(L, L.start)) bad++;
    if (sp.needTurn && !L.solution.some((m: Move) => m === 'cw' || m === 'ccw')) turnNeeded++;
    maxStates = Math.max(maxStates, L.w * L.h * L.w * L.h * 4);
  }
}
check(`${n} generated levels: solution replays to the socket at par within spec (${bad} bad)`, bad === 0);
check(`needTurn levels: shortest solution includes a turn (${turnNeeded} without)`, turnNeeded === 0);
const a = makeLevel(spec(5), mulberry32(3)), b = makeLevel(spec(5), mulberry32(3));
check('same seed → same level', JSON.stringify(a) === JSON.stringify(b));
if (failures) throw new Error(`${failures} check(s) failed`);
