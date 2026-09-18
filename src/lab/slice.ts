// Slice: a solid and a cutting plane. Predict the cross-section before the blade goes through.
import * as THREE from 'three';
import { SketchStage, choices, panel, h, mulberry32, pick, shuffle, sleep, easeInOut, easeOut } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

type P2 = [number, number];
interface Solid { name: string; geo: THREE.BufferGeometry; tier: number }
interface Cut { n: THREE.Vector3; d: number; label: string; tier: number }
interface Section { loops: P2[][]; area: number; corners: number; aspect: number; svg: string }

function solids(): Solid[] {
  const g = (name: string, tier: number, geo: THREE.BufferGeometry, rot?: (g: THREE.BufferGeometry) => void) => {
    rot?.(geo);
    return { name, tier, geo: geo.toNonIndexed() };
  };
  return [
    g('cube', 0, new THREE.BoxGeometry(2, 2, 2)),
    g('cylinder', 0, new THREE.CylinderGeometry(1, 1, 2.2, 48)),
    g('cone', 0, new THREE.ConeGeometry(1.1, 2.2, 48)),
    g('sphere', 0, new THREE.SphereGeometry(1.2, 48, 32)),
    g('square pyramid', 0, new THREE.ConeGeometry(1.4, 2, 4), (geo) => geo.rotateY(Math.PI / 4)),
    g('triangular prism', 1, new THREE.CylinderGeometry(1.2, 1.2, 2.2, 3)),
    g('hexagonal prism', 1, new THREE.CylinderGeometry(1, 1, 2.2, 6)),
    g('wedge', 1, new THREE.CylinderGeometry(1.3, 1.3, 2, 3), (geo) => geo.rotateZ(Math.PI / 2)),
    g('torus', 2, new THREE.TorusGeometry(0.85, 0.4, 24, 64), (geo) => geo.rotateX(Math.PI / 2)),
    g('capsule', 2, new THREE.CapsuleGeometry(0.7, 1.2, 8, 24)),
  ];
}

const CUTS: Cut[] = [
  { n: new THREE.Vector3(0, 1, 0), d: 0, label: 'horizontal, through the middle', tier: 0 },
  { n: new THREE.Vector3(1, 0, 0), d: 0, label: 'vertical, through the middle', tier: 0 },
  { n: new THREE.Vector3(0, 1, 0), d: 0.55, label: 'horizontal, above the middle', tier: 1 },
  { n: new THREE.Vector3(0, 1, 0), d: -0.6, label: 'horizontal, below the middle', tier: 1 },
  { n: new THREE.Vector3(1, 0, 0), d: 0.5, label: 'vertical, off-centre', tier: 1 },
  { n: new THREE.Vector3(0, 0, 1), d: 0.45, label: 'vertical, off-centre', tier: 1 },
  { n: new THREE.Vector3(1, 1, 0).normalize(), d: 0, label: 'tilted 45°', tier: 2 },
  { n: new THREE.Vector3(0, 1, 1).normalize(), d: 0.3, label: 'tilted 45°, off-centre', tier: 2 },
  { n: new THREE.Vector3(1, 1, 1).normalize(), d: 0, label: 'tilted on two axes', tier: 3 },
  { n: new THREE.Vector3(1, -0.5, 0).normalize(), d: 0.2, label: 'steeply tilted', tier: 3 },
];

/** Difficulty by level: which solids and cuts are in play. */
const tiers = (level: number) => ({ solid: level < 2 ? 0 : level < 5 ? 1 : 2, cut: level < 1 ? 0 : level < 3 ? 1 : level < 6 ? 2 : 3 });

/** Plane basis (u, v) so 2D coordinates are stable across candidates. */
function basis(n: THREE.Vector3) {
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(ref, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

/** Intersect every triangle with the plane, chain the segments into loops, and describe the result. */
function section(geo: THREE.BufferGeometry, cutIn: Cut): Section | null {
  const cut = { ...cutIn, d: cutIn.d + 0.0137 }; // off the lattice: never exactly through a vertex
  const pos = geo.getAttribute('position');
  const { u, v } = basis(cut.n);
  const segs: [P2, P2][] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const to2 = (p: THREE.Vector3): P2 => [p.dot(u), p.dot(v)];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const pts: THREE.Vector3[] = [];
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [THREE.Vector3, THREE.Vector3][]) {
      const sp = p.dot(cut.n) - cut.d, sq = q.dot(cut.n) - cut.d;
      if ((sp < 0 && sq >= 0) || (sp >= 0 && sq < 0)) pts.push(p.clone().lerp(q, sp / (sp - sq)));
    }
    if (pts.length === 2) {
      const s: [P2, P2] = [to2(pts[0]), to2(pts[1])];
      if (Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]) > 1e-5) segs.push(s);
    }
  }
  if (segs.length < 3) return null;
  // Chain segments by matching endpoints.
  const key = (p: P2) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const adj = new Map<string, { p: P2; segs: number[] }>();
  segs.forEach((s, i) => { for (const p of s) { const k = key(p); (adj.get(k) ?? adj.set(k, { p, segs: [] }).get(k)!).segs.push(i); } });
  const used = new Set<number>();
  const loops: P2[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    const loop: P2[] = [segs[i][0]];
    let cur = segs[i][1], curSeg = i, closed = false;
    used.add(i);
    for (let guard = 0; guard < segs.length; guard++) {
      if (key(cur) === key(loop[0])) { closed = true; break; }
      loop.push(cur);
      const node = adj.get(key(cur));
      const next = node?.segs.find((s) => s !== curSeg && !used.has(s));
      if (next == null) break;
      used.add(next);
      const s = segs[next];
      cur = key(s[0]) === key(cur) ? s[1] : s[0];
      curSeg = next;
    }
    if (!closed) return null; // an open chain means the mesh or the cut is degenerate here
    const simp = simplify(loop, 0.03);
    if (simp.length >= 3 && Math.abs(polyArea(simp)) > 0.05) loops.push(simp);
  }
  if (!loops.length) return null;
  let area = 0;
  for (const l of loops) area += Math.abs(polyArea(l));
  const corners = loops.reduce((s, l) => s + l.filter((_, i) => angleAt(l, i) > 0.4).length, 0);
  if (area < 0.25) return null; // slivers are unreadable
  const xs = loops.flat().map((p) => p[0]), ys = loops.flat().map((p) => p[1]);
  const aspect = (Math.max(...xs) - Math.min(...xs)) / Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  return { loops, area, corners, aspect, svg: '' };
}

const polyArea = (l: P2[]) => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);
function angleAt(l: P2[], i: number) {
  const p = l[(i - 1 + l.length) % l.length], q = l[i], r = l[(i + 1) % l.length];
  const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}
/** Douglas–Peucker on a closed loop. */
function simplify(loop: P2[], eps: number): P2[] {
  const dp = (pts: P2[]): P2[] => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let best = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distToSeg(pts[i], a, b);
      if (d > best) { best = d; idx = i; }
    }
    if (best <= eps) return [a, b];
    return [...dp(pts.slice(0, idx + 1)).slice(0, -1), ...dp(pts.slice(idx))];
  };
  // Split at the farthest point from loop[0] so the closed curve becomes two open runs.
  let far = 0, fd = 0;
  loop.forEach((p, i) => { const d = Math.hypot(p[0] - loop[0][0], p[1] - loop[0][1]); if (d > fd) { fd = d; far = i; } });
  const r1 = dp(loop.slice(0, far + 1)), r2 = dp([...loop.slice(far), loop[0]]);
  return [...r1.slice(0, -1), ...r2.slice(0, -1)];
}
function distToSeg(p: P2, a: P2, b: P2) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const similar = (a: Section, b: Section) =>
  a.loops.length === b.loops.length &&
  (a.corners <= 2 ? b.corners <= 2 : a.corners === b.corners) &&
  Math.abs(a.area - b.area) / Math.max(a.area, b.area) < 0.3 &&
  Math.abs(Math.log(a.aspect / b.aspect)) < 0.2;

function svgOf(s: Section, scale: number) {
  const paths = s.loops.map((l) => 'M' + l.map((p) => `${(50 + p[0] * scale).toFixed(1)},${(50 - p[1] * scale).toFixed(1)}`).join('L') + 'Z').join(' ');
  return `<svg viewBox="0 0 100 100"><path d="${paths}" fill="#6b8fd6" fill-opacity="0.35" stroke="#9fb8ff" stroke-width="2" fill-rule="evenodd"/></svg>`;
}

let SOLIDS_CACHE: Solid[] | null = null;
const SOLIDS_ALL = () => (SOLIDS_CACHE ??= solids());

export interface SliceCase { solid: Solid; cut: Cut; answer: Section; options: { id: string; s: Section }[]; correctId: string }

/** A solid, a cut, its true section and three visibly different distractors (other cuts of this solid first, then other solids). */
export function pickCase(level: number, rng: () => number): SliceCase | null {
  const t = tiers(level);
  const want = level >= 8 ? 5 : 3; // distractors: five options from level 8
  for (let tries = 0; tries < 200; tries++) {
    const SOLIDS = SOLIDS_ALL();
    const solid = pick(SOLIDS.filter((x) => x.tier <= t.solid), rng);
    const cut = pick(CUTS.filter((x) => x.tier <= t.cut), rng);
    const answer = section(solid.geo, cut);
    if (!answer) continue;
    const pool: Section[] = [];
    for (const c of CUTS) if (c !== cut) { const s = section(solid.geo, c); if (s) pool.push(s); }
    for (const o of SOLIDS) if (o !== solid) { const s = section(o.geo, cut); if (s) pool.push(s); }
    const chosen: Section[] = [];
    for (const s of shuffle(pool, rng)) {
      if (similar(s, answer) || chosen.some((c) => similar(c, s))) continue;
      chosen.push(s);
      if (chosen.length === want) break;
    }
    if (chosen.length < want) continue;
    const all = shuffle([answer, ...chosen].map((s, i) => ({ id: String(i), s })), rng);
    return { solid, cut, answer, options: all, correctId: all.find((o) => o.s === answer)!.id };
  }
  return null;
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -1.8 });
  const run = new Run({ id: 'cut', name: 'Cut', icon: '🔪', dailyRounds: 8 }, hudEl, stageEl);
  const world = new THREE.Group();
  stage.scene.add(world);
  const choiceBox = h('div');
  panelEl.append(choiceBox);
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Cut ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', {}, commitB));
  const P = panel(panelEl);
  let C: ReturnType<typeof choices<string>> | null = null;
  let current: SliceCase | null = null;
  const solidMat = () => new THREE.MeshStandardMaterial({ color: 0x6b8fd6, roughness: 0.55, metalness: 0.05 });
  const frame = () => stage.place(35, 22, stage.fit(2.9), [0, -0.1, 0]);
  stage.onResize = frame;

  function newCase() {
    const rng = mulberry32(run.nextSeed());
    const next = pickCase(run.level, rng);
    if (!next) { P.message('No cut could be generated — try the next round.', 'bad'); if (!current) { run.miss(); newCase(); return; } }
    else current = next;
    if (!current) return;
    const { solid, cut, options } = current;
    world.clear();
    const mesh = new THREE.Mesh(solid.geo, solidMat());
    mesh.castShadow = mesh.receiveShadow = true;
    world.add(mesh);
    // The blade: a translucent square in the cutting plane.
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cut.n);
    blade.position.copy(cut.n).multiplyScalar(cut.d);
    blade.add(new THREE.LineSegments(new THREE.EdgesGeometry(blade.geometry), new THREE.LineBasicMaterial({ color: 0xf5a524 })));
    world.add(blade);
    frame();

    const scale = 95 / Math.max(...options.map((o) => Math.max(...o.s.loops.flat().map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))))) ) / 2;
    choiceBox.replaceChildren();
    C = choices(choiceBox, options.map((o) => { const d = h('div'); d.innerHTML = svgOf(o.s, scale); return { id: o.id, label: d }; }));
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `A ${solid.name}, cut ${cut.label}. Which outline does the blade leave?`;
    log.push('present', { sketch: 'slice', mode: run.mode, level: run.level, solid: solid.name, cut: cut.label });
  }

  async function commit() {
    if (!C?.picked || !current) { C?.el.classList.add('shake'); setTimeout(() => C?.el.classList.remove('shake'), 300); return; }
    const cur = current;
    const said = C.picked;
    const ok = said === cur.correctId;
    C.enabled = false;
    commitB.disabled = true;
    log.push('result', { sketch: 'slice', ok });

    // The cut: two clipped copies, the upper half lifts away, both show the section face.
    const { solid, answer } = current;
    const cut = { ...cur.cut, d: cur.cut.d + 0.0137 };
    const mesh = world.children[0] as THREE.Mesh;
    const upper = new THREE.Mesh(solid.geo, solidMat()), lower = new THREE.Mesh(solid.geo, solidMat());
    upper.material.clippingPlanes = [new THREE.Plane(cut.n.clone(), -cut.d)];
    lower.material.clippingPlanes = [new THREE.Plane(cut.n.clone().negate(), cut.d)];
    upper.castShadow = lower.castShadow = true;
    const { u, v } = basis(cut.n);
    const cap = () => {
      const shapes = answer.loops.map((l) => new THREE.Shape(l.map((p) => new THREE.Vector2(p[0], p[1]))));
      const g = new THREE.ShapeGeometry(shapes);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf5a524, side: THREE.DoubleSide }));
      const basisM = new THREE.Matrix4().makeBasis(u, v, cut.n);
      m.quaternion.setFromRotationMatrix(basisM);
      m.position.copy(cut.n).multiplyScalar(cut.d);
      return m;
    };
    const capU = cap(), capL = cap();
    capL.position.addScaledVector(cut.n, -0.002);
    capU.position.addScaledVector(cut.n, 0.002);
    const upperG = new THREE.Group();
    upperG.add(upper, capU);
    mesh.visible = false;
    world.add(lower, capL, upperG);
    // Blade sweep, then lift.
    const blade = world.children[1];
    const b0 = blade.position.clone();
    blade.position.addScaledVector(cut.n, 2.5);
    await stage.tween(500, (t) => blade.position.copy(b0).addScaledVector(cut.n, 2.5 * (1 - easeInOut(t))));
    await sleep(120);
    await stage.tween(700, (t) => {
      const k = easeOut(t) * 0.9;
      upperG.position.copy(cut.n).multiplyScalar(k);
      upper.material.clippingPlanes![0].constant = -cut.d + k;
    });
    C.mark(cur.correctId, 'right');
    if (!ok) C.mark(said, 'wrong');
    ok ? run.hit() : run.miss();
    P.message(ok ? 'That is the cut.' : 'The blade disagrees — the orange face is the real cross-section.', ok ? 'ok' : 'bad');
    if (run.over) run.showOver(newCase);
    else P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
  }

  run.begin(newCase);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (/^[1-4]$/.test(e.key) && C?.enabled) (C.el.children[Number(e.key) - 1] as HTMLElement | undefined)?.click();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const slice: SketchDef = {
  id: 'cut', title: 'Cut', status: 'playable', skill: 'cross-section prediction', icon: '🔪',
  tagline: 'A solid and a blade. Call the cross-section, then watch it cut.',
  about: 'Predicting a cross-section means holding the solid and the plane together in your head. The four outlines are all real cross-sections (of this solid or of the same cut on another), filtered to look different, and the plane is nudged off the lattice so no cut passes through a vertex.',
  controls: 'Tap an outline, then Cut. Enter commits; Enter again for the next.',
  mount,
};
