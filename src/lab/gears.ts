// Mechanism: a gear train. The red gear turns clockwise. Which way does the last gear turn, and how fast?
import * as THREE from 'three';
import { SketchStage, choices, panel, h, mulberry32, pick, sleep } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

const MODULE = 0.32;
interface Gear { x: number; y: number; teeth: number; theta: number; omega: number; out?: { teeth: number }; mesh: THREE.Group }

function gearShape(teeth: number) {
  const rp = (MODULE * teeth) / 2, ro = rp + MODULE, rr = rp - MODULE * 1.2, p = (Math.PI * 2) / teeth;
  const s = new THREE.Shape();
  const pt = (r: number, a: number) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  for (let k = 0; k < teeth; k++) {
    const a = k * p;
    const pts = [pt(rr, a - 0.5 * p), pt(rr, a - 0.28 * p), pt(ro, a - 0.16 * p), pt(ro, a + 0.16 * p), pt(rr, a + 0.28 * p)];
    for (const q of pts) k === 0 && q === pts[0] ? s.moveTo(q.x, q.y) : s.lineTo(q.x, q.y);
  }
  s.closePath();
  return s;
}

function gearMesh(teeth: number, color: number, z = 0) {
  const geo = new THREE.ExtrudeGeometry(gearShape(teeth), { depth: 0.28, bevelEnabled: false });
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }));
  m.castShadow = m.receiveShadow = true;
  m.position.z = z;
  return m;
}

const pitch = (teeth: number) => (MODULE * teeth) / 2;

export function makeTrain(count: number, compounds: number, rng: () => number) {
  for (let tries = 0; tries < 300; tries++) {
    const gears: Omit<Gear, 'mesh'>[] = [];
    let heading = rng() * Math.PI * 2;
    let ok = true;
    for (let i = 0; i < count; i++) {
      const teeth = 8 + Math.floor(rng() * 12);
      if (i === 0) { gears.push({ x: 0, y: 0, teeth, theta: 0, omega: 0 }); continue; }
      const prev = gears[i - 1];
      const prevR = pitch(prev.out?.teeth ?? prev.teeth);
      heading += (rng() - 0.5) * 1.6;
      const d = prevR + pitch(teeth);
      const g = { x: prev.x + Math.cos(heading) * d, y: prev.y + Math.sin(heading) * d, teeth, theta: 0, omega: 0 };
      // No overlap with any non-adjacent gear.
      for (let j = 0; j < i - 1; j++) {
        const o = gears[j];
        const rj = pitch(Math.max(o.teeth, o.out?.teeth ?? 0));
        if (Math.hypot(o.x - g.x, o.y - g.y) < rj + pitch(Math.max(teeth, 20)) + MODULE * 2) ok = false;
      }
      gears.push(g);
    }
    if (!ok) continue;
    // Compound gears: a second wheel on the same axle drives the next gear.
    const mids = gears.slice(1, -1);
    for (let k = 0; k < compounds && mids.length; k++) {
      const g = pick(mids, rng);
      if (g.out) continue;
      g.out = { teeth: g.teeth + (rng() < 0.5 ? 6 : -4) };
      if (g.out.teeth < 6) g.out.teeth = g.teeth + 6;
      // Re-place every later gear against the new wheel radius.
      const idx = gears.indexOf(g);
      for (let i = idx + 1; i < gears.length; i++) {
        const prev = gears[i - 1];
        const ang = Math.atan2(gears[i].y - prev.y, gears[i].x - prev.x);
        const d = pitch(prev.out?.teeth ?? prev.teeth) + pitch(gears[i].teeth);
        gears[i].x = prev.x + Math.cos(ang) * d;
        gears[i].y = prev.y + Math.sin(ang) * d;
      }
    }
    // Angular velocities and meshing phases.
    gears[0].omega = -0.9; // clockwise seen from the front
    for (let i = 1; i < gears.length; i++) {
      const prev = gears[i - 1], g = gears[i];
      const tPrev = prev.out?.teeth ?? prev.teeth;
      g.omega = -prev.omega * (tPrev / g.teeth);
      const phi = Math.atan2(g.y - prev.y, g.x - prev.x);
      const pPrev = (Math.PI * 2) / tPrev;
      const e = phi - (prev.theta + Math.round((phi - prev.theta) / pPrev) * pPrev);
      g.theta = phi + Math.PI - e * (tPrev / g.teeth) - Math.PI / g.teeth;
    }
    return gears;
  }
  throw new Error('no train');
}

/** Difficulty by level: more gears, then speed is asked, then compound gears (two wheels on one axle). */
export const setup = (level: number) => ({ count: Math.min(9, 4 + Math.floor(level / 2)), askSpeed: level >= 3, compounds: level >= 12 ? 3 : level >= 8 ? 2 : level >= 5 ? 1 : 0 });

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: null, fov: 30 });
  const run = new Run({ id: 'gears', name: 'Gears', icon: '⚙️', dailyRounds: 8 }, hudEl, stageEl);
  /** Difficulty by level: longer trains, then the speed question, then compound gears. */
  let askSpeed = false, compounds = 0;
  let gears: Gear[] = [];
  const world = new THREE.Group();
  stage.scene.add(world);
  let running = false, t0 = 0;
  const dirBox = h('div'), speedBox = h('div');
  panelEl.append(h('div.rows', {}, h('div', {}, h('div.layer-label', {}, 'last gear turns'), dirBox), h('div', {}, h('div.layer-label', {}, 'and compared to the red gear it is'), speedBox)));
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Run it ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', {}, commitB));
  const P = panel(panelEl);
  let CD!: ReturnType<typeof choices<'cw' | 'ccw'>>, CS!: ReturnType<typeof choices<'faster' | 'slower' | 'same'>>;

  function build() {
    const rng = mulberry32(run.nextSeed());
    const d = setup(run.level);
    askSpeed = d.askSpeed;
    compounds = d.compounds;
    world.clear();
    const model = makeTrain(d.count, compounds, rng);
    gears = model.map((g, i) => {
      const group = new THREE.Group();
      const color = i === 0 ? 0xe5484d : i === model.length - 1 ? 0x3e8ff5 : 0x8a97b3;
      group.add(gearMesh(g.teeth, color));
      if (g.out) group.add(gearMesh(g.out.teeth, 0xb0bad4, 0.32));
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x2a2e3a }));
      axle.rotation.x = Math.PI / 2;
      axle.position.z = 0.2;
      group.add(axle);
      group.position.set(g.x, g.y, 0);
      group.rotation.z = g.theta;
      world.add(group);
      return { ...g, mesh: group };
    });
    // Direction arrow on the driver.
    const arrow = new THREE.Mesh(new THREE.TorusGeometry(pitch(gears[0].teeth) + 0.55, 0.05, 8, 40, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xe5484d }));
    arrow.position.set(gears[0].x, gears[0].y, 0.5);
    arrow.rotation.z = Math.PI * 0.25;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 10), new THREE.MeshBasicMaterial({ color: 0xe5484d }));
    const r = pitch(gears[0].teeth) + 0.55, a = Math.PI * 0.25;
    tip.position.set(gears[0].x + r * Math.cos(a), gears[0].y + r * Math.sin(a), 0.5);
    tip.rotation.z = a; // tangent pointing clockwise
    world.add(arrow, tip);
    frame();
    running = false;
    dirBox.replaceChildren(); speedBox.replaceChildren();
    CD = choices(dirBox, [{ id: 'cw', label: 'clockwise ↻' }, { id: 'ccw', label: 'counter-clockwise ↺' }]);
    CS = choices(speedBox, [{ id: 'faster', label: 'faster' }, { id: 'same', label: 'same speed' }, { id: 'slower', label: 'slower' }]);
    speedBox.parentElement!.hidden = !askSpeed;
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    const teethList = gears.map((g) => g.out ? `${g.teeth}/${g.out.teeth}` : String(g.teeth)).join(' → ');
    hintEl.textContent = `${gears.length} gears (${teethList} teeth${compounds ? '; a/b is two wheels on one axle' : ''}). Seen from the front, the red gear turns clockwise.`;
    log.push('present', { sketch: 'gears', mode: run.mode, level: run.level, gears: gears.map((g) => ({ teeth: g.teeth, out: g.out?.teeth })) });
  }

  /** Frame the train for the current aspect ratio. */
  function frame() {
    if (!gears.length) return;
    const rOf = (g: Gear) => pitch(Math.max(g.teeth, g.out?.teeth ?? 0)) + MODULE;
    const minX = Math.min(...gears.map((g) => g.x - rOf(g))), maxX = Math.max(...gears.map((g) => g.x + rOf(g)));
    const minY = Math.min(...gears.map((g) => g.y - rOf(g))), maxY = Math.max(...gears.map((g) => g.y + rOf(g)));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));
    const D = Math.max((maxY - minY + 1.5) / (2 * tan), (maxX - minX + 1.5) / (2 * tan * stage.camera.aspect)) * 1.08;
    stage.camera.position.set(cx, cy - D * 0.18, D);
    stage.camera.lookAt(cx, cy, 0);
    stage.lookAt.set(cx, cy, 0);
    stage.sun.position.set(cx + 6, cy + 8, 14);
    stage.sun.target.position.set(cx, cy, 0);
    stage.sun.target.updateMatrixWorld();
  }
  stage.onResize = frame;

  stage.onFrame = (now) => {
    if (!running) return;
    const dt = (now - t0) / 1000;
    for (const g of gears) g.mesh.rotation.z = g.theta + g.omega * dt;
  };

  async function commit() {
    if (!CD.picked || (askSpeed && !CS.picked)) { P.message('Pick an answer first.', 'bad'); return; }
    const last = gears[gears.length - 1];
    const dirOk = (last.omega < 0) === (CD.picked === 'cw');
    const ratio = Math.abs(last.omega / gears[0].omega);
    const speedTruth = Math.abs(ratio - 1) < 1e-6 ? 'same' : ratio > 1 ? 'faster' : 'slower';
    const speedOk = !askSpeed || CS.picked === speedTruth;
    const ok = dirOk && speedOk;
    CD.enabled = CS.enabled = false;
    commitB.disabled = true;
    log.push('result', { sketch: 'gears', ok, dir: CD.picked, speed: CS.picked, dirOk, speedOk, ratio });
    running = true;
    t0 = performance.now();
    await sleep(3200);
    CD.mark(last.omega < 0 ? 'cw' : 'ccw', 'right');
    if (!dirOk) CD.mark(CD.picked, 'wrong');
    if (askSpeed) { CS.mark(speedTruth, 'right'); if (!speedOk) CS.mark(CS.picked!, 'wrong'); }
    ok ? run.hit() : run.miss();
    P.message(`The last gear turns ${last.omega < 0 ? 'clockwise' : 'counter-clockwise'} at ${ratio.toFixed(2)}× the red gear's speed.${ok ? '' : ' Reality disagrees with your pick.'}`, ok ? 'ok' : 'bad');
    if (run.over) run.showOver(build);
    else P.post([{ label: 'Next ↵', primary: true, onClick: build }]);
  }

  run.begin(build);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const gears: SketchDef = {
  id: 'gears', title: 'Gears', status: 'playable', skill: 'propagating motion through a system', icon: '⚙️',
  tagline: 'The red gear turns clockwise. Which way does the blue gear go — and faster or slower? Decide, then run the machine.',
  about: 'Motion through a system: each mesh reverses direction and the ratio of teeth sets the speed. You commit direction (and later speed) of the last gear before the train runs.',
  controls: 'Pick a direction (and speed when asked), then Run it (Enter).',
  mount,
};
