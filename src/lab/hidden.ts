// Hidden Structure: a stack of cubes seen from one viewpoint. Some are hidden.
// How many cubes are there? Commit, then the structure turns and shows you.
import * as THREE from 'three';
import type { Cell } from '../polycube';
import { SketchStage, cubeGroup, panel, hud, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, easeInOut, COLOR_MARKER } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';

const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

function heightmap(w: number, d: number, maxH: number, rng: () => number): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const hgt = rng() < 0.2 ? 0 : 1 + Math.floor(rng() * maxH);
    for (let y = 0; y < hgt; y++) cells.push([x, y, z]);
  }
  return cells;
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -0.5 });
  const H = hud(hudEl, ['right', 'seen']);
  let base = 3, maxH = 3, right = 0, seen = 0;
  let cells: Cell[] = [];
  let hiddenIdx: number[] = [];
  let group!: ReturnType<typeof cubeGroup>;
  const world = new THREE.Group();
  stage.scene.add(world);

  let guess = 1;
  const num = h('b', {}, '1');
  const stepper = h('div.stepper', {}, h('span', {}, 'cubes in total:'), h('button', { onclick: () => setGuess(guess - 1) }, '−'), num, h('button', { onclick: () => setGuess(guess + 1) }, '+'));
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Commit ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', { style: { justifyContent: 'space-between' } }, stepper, commitB));
  const P = panel(panelEl);
  function setGuess(v: number) { guess = Math.max(1, Math.min(64, v)); num.textContent = String(guess); }

  /** Cube is visible if any camera-facing face centre is the first thing a ray from the camera hits. */
  function visibility() {
    stage.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const p = new THREE.Vector3(), c = new THREE.Vector3();
    return group.cubes.map((cube) => {
      cube.getWorldPosition(c);
      for (const n of NORMALS) {
        const nv = new THREE.Vector3(n[0], n[1], n[2]);
        if (nv.dot(stage.camera.position.clone().sub(c)) <= 0) continue;
        p.copy(c).addScaledVector(nv, 0.51);
        ray.set(stage.camera.position, p.clone().sub(stage.camera.position).normalize());
        const hits = ray.intersectObjects(group.cubes, false);
        if (hits.length && hits[0].object === cube) return true;
      }
      return false;
    });
  }

  function newCase() {
    const rng = mulberry32(Date.now());
    for (let tries = 0; tries < 300; tries++) {
      cells = heightmap(base, base, maxH, rng);
      world.clear();
      group = cubeGroup(cells);
      world.add(group.group);
      stage.place(35 + (rng() - 0.5) * 20, 22 + rng() * 10, 9 + base * 2.2, [(base - 1) / 2, (maxH - 1) / 2 - 0.4, (base - 1) / 2]);
      const vis = visibility();
      hiddenIdx = vis.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      // Every column's top must be visible, so heights are inferable; and there must be something to infer.
      const tops = new Map<string, number>();
      cells.forEach((c, i) => { const k = `${c[0]},${c[2]}`; if ((cells[tops.get(k) ?? -1]?.[1] ?? -1) < c[1]) tops.set(k, i); });
      const topsVisible = [...tops.values()].every((i) => vis[i]);
      if (topsVisible && hiddenIdx.length >= 2 && hiddenIdx.length <= cells.length / 2) break;
    }
    group.group.rotation.set(0, 0, 0);
    setGuess(1);
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `${base}×${base} footprint, columns up to ${maxH} high. Every column's top is visible; cubes rest on cubes.`;
    H.set('right', right); H.set('seen', seen);
    log.push('present', { sketch: 'hidden', cells, hidden: hiddenIdx.length });
  }

  async function commit() {
    commitB.disabled = true;
    seen++;
    const ok = guess === cells.length;
    if (ok) right++;
    log.push('result', { sketch: 'hidden', guess, actual: cells.length, hidden: hiddenIdx.length, ok });
    H.set('right', right); H.set('seen', seen);
    // Tint the hidden cubes, then turn the structure so they come into view.
    for (const i of hiddenIdx) group.cubes[i].material = new THREE.MeshStandardMaterial({ color: COLOR_MARKER, roughness: 0.6 });
    void pulseMats(stage.ticker, [group.mats.base], ok ? COLOR_OK : COLOR_BAD);
    const pivot = new THREE.Vector3((base - 1) / 2, 0, (base - 1) / 2);
    await stage.tween(2600, (t) => {
      const a = easeInOut(t) * Math.PI * 2;
      group.group.position.set(pivot.x - (pivot.x * Math.cos(a) - pivot.z * Math.sin(a)), 0, pivot.z - (pivot.x * Math.sin(a) + pivot.z * Math.cos(a)));
      group.group.rotation.y = a;
    });
    P.message(`${cells.length} cubes — ${hiddenIdx.length} were hidden (orange). ${ok ? 'You had it.' : `You said ${guess}.`}`, ok ? 'ok' : 'bad');
    if (ok && right % 3 === 0) { if (base < 4) base++; else maxH = Math.min(4, maxH + 1); }
    P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
  }

  newCase();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') setGuess(guess + 1);
    else if (e.key === 'ArrowDown' || e.key === '-') setGuess(guess - 1);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const hidden: SketchDef = {
  id: 'hidden', title: 'Hidden Structure', status: 'playable', skill: 'inference behind occlusion',
  tagline: 'A stack seen from one angle. Some cubes are hidden behind others. How many cubes are there? Commit, then it turns around.',
  mount,
};
