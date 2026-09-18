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
// Box: pushed one cell, blocked by the crate, never turned; a turn cannot sweep onto it.
const bl: Level = { ...lvl, start: { player: [1, 1], crate: { pivot: [2, 2], rot: 0 }, box: [2, 1] } };
check('pushing the box moves it and the player', JSON.stringify(apply(bl, bl.start, 'right')?.box) === '[3,1]');
check('the box cannot be pushed into the crate', apply(bl, { player: [1, 2], crate: { pivot: [3, 2], rot: 0 }, box: [2, 2] }, 'right') === null);
check('…but it can be pushed elsewhere', apply(bl, { player: [2, 1], crate: { pivot: [3, 2], rot: 0 }, box: [2, 2] }, 'down')?.box?.join() === '2,3');
check('the crate cannot be pushed into the box', apply(bl, { player: [2, 4], crate: { pivot: [2, 2], rot: 0 }, box: [2, 1] }, 'up') === null);
check('a turn onto the box is blocked', apply(bl, { player: [1, 2], crate: { pivot: [2, 2], rot: 0 }, box: [2, 1] }, 'ccw') === null);
check('four cw turns are the identity', crateCells(SHAPES.L3, { pivot: [2, 2], rot: 4 }).join(';') === crateCells(SHAPES.L3, { pivot: [2, 2], rot: 0 }).join(';'));

// Two crates: a turn next to both is blocked; either crate may take either socket; crates block each other.
// Crate 1 at (1,2) rot 0 → (1,2),(2,2),(1,3). Crate 2 at (4,3) rot 2 → (4,3),(3,3),(4,2).
const two: Level = { ...lvl, start: { player: [3, 2], crate: { pivot: [1, 2], rot: 0 }, crate2: { pivot: [4, 3], rot: 2 } } };
check('turn next to two crates is blocked', apply(two, two.start, 'ccw') === null && apply(two, two.start, 'cw') === null);
check('turn next to one crate works', apply(two, { ...two.start, player: [2, 1] }, 'ccw')?.crate.rot === 3);
check('either crate on either socket counts', solved({ ...two, socket: crateCells(SHAPES.L3, { pivot: [4, 3], rot: 2 }), socket2: crateCells(SHAPES.L3, { pivot: [1, 2], rot: 0 }) }, two.start));
const pushInto: Level = { ...lvl, start: { player: [1, 2], crate: { pivot: [2, 2], rot: 0 }, crate2: { pivot: [4, 3], rot: 2 } } };
check('pushing one crate into the other is blocked', apply(pushInto, pushInto.start, 'right') === null);
check('…and allowed once the other crate is gone', apply({ ...pushInto, start: { player: [1, 2], crate: { pivot: [2, 2], rot: 0 } } }, { player: [1, 2], crate: { pivot: [2, 2], rot: 0 } }, 'right') !== null);

// Solver: a level whose socket is one push away has par 1.
const one: Level = { ...lvl, socket: crateCells(SHAPES.L3, { pivot: [3, 2], rot: 0 }) };
check('par 1 for a one-push socket', solve(one)?.par === 1);
check('solved() detects the socket', solved(one, apply(one, s0, 'right')!));

// Generator: every level solvable at exactly its par, solution replays, no shorter path, and the socket is not the start.
let n = 0, bad = 0, turnNeeded = 0, maxStates = 0;
for (let seed = 1; seed <= 8; seed++) {
  const rng = mulberry32(seed);
  for (const level of [0, 2, 4, 6, 7, 8, 9, 10, 12, 13]) {
    const sp = spec(level);
    const L = makeLevel(sp, rng);
    n++;
    let s: State | null = L.start;
    for (const m of L.solution) { s = s && apply(L, s, m); }
    if (!s || !solved(L, s) || L.solution.length !== L.par) bad++;
    if (L.par < sp.parMin || L.par > sp.parMax) bad++;
    if (solved(L, L.start)) bad++;
    if (sp.needTurn && !L.solution.some((m: Move) => m === 'cw' || m === 'ccw')) turnNeeded++;
    if (sp.box && (!L.boxSocket || !L.start.box || L.start.box.join() === L.boxSocket.join())) bad++;
    if (sp.crates === 2 && (!L.socket2 || !L.start.crate2)) bad++;
    maxStates = Math.max(maxStates, L.w * L.h * L.w * L.h * 4);
  }
}
check(`${n} generated levels: solution replays to the socket at par within spec (${bad} bad)`, bad === 0);
check(`needTurn levels: shortest solution includes a turn (${turnNeeded} without)`, turnNeeded === 0);
const a = makeLevel(spec(5), mulberry32(3)), b = makeLevel(spec(5), mulberry32(3));
check('same seed → same level', JSON.stringify(a) === JSON.stringify(b));
if (failures) throw new Error(`${failures} check(s) failed`);
