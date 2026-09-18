// Run with: npm test
import { makeItem, makeLoad, land, makeDoorway, passes, settleBodies, makeCorner, cellKey } from './model.ts';
import { applyMoves, orientations, normalize, MOVES, type Cell } from '../polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Rigid bodies: an L falls as one piece and rests on a ledge by its lowest cell.
const L: Cell[] = [[0, 3, 0], [0, 4, 0], [1, 4, 0]];
const ledge: Cell[] = [[1, 1, 0]];
const [settled] = settleBodies(5, ledge, [L], [0, -1, 0]);
const want: Cell[] = [[0, 1, 0], [0, 2, 0], [1, 2, 0]];
check('rigid L rests on the ledge under its foot', settled.map(cellKey).sort().join(';') === want.map(cellKey).sort().join(';'));
const [free] = settleBodies(5, [], [L], [0, -1, 0]);
check('rigid L falls to the floor otherwise', Math.min(...free.map((c) => c[1])) === 0);

let loads = 0, loadBad = 0, doors = 0, doorBad = 0, corners = 0, cornerBad = 0;
for (let s = 1; s <= 60; s++) {
  const rng = mulberry32(s);
  for (const cubes of [4, 5]) {
    const item = makeItem(cubes, rng);
    for (const d of [1, 2, 3]) {
      const p = makeLoad(item, d, rng);
      loads++;
      if (!land(p, applyMoves(p.piece, p.solution)).fits) loadBad++;
      for (const m of MOVES) if (land(p, applyMoves(p.piece, [...p.solution, m])).fits) loadBad++;
      // After loading, the item is in the target orientation; a doorway from there must be impassable now, passable later.
      const dw = makeDoorway(p.target, d, rng);
      doors++;
      if (passes(normalize(p.target), dw.wall)) doorBad++;
      if (!orientations(normalize(p.target)).some((o) => passes(o.cells, dw.wall))) doorBad++;
      if (!(dw.par >= 1 && dw.par <= 3)) doorBad++;
    }
    const others = [{ cells: makeItem(4, rng), name: 'box', color: 0x6b8fd6 }, { cells: [[0, 0, 0], [1, 0, 0]] as Cell[], name: 'crate', color: 0x46a758 }];
    const c = makeCorner(item, others, rng);
    corners++;
    const hit = c.final.filter((b) => b.some((cell) => cellKey(cell) === cellKey(c.socket)));
    if (hit.length !== 1 || hit[0] !== c.final[c.answer]) cornerBad++;
    if (c.bodies.some((b) => b.cells.some((cell) => cellKey(cell) === cellKey(c.socket)))) cornerBad++;
  }
}
check(`${loads} loads: solution fits, no single-turn deviation fits (${loadBad} bad)`, loadBad === 0);
check(`${doors} doorways: impassable now, passable within 1–3 turns (${doorBad} bad)`, doorBad === 0);
check(`${corners} corners: exactly the answer body reaches the socket, socket empty before (${cornerBad} bad)`, cornerBad === 0);
if (failures) throw new Error(`${failures} check(s) failed`);
