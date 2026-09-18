// Run with: npm test
import { generate, walk, good, shortestWalk, neighbours, isDecision, turnTo, headingOf, key, spec, HEAD_VEC, type P } from './wayfind-model.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let n = 0, bad = 0, loopsBad = 0, parBad = 0;
for (let seed = 1; seed <= 40; seed++) {
  const rng = mulberry32(seed);
  for (const level of [0, 1, 2, 3, 5, 7]) {
    const sp = spec(level);
    const m = generate(sp.rooms, sp.loops, rng, sp.heading);
    n++;
    const open = new Set(m.open);
    // The start heading faces an open cell.
    if (!open.has(key([m.start[0] + HEAD_VEC[m.heading][0], m.start[1] + HEAD_VEC[m.heading][1]]))) bad++;
    // Every room reachable from the goal; start and goal are rooms; start ≠ goal.
    const rooms = m.rooms * m.rooms;
    const reached = Object.keys(m.dist).filter((k) => k.split(',').every((v) => Number(v) % 2 === 1)).length;
    if (reached !== rooms || !(key(m.start) in m.dist) || key(m.start) === key(m.goal)) bad++;
    // Doors = (rooms − 1) for a tree, plus the loops.
    const doors = m.open.filter((k) => { const [x, z] = k.split(',').map(Number); return (x % 2) !== (z % 2); }).length;
    if (doors !== rooms - 1 + sp.loops) loopsBad++;
    // Replaying the shortest walk reaches the goal with every decision graded good, in `par` decisions.
    let cur: P = m.start, h = m.heading, steps = 0, wrong = 0;
    for (const rel of shortestWalk(m)) {
      const nh = turnTo(h, rel);
      const nxt: P = [cur[0] + HEAD_VEC[nh][0], cur[1] + HEAD_VEC[nh][1]];
      if (!open.has(key(nxt))) { wrong++; break; }
      if (!good(m, cur, nxt)) wrong++;
      const w = walk(m, cur, nxt);
      if (!w.path.every((p) => open.has(key(p))) || !isDecision(open, w.end, m.goal) || headingOf(w.path.length > 1 ? w.path[w.path.length - 2] : cur, w.end) !== w.heading) bad++;
      cur = w.end; h = w.heading; steps++;
    }
    if (key(cur) !== key(m.goal) || wrong || steps !== m.par || m.par < 1) parBad++;
    // A step away from the goal is graded wrong.
    const worse = neighbours(open, m.goal)[0];
    if (good(m, m.goal, worse)) bad++;
  }
}
check(`${n} mazes: connected, start≠goal, walks stop at decision cells (${bad} bad)`, bad === 0);
check(`door count = rooms − 1 + loops (${loopsBad} bad)`, loopsBad === 0);
check(`shortest walk replays to the goal in par decisions with no wrong turn (${parBad} bad)`, parBad === 0);
const a = generate(5, 2, mulberry32(9), 'random'), b = generate(5, 2, mulberry32(9), 'random');
check('same seed → same maze', JSON.stringify(a) === JSON.stringify(b));
if (failures) throw new Error(`${failures} check(s) failed`);
