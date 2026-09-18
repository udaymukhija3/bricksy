// Run with: npm test
import { visible, makeStack } from './count-model.ts';
import type { Cell } from '../polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A cube behind a taller column, seen from the front-right and above, is hidden; the tops stay visible.
const wall: Cell[] = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 0, -1]];
const vis = visible(wall, 0, 20);
check('cube directly behind a 3-high column is hidden from the front', vis[3] === false);
check('the column itself is visible', vis[0] && vis[1] && vis[2]);
check('same cube is visible once the view swings to the side', visible(wall, 80, 20)[3] === true);
check('a lone cube is visible from anywhere', visible([[0, 0, 0]], 123, 5)[0]);

let bad = 0, n = 0;
for (let s = 1; s <= 40; s++) {
  const rng = mulberry32(s);
  for (const [base, maxH] of [[3, 3], [4, 3], [4, 4], [5, 4]]) {
    const st = makeStack(base, maxH, rng);
    n++;
    const vis = visible(st.cells, st.az, st.el);
    if (st.hidden.some((i) => vis[i]) || st.hidden.length < 2) bad++;
    // Every column top visible, as promised by the hint.
    const tops = new Map<string, number>();
    st.cells.forEach((c, i) => { const k = `${c[0]},${c[2]}`; const t = tops.get(k); if (t == null || st.cells[t][1] < c[1]) tops.set(k, i); });
    if (![...tops.values()].every((i) => vis[i])) bad++;
  }
}
check(`${n} stacks: hidden set matches visibility, ≥2 hidden, all column tops visible (${bad} bad)`, bad === 0);
// Determinism: the same seed gives the same stack.
const a = makeStack(4, 3, mulberry32(7)), b = makeStack(4, 3, mulberry32(7));
check('same seed → same stack', JSON.stringify(a) === JSON.stringify(b));
if (failures) throw new Error(`${failures} check(s) failed`);
