// Wayfind: see the maze from above for a few seconds, then walk it from inside. At every junction
// you commit a direction; the corridor then plays out. Later, your start heading no longer matches
// the map's up, so two frames of reference have to be aligned before memory is any use.
import * as THREE from 'three';
import type { Cell } from '../polycube';
import { SketchStage, voxelMesh, panel, h, mulberry32, sleep, easeInOut, easeOut } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';
import { Run } from '../run';
import { generate, walk, good, turnTo, spec, key, HEAD_VEC, type Maze, type P, type Heading, type Rel } from './wayfind-model';

const RELS: Rel[] = ['left', 'forward', 'right', 'back'];
const GLYPH: Record<Rel, string> = { left: '←', forward: '↑', right: '→', back: '↓' };
const EYE = 0.05, STEP_MS = 170, TURN_MS = 220;
const yawOf = (hd: Heading) => (hd * Math.PI) / 2;
const dirOf = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: null, fov: 30 });
  const run = new Run({ id: 'wayfind', name: 'Wayfind', icon: '🧭', dailyRounds: 6 }, hudEl, stageEl);
  let m!: Maze, cur!: P, heading!: Heading, decisions = 0, wrong = 0, gen = 0, mode: 'top' | 'fp' = 'top', busy = true, done = false;
  const world = new THREE.Group();
  stage.scene.add(world);
  const overlay = h('div.overlay-text.corner');
  stageEl.append(overlay);
  const fade = h('div.fade', { hidden: true });
  stageEl.append(fade);
  let startMarker!: THREE.Object3D, trail!: THREE.Group;
  let yaw = 0;

  // ---- panel
  const status = h('div.muted');
  const btns = {} as Record<Rel, HTMLButtonElement>;
  const dpad = h('div.dpad.wf', {});
  for (const r of RELS) { btns[r] = h('button.mv', { onclick: () => choose(r), title: `Arrow ${r}` }, h('span.ax', {}, GLYPH[r]), h('span.deg', {}, r)) as HTMLButtonElement; }
  dpad.append(h('span'), btns.forward, h('span'), btns.left, btns.back, btns.right);
  const giveUpB = h('button', { onclick: () => { if (!busy && !done) void finish(false, 'Gave up.'); } }, 'Give up') as HTMLButtonElement;
  panelEl.append(status, dpad, h('div#actions', {}, giveUpB));
  const P = panel(panelEl);
  const setButtons = (opts: Rel[] | null) => { for (const r of RELS) btns[r].disabled = !opts || !opts.includes(r); };
  const renderStatus = () => { status.innerHTML = `decisions <b>${decisions}</b> · wrong turns <b>${wrong}</b> · par ${m.par}`; };

  // ---- scene
  const centre = () => new THREE.Vector3((m.size - 1) / 2, -0.5, (m.size - 1) / 2);
  function build() {
    world.clear();
    const open = new Set(m.open);
    // Two tints in a checker so corridors give motion cues without any cell being recognisable.
    const walls: Cell[][] = [[], []], floor: Cell[][] = [[], []];
    for (let x = 0; x < m.size; x++) for (let z = 0; z < m.size; z++) (open.has(key([x, z])) ? floor : walls)[(x + z) & 1].push([x, open.has(key([x, z])) ? -1 : 0, z]);
    world.add(voxelMesh(walls[0], { color: 0x5b6478, outline: 0x1a1d26 }).group, voxelMesh(walls[1], { color: 0x525a6e, outline: 0x1a1d26 }).group);
    world.add(voxelMesh(floor[0], { color: 0x262b38, outline: 0x3a4052 }).group, voxelMesh(floor[1], { color: 0x2c3140, outline: 0x3a4052 }).group);
    // Goal: a green disc and a tall pillar you can spot down a corridor.
    const gm = new THREE.MeshStandardMaterial({ color: 0x46a758, emissive: 0x2a7a3a, emissiveIntensity: 0.8 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 24), gm);
    disc.position.set(m.goal[0], -0.47, m.goal[1]);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), gm);
    pillar.position.set(m.goal[0], -0.05, m.goal[1]);
    world.add(disc, pillar);
    // Start: an arrow showing the heading you begin with (top view only).
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0x3e8ff5, emissive: 0x1d4f9a, emissiveIntensity: 0.6 }));
    cone.rotation.x = -Math.PI / 2; // tip toward −z = north; the group's yaw turns it to the heading
    startMarker = new THREE.Group();
    startMarker.add(cone);
    startMarker.position.set(m.start[0], -0.2, m.start[1]);
    startMarker.rotation.y = -yawOf(m.heading);
    world.add(startMarker);
    trail = new THREE.Group();
    world.add(trail);
  }
  function topView() {
    mode = 'top';
    stage.camera.fov = 30;
    stage.camera.updateProjectionMatrix();
    stage.place(0, 89, stage.fit((m.size * Math.SQRT2) / 2 + 0.3, 1.02), centre());
  }
  function fpView() {
    mode = 'fp';
    stage.camera.fov = 72;
    stage.camera.updateProjectionMatrix();
    stage.camera.position.set(cur[0], EYE, cur[1]);
    stage.camera.lookAt(stage.camera.position.clone().add(dirOf(yaw)));
  }
  stage.onResize = () => { if (mode === 'top') topView(); else fpView(); };
  const markTrail = (p: P, ok: boolean) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: ok ? 0x3e8ff5 : 0xe5484d, transparent: true, opacity: 0.85 }));
    t.position.set(p[0], -0.46, p[1]);
    trail.add(t);
  };

  async function newMaze() {
    const my = ++gen;
    const sp = spec(run.level);
    m = generate(sp.rooms, sp.loops, mulberry32(run.nextSeed()), sp.heading);
    cur = m.start; heading = m.heading; yaw = yawOf(heading);
    decisions = 0; wrong = 0; busy = true; done = false;
    build();
    topView();
    trail.visible = false;
    setButtons(null);
    giveUpB.disabled = true;
    P.message('');
    P.clearPost();
    renderStatus();
    hintEl.textContent = `${sp.showMs / 1000}s to memorise. Blue arrow: you and the way you face. Green: the goal.${sp.heading === 'random' ? ' The map is north-up; you are not.' : ''}`;
    log.push('present', { sketch: 'wayfind', mode: run.mode, level: run.level, maze: { rooms: m.rooms, loops: sp.loops, open: m.open, start: m.start, goal: m.goal, heading: m.heading, par: m.par }, showMs: sp.showMs, cut: sp.cut });
    for (let ms = sp.showMs; ms > 0; ms -= 100) { overlay.textContent = (ms / 1000).toFixed(1); await sleep(100); if (gen !== my) return; }
    overlay.textContent = '';
    startMarker.visible = false;
    if (sp.cut) {
      fade.hidden = false; fade.style.opacity = '1';
      await sleep(350); if (gen !== my) return;
      fpView();
      await stage.tween(300, (t) => { fade.style.opacity = String(1 - t); });
      fade.hidden = true;
    } else {
      // Swoop from the map into your own eyes so the two frames are seen to be the same place.
      const p0 = stage.camera.position.clone(), q0 = stage.camera.quaternion.clone(), f0 = stage.camera.fov;
      fpView();
      const p1 = stage.camera.position.clone(), q1 = stage.camera.quaternion.clone();
      await stage.tween(1500, (t) => {
        const k = easeInOut(t);
        stage.camera.position.lerpVectors(p0, p1, k);
        stage.camera.quaternion.slerpQuaternions(q0, q1, k);
        stage.camera.fov = f0 + (72 - f0) * k;
        stage.camera.updateProjectionMatrix();
      });
      if (gen !== my) return;
    }
    busy = false;
    giveUpB.disabled = false;
    present();
  }

  function options(): Rel[] {
    const open = new Set(m.open);
    return RELS.filter((r) => open.has(key([cur[0] + HEAD_VEC[turnTo(heading, r)][0], cur[1] + HEAD_VEC[turnTo(heading, r)][1]])));
  }
  function present(deadEnd = false) {
    const opts = options();
    setButtons(opts);
    P.message(deadEnd ? 'Dead end.' : opts.length > 1 ? 'Which way?' : 'Only one way on.', deadEnd ? 'bad' : '');
  }

  async function choose(rel: Rel) {
    if (busy || done) return;
    const nh = turnTo(heading, rel);
    const nxt: P = [cur[0] + HEAD_VEC[nh][0], cur[1] + HEAD_VEC[nh][1]];
    if (!new Set(m.open).has(key(nxt))) return;
    busy = true;
    setButtons(null);
    P.message('');
    const ok = good(m, cur, nxt);
    decisions++;
    if (!ok) wrong++;
    renderStatus();
    log.push('commit', { sketch: 'wayfind', at: cur, heading, rel, ok, decisions });
    const w = walk(m, cur, nxt);
    for (const p of w.path) markTrail(p, ok);
    if (!ok) run.sfx.miss(); else run.sfx.click();
    // Walk the corridor: turn toward each next cell, then glide into it.
    let from = cur;
    for (const p of w.path) {
      const hd = HEAD_VEC.findIndex((v) => from[0] + v[0] === p[0] && from[1] + v[1] === p[1]) as Heading;
      await turnYaw(yawOf(hd));
      const a = new THREE.Vector3(from[0], EYE, from[1]), b = new THREE.Vector3(p[0], EYE, p[1]);
      await stage.tween(STEP_MS, (t) => { stage.camera.position.lerpVectors(a, b, t); });
      from = p;
    }
    cur = w.end; heading = w.heading;
    if (w.atGoal) return finish(wrong === 0, '');
    if (decisions >= m.par * 3 + 4) return finish(false, 'Lost — too many turns.');
    busy = false;
    present(w.deadEnd);
  }
  async function turnYaw(target: number) {
    let d = target - yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < 1e-6) return;
    const y0 = yaw;
    await stage.tween(TURN_MS * (Math.abs(d) > Math.PI / 2 + 0.01 ? 1.6 : 1), (t) => { yaw = y0 + d * easeInOut(t); stage.camera.lookAt(stage.camera.position.clone().add(dirOf(yaw))); });
    yaw = target;
  }

  async function finish(ok: boolean, why: string) {
    done = true; busy = true;
    setButtons(null);
    giveUpB.disabled = true;
    log.push('result', { sketch: 'wayfind', ok, decisions, wrong, par: m.par, why });
    ok ? run.hit() : run.miss();
    P.message(ok ? `Goal, no wrong turns (${decisions} decisions, par ${m.par}).` : `${why} ${wrong} wrong turn${wrong === 1 ? '' : 's'} in ${decisions} decisions (par ${m.par}). Your trail is on the map.`, ok ? 'ok' : 'bad');
    // Rise back to the map with the trail drawn: reality's account of the walk.
    trail.visible = true;
    startMarker.visible = true;
    const p0 = stage.camera.position.clone(), q0 = stage.camera.quaternion.clone(), f0 = stage.camera.fov;
    topView();
    const p1 = stage.camera.position.clone(), q1 = stage.camera.quaternion.clone();
    await stage.tween(1300, (t) => { const k = easeOut(t); stage.camera.position.lerpVectors(p0, p1, k); stage.camera.quaternion.slerpQuaternions(q0, q1, k); stage.camera.fov = f0 + (30 - f0) * k; stage.camera.updateProjectionMatrix(); });
    if (run.over) run.showOver(() => void newMaze());
    else P.post([{ label: 'Next ↵', primary: true, onClick: () => void newMaze() }]);
  }

  run.onModeChange = () => void newMaze();
  void newMaze();
  const KEYS: Record<string, Rel> = { ArrowLeft: 'left', ArrowUp: 'forward', ArrowRight: 'right', ArrowDown: 'back', a: 'left', w: 'forward', d: 'right', s: 'back' };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click();
    else if (KEYS[e.key]) { if (!btns[KEYS[e.key]].disabled) void choose(KEYS[e.key]); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => { gen++; window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const wayfind: SketchDef = {
  id: 'wayfind', title: 'Wayfind', status: 'playable', skill: 'perspective taking · mental maps', icon: '🧭',
  tagline: 'See the maze from above for a few seconds. Then walk it from inside, committing a direction at every junction. Later the map\'s up is not the way you face.',
  mount,
};
