// Shove: push and turn one awkward crate into its socket. You commit a plan of 2–4 moves; it
// executes without pause and stops at the first blocked move. No undo, a move budget of par + 3.
import * as THREE from 'three';
import type { Cell } from '../polycube';
import { SketchStage, cubeGroup, voxelMesh, panel, h, mulberry32, sleep, easeInOut, easeOut, pulseMats, COLOR_OK, COLOR_BAD } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';
import { Run } from '../run';
import { apply, makeLevel, spec, solved, crateCells, key, isTurn, MOVE_GLYPH, DIRS, type Level, type State, type Move, type P } from './shove-model';

const SLACK = 3;
const MAX_PLAN = 4, MIN_PLAN = 2;
const STEP_MS = 210, TURN_MS = 280;

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: null });
  const run = new Run({ id: 'shove', name: 'Shove', icon: '🏗️', dailyRounds: 5 }, hudEl, stageEl);
  let level!: Level, state!: State, used = 0, budget = 0, busy = false, done = false;
  const world = new THREE.Group();
  stage.scene.add(world);
  let crate!: ReturnType<typeof cubeGroup>;
  let player!: THREE.Mesh;
  let box: THREE.Mesh | null = null;

  // ---- panel: status · plan queue · d-pad · actions
  const status = h('div.muted');
  const queueEl = h('div#queue');
  const btn = (m: Move, label: string, keyHint: string) => h('button.mv.dp-' + m, { title: keyHint, onclick: () => addMove(m) }, h('span.ax', {}, MOVE_GLYPH[m]), h('span.deg', {}, label));
  const dpad = h('div.dpad', {},
    btn('ccw', 'turn', 'Q'), btn('up', 'push', '↑'), btn('cw', 'turn', 'E'),
    btn('left', 'push', '←'), btn('down', 'push', '↓'), btn('right', 'push', '→'));
  const undoB = h('button', { onclick: () => { if (!busy && plan.length) { plan.pop(); renderPlan(); } }, title: 'Backspace' }, '⌫ Undo') as HTMLButtonElement;
  const clearB = h('button', { onclick: () => { if (!busy) { plan = []; renderPlan(); } } }, 'Clear') as HTMLButtonElement;
  const goB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Go ↵') as HTMLButtonElement;
  const giveUpB = h('button', { onclick: giveUp }, 'Give up') as HTMLButtonElement;
  panelEl.append(status, queueEl, dpad, h('div#actions', {}, giveUpB, undoB, clearB, goB));
  const P = panel(panelEl);
  let plan: Move[] = [];

  const minPlan = () => Math.min(MIN_PLAN, budget - used);
  function renderPlan() {
    queueEl.replaceChildren();
    if (!plan.length) { queueEl.append(h('span.placeholder', {}, `queue ${minPlan()}–${MAX_PLAN} moves — nothing moves until you go`)); return; }
    plan.forEach((m, i) => queueEl.append(h('span.chip', { style: { '--c': isTurn(m) ? '#f5a524' : '#3e8ff5' } }, h('span.n', {}, String(i + 1)), h('span.dot'), MOVE_GLYPH[m])));
  }
  const shakeQ = () => { queueEl.classList.remove('shake'); void queueEl.offsetWidth; queueEl.classList.add('shake'); };
  function addMove(m: Move) {
    if (busy || done) return;
    if (plan.length >= Math.min(MAX_PLAN, budget - used)) { shakeQ(); return; }
    plan.push(m);
    renderPlan();
    log.push('enqueue', { sketch: 'shove', move: m });
  }
  function renderStatus() { status.innerHTML = `moves <b>${used}</b> / ${budget} · par ${level.par} · plans of ${minPlan()}–${MAX_PLAN}`; }

  // ---- scene
  const at = (p: P, y = 0) => new THREE.Vector3(p[0], y, p[1]);
  const frame = () => stage.place(0, 52, stage.fit(Math.hypot(level.w - 2, level.h - 2) / 2 + 0.5, 1.08), [(level.w - 1) / 2, -0.4, (level.h - 1) / 2]);
  stage.onResize = frame;

  function build() {
    world.clear();
    const walls = new Set(level.walls);
    const floor: Cell[] = [], blocks: Cell[] = [];
    for (let x = 1; x < level.w - 1; x++) for (let z = 1; z < level.h - 1; z++) {
      floor.push([x, 0, z]);
      if (walls.has(key([x, z]))) blocks.push([x, 0, z]);
    }
    // Low geometry so the room stays readable from above: a thin tiled floor, a fence at the
    // border (the border cells themselves are out of bounds and not drawn), kerb-high obstacles.
    const low = (cells: Cell[], height: number, color: number, outline?: number) => {
      const g = voxelMesh(cells, { color, outline }).group;
      g.scale.y = height;
      g.position.y = -0.5 - height / 2;
      return g;
    };
    world.add(low(floor, 0.08, 0x2a2f3c, 0x454c60));
    const fence = new THREE.Group();
    const fm = new THREE.MeshStandardMaterial({ color: 0x505870, roughness: 0.8 });
    const iw = level.w - 2, ih = level.h - 2, cx = (level.w - 1) / 2, cz = (level.h - 1) / 2, T = 0.16, H = 0.34;
    for (const [sx, sz, px, pz] of [[iw + 2 * T, T, cx, 0.5 - T / 2], [iw + 2 * T, T, cx, level.h - 1.5 + T / 2], [T, ih, 0.5 - T / 2, cz], [T, ih, level.w - 1.5 + T / 2, cz]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, H, sz), fm);
      m.position.set(px, -0.5 + H / 2, pz);
      m.castShadow = m.receiveShadow = true;
      fence.add(m);
    }
    world.add(fence);
    if (blocks.length) { const g = voxelMesh(blocks, { color: 0x6b7590 }).group; g.scale.y = 0.7; g.position.y = -0.5 + 0.35; world.add(g); }
    // Socket: a thin green plate in the crate's target footprint, with the pivot cell brighter.
    // The outline ignores depth so the target footprint shows through the crate when they overlap.
    const sock = new THREE.Group();
    level.socket.forEach((p, i) => {
      const fill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.92), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x7ee39a : 0x46a758, transparent: true, opacity: 0.5 }));
      fill.position.set(p[0], -0.46, p[1]);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.92, 0.06, 0.92)), new THREE.LineBasicMaterial({ color: 0x9fe0ad, depthTest: false, transparent: true, opacity: 0.9 }));
      line.position.copy(fill.position);
      line.renderOrder = 5;
      sock.add(fill, line);
    });
    world.add(sock);
    // The box (push only) and its own teal socket.
    box = null;
    if (level.boxSocket) {
      const bs = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.92), new THREE.MeshBasicMaterial({ color: 0x2ec4b6, transparent: true, opacity: 0.5 }));
      bs.position.set(level.boxSocket[0], -0.46, level.boxSocket[1]);
      const bl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.92, 0.06, 0.92)), new THREE.LineBasicMaterial({ color: 0x7fe5da, depthTest: false, transparent: true, opacity: 0.9 }));
      bl.position.copy(bs.position);
      bl.renderOrder = 5;
      world.add(bs, bl);
      box = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), new THREE.MeshStandardMaterial({ color: 0x3f8f86, roughness: 0.7 }));
      box.castShadow = box.receiveShadow = true;
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.87, 0.87, 0.87)), new THREE.LineBasicMaterial({ color: 0x0b0d12, transparent: true, opacity: 0.6 })));
      world.add(box);
    }
    // Crate: cells relative to the pivot so the group can spin about it; the pivot cube is marked.
    const rel = crateCells(level.shape, { pivot: [0, 0], rot: 0 }).map((p) => [p[0], 0, p[1]] as Cell);
    crate = cubeGroup(rel, { marker: 0, color: 0xa8703a });
    world.add(crate.group);
    player = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: 0x3e8ff5, roughness: 0.5 }));
    player.castShadow = true;
    world.add(player);
    syncScene();
    frame();
  }
  function syncScene() {
    crate.group.position.copy(at(state.crate.pivot));
    crate.group.rotation.y = -(state.crate.rot & 3) * Math.PI / 2;
    player.position.copy(at(state.player, -0.18));
    if (box && state.box) box.position.copy(at(state.box, -0.07));
  }

  function newLevel() {
    const sp = spec(run.level);
    level = makeLevel(sp, mulberry32(run.nextSeed()));
    state = level.start;
    used = 0; budget = level.par + SLACK; done = false; busy = false;
    plan = [];
    build();
    renderPlan();
    renderStatus();
    P.message('');
    P.clearPost();
    goB.disabled = undoB.disabled = clearB.disabled = giveUpB.disabled = false;
    hintEl.textContent = level.boxSocket
      ? `Crate onto the green socket, pivot on the bright cell — and the teal box onto its teal socket. The box only pushes.`
      : `Crate onto the green socket, orange pivot cube on the bright cell. You turn it from a cell next to it.`;
    log.push('present', { sketch: 'shove', mode: run.mode, level: run.level, room: { w: level.w, h: level.h, walls: level.walls, shape: level.shape, start: level.start, socket: level.socket, boxSocket: level.boxSocket, par: level.par }, budget });
  }

  /** Animate one already-validated transition. */
  async function animate(from: State, to: State, m: Move) {
    if (isTurn(m)) {
      const r0 = crate.group.rotation.y, r1 = r0 + (m === 'cw' ? -1 : 1) * Math.PI / 2;
      run.sfx.turn();
      await stage.tween(TURN_MS, (t) => { crate.group.rotation.y = r0 + (r1 - r0) * easeInOut(t); });
    } else {
      const p0 = at(from.player, -0.18), p1 = at(to.player, -0.18);
      const c0 = at(from.crate.pivot), c1 = at(to.crate.pivot);
      const pushed = key(from.crate.pivot) !== key(to.crate.pivot);
      const boxed = !!(from.box && to.box && key(from.box) !== key(to.box));
      const b0 = from.box ? at(from.box, -0.07) : null, b1 = to.box ? at(to.box, -0.07) : null;
      if (pushed || boxed) run.sfx.thud(); else run.sfx.click();
      await stage.tween(STEP_MS, (t) => { const k = easeOut(t); player.position.lerpVectors(p0, p1, k); if (pushed) crate.group.position.lerpVectors(c0, c1, k); if (boxed && box && b0 && b1) box.position.lerpVectors(b0, b1, k); });
    }
    syncScene();
  }
  async function bump(m: Move) {
    run.sfx.miss();
    if (isTurn(m)) { void pulseMats(stage.ticker, [crate.mats.base, crate.mats.marker], COLOR_BAD, 600); await stage.shake(220, 0.08); return; }
    const p0 = player.position.clone(), d = DIRS[m];
    await stage.tween(160, (t) => { const k = Math.sin(t * Math.PI) * 0.3; player.position.set(p0.x + d[0] * k, p0.y, p0.z + d[1] * k); });
    player.position.copy(p0);
  }

  async function commit() {
    if (busy || done) return;
    if (plan.length < minPlan()) { shakeQ(); P.message(`Queue at least ${minPlan()} moves.`, 'bad'); return; }
    busy = true;
    goB.disabled = undoB.disabled = clearB.disabled = true;
    const moves = [...plan];
    plan = [];
    renderPlan();
    P.message('');
    log.push('commit', { sketch: 'shove', plan: moves, used });
    let blockedAt = -1;
    for (let i = 0; i < moves.length; i++) {
      const next = apply(level, state, moves[i]);
      used++;
      renderStatus();
      if (!next) { blockedAt = i; await bump(moves[i]); break; }
      const prev = state;
      state = next;
      await animate(prev, state, moves[i]);
      if (solved(level, state)) break;
    }
    log.push('exec', { sketch: 'shove', blockedAt, used, state });
    if (solved(level, state)) return finish(true);
    if (used >= budget) return finish(false, 'Out of moves.');
    busy = false;
    goB.disabled = undoB.disabled = clearB.disabled = false;
    renderStatus();
    renderPlan();
    if (blockedAt >= 0) P.message(`Move ${blockedAt + 1} (${MOVE_GLYPH[moves[blockedAt]]}) was blocked — the rest of the plan was dropped.`, 'bad');
  }

  function giveUp() { if (!busy && !done) void finish(false, 'Gave up.'); }

  async function finish(ok: boolean, why = '') {
    done = true; busy = false;
    goB.disabled = undoB.disabled = clearB.disabled = giveUpB.disabled = true;
    void pulseMats(stage.ticker, [crate.mats.base, crate.mats.marker], ok ? COLOR_OK : COLOR_BAD);
    log.push('result', { sketch: 'shove', ok, used, par: level.par, why });
    ok ? run.hit() : run.miss();
    P.message(ok ? `Seated in ${used} moves (par ${level.par}).` : `${why} Par was ${level.par}.`, ok ? 'ok' : 'bad');
    if (run.over) { run.showOver(newLevel); return; }
    P.post([
      { label: 'Next ↵', primary: true, onClick: newLevel },
      ...(ok ? [] : [{ label: 'Show solution', onClick: showSolution }]),
    ]);
  }

  async function showSolution() {
    if (busy) return;
    busy = true;
    P.clearPost();
    state = level.start;
    syncScene();
    await sleep(300);
    for (const m of level.solution) { const next = apply(level, state, m)!; const prev = state; state = next; await animate(prev, state, m); await sleep(60); }
    void pulseMats(stage.ticker, [crate.mats.base, crate.mats.marker], COLOR_OK);
    busy = false;
    log.push('reveal', { sketch: 'shove' });
    P.post([{ label: 'Next ↵', primary: true, onClick: newLevel }]);
  }

  run.begin(newLevel);
  const KEYS: Record<string, Move> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', q: 'ccw', e: 'cw', Q: 'ccw', E: 'cw' };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') { if (!done && !busy) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (e.key === 'Backspace') undoB.click();
    else if (KEYS[e.key]) addMove(KEYS[e.key]);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const shove: SketchDef = {
  id: 'shove', title: 'Shove', status: 'playable', skill: 'planning under irreversible moves', icon: '🏗️',
  tagline: 'One awkward crate, one socket. Push it, turn it — but plan 2–4 moves at a time and commit: a blocked move drops the rest, and a crate in a corner stays there.',
  mount,
};
