// Run with: npm test — every game's round generator, every level, many seeds: a daily must
// never fail to generate. Sketches import three.js, which loads fine in node without a DOM.
import { makeTrap, cubesFor as mirrorCubes } from './mirror.ts';
import { makeTrain, setup as gearsSetup } from './gears.ts';
import { makeRun, cubesFor as smuggleCubes, wallsFor } from './smuggler.ts';
import { makeRoom, setup as tiltSetup } from './gravity.ts';
import { makeCase as shadowsCase, setup as shadowsSetup } from './shadows.ts';
import { makeCase as flashCase, setup as flashSetup } from './flash.ts';
import { pickCase } from './slice.ts';
import { makeStack } from './count-model.ts';
import { makeLevel, spec as shoveSpec } from './shove-model.ts';
import { generate, spec as wayfindSpec } from './wayfind-model.ts';
import { makePuzzle as assemblePuzzle, spec as assembleSpec } from './assemble-model.ts';
import { makePuzzle as matePuzzle, spec as mateSpec } from './mate-model.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 24];
const SEEDS = 40;
/** The search-heavy generators (mate in two, Shove with the box) get fewer seeds so the sweep stays quick. */
const seedsFor = (name: string, level: number) => (name === 'mate' && level >= 8) || (name === 'shove' && level >= 6) ? 6 : SEEDS;

const gens: Record<string, (level: number, rng: () => number) => unknown> = {
  mirror: (l, r) => makeTrap(mirrorCubes(l), r),
  gears: (l, r) => { const d = gearsSetup(l); return makeTrain(d.count, d.compounds, r); },
  smuggle: (l, r) => makeRun(smuggleCubes(l), wallsFor(l), r),
  tilt: (l, r) => { const d = tiltSetup(l); return makeRoom(d.n, d.looseN, d.fixedN, r); },
  shadows: (l, r) => { const d = shadowsSetup(l); return shadowsCase(d.dims, d.n, r); },
  flash: (l, r) => { const d = flashSetup(l); return flashCase({ w: 3, h: 3, d: 3 }, d.n, r); },
  cut: (l, r) => { const c = pickCase(l, r); if (!c) throw new Error('no case'); return c; },
  count: (l, r) => { const base = l < 3 ? 3 : l < 6 ? 4 : l < 9 ? 4 : 5, maxH = l < 3 ? 3 : l < 6 ? 3 : 4; return makeStack(base, maxH, r); },
  shove: (l, r) => makeLevel(shoveSpec(l), r),
  wayfind: (l, r) => { const s = wayfindSpec(l); return generate(s.rooms, s.loops, r, s.heading); },
  assemble: (l, r) => assemblePuzzle(assembleSpec(l), r),
  mate: (l, r) => matePuzzle(mateSpec(Math.min(l, 9)), r),
};

for (const [name, gen] of Object.entries(gens)) {
  let bad = 0, worst = 0;
  const t0 = performance.now();
  for (const level of LEVELS) for (let s = 1; s <= seedsFor(name, level); s++) {
    const a = performance.now();
    try { gen(level, mulberry32(s * 7919 + level * 131)); } catch (e) { bad++; if (bad <= 3) console.log(`     ${name} level ${level} seed ${s}: ${(e as Error).message}`); }
    worst = Math.max(worst, performance.now() - a);
  }
  check(`${name}: every level generates (${bad} failures, worst ${Math.round(worst)} ms, ${Math.round(performance.now() - t0)} ms total)`, bad === 0);
}
if (failures) throw new Error(`${failures} check(s) failed`);
