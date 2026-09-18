// Run with: npm test
import { attacks, isMate, apply, matingMoves, makePuzzle, spec, valid, worldCells, SHAPES, key, type State } from './mate-model.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };
function mulberry32(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A flat L at (2,2): shadow (3,2) and (2,3); the anchor itself is not an attack.
const L = { cells: SHAPES.L3, anchor: [2, 2] as const };
check('flat L attacks the two cells under its arms', [...attacks(5, L)].sort().join(';') === '2,3;3,2');
// Stand it up: turn about z so the x-arm points up → only the z-arm still casts a shadow.
const up = apply({ n: 5, king: [0, 0], pieces: [L] }, 0, { type: 'turn', move: { axis: 'z', dir: 1 } })!;
check('after a Z+ turn the x-arm stands up and its shadow is gone', [...attacks(5, up.pieces[0])].join(';') === '2,3');
// A corner king with every neighbour covered is mate; move one attacker away and it is not.
const cornered: State = { n: 5, king: [0, 0], pieces: [{ cells: [[0, 0, 0], [-1, 0, 0], [-1, 0, -1], [0, 0, -1]], anchor: [1, 1] }] };
check('king in the corner, its cell and both neighbours shadowed: mate', isMate(cornered));
check('same piece one cell further away: not mate', !isMate({ ...cornered, pieces: [{ ...cornered.pieces[0], anchor: [2, 2] }] }));
check('sliding off the board is illegal', apply({ n: 5, king: [4, 4], pieces: [{ cells: SHAPES.I3, anchor: [0, 0] }] }, 0, { type: 'slide', dir: 'x-' }) === null);
check('two pieces whose cubes would share a cell are invalid', !valid({ n: 5, king: [4, 4], pieces: [{ cells: SHAPES.I3, anchor: [0, 0] }, { cells: SHAPES.I3, anchor: [1, 0] }] }));
check('a piece hanging over the king at ground level is invalid', !valid({ n: 5, king: [1, 0], pieces: [{ cells: SHAPES.I3, anchor: [0, 0] }] }));
check('a turn that would crash into another piece is illegal', apply({ n: 5, king: [4, 4], pieces: [{ cells: [[0, 0, 0], [0, 1, 0], [0, 2, 0]], anchor: [0, 0] }, { cells: [[0, 0, 0]], anchor: [1, 0] }] }, 0, { type: 'turn', move: { axis: 'z', dir: -1 } }) === null);
check('sliding onto the king is illegal', apply({ n: 5, king: [1, 0], pieces: [{ cells: SHAPES.I3, anchor: [0, 0] }] }, 0, { type: 'slide', dir: 'x+' }) === null);

const connected = (cells: readonly (readonly number[])[]) => {
  const k = (c: readonly number[]) => c.join(','), keys = new Set(cells.map(k)), seen = new Set([k(cells[0])]), q = [cells[0]];
  while (q.length) { const [x, y, z] = q.pop()!; for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const c = [x + d[0], y + d[1], z + d[2]]; if (keys.has(k(c)) && !seen.has(k(c))) { seen.add(k(c)); q.push(c); } } }
  return seen.size === cells.length;
};
let n = 0, bad = 0, kind = 0, split = 0;
for (let seed = 1; seed <= 25; seed++) {
  const rng = mulberry32(seed);
  for (const level of [0, 2, 4, 6]) {
    const sp = spec(level);
    const p = makePuzzle(sp, rng);
    n++;
    const mates = matingMoves(p);
    if (isMate(p) || mates.length !== 1 || mates[0].piece !== p.answer.piece || JSON.stringify(mates[0].action) !== JSON.stringify(p.answer.action)) bad++;
    const a = p.answer.action;
    if (sp.answer === 'turn' && a.type !== 'turn') kind++;
    if (sp.answer === 'tilt' && (a.type !== 'turn' || a.move.axis === 'y')) kind++;
    if (p.pieces.length !== sp.pieces || new Set([key(p.king), ...p.pieces.map((x) => key(x.anchor))]).size !== sp.pieces + 1) bad++;
    if (!p.pieces.every((pc) => connected(pc.cells) && pc.cells[0].join() === '0,0,0')) split++;
    if (!valid(p) || p.pieces.some((pc) => Math.min(...worldCells(pc).map((c) => c[1])) !== 0)) bad++;
  }
}
check(`${n} puzzles: not mate yet, exactly one mating move, it is the recorded answer (${bad} bad)`, bad === 0);
check(`every piece is a connected polycube with its pivot at the origin (${split} broken)`, split === 0);
check(`answer kind follows the spec: turn / horizontal-axis turn (${kind} wrong)`, kind === 0);
const x = makePuzzle(spec(4), mulberry32(2)), y = makePuzzle(spec(4), mulberry32(2));
check('same seed → same puzzle', JSON.stringify(x) === JSON.stringify(y));
if (failures) throw new Error(`${failures} check(s) failed`);
