// Cube nets and a pure folding model (no rendering), so it can be tested.
export type Net = [number, number][];

/** The 11 hexomino nets of a cube, as (col, row) cells. */
export const NETS: Net[] = [
  // 1-4-1: a row of four with one cell above and one below.
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
  // 2-3-1
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]],
  // 2-2-2 and 3-3
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
];

export interface Hinge { face: number; parent: number; dx: number; dz: number }

/** Spanning tree of the net from `root`, as hinges (child face, parent face, offset). */
export function hinges(net: Net, root = 0): Hinge[] {
  const idx = new Map(net.map((c, i) => [`${c[0]},${c[1]}`, i]));
  const seen = new Set([root]);
  const out: Hinge[] = [];
  const queue = [root];
  while (queue.length) {
    const p = queue.shift()!;
    const [x, z] = net[p];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = idx.get(`${x + dx},${z + dz}`);
      if (j == null || seen.has(j)) continue;
      seen.add(j);
      out.push({ face: j, parent: p, dx, dz });
      queue.push(j);
    }
  }
  return out;
}

type M = number[]; // 4x4 column-major-agnostic: we use row-major 3x4 [r0..r2 | t]
const mul = (a: M, b: M): M => {
  const r: M = new Array(12).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
    r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + (j === 3 ? a[i * 4 + 3] : 0);
  }
  return r;
};
const T = (x: number, y: number, z: number): M => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
const Rx = (a: number): M => [1, 0, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0];
const Rz = (a: number): M => [Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0];
const apply = (m: M, v: [number, number, number], w = 1) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * w,
  m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * w,
  m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * w,
] as [number, number, number];

/** Hinge rotation for a child at (dx, dz), folding *down* so face-up symbols end on the outside. */
export const hingeRotation = (dx: number, dz: number, angle: number): { axis: 'x' | 'z'; angle: number } =>
  dx !== 0 ? { axis: 'z', angle: -dx * angle } : { axis: 'x', angle: dz * angle };

/** Per-face centre and outward normal after folding by `angle` (π/2 = closed). */
export function fold(net: Net, angle: number, root = 0) {
  const mats: M[] = [];
  mats[root] = T(0, 0, 0);
  for (const hg of hinges(net, root)) {
    const r = hingeRotation(hg.dx, hg.dz, angle);
    const R = r.axis === 'z' ? Rz(r.angle) : Rx(r.angle);
    const local = mul(mul(T(hg.dx / 2, 0, hg.dz / 2), R), T(hg.dx / 2, 0, hg.dz / 2));
    mats[hg.face] = mul(mats[hg.parent], local);
  }
  return net.map((_, i) => ({ centre: apply(mats[i], [0, 0, 0]), normal: apply(mats[i], [0, 1, 0], 0) }));
}

/** Index of the face opposite `face` in the folded cube. */
export function opposite(net: Net, face: number, root = 0) {
  const f = fold(net, Math.PI / 2, root);
  const n = f[face].normal;
  return f.findIndex((g, i) => i !== face && g.normal[0] * n[0] + g.normal[1] * n[1] + g.normal[2] * n[2] < -0.99);
}
