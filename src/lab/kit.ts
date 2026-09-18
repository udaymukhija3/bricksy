// Shared kit for lab sketches: a single-view stage, voxel helpers, and small
// predict-commit UI widgets. Every sketch is a few hundred lines on top of this.
import * as THREE from 'three';
import { MOVES, moveLabel, type Axis, type Cell, type Move } from '../polycube';
import {
  AXIS_COLOR, AXIS_VEC, COLOR_BG, Ticker, addLights, cubeGeo, edgeGeo, edgeMat, easeInOut, fitDistance, highlightGizmo,
  makeCubeMaterials, makeGizmo, placeCamera, renderGizmo, type Gizmo,
} from '../render-common';

export * from '../render-common';
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const cssColor = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const cellKey = (c: Cell) => c.join(',');

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(arr: readonly T[], rng: () => number) => arr[Math.floor(rng() * arr.length)];

/** Tiny element helper: h('div.cls#id', {attrs}, ...children). */
export function h(spec: string, attrs: Record<string, unknown> = {}, ...children: (Node | string | null | undefined)[]) {
  const [tag, ...rest] = spec.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) r[0] === '.' ? el.classList.add(r.slice(1)) : (el.id = r.slice(1));
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}

export function toast(text: string) {
  const d = h('div.toast', {}, text);
  document.body.append(d);
  setTimeout(() => d.remove(), 2600);
}

// ---------------------------------------------------------------- stage

export interface StageOpts { gizmo?: boolean; ground?: number | null; fov?: number; shadows?: boolean }

export class SketchStage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  ticker = new Ticker();
  gizmo: Gizmo | null;
  lookAt = new THREE.Vector3();
  onFrame: ((now: number) => void) | null = null;
  /** Called after the canvas changes size (orientation change, split view) so a sketch can reframe. */
  onResize: (() => void) | null = null;
  canvas: HTMLCanvasElement;
  private w = 1;
  private h = 1;
  private ro: ResizeObserver;

  constructor(private container: HTMLElement, opts: StageOpts = {}) {
    this.canvas = document.createElement('canvas');
    container.append(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = opts.shadows ?? true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.autoClear = false;
    this.scene.background = new THREE.Color(COLOR_BG);
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 32, 1, 0.1, 300);
    this.sun = addLights(this.scene);
    if (opts.ground !== null) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.3 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = opts.ground ?? -0.5;
      ground.receiveShadow = true;
      this.scene.add(ground);
    }
    this.gizmo = opts.gizmo ? makeGizmo() : null;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    if (import.meta.env.DEV) (window as unknown as { stage: SketchStage }).stage = this; // dev: poke the live scene from the console
  }

  place(azimuth: number, elevation: number, distance: number, target: THREE.Vector3 | [number, number, number]) {
    if (Array.isArray(target)) this.lookAt.set(target[0], target[1], target[2]);
    else this.lookAt.copy(target);
    placeCamera(this.camera, this.sun, azimuth, elevation, distance, this.lookAt);
  }

  tween(ms: number, fn: (t: number) => void) { return this.ticker.tween(ms, fn); }

  /** Distance that fits a sphere of radius r in this view — use instead of fixed camera distances. */
  fit(r: number, margin = 1.12) { return fitDistance(this.camera, r, margin); }

  get aspect() { return this.camera.aspect; }

  highlightAxis(axis: Axis | null, dir: 1 | -1 = 1) { if (this.gizmo) highlightGizmo(this.gizmo, axis, dir); }

  /** Pick objects under a pointer event. */
  pickAt(ev: MouseEvent, objects: THREE.Object3D[], recursive = false) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray.intersectObjects(objects, recursive);
  }

  /** Small camera jolt. */
  shake(ms = 260, amp = 0.12) {
    const base = this.camera.position.clone();
    return this.tween(ms, (t) => {
      const k = (1 - t) * amp;
      this.camera.position.set(base.x + Math.sin(t * 40) * k, base.y + Math.cos(t * 37) * k, base.z);
    }).then(() => { this.camera.position.copy(base); });
  }

  /** Slerp `group` by one world-axis quarter-turn about its own origin. */
  spin(group: THREE.Object3D, m: Move, ms = 460) {
    const q0 = group.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[m.axis], (m.dir * Math.PI) / 2).multiply(q0);
    return this.tween(ms, (t) => group.quaternion.slerpQuaternions(q0, q1, easeInOut(t)));
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize?.();
  }

  private frame() {
    const now = performance.now();
    this.ticker.update(now);
    this.onFrame?.(now);
    const r = this.renderer;
    r.setScissorTest(true);
    r.setViewport(0, 0, this.w, this.h);
    r.setScissor(0, 0, this.w, this.h);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.gizmo) {
      const size = Math.min(150, Math.round(this.w * 0.26));
      renderGizmo(r, this.gizmo, this.camera, this.lookAt, this.w - size - 6, 6, size);
    }
    r.setScissorTest(false);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

// ---------------------------------------------------------------- voxels

interface Face { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const neg = (v: THREE.Vector3) => v.clone().negate();
const FACES: Face[] = [
  { n: X, u: Y, v: Z }, { n: neg(X), u: Z, v: Y },
  { n: Y, u: Z, v: X }, { n: neg(Y), u: X, v: Z },
  { n: Z, u: X, v: Y }, { n: neg(Z), u: Y, v: X },
];

/** Only the faces between a solid cell and a non-solid one. */
export function voxelSurface(cells: Cell[]): THREE.BufferGeometry {
  const solid = new Set(cells.map(cellKey));
  const pos: number[] = [], nor: number[] = [];
  const c = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [x, y, z] of cells) {
    for (const f of FACES) {
      if (solid.has(cellKey([x + f.n.x, y + f.n.y, z + f.n.z]))) continue;
      c.set(x, y, z).addScaledVector(f.n, 0.5);
      const corner = (su: number, sv: number) => {
        p.copy(c).addScaledVector(f.u, su * 0.5).addScaledVector(f.v, sv * 0.5);
        pos.push(p.x, p.y, p.z);
        nor.push(f.n.x, f.n.y, f.n.z);
      };
      corner(-1, -1); corner(1, -1); corner(1, 1);
      corner(-1, -1); corner(1, 1); corner(-1, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** A solid made of cells as one skinned mesh with crease outlines. */
export function voxelMesh(cells: Cell[], opts: { color?: number; glass?: boolean; outline?: number } = {}) {
  const geo = voxelSurface(cells);
  const mat = opts.glass
    ? new THREE.MeshStandardMaterial({ color: opts.color ?? 0x8a97b3, transparent: true, opacity: 0.2, roughness: 0.35, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: opts.color ?? 0x8a97b3, roughness: 0.75 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = !opts.glass;
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: opts.outline ?? (opts.glass ? 0xb9c6e4 : 0x0b0d12), transparent: true, opacity: 0.55 }));
  const g = new THREE.Group();
  g.add(mesh, outline);
  return { group: g, mesh, mat };
}

export interface CubeGroupOpts { marker?: number; colors?: number[]; center?: boolean; ghost?: boolean; color?: number }

/** Individual unit cubes with edges. `center` puts the bounding-box centre at the group origin. */
export function cubeGroup(cells: Cell[], opts: CubeGroupOpts = {}) {
  const group = new THREE.Group();
  const mats = makeCubeMaterials();
  if (opts.color != null) mats.base.color.set(opts.color);
  const cubes: THREE.Mesh[] = [];
  const c0 = [0, 0, 0];
  if (opts.center) for (let i = 0; i < 3; i++) {
    const xs = cells.map((c) => c[i]);
    c0[i] = (Math.min(...xs) + Math.max(...xs)) / 2;
  }
  cells.forEach((c, i) => {
    let mat: THREE.Material = i === opts.marker ? mats.marker : mats.base;
    if (opts.colors) mat = new THREE.MeshStandardMaterial({ color: opts.colors[i % opts.colors.length], roughness: 0.6 });
    if (opts.ghost) mat = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x9ec2ff, transparent: true, opacity: 0.18, depthWrite: false });
    const mesh = new THREE.Mesh(cubeGeo, mat);
    mesh.position.set(c[0] - c0[0], c[1] - c0[1], c[2] - c0[2]);
    mesh.castShadow = mesh.receiveShadow = !opts.ghost;
    mesh.add(new THREE.LineSegments(edgeGeo, opts.ghost ? new THREE.LineBasicMaterial({ color: opts.color ?? 0x9ec2ff, transparent: true, opacity: 0.6 }) : edgeMat));
    mesh.userData.cell = c;
    mesh.userData.index = i;
    group.add(mesh);
    cubes.push(mesh);
  });
  return { group, cubes, mats, c0: new THREE.Vector3(c0[0], c0[1], c0[2]) };
}

export function pulseMats(ticker: Ticker, mats: THREE.MeshStandardMaterial[], color: number, ms = 900) {
  for (const m of mats) m.emissive.set(color);
  return ticker.tween(ms, (t) => { for (const m of mats) m.emissiveIntensity = 0.85 * (1 - t); });
}

// ---------------------------------------------------------------- ui widgets

/** Message line + a row of post-commit buttons. */
export function panel(container: HTMLElement) {
  const message = h('div#message');
  const post = h('div#post');
  container.append(message, post);
  return {
    message(text: string, tone: '' | 'ok' | 'bad' = '') { message.textContent = text; message.className = tone; },
    post(buttons: { label: string; primary?: boolean; onClick: () => void; key?: string }[]) {
      post.replaceChildren(...buttons.map((b) => h('button' + (b.primary ? '.primary' : ''), { onclick: b.onClick, title: b.key }, b.label)));
      post.hidden = !buttons.length;
      return buttons;
    },
    clearPost() { post.replaceChildren(); post.hidden = true; },
  };
}

/** The six turn buttons, a chip queue, undo/clear/commit. */
export function turnQueue(container: HTMLElement, opts: { commitLabel?: string; onHover?: (axis: Axis | null, dir: 1 | -1) => void; onCommit: (moves: Move[]) => void; max?: number; /** Commit with no turns queued is a valid answer ("no turns needed"). */ allowEmpty?: boolean }) {
  const queueEl = h('div#queue');
  const movesEl = h('div#moves');
  const undoB = h('button', { title: 'Backspace' }, '⌫ Undo') as HTMLButtonElement;
  const clearB = h('button', {}, 'Clear') as HTMLButtonElement;
  const commitB = h('button.primary', { title: 'Enter' }, opts.commitLabel ?? 'Commit ↵') as HTMLButtonElement;
  const actions = h('div#actions', {}, undoB, clearB, commitB);
  container.append(queueEl, movesEl, actions);
  let moves: Move[] = [];
  let enabled = true;
  const buttons = new Map<Move, HTMLButtonElement>();

  const render = (list: readonly Move[] = moves, cls = '', label = '') => {
    queueEl.replaceChildren();
    if (label) queueEl.append(h('span.label', {}, label));
    if (!list.length) { queueEl.append(h('span.placeholder', {}, 'no turns queued — nothing moves until you commit')); return; }
    list.forEach((m, i) => {
      const chip = h('span.chip' + (cls ? '.' + cls : ''), { style: { '--c': cssColor(AXIS_COLOR[m.axis]) } });
      chip.style.setProperty('--c', cssColor(AXIS_COLOR[m.axis]));
      chip.append(h('span.n', {}, String(i + 1)), h('span.dot'), moveLabel(m));
      queueEl.append(chip);
    });
  };
  const shakeQ = () => { queueEl.classList.remove('shake'); void queueEl.offsetWidth; queueEl.classList.add('shake'); };
  const add = (m: Move) => {
    if (!enabled) return;
    if (moves.length >= (opts.max ?? 6)) { shakeQ(); return; }
    moves.push(m);
    render();
    api.onChange?.(moves);
  };
  const undo = () => { if (enabled && moves.length) { moves.pop(); render(); api.onChange?.(moves); } };
  const clear = () => { if (enabled && moves.length) { moves = []; render(); api.onChange?.(moves); } };
  const commit = () => { if (!enabled) return; if (!moves.length && !opts.allowEmpty) { shakeQ(); return; } opts.onCommit([...moves]); };

  for (const m of MOVES) {
    const b = h('button.mv', {
      title: `Turn ${m.dir > 0 ? '+' : '−'}90° about ${m.axis.toUpperCase()}  (key: ${m.dir > 0 ? m.axis : '⇧' + m.axis})`,
      onclick: () => add(m),
      onpointerenter: () => opts.onHover?.(m.axis, m.dir),
      onpointerleave: () => opts.onHover?.(null, 1),
    }, h('span.ax', {}, m.axis.toUpperCase()), h('span.deg', {}, `${m.dir > 0 ? '+' : '−'}90°`)) as HTMLButtonElement;
    b.style.setProperty('--c', cssColor(AXIS_COLOR[m.axis]));
    movesEl.append(b);
    buttons.set(m, b);
  }
  undoB.onclick = undo;
  clearB.onclick = clear;
  commitB.onclick = commit;

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !enabled) return;
    const k = e.key.toLowerCase();
    if (k === 'x' || k === 'y' || k === 'z') add(MOVES.find((m) => m.axis === k && m.dir === (e.shiftKey ? -1 : 1))!);
    else if (k === 'backspace') undo();
    else if (k === 'enter') commit();
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const api = {
    onChange: null as ((moves: Move[]) => void) | null,
    get moves() { return moves; },
    set enabled(v: boolean) {
      enabled = v;
      for (const b of buttons.values()) b.disabled = !v;
      undoB.disabled = clearB.disabled = commitB.disabled = !v;
    },
    get enabled() { return enabled; },
    reset() { moves = []; render(); },
    render,
    dispose() { window.removeEventListener('keydown', onKey); },
  };
  render();
  return api;
}

/** Layer-by-layer voxel editor: one W×D grid per layer, bottom layer first. */
export function layerBuilder(container: HTMLElement, dims: { w: number; h: number; d: number }, opts: { onChange?: (cells: Cell[]) => void; max?: number } = {}) {
  const on = new Set<string>();
  const wrap = h('div.layers');
  const cellsEl = new Map<string, HTMLElement>();
  let enabled = true;
  for (let y = 0; y < dims.h; y++) {
    const grid = h('div.grid', { style: { gridTemplateColumns: `repeat(${dims.w}, 1fr)` } });
    for (let z = 0; z < dims.d; z++) for (let x = 0; x < dims.w; x++) {
      const k = cellKey([x, y, z]);
      const c = h('button.cell', {
        onclick: () => {
          if (!enabled) return;
          if (on.has(k)) on.delete(k);
          else if (opts.max && on.size >= opts.max) { toast(`Only ${opts.max} cubes`); return; }
          else on.add(k);
          paint();
          opts.onChange?.(api.cells);
        },
      });
      cellsEl.set(k, c);
      grid.append(c);
    }
    wrap.append(h('div.layer', {}, h('div.layer-label', {}, `layer ${y + 1}`), grid));
  }
  container.append(wrap);
  const paint = () => { for (const [k, el] of cellsEl) el.classList.toggle('on', on.has(k)); };
  const api = {
    get cells(): Cell[] { return [...on].map((k) => k.split(',').map(Number) as unknown as Cell); },
    set(cells: Cell[]) { on.clear(); for (const c of cells) on.add(cellKey(c)); paint(); },
    set enabled(v: boolean) { enabled = v; wrap.classList.toggle('disabled', !v); },
    get enabled() { return enabled; },
    el: wrap,
  };
  return api;
}

/** A W×H grid of toggleable squares (silhouettes, cross-sections). Row 0 is the top row. */
export function gridPicker(container: HTMLElement, w: number, hgt: number, opts: { onChange?: (on: Set<string>) => void; readonly?: boolean; label?: string } = {}) {
  const on = new Set<string>();
  const grid = h('div.grid' + (opts.readonly ? '.ro' : ''), { style: { gridTemplateColumns: `repeat(${w}, 1fr)` } });
  const cells = new Map<string, HTMLElement>();
  let enabled = !opts.readonly;
  for (let r = 0; r < hgt; r++) for (let c = 0; c < w; c++) {
    const k = `${c},${r}`;
    const el = h('button.cell', { onclick: () => { if (!enabled) return; on.has(k) ? on.delete(k) : on.add(k); paint(); opts.onChange?.(on); } });
    cells.set(k, el);
    grid.append(el);
  }
  const wrap = h('div.layer', {}, opts.label ? h('div.layer-label', {}, opts.label) : null, grid);
  container.append(wrap);
  const paint = () => { for (const [k, el] of cells) el.classList.toggle('on', on.has(k)); };
  return {
    on,
    set(keys: Iterable<string>) { on.clear(); for (const k of keys) on.add(k); paint(); },
    mark(k: string, cls: string) { cells.get(k)?.classList.add(cls); },
    clearMarks() { for (const el of cells.values()) el.classList.remove('miss', 'extra'); },
    set enabled(v: boolean) { enabled = v; wrap.classList.toggle('disabled', !v); },
    get enabled() { return enabled; },
    el: wrap,
  };
}

/** Mutually exclusive choice buttons. */
export function choices<T extends string>(container: HTMLElement, items: { id: T; label: string | Node }[], opts: { onPick?: (id: T) => void } = {}) {
  let picked: T | null = null;
  let enabled = true;
  const row = h('div.choices');
  const btns = new Map<T, HTMLElement>();
  for (const it of items) {
    const b = h('button.choice', { onclick: () => { if (!enabled) return; picked = it.id; paint(); opts.onPick?.(it.id); } }, it.label);
    btns.set(it.id, b);
    row.append(b);
  }
  container.append(row);
  const paint = () => { for (const [id, b] of btns) b.classList.toggle('picked', id === picked); };
  return {
    get picked() { return picked; },
    reset() { picked = null; paint(); for (const b of btns.values()) b.classList.remove('right', 'wrong'); },
    mark(id: T, cls: 'right' | 'wrong') { btns.get(id)?.classList.add(cls); },
    set enabled(v: boolean) { enabled = v; for (const b of btns.values()) (b as HTMLButtonElement).disabled = !v; },
    get enabled() { return enabled; },
    el: row,
  };
}

/** Simple HUD counters. */
export function hud(container: HTMLElement, names: string[]) {
  const vals = new Map<string, HTMLElement>();
  for (const n of names) {
    const b = h('b', {}, '0');
    vals.set(n, b);
    container.append(h('span.stat', {}, `${n} `, b));
  }
  return { set(name: string, v: string | number) { vals.get(name)!.textContent = String(v); } };
}
