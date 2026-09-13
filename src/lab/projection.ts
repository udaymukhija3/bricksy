// Projection Detective: three silhouettes of a hidden object; build what casts them.
// You see your build in 3D but never its silhouettes until you commit — that is the skill.
import * as THREE from 'three';
import { randomPolycube, extents, type Cell } from '../polycube';
import { SketchStage, cubeGroup, layerBuilder, gridPicker, panel, hud, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, cellKey, sleep } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';

type Dims = { w: number; h: number; d: number };
type View = 'top' | 'front' | 'right';

/** 2D keys "col,row" for each view, using the grid layouts described in the UI. */
function project(cells: Cell[], dims: Dims): Record<View, Set<string>> {
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

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -0.5 });
  const H = hud(hudEl, ['solved', 'attempts']);
  let dims: Dims = { w: 3, h: 3, d: 3 }, n = 5, solved = 0, attempts = 0, caseAttempts = 0;
  let hidden: Cell[] = makeCase(dims, n, mulberry32(Date.now()));
  let target = project(hidden, dims);
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
    const out = {} as Record<View, ReturnType<typeof gridPicker>>;
    for (const [v, w, hgt, label] of spec) {
      const g = gridPicker(container, w, hgt, { readonly: true, label });
      g.set(sets[v]);
      if (marks) for (const k of marks[v]) g.mark(k, sets[v].has(k) ? 'extra' : 'miss');
      out[v] = g;
    }
    return out;
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
    hidden = makeCase(dims, n, mulberry32(Date.now()));
    target = project(hidden, dims);
    caseAttempts = 0;
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
    H.set('solved', solved); H.set('attempts', attempts);
    log.push('present', { sketch: 'projection', dims, n, hidden });
  }

  async function commit() {
    const cells = LB.cells;
    if (cells.length !== n) { P.message(`Place exactly ${n} cubes (you have ${cells.length}).`, 'bad'); return; }
    attempts++; caseAttempts++;
    const mine = project(cells, dims);
    const diff = {} as Record<View, Set<string>>;
    let bad = 0;
    for (const v of ['top', 'front', 'right'] as View[]) {
      diff[v] = new Set([...mine[v]].filter((k) => !target[v].has(k)).concat([...target[v]].filter((k) => !mine[v].has(k))));
      bad += diff[v].size;
    }
    const ok = bad === 0;
    log.push('result', { sketch: 'projection', attempt: caseAttempts, ok, cells, badCells: bad });
    grids(resultViews, mine, diff);
    resultBox.hidden = false;
    if (build) void pulseMats(stage.ticker, [build.mats.base, build.mats.marker], ok ? COLOR_OK : COLOR_BAD);
    if (ok) {
      solved++;
      commitB.disabled = clearB.disabled = true;
      LB.enabled = false;
      const same = cells.length === hidden.length && cells.every((c) => hidden.some((d) => cellKey(c) === cellKey(d)));
      if (!same) {
        // Consistent with every view but not the object that cast them: show it.
        await sleep(400);
        const ghost = cubeGroup(hidden, { ghost: true, color: 0xf5a524 });
        world.add(ghost.group);
      }
      P.message(same ? 'Exactly the hidden object.' : 'Your build casts all three silhouettes — a valid answer. The actual hidden object is shown in orange; the views could not tell them apart.', 'ok');
      if (caseAttempts === 1) { if (n < 8) n++; else if (dims.w < 4) { dims = { w: 4, h: 3, d: 4 }; n = 6; } }
      H.set('solved', solved); H.set('attempts', attempts);
      P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
    } else {
      P.message(`${bad} cell${bad > 1 ? 's' : ''} disagree across the three views — outlined red are missing, solid red are extra. Fix and commit again.`, 'bad');
      H.set('attempts', attempts);
    }
  }

  newCase();
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const projection: SketchDef = {
  id: 'projection', title: 'Projection Detective', status: 'playable', skill: '2D → 3D reconstruction',
  tagline: 'Top, front and side silhouettes of a hidden object. Build what casts them — you see your build in 3D, but its silhouettes stay hidden until you commit.',
  mount,
};
