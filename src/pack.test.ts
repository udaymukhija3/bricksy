// Run with: npm test
import { isDroppable, depthVariety, land, makePackPuzzle, STAGES, cellKey } from './pack.ts';
import { applyMoves, MOVES, type Cell, type Move } from './polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};

const flatL: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1]];
const standingL: Cell[] = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 0, 0]];
const hangingL: Cell[] = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0]];
check('flat L is droppable', isDroppable(flatL));
check('standing L (foot at bottom) is not droppable', !isDroppable(standingL));
check('hanging L (foot at top) is droppable', isDroppable(hangingL));
check('flat L has one depth', depthVariety(flatL) === 1);
check('hanging L has two depths', depthVariety(hangingL) === 2);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Across many generated puzzles: the solution fits, has the promised length, and
// every other orientation the player might commit does NOT fit.
let generated = 0, wrongFits = 0, badLen = 0, notDroppable = 0, floating = 0;
for (const stage of STAGES) {
  for (let s = 0; s < 40; s++) {
    const p = makePackPuzzle(stage, s, mulberry32(s * 7919 + stage.from), () => true);
    generated++;
    if (!land(p, applyMoves(p.piece, p.solution)).fits) wrongFits++;
    if (p.solution.length !== p.distance || p.distance !== Math.min(stage.distance, 3)) badLen++;
    if (!isDroppable(p.target)) notDroppable++;
    // Every single-turn deviation from the solution must land somewhere non-fitting.
    for (const m of MOVES) {
      const alt: Move[] = [...p.solution, m];
      const l = land(p, applyMoves(p.piece, alt));
      if (l.fits) wrongFits++;
      // and must rest on something: at least one cell sits directly on a solid or the ground
      const moldSet = new Set<string>();
      for (let x = 0; x < p.mold.w; x++) for (let y = 0; y < p.mold.h; y++) for (let z = 0; z < p.mold.d; z++) moldSet.add(cellKey([x, y, z]));
      for (const c of p.cavity) moldSet.delete(cellKey(c));
      const supported = l.cells.some(([x, y, z]) => y === 0 || moldSet.has(cellKey([x, y - 1, z])));
      const overlapping = l.cells.some((c) => moldSet.has(cellKey(c)));
      if (!supported || overlapping) floating++;
    }
  }
}
check(`${generated} puzzles: solution always fits, no deviation fits (${wrongFits} bad)`, wrongFits === 0);
check('solution length equals stage distance', badLen === 0);
check('cavity orientation always droppable', notDroppable === 0);
check('wrong drops always rest on solid without overlapping it', floating === 0);

if (failures) throw new Error(`${failures} check(s) failed`);
