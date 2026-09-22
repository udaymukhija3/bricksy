import { JOBS } from './jobs.ts';
import { furnitureCells, FURNITURE_NAMES } from './furniture.ts';
import { readCheckpoint, type Checkpoint } from './journey.ts';
import { makeLoad, land, makeDoorway, passes, makeCorner } from './model.ts';
import { applyMoves, orientations, normalize, shapeKey } from '../polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function rngFor(seed: number) { return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed) + 0x6d2b79f5 | 0; return (seed >>> 0) / 2 ** 32; }; }

check('every furniture item has 24 distinct orientations', FURNITURE_NAMES.every((name) => orientations(furnitureCells(name)!).length === 24));
let bad = 0;
for (const job of JOBS) for (let seed = 1; seed <= 20; seed++) {
  let item = furnitureCells(job.item)!;
  const initial = shapeKey(item);
  const rng = rngFor(seed * 7919 + job.id);
  for (const st of job.stages) {
    if (st.type === 'load') {
      const p = makeLoad(item, st.d, rng);
      if (!land(p, applyMoves(p.piece, p.solution)).fits) bad++;
      item = normalize(p.target);
    } else if (st.type === 'doorway') {
      const d = makeDoorway(item, st.d, rng);
      if (passes(item, d.wall)) bad++;
      const solution = orientations(item).find((o) => passes(o.cells, d.wall));
      if (!solution) { bad++; continue; }
      item = solution.cells;
    } else {
      const c = makeCorner(item, [{ cells: [[0,0,0],[1,0,0]], name:'crate', color:0 }], rng);
      if (!c.final[c.answer].some((cell) => cell.join(',') === c.socket.join(','))) bad++;
    }
    if (!orientations(item).some((o) => o.key === initial)) bad++;
  }
}
check(`all ten authored deliveries remain solvable across 20 seeds, with the same furniture (${bad} failures)`, bad === 0);

const cp: Checkpoint = { version: 1, jobId: 4, stageIndex: 1, item: furnitureCells('fridge')!, misses: 1, results: [false] };
check('a valid stage checkpoint restores orientation and misses', JSON.stringify(readCheckpoint(JSON.stringify(cp))) === JSON.stringify(cp));
check('unfinished award after the final stage can resume', !!readCheckpoint(JSON.stringify({ ...cp, stageIndex: 2, results: [false,true] })));
for (const [name, value] of Object.entries({ version: { ...cp, version: 0 }, job: { ...cp, jobId: 99 }, stage: { ...cp, stageIndex: 3 }, results: { ...cp, results: [] }, misses: { ...cp, misses: -1 }, item: { ...cp, item: [[0,0,0],[1,0,0],[2,0,0],[3,0,0]] } })) check(`corrupt checkpoint ${name} is rejected`, readCheckpoint(JSON.stringify(value)) === null);
check('invalid storage JSON is ignored', readCheckpoint('{oops') === null && readCheckpoint(null) === null);
if (failures) throw new Error(`${failures} check(s) failed`);
