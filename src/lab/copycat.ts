// Copycat: see a shape for a few seconds, then rebuild it from memory.
import * as THREE from 'three';
import { randomPolycube, extents, normalize, shapeKey, type Cell } from '../polycube';
import { SketchStage, cubeGroup, layerBuilder, panel, hud, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, cellKey, sleep } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';

type Dims = { w: number; h: number; d: number };

function makeCase(dims: Dims, n: number, rng: () => number) {
  for (let tries = 0; tries < 500; tries++) {
    const cells = randomPolycube(n, rng);
    const [ex, ey, ez] = extents(cells);
    if (ex >= dims.w || ey >= dims.h || ez >= dims.d) continue;
    return cells;
  }
  throw new Error('no case');
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -0.5 });
  const H = hud(hudEl, ['exact', 'seen']);
  const dims: Dims = { w: 3, h: 3, d: 3 };
  let n = 4, showMs = 3000, turnView = false, exact = 0, seen = 0;
  let original: Cell[] = [];
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
    original = makeCase(dims, n, mulberry32(Date.now()));
    builderBox.replaceChildren();
    LB = layerBuilder(builderBox, dims, { onChange: refresh });
    LB.enabled = false;
    commitB.disabled = true;
    P.message('');
    P.clearPost();
    hintEl.textContent = `${n} cubes, ${showMs / 1000}s to look${turnView ? ', then the view turns 90° before you build' : ''}.`;
    H.set('exact', exact); H.set('seen', seen);
    log.push('present', { sketch: 'copycat', original, showMs, turnView });

    // Show phase.
    showing = true;
    world.clear();
    world.add(box());
    const shown = cubeGroup(original);
    world.add(shown.group);
    azimuth = 35;
    frame();
    for (let s = showMs / 1000; s > 0; s--) { overlay.textContent = String(s); await sleep(1000); }
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
    seen++;
    // Compare up to translation: the same shape anywhere in the box counts.
    const same = shapeKey(cells) === shapeKey(original);
    const a = new Set(normalize(cells).map(cellKey)), b = new Set(normalize(original).map(cellKey));
    const missing = [...b].filter((k) => !a.has(k)).length, extra = [...a].filter((k) => !b.has(k)).length;
    if (same) exact++;
    log.push('result', { sketch: 'copycat', ok: same, missing, extra, cells });
    // Reveal: the original as an orange ghost over your build, aligned by bounding box.
    const oMin = [0, 1, 2].map((i) => Math.min(...original.map((c) => c[i])));
    const bMin = [0, 1, 2].map((i) => Math.min(...cells.map((c) => c[i])));
    const ghost = cubeGroup(original, { ghost: true, color: 0xf5a524 });
    ghost.group.position.set(bMin[0] - oMin[0], bMin[1] - oMin[1], bMin[2] - oMin[2]);
    world.add(ghost.group);
    if (build) void pulseMats(stage.ticker, [build.mats.base], same ? COLOR_OK : COLOR_BAD);
    P.message(same ? 'Exact.' : `${missing} missing, ${extra} extra. The original is the orange ghost.`, same ? 'ok' : 'bad');
    if (same && exact % 3 === 0) { if (n < 7) n++; else if (showMs > 1500) showMs -= 500; else turnView = true; }
    H.set('exact', exact); H.set('seen', seen);
    P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
  }

  void newCase();
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const copycat: SketchDef = {
  id: 'copycat', title: 'Copycat', status: 'playable', skill: 'spatial memory',
  tagline: 'See a shape for three seconds. It vanishes. Rebuild it. Later, the view turns before you build, so memory has to survive a rotation.',
  mount,
};
