// Shadows: three silhouettes of a hidden object; build what casts them.
// You see your build in 3D but never its silhouettes until you commit — that is the skill.
import * as THREE from 'three';
import { randomPolycube, extents, type Cell } from '../polycube';
import { SketchStage, cubeGroup, layerBuilder, gridPicker, panel, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, cellKey, sleep } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';
import { Run } from '../run';

type Dims = { w: number; h: number; d: number };
type View = 'top' | 'front' | 'right';

/** 2D keys "col,row" for each view, using the grid layouts described in the UI. */
export function project(cells: Cell[], dims: Dims): Record<View, Set<string>> {
  const top = new Set<string>(), front = new Set<string>(), right = new Set<string>();
  for (const [x, y, z] of cells) {
    top.add(`${x},${z}`);
    front.add(`${x},${dims.h - 1 - y}`);
    right.add(`${dims.d - 1 - z},${dims.h - 1 - y}`);
  }
  return { top, front, right };
}

function makeCase(dims: Dims, n: number, rng: () => number) {
  for (let tries = 0; tries < 500; tries++) {
    const cells = randomPolycube(n, rng);
    const [ex, ey, ez] = extents(cells);
    if (ex >= dims.w || ey >= dims.h || ez >= dims.d) continue;
    // Skip shapes that are just a flat sheet: no depth to reconstruct.
    if (ex === 0 || ey === 0 || ez === 0) continue;
    return cells;
  }
  throw new Error('no case');
}

/** Difficulty by level: more cubes in a 3³ box, then a wider box. */
const setup = (level: number): { dims: Dims; n: number } =>
  level < 6 ? { dims: { w: 3, h: 3, d: 3 }, n: Math.min(8, 5 + Math.floor((level + 1) / 2)) } : { dims: { w: 4, h: 3, d: 4 }, n: Math.min(10, 7 + Math.floor((level - 6) / 2)) };

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -0.5 });
  const run = new Run({ id: 'shadows', name: 'Shadows', icon: '🔦', dailyRounds: 6 }, hudEl, stageEl);
  let dims: Dims = { w: 3, h: 3, d: 3 }, n = 5;
  let hidden: Cell[] = [];
  let target = project([], dims);
  const world = new THREE.Group();
  stage.scene.add(world);
  let build: ReturnType<typeof cubeGroup> | null = null;

  // Panel: target views (left) · your build (layers, right) · results appear after commit.
  const views = h('div.rows');
  const targetBox = h('div', {}, h('div.layer-label', {}, 'the hidden object casts these'), views);
  const resultViews = h('div.rows');
  const resultBox = h('div', { hidden: true }, h('div.layer-label', {}, 'your build casts these'), resultViews);
  const builderBox = h('div');
  panelEl.append(h('div.rows', {}, targetBox, resultBox), builderBox);
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Commit ↵') as HTMLButtonElement;
  const clearB = h('button', { onclick: () => { LB.set([]); refresh(); } }, 'Clear') as HTMLButtonElement;
  panelEl.append(h('div#actions', {}, clearB, commitB));
  const P = panel(panelEl);
  let LB!: ReturnType<typeof layerBuilder>;

  function grids(container: HTMLElement, sets: Record<View, Set<string>>, marks?: Record<View, Set<string>>) {
    container.replaceChildren();
    const spec: [View, number, number, string][] = [['top', dims.w, dims.d, 'top (x →, far ↑)'], ['front', dims.w, dims.h, 'front (x →, y ↑)'], ['right', dims.d, dims.h, 'right side (depth ←, y ↑)']];
    for (const [v, w, hgt, label] of spec) {
      const g = gridPicker(container, w, hgt, { readonly: true, label });
      g.set(sets[v]);
      if (marks) for (const k of marks[v]) g.mark(k, sets[v].has(k) ? 'extra' : 'miss');
    }
  }

  function refresh() {
    world.clear();
    const cells = LB.cells;
    // Box outline so position inside the volume is legible.
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(dims.w, dims.h, dims.d)), new THREE.LineBasicMaterial({ color: 0x3a4052 }));
    box.position.set((dims.w - 1) / 2, (dims.h - 1) / 2, (dims.d - 1) / 2);
    world.add(box);
    if (cells.length) {
      build = cubeGroup(cells);
      world.add(build.group);
    } else build = null;
    hintEl.textContent = `${n} cubes in a ${dims.w}×${dims.h}×${dims.d} box. Placed: ${cells.length}/${n}.`;
  }

  const frame = () => stage.place(35, 28, stage.fit(Math.hypot(dims.w, dims.h, dims.d) / 2 + 0.6), [(dims.w - 1) / 2, (dims.h - 1) / 2 - 0.3, (dims.d - 1) / 2]);
  stage.onResize = frame;

  function newCase() {
    ({ dims, n } = setup(run.level));
    hidden = makeCase(dims, n, mulberry32(run.nextSeed()));
    target = project(hidden, dims);
    builderBox.replaceChildren();
    LB = layerBuilder(builderBox, dims, { onChange: refresh, max: n });
    grids(views, target);
    resultBox.hidden = true;
    refresh();
    frame();
    commitB.disabled = clearB.disabled = false;
    LB.enabled = true;
    P.message('');
    P.clearPost();
    log.push('present', { sketch: 'shadows', mode: run.mode, level: run.level, dims, n, hidden });
  }

  async function commit() {
    const cells = LB.cells;
    if (cells.length !== n) { P.message(`Place exactly ${n} cubes (you have ${cells.length}).`, 'bad'); return; }
    commitB.disabled = clearB.disabled = true;
    LB.enabled = false;
    const mine = project(cells, dims);
    const diff = {} as Record<View, Set<string>>;
    let bad = 0;
    for (const v of ['top', 'front', 'right'] as View[]) {
      diff[v] = new Set([...mine[v]].filter((k) => !target[v].has(k)).concat([...target[v]].filter((k) => !mine[v].has(k))));
      bad += diff[v].size;
    }
    const ok = bad === 0;
    log.push('result', { sketch: 'shadows', ok, cells, badCells: bad });
    grids(resultViews, mine, diff);
    resultBox.hidden = false;
    if (build) void pulseMats(stage.ticker, [build.mats.base, build.mats.marker], ok ? COLOR_OK : COLOR_BAD);
    const same = cells.length === hidden.length && cells.every((c) => hidden.some((d) => cellKey(c) === cellKey(d)));
    if (!same) {
      // Show the object that actually cast the silhouettes, as an orange ghost.
      await sleep(400);
      world.add(cubeGroup(hidden, { ghost: true, color: 0xf5a524 }).group);
    }
    ok ? run.hit() : run.miss();
    P.message(ok
      ? (same ? 'Exactly the hidden object.' : 'Your build casts all three silhouettes — a valid answer. The actual object is the orange ghost; the views could not tell them apart.')
      : `${bad} cell${bad > 1 ? 's' : ''} disagree across the views — outlined red are missing, solid red are extra. The hidden object is the orange ghost.`, ok ? 'ok' : 'bad');
    if (run.over) run.showOver(newCase);
    else P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
  }

  run.begin(newCase);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const shadows: SketchDef = {
  id: 'shadows', title: 'Shadows', status: 'playable', skill: '2D → 3D reconstruction', icon: '🔦',
  tagline: 'Top, front and side silhouettes of a hidden object. Build what casts them — you see your build in 3D, but its silhouettes stay hidden until you commit.',
  about: 'Three silhouettes fix an object only partly; rebuilding one that casts them is 2D→3D reconstruction. You never see your own build\'s silhouettes until you commit — with them visible this would collapse into pure cell logic (Picross 3D) — and the cube count is fixed so the biggest-possible-object trick fails.',
  controls: 'Toggle cells layer by layer (bottom layer first), then Commit (Enter).',
  mount,
};
