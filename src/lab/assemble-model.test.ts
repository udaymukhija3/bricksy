// Run with: npm test
import { makePuzzle, build, cut, spec, cellKey } from './assemble-model.ts';
import { shapeKey, type Cell } from '../polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const connected = (cells: Cell[]) => {
  const keys = new Set(cells.map(cellKey)), seen = new Set([cellKey(cells[0])]), q = [cells[0]];
  while (q.length) { const [x, y, z] = q.pop()!; for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = cellKey([x + d[0], y + d[1], z + d[2]]); if (keys.has(k) && !seen.has(k)) { seen.add(k); q.push([x + d[0], y + d[1], z + d[2]]); } } }
  return seen.size === cells.length;
};

let n = 0, bad = 0, trivial = 0, uncut = 0;
for (let seed = 1; seed <= 40; seed++) {
  const rng = mulberry32(seed);
  for (const level of [0, 1, 2, 3, 4, 6, 7]) {
    const sp = spec(level);
    const p = makePuzzle(sp, rng);
    n++;
    // Parts partition the target, each connected, sizes 2..4.
    const all = p.parts.flatMap((pt) => pt.cells.length);
    if (all.reduce((a, b) => a + b, 0) !== p.target.length || all.some((s) => s < 2 || s > 4)) bad++;
    if (!p.parts.every((pt) => connected(pt.cells) && cellKey(pt.cells[0]) === '0,0,0')) bad++;
    // The recorded solution builds cleanly and covers the target exactly.
    const out = build(p, p.parts.map((pt) => pt.solution));
    const covered = new Set(out.placed.flat().map(cellKey));
    if (!out.ok || covered.size !== p.target.length || !p.target.every((c) => covered.has(cellKey(c)))) bad++;
    // Turns are needed for at least one part whenever the level scrambles.
    if (sp.scramble > 0 && p.parts.every((pt) => shapeKey(pt.cells) === shapeKey(build(p, [pt.solution, ...p.parts.slice(1).map((x) => x.solution)]).placed[0] ?? []))) trivial++;
    // A plan with the right turns but the wrong anchor fails, as does a missing anchor.
    const wrong = p.parts.map((pt, i) => (i === 0 ? { moves: pt.solution.moves, anchor: [50, 50, 50] as Cell } : pt.solution));
    if (build(p, wrong).ok || build(p, wrong).reason !== 'outside') bad++;
    if (build(p, [{ moves: [], anchor: null }]).reason !== 'no-anchor') bad++;
  }
}
check(`${n} puzzles: parts partition the target (connected, 2–4 cells), the solution builds, wrong anchors fail (${bad} bad)`, bad === 0);
check(`scrambled puzzles need at least one turn (${trivial} trivial)`, trivial === 0);
// Overlap detection: two parts sent to the same place.
{
  const p = makePuzzle(spec(0), mulberry32(4));
  const dup = [p.parts[0].solution, { moves: p.parts[0].solution.moves, anchor: p.parts[0].solution.anchor }];
  const o = build({ target: p.target, parts: [p.parts[0], p.parts[0]] }, dup);
  check('overlapping placement fails with reason overlap', !o.ok && o.reason === 'overlap' && o.failedAt === 1);
}
let cuts = 0;
for (let s = 1; s <= 10; s++) { const c = cut([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], 2, 2, 2, mulberry32(s)); if (c) { cuts++; if (!c.every((p) => p.length === 2 && connected(p))) uncut++; } }
check(`a 4-line cuts into two dominoes when the seeds allow it (${cuts}/10 cut, ${uncut} wrong)`, cuts > 0 && uncut === 0);
const a = makePuzzle(spec(4), mulberry32(11)), b = makePuzzle(spec(4), mulberry32(11));
check('same seed → same puzzle', JSON.stringify(a) === JSON.stringify(b));
if (failures) throw new Error(`${failures} check(s) failed`);
