// Count: a stack of cubes and which of them a viewpoint hides. Pure and orthographic, so a
// daily puzzle is the same on every screen (the stage uses a narrow FOV to match).
import type { Cell } from '../polycube.ts';

export const cellKey = (c: Cell) => c.join(',');

/** Columns of random height on a w×d footprint; a fifth of the columns are empty. */
export function heightmap(w: number, d: number, maxH: number, rng: () => number): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const hgt = rng() < 0.2 ? 0 : 1 + Math.floor(rng() * maxH);
    for (let y = 0; y < hgt; y++) cells.push([x, y, z]);
  }
  return cells;
}

/** Unit vector from the scene toward the camera; same spherical convention as placeCamera. */
export function viewDir(azDeg: number, elDeg: number): [number, number, number] {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

const NORMALS: readonly Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Sample offsets on a face (in the face's two tangent directions): centre plus four inner points. */
const SAMPLES = [[0, 0], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]];

/** Does a ray from p along v (t > 0) pass through the unit cube centred at c? Exact slab test. */
function hitsBox(p: number[], v: number[], c: Cell) {
  let tIn = -Infinity, tOut = Infinity;
  for (let i = 0; i < 3; i++) {
    const lo = c[i] - 0.5, hi = c[i] + 0.5;
    if (Math.abs(v[i]) < 1e-9) { if (p[i] <= lo || p[i] >= hi) return false; continue; }
    const t1 = (lo - p[i]) / v[i], t2 = (hi - p[i]) / v[i];
    tIn = Math.max(tIn, Math.min(t1, t2));
    tOut = Math.min(tOut, Math.max(t1, t2));
  }
  return tIn < tOut && tOut > 1e-6;
}

/** Per cube: is any camera-facing face partly in view from direction (az, el)? */
export function visible(cells: Cell[], azDeg: number, elDeg: number): boolean[] {
  const v = viewDir(azDeg, elDeg);
  const solid = new Set(cells.map(cellKey));
  return cells.map((c) => {
    for (const n of NORMALS) {
      if (n[0] * v[0] + n[1] * v[1] + n[2] * v[2] <= 0) continue;
      if (solid.has(cellKey([c[0] + n[0], c[1] + n[1], c[2] + n[2]]))) continue; // face is internal
      const u = n[0] ? [0, 1, 0] : [1, 0, 0];
      const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (const [su, sw] of SAMPLES) {
        const p = [0, 1, 2].map((i) => c[i] + 0.5001 * n[i] + su * u[i] + sw * w[i]);
        if (!cells.some((o) => o !== c && hitsBox(p, v, o))) return true;
      }
    }
    return false;
  });
}

export interface Stack { cells: Cell[]; az: number; el: number; hidden: number[] }

/** A stack where every column's top is visible (so heights are inferable) and 2..half the cubes are hidden. */
export function makeStack(base: number, maxH: number, rng: () => number): Stack {
  for (let tries = 0; tries < 800; tries++) {
    const cells = heightmap(base, base, maxH, rng);
    const az = 35 + (rng() - 0.5) * 20, el = 42 + rng() * 10;
    const vis = visible(cells, az, el);
    const hidden = vis.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const tops = new Map<string, number>();
    cells.forEach((c, i) => { const k = `${c[0]},${c[2]}`; const t = tops.get(k); if (t == null || cells[t][1] < c[1]) tops.set(k, i); });
    const topsVisible = [...tops.values()].every((i) => vis[i]);
    if (topsVisible && hidden.length >= 2 && hidden.length <= cells.length / 2) return { cells, az, el, hidden };
  }
  throw new Error('no stack');
}
