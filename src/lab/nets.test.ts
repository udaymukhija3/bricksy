// Run with: npm test
import { NETS, fold, opposite } from './nets.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };

NETS.forEach((net, k) => {
  const f = fold(net, Math.PI / 2);
  const normals = f.map((x) => x.normal.map((v) => Math.round(v)).join(','));
  const distinct = new Set(normals).size === 6;
  // Every folded face centre must be 0.5 from the cube centre along its own normal.
  const cx = f.reduce((s, x) => s + x.centre[0], 0) / 6, cy = f.reduce((s, x) => s + x.centre[1], 0) / 6, cz = f.reduce((s, x) => s + x.centre[2], 0) / 6;
  const onCube = f.every((x) => Math.abs((x.centre[0] - cx) * x.normal[0] + (x.centre[1] - cy) * x.normal[1] + (x.centre[2] - cz) * x.normal[2] - 0.5) < 1e-6);
  check(`net ${k + 1} folds into a cube (6 distinct outward normals: ${distinct}, faces on cube: ${onCube})`, distinct && onCube);
  check(`net ${k + 1}: opposite is an involution`, net.every((_, i) => opposite(net, opposite(net, i)) === i));
});
if (failures) throw new Error(`${failures} check(s) failed`);
