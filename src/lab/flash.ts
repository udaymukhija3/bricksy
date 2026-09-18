// Flash: see a shape for a few seconds, then rebuild it from memory.
import * as THREE from 'three';
import { randomPolycube, extents, normalize, shapeKey, type Cell } from '../polycube.ts';
import { SketchStage, cubeGroup, layerBuilder, panel, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, cellKey, sleep } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

type Dims = { w: number; h: number; d: number };

export function makeCase(dims: Dims, n: number, rng: () => number) {
  for (let tries = 0; tries < 500; tries++) {
    const cells = randomPolycube(n, rng);
    const [ex, ey, ez] = extents(cells);
    if (ex >= dims.w || ey >= dims.h || ez >= dims.d) continue;
    return cells;
  }
  throw new Error('no case');
}

/** Difficulty by level: more cubes, then less time, then the view turns before you build. */
export const setup = (level: number) => {
  const table = [[4, 3000, 0], [5, 3000, 0], [5, 2500, 0], [6, 2500, 0], [6, 2000, 0], [6, 2000, 1], [7, 2000, 1], [7, 1500, 1], [8, 1500, 1], [8, 1200, 1]];
  const [n, showMs, turn] = table[Math.min(level, table.length - 1)];
  return { n, showMs, turnView: turn === 1 };
};

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -0.5 });
  const run = new Run({ id: 'flash', name: 'Flash', icon: '⚡', dailyRounds: 8 }, hudEl, stageEl);
  const dims: Dims = { w: 3, h: 3, d: 3 };
  let n = 4, showMs = 3000, turnView = false;
  let original: Cell[] = [];
  let gen = 0; // bumps when a new case starts so a stale show-phase can bail out
  const world = new THREE.Group();
  stage.scene.add(world);
  const overlay = h('div.overlay-text');
  stageEl.append(overlay);
  const builderBox = h('div');
  panelEl.append(builderBox);
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Commit ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', {}, commitB));
  const P = panel(panelEl);
  let LB!: ReturnType<typeof layerBuilder>;
  let build: ReturnType<typeof cubeGroup> | null = null;
  let showing = false;

  const centre: [number, number, number] = [(dims.w - 1) / 2, (dims.h - 1) / 2 - 0.3, (dims.d - 1) / 2];
  let azimuth = 35;
  const frame = () => stage.place(azimuth, 26, stage.fit(Math.hypot(dims.w, dims.h, dims.d) / 2 + 0.6), centre);
  stage.onResize = frame;
  const box = () => {
    const b = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(dims.w, dims.h, dims.d)), new THREE.LineBasicMaterial({ color: 0x3a4052 }));
    b.position.set((dims.w - 1) / 2, (dims.h - 1) / 2, (dims.d - 1) / 2);
    return b;
  };

  function refresh() {
    if (showing) return;
    world.clear();
    world.add(box());
    const cells = LB.cells;
    build = cells.length ? cubeGroup(cells) : null;
    if (build) world.add(build.group);
  }

  async function newCase() {
    const my = ++gen;
    ({ n, showMs, turnView } = setup(run.level));
    original = makeCase(dims, n, mulberry32(run.nextSeed()));
    builderBox.replaceChildren();
    LB = layerBuilder(builderBox, dims, { onChange: refresh });
    LB.enabled = false;
    commitB.disabled = true;
    P.message('');
    P.clearPost();
    hintEl.textContent = `${n} cubes, ${showMs / 1000}s to look${turnView ? ', then the view turns 90° before you build' : ''}.`;
    log.push('present', { sketch: 'flash', mode: run.mode, level: run.level, original, showMs, turnView });

    // Show phase.
    showing = true;
    world.clear();
    world.add(box());
    world.add(cubeGroup(original).group);
    azimuth = 35;
    frame();
    for (let ms = showMs; ms > 0; ms -= 100) {
      overlay.textContent = (ms / 1000).toFixed(1);
      await sleep(100);
      if (gen !== my) return;
    }
    overlay.textContent = '';
    showing = false;
    if (turnView) { azimuth = 125; frame(); }
    refresh();
    LB.enabled = true;
    commitB.disabled = false;
    P.message('Rebuild it.');
  }

  function commit() {
    const cells = LB.cells;
    if (!cells.length) { P.message('Place some cubes first.', 'bad'); return; }
    commitB.disabled = true;
    LB.enabled = false;
    // Compare up to translation: the same shape anywhere in the box counts.
    const same = shapeKey(cells) === shapeKey(original);
    const a = new Set(normalize(cells).map(cellKey)), b = new Set(normalize(original).map(cellKey));
    const missing = [...b].filter((k) => !a.has(k)).length, extra = [...a].filter((k) => !b.has(k)).length;
    log.push('result', { sketch: 'flash', ok: same, missing, extra, cells });
    // Reveal: the original as an orange ghost over your build, aligned by bounding box.
    const oMin = [0, 1, 2].map((i) => Math.min(...original.map((c) => c[i])));
    const bMin = [0, 1, 2].map((i) => Math.min(...cells.map((c) => c[i])));
    const ghost = cubeGroup(original, { ghost: true, color: 0xf5a524 });
    ghost.group.position.set(bMin[0] - oMin[0], bMin[1] - oMin[1], bMin[2] - oMin[2]);
    world.add(ghost.group);
    // Your cubes that are not in the original (after aligning bounding boxes) turn red; the rest stay.
    if (build) {
      const orig = new Set(original.map((c) => cellKey([c[0] - oMin[0] + bMin[0], c[1] - oMin[1] + bMin[1], c[2] - oMin[2] + bMin[2]])));
      for (const cube of build.cubes) if (!orig.has(cellKey(cube.userData.cell as Cell))) cube.material = new THREE.MeshStandardMaterial({ color: COLOR_BAD, roughness: 0.6 });
      void pulseMats(stage.ticker, [build.mats.base], same ? COLOR_OK : COLOR_BAD);
    }
    same ? run.hit() : run.miss();
    P.message(same ? 'Exact.' : `${missing} missing, ${extra} extra (red). The original is the orange ghost.`, same ? 'ok' : 'bad');
    if (run.over) run.showOver(() => void newCase());
    else P.post([{ label: 'Next ↵', primary: true, onClick: () => void newCase() }]);
  }

  run.begin(() => void newCase());
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { gen++; window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const flash: SketchDef = {
  id: 'flash', title: 'Flash', status: 'playable', skill: 'spatial memory', icon: '⚡',
  tagline: 'See a shape for three seconds. It vanishes. Rebuild it. Later, the view turns before you build, so memory has to survive a rotation.',
  about: 'Spatial memory: hold a 3D shape after it is gone, and later hold it through a 90° change of viewpoint. Difficulty is cubes first, then look time, then the turned view.',
  controls: 'Look, then toggle cells layer by layer and Commit (Enter).',
  mount,
};
