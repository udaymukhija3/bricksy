// Mirror Trap: is the right shape a rotation of the left one, or its mirror image?
// After you commit, the left shape rotates to its best fit and slides onto the right one.
import * as THREE from 'three';
import { isPlanar, normalize, orientations, randomPolycube, shapeKey, type Cell, moveLabel } from '../polycube.ts';
import { SketchStage, cubeGroup, choices, panel, h, mulberry32, pick, sleep, pulseMats, easeInOut, COLOR_OK, COLOR_BAD, cellKey } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

const mirrorX = (cells: Cell[]) => normalize(cells.map(([x, y, z]) => [-x + 0, y, z] as Cell));

export function makeTrap(cubes: number, rng: () => number) {
  for (let tries = 0; tries < 400; tries++) {
    const a = randomPolycube(cubes, rng);
    if (isPlanar(a)) continue; // planar shapes can be flipped over: never chiral
    const os = orientations(a);
    if (os.length !== 24) continue;
    const keys = new Set(os.map((o) => o.key));
    const m = mirrorX(a);
    if (keys.has(shapeKey(m))) continue; // achiral: mirror is reachable by rotation
    const isMirror = rng() < 0.5;
    const src = isMirror ? m : a;
    const srcOs = orientations(src).filter((o) => o.dist > 0);
    const b = pick(srcOs, rng).cells;
    return { a, b, isMirror };
  }
  throw new Error('no trap');
}

/** Difficulty by level: five cubes, then six, seven, eight. */
export const cubesFor = (level: number) => Math.min(8, 5 + Math.floor(level / 4));

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { fov: 14, ground: -2.6 });
  const run = new Run({ id: 'mirror', name: 'Mirror', icon: '🪞', dailyRounds: 10 }, hudEl, stageEl);
  let trap = makeTrap(cubesFor(run.level), mulberry32(run.nextSeed()));
  let A!: ReturnType<typeof cubeGroup>, B!: ReturnType<typeof cubeGroup>;
  const world = new THREE.Group();
  stage.scene.add(world);
  const SEP = 3.6;
  const labelA = h('div.stage-label', { style: { left: '14px' } }, 'A');
  const labelB = h('div.stage-label', { style: { left: 'calc(50% + 14px)' } }, 'B');
  stageEl.append(labelA, labelB);

  /** Side by side when wide, A above B when narrow. Safe to call mid-reveal only before A starts sliding. */
  function layout() {
    const stacked = stage.aspect < 1.15;
    if (stacked) {
      A.group.position.set(0, 2.1, 0);
      B.group.position.set(0, -1.5, 0);
      Object.assign(labelB.style, { left: '14px', top: 'calc(50% + 4px)' });
      stage.place(28, 18, stage.fit(4.6), [0, 0.3, 0]);
    } else {
      A.group.position.set(-SEP, 0, 0);
      B.group.position.set(SEP, 0, 0);
      Object.assign(labelB.style, { left: 'calc(50% + 14px)', top: '10px' });
      stage.place(28, 20, stage.fit(5.2), [0, -0.2, 0]);
    }
  }

  const C = choices<'rot' | 'mir'>(panelEl, [{ id: 'rot', label: 'Same shape — B is a rotation of A' }, { id: 'mir', label: 'Mirror image — no rotation gets there' }]);
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Commit ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', {}, commitB));
  const P = panel(panelEl);

  function build() {
    world.clear();
    A = cubeGroup(trap.a, { center: true, marker: 0 });
    B = cubeGroup(trap.b, { center: true });
    world.add(A.group, B.group);
    layout();
    stage.onResize = () => { if (C.enabled) layout(); };
    C.reset();
    C.enabled = true;
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `${trap.a.length} cubes.`;
    log.push('present', { sketch: 'mirror', mode: run.mode, level: run.level, a: trap.a, b: trap.b, isMirror: trap.isMirror });
  }

  async function commit() {
    if (!C.picked) { C.el.classList.add('shake'); setTimeout(() => C.el.classList.remove('shake'), 300); return; }
    const said = C.picked;
    const ok = (said === 'mir') === trap.isMirror;
    C.enabled = false;
    commitB.disabled = true;
    log.push('result', { sketch: 'mirror', said, isMirror: trap.isMirror, ok });

    // Best-fit orientation of A against B, by shared cells after normalisation.
    const bSet = new Set(trap.b.map(cellKey));
    const os = orientations(trap.a);
    const best = os.reduce((acc, o) => {
      const overlap = o.cells.filter((c) => bSet.has(cellKey(c))).length;
      return overlap > acc.overlap ? { o, overlap } : acc;
    }, { o: os[0], overlap: -1 }).o;
    for (const m of best.path) { await stage.spin(A.group, m, 380); await sleep(60); }

    // B goes to glass, then A slides onto it (bounding-box centre onto centre).
    for (const m of [B.mats.base, B.mats.marker]) { m.transparent = true; m.depthWrite = false; }
    const from = A.group.position.clone();
    const to = B.group.position.clone();
    await stage.tween(600, (t) => { A.group.position.lerpVectors(from, to, easeInOut(t)); B.mats.base.opacity = 1 - 0.75 * t; });

    if (!trap.isMirror) {
      B.group.visible = false;
      void pulseMats(stage.ticker, [A.mats.base, A.mats.marker], COLOR_OK);
      P.message(ok ? `Right — a rotation (${best.path.map(moveLabel).join(' ')}) maps A onto B exactly.` : `It was a rotation: ${best.path.map(moveLabel).join(' ')} maps A onto B exactly.`, ok ? 'ok' : 'bad');
    } else {
      // Show what refuses to line up: B cells A can't cover, and A cubes sticking out of B.
      const aSet = new Set(best.cells.map(cellKey));
      const miss = trap.b.filter((c) => !aSet.has(cellKey(c)));
      B.group.visible = false;
      const ghost = cubeGroup(miss, { ghost: true, color: 0xe5484d });
      ghost.group.position.copy(B.group.position).sub(B.c0);
      world.add(ghost.group);
      void pulseMats(stage.ticker, [A.mats.base, A.mats.marker], COLOR_BAD);
      P.message(ok ? `Right — the closest rotation still leaves ${miss.length} cell${miss.length > 1 ? 's' : ''} uncovered (red). B is A's mirror.` : `It's a mirror: even the best rotation leaves ${miss.length} cell${miss.length > 1 ? 's' : ''} uncovered (red).`, ok ? 'ok' : 'bad');
    }
    C.mark(said, ok ? 'right' : 'wrong');
    ok ? run.hit() : run.miss();
    const next = () => { trap = makeTrap(cubesFor(run.level), mulberry32(run.nextSeed())); build(); };
    if (run.over) run.showOver(next);
    else P.post([{ label: 'Next ↵', primary: true, onClick: next }]);
  }

  run.begin(() => { trap = makeTrap(cubesFor(run.level), mulberry32(run.nextSeed())); build(); });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (e.key === '1' && C.enabled) (C.el.children[0] as HTMLElement).click();
    else if (e.key === '2' && C.enabled) (C.el.children[1] as HTMLElement).click();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const mirror: SketchDef = {
  id: 'mirror', title: 'Mirror', status: 'playable', skill: 'rotation vs reflection', icon: '🪞',
  tagline: 'Two shapes, nearly identical. Can A be rotated into B, or is B the mirror image? Decide, then watch A try.',
  about: 'A rotation can never turn a shape into its mirror image — but only for chiral, non-planar shapes; a flat shape can be flipped over in 3D. So every pair here is non-planar, from five cubes up, and the reveal turns A to its best fit and shows the cells it cannot cover.',
  controls: 'Pick rotation or mirror, then commit (Enter).',
  mount,
};
