// Run with: npm test
import { applyMoves, hasTrivialSymmetry, orientations, rotateCell, shapeKey, MOVES, type Cell, type Move } from './polycube.ts';

let failures = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};
const eq = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// Right-hand rule: +90 about X takes Y→Z, about Y takes Z→X, about Z takes X→Y.
check('X+ maps Y to Z', eq(rotateCell([0, 1, 0], { axis: 'x', dir: 1 }), [0, 0, 1]));
check('Y+ maps Z to X', eq(rotateCell([0, 0, 1], { axis: 'y', dir: 1 }), [1, 0, 0]));
check('Z+ maps X to Y', eq(rotateCell([1, 0, 0], { axis: 'z', dir: 1 }), [0, 1, 0]));

// Each move composed with its inverse is the identity, and four of the same move is the identity.
for (const m of MOVES) {
  const inv: Move = { axis: m.axis, dir: m.dir > 0 ? -1 : 1 };
  const p: Cell = [1, 2, 3];
  check(`${m.axis}${m.dir} then inverse is identity`, eq(rotateCell(rotateCell(p, m), inv), p));
  check(`${m.axis}${m.dir} ×4 is identity`, eq(applyMoves([p], [m, m, m, m])[0], p));
}

// Symmetry classification.
const L: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]];
const S: Cell[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]];
const I: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]];
const screw: Cell[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]];
check('L tetracube has 24 orientations', hasTrivialSymmetry(L));
check('S tetracube has 12 orientations', orientations(S).length === 12);
check('I tetracube has 3 orientations', orientations(I).length === 3);
check('3D screw tetracube has 12 orientations (2-fold symmetric)', orientations(screw).length === 12);

// BFS paths actually reach their orientation, and the graph has diameter 3.
const os = orientations(L);
check('every BFS path reproduces its orientation', os.every((o) => shapeKey(applyMoves(L, o.path)) === o.key));
const maxD = Math.max(...os.map((o) => o.dist));
check(`max distance is 3 (got ${maxD})`, maxD === 3);
const hist = [0, 1, 2, 3].map((d) => os.filter((o) => o.dist === d).length);
check(`distance histogram is 1/6/11/6 (got ${hist})`, hist.join() === '1,6,11,6');

if (failures) throw new Error(`${failures} check(s) failed`);
