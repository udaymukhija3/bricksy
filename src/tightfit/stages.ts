// Tight Fit stages. Each mounts into the shared stage/panel, runs to a result, and cleans up.
import * as THREE from 'three';
import { applyMoves, normalize, rotateCell, moveLabel, type Cell, type Move } from '../polycube';
import { PackStage } from '../pack-scene';
import {
  SketchStage, cubeGroup, voxelMesh, turnQueue, panel, h, sleep, pulseMats, easeIn, easeOut, COLOR_OK, COLOR_BAD,
  cubeGeo, edgeGeo,
} from '../lab/kit';
import { makeLoad, land, makeDoorway, passes, makeCorner, type Body } from './model';
import { PLATE, placeSil } from '../smuggle-model';
import { Sfx } from '../sfx';

export interface StageCtx {
  stageEl: HTMLElement;
  panelEl: HTMLElement;
  hintEl: HTMLElement;
  item: Cell[];
  itemName: string;
  itemColor: number;
  distance: number;
  rng: () => number;
  others?: Body[];
  sfx: Sfx;
  /** Called after each attempt so the job HUD can update stars. */
  onAttempt?: (ok: boolean, attempt: number) => void;
}

export interface StageResult { firstTry: boolean; attempts: number; failed: boolean; item: Cell[]; cleanup: () => void }

const MAX_ATTEMPTS = 3;

/** Marker cube colour that contrasts with the item colour. */
function markerFor(color: number) {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 150 ? 0x2a2e3a : 0xf4f6ff;
}
const dev = (obj: Record<string, unknown>) => { if (import.meta.env.DEV) Object.assign(window, { tf: obj }); };

const resultPause = (P: ReturnType<typeof panel>, label: string) =>
  new Promise<void>((resolve) => {
    const go = () => { window.removeEventListener('keydown', onKey); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };
    window.addEventListener('keydown', onKey);
    P.post([{ label: `${label} ↵`, primary: true, onClick: go }]);
  });

// ---------------------------------------------------------------- Load: the van

export async function loadStage(ctx: StageCtx): Promise<StageResult> {
  const canvas = document.createElement('canvas');
  ctx.stageEl.replaceChildren(canvas);
  const stage = new PackStage(canvas);
  stage.setItemColor(ctx.itemColor, markerFor(ctx.itemColor));
  const puzzle = makeLoad(ctx.item, ctx.distance, ctx.rng);
  stage.setPuzzle(puzzle);
  dev({ puzzle });
  ctx.panelEl.replaceChildren();
  ctx.hintEl.textContent = `Load the ${ctx.itemName} into the van — it has to drop into the slot. ${puzzle.distance} turn${puzzle.distance > 1 ? 's' : ''}.`;

  let attempts = 0;
  let resolveDone!: (r: StageResult) => void;
  const done = new Promise<StageResult>((r) => { resolveDone = r; });
  const Q = turnQueue(ctx.panelEl, { commitLabel: 'Load it ↵', onHover: (a, d) => stage.highlightAxis(a, d), onCommit: commit });
  const P = panel(ctx.panelEl);

  async function commit(moves: Move[]) {
    Q.enabled = false;
    attempts++;
    for (const m of moves) { stage.highlightAxis(m.axis, m.dir); ctx.sfx.turn(); await stage.animateMove(m, 440); await sleep(100); }
    stage.highlightAxis(null);
    await sleep(100);
    const landing = land(puzzle, applyMoves(puzzle.piece, moves));
    await stage.animateDrop(moves, landing);
    const ok = landing.fits;
    ctx.onAttempt?.(ok, attempts);
    if (ok) {
      ctx.sfx.fit();
      stage.fuse();
      void stage.pulse(COLOR_OK);
      P.message(attempts === 1 ? 'In it goes. Clean.' : 'In it goes.', 'ok');
      await sleep(700);
      finish({ firstTry: attempts === 1, attempts, failed: false, item: normalize(puzzle.target) });
      return;
    }
    ctx.sfx.miss();
    void stage.shake();
    void stage.pulse(COLOR_BAD);
    if (attempts >= MAX_ATTEMPTS) {
      P.message(`It won't go in. The ${ctx.itemName} stays on the pavement.`, 'bad');
      await sleep(900);
      finish({ firstTry: false, attempts, failed: true, item: ctx.item });
      return;
    }
    P.message(`Doesn't fit like that. Lift it back out — ${MAX_ATTEMPTS - attempts} ${MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left.`, 'bad');
    await sleep(500);
    await stage.animateLift();
    Q.reset();
    Q.enabled = true;
  }

  function finish(r: Omit<StageResult, 'cleanup'>) {
    Q.dispose();
    resolveDone({ ...r, cleanup: () => stage.dispose() });
  }
  return done;
}

// ---------------------------------------------------------------- Doorway

export async function doorwayStage(ctx: StageCtx): Promise<StageResult> {
  ctx.stageEl.replaceChildren();
  const stage = new SketchStage(ctx.stageEl, { gizmo: true });
  const door = makeDoorway(ctx.item, ctx.distance, ctx.rng);
  let cells = normalize(ctx.item);
  const moves: Move[] = [];
  const world = new THREE.Group();
  stage.scene.add(world);
  const cx = (PLATE - 1) / 2, cy = (PLATE - 1) / 2;
  // The house wall: warm plaster with the doorway cut through it.
  const wall = voxelMesh(door.wall.plate, { color: 0x9a8b78, outline: 0x3a3028 });
  world.add(wall.group);
  const piece = cubeGroup(cells, { center: true, marker: 0, color: ctx.itemColor });
  piece.mats.marker.color.set(markerFor(ctx.itemColor));
  dev({ door, passes, rotateCell, normalize, get cells() { return cells; } });
  const REST = 3.5;
  piece.group.position.set(cx, cy, REST);
  world.add(piece.group);
  const frame = () => stage.place(30, 18, stage.fit(6.5), [cx + 0.5, cy - 0.5, 1.5]);
  frame();
  stage.onResize = frame;
  ctx.panelEl.replaceChildren();
  ctx.hintEl.textContent = `Get the ${ctx.itemName} through the doorway. It's the shape it was loaded in. Par ${door.par}.`;

  let attempts = 0;
  let resolveDone!: (r: StageResult) => void;
  const done = new Promise<StageResult>((r) => { resolveDone = r; });
  const Q = turnQueue(ctx.panelEl, { commitLabel: 'Carry it ↵', onHover: (a, d) => stage.highlightAxis(a, d), onCommit: commit });
  const P = panel(ctx.panelEl);

  function snapPos(ox: number, oy: number, z: number) {
    const rotated = applyMoves(normalize(ctx.item), moves);
    const min = [0, 1, 2].map((i) => Math.min(...rotated.map((c) => c[i])));
    return piece.c0.clone().applyQuaternion(piece.group.quaternion).sub(new THREE.Vector3(min[0], min[1], min[2])).add(new THREE.Vector3(ox, oy, z));
  }

  async function commit(queued: Move[]) {
    Q.enabled = false;
    attempts++;
    for (const m of queued) {
      stage.highlightAxis(m.axis, m.dir);
      ctx.sfx.turn();
      await stage.spin(piece.group, m, 440);
      moves.push(m);
      cells = normalize(cells.map((c) => rotateCell(c, m)));
      await sleep(80);
    }
    stage.highlightAxis(null);
    const ok = passes(cells, door.wall);
    const { ox, oy } = placeSil(cells);
    const from = piece.group.position.clone();
    const front = snapPos(ox, oy, 1.2);
    await stage.tween(420, (t) => piece.group.position.lerpVectors(from, front, easeIn(t)));
    ctx.onAttempt?.(ok, attempts);
    if (ok) {
      const through = snapPos(ox, oy, -3.5);
      await stage.tween(500, (t) => piece.group.position.lerpVectors(front, through, easeOut(t)));
      ctx.sfx.fit();
      void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_OK);
      P.message(attempts === 1 ? 'Through, first go.' : 'Through.', 'ok');
      await sleep(700);
      finish({ firstTry: attempts === 1, attempts, failed: false, item: cells });
      return;
    }
    ctx.sfx.miss();
    void stage.shake();
    void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_BAD);
    const back = front.clone().setZ(REST);
    await stage.tween(380, (t) => piece.group.position.lerpVectors(front, back, easeOut(t)));
    if (attempts >= MAX_ATTEMPTS) {
      P.message(`Wedged in the frame. The ${ctx.itemName} isn't going through today.`, 'bad');
      await sleep(900);
      finish({ firstTry: false, attempts, failed: true, item: cells });
      return;
    }
    P.message(`Bonk. It keeps this orientation — plan from here. ${MAX_ATTEMPTS - attempts} ${MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left.`, 'bad');
    Q.reset();
    Q.enabled = true;
  }

  function finish(r: Omit<StageResult, 'cleanup'>) {
    Q.dispose();
    resolveDone({ ...r, cleanup: () => stage.dispose() });
  }
  return done;
}

// ---------------------------------------------------------------- Corner: the van turns

export async function cornerStage(ctx: StageCtx): Promise<StageResult> {
  ctx.stageEl.replaceChildren();
  const stage = new SketchStage(ctx.stageEl, { gizmo: true, ground: null });
  const corner = makeCorner(ctx.item, ctx.others ?? [], ctx.rng, `the ${ctx.itemName}`, ctx.itemColor);
  dev({ corner });
  const n = corner.n, c = (n - 1) / 2;
  const world = new THREE.Group();
  stage.scene.add(world);
  world.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(n, n, n)), new THREE.LineBasicMaterial({ color: 0x8a97b3 })));
  const grid = new THREE.GridHelper(n, n, 0x3a4052, 0x2a2e3a);
  grid.position.y = -c - 0.5;
  world.add(grid);
  world.add(voxelMesh(corner.fixed.map(([x, y, z]) => [x - c, y - c, z - c] as Cell), { color: 0x5b6478 }).group);
  const bodies = corner.bodies.map((b) => {
    const g = cubeGroup(b.cells.map(([x, y, z]) => [x - c, y - c, z - c] as Cell), { color: b.color });
    world.add(g.group);
    return g;
  });
  const socket = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.18, depthWrite: false }));
  socket.position.set(corner.socket[0] - c, corner.socket[1] - c, corner.socket[2] - c);
  socket.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xf5a524 })));
  world.add(socket);
  const frame = () => stage.place(35, 24, stage.fit((n * Math.sqrt(3)) / 2 + 0.4), [0, -0.3, 0]);
  frame();
  stage.onResize = frame;
  stage.highlightAxis(corner.move.axis, corner.move.dir);
  ctx.panelEl.replaceChildren();
  ctx.hintEl.textContent = `The van takes a corner — it turns ${moveLabel(corner.move)} (see gizmo). Which item ends up in the marked spot?`;

  let picked = -1;
  let resolveDone!: (r: StageResult) => void;
  const done = new Promise<StageResult>((r) => { resolveDone = r; });
  const names = corner.bodies.map((b, i) => h('button.choice', { onclick: () => pick(i) }, `${i + 1}. ${b.name}`));
  ctx.hintEl.textContent = `The van takes a corner — it turns ${moveLabel(corner.move)} (see gizmo). Which item ends up in the marked spot?`;
  ctx.panelEl.append(h('div.choices', {}, ...names));
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Take the corner ↵') as HTMLButtonElement;
  ctx.panelEl.append(h('div#actions', {}, commitB));
  const P = panel(ctx.panelEl);
  const allCubes = bodies.flatMap((b) => b.cubes);

  function pick(i: number) {
    if (commitB.disabled) return;
    picked = i;
    names.forEach((b, j) => b.classList.toggle('picked', j === i));
    bodies.forEach((b, j) => { b.mats.base.emissive.set(j === i ? 0xffffff : 0); b.mats.base.emissiveIntensity = 0.3; });
    P.message(`${corner.bodies[i].name} picked.`);
  }
  const onClick = (ev: MouseEvent) => {
    const hit = stage.pickAt(ev, allCubes)[0];
    if (!hit) return;
    pick(bodies.findIndex((b) => b.cubes.includes(hit.object as THREE.Mesh)));
  };
  stage.canvas.addEventListener('click', onClick);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !commitB.disabled) commit();
    else if (/^[1-4]$/.test(e.key) && Number(e.key) <= bodies.length) pick(Number(e.key) - 1);
  };
  window.addEventListener('keydown', onKey);

  async function commit() {
    if (picked < 0) { P.message('Pick an item first.', 'bad'); return; }
    commitB.disabled = true;
    const ok = picked === corner.answer;
    await stage.spin(world, corner.move, 900);
    await sleep(150);
    const from = bodies.map((b) => b.group.position.clone());
    const to = corner.final.map((cells, i) => {
      // Body groups are positioned at their bounding-box min; move the group so the cells land on `cells`.
      const min0 = [0, 1, 2].map((k) => Math.min(...corner.bodies[i].cells.map((cc) => cc[k])));
      const min1 = [0, 1, 2].map((k) => Math.min(...cells.map((cc) => cc[k])));
      return new THREE.Vector3(min1[0] - min0[0], min1[1] - min0[1], min1[2] - min0[2]);
    });
    await stage.tween(700, (t) => bodies.forEach((b, i) => b.group.position.lerpVectors(from[i], to[i], easeIn(t))));
    ctx.onAttempt?.(ok, 1);
    ctx.sfx[ok ? 'fit' : 'miss']();
    void pulseMats(stage.ticker, [bodies[corner.answer].mats.base], ok ? COLOR_OK : COLOR_BAD);
    stage.highlightAxis(null);
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    P.message(ok ? `${cap(corner.bodies[corner.answer].name)} slides into the spot. Called it.` : `${cap(corner.bodies[corner.answer].name)} slides into the spot — not ${corner.bodies[picked].name}.`, ok ? 'ok' : 'bad');
    await resultPause(P, 'Continue');
    window.removeEventListener('keydown', onKey);
    stage.canvas.removeEventListener('click', onClick);
    resolveDone({ firstTry: ok, attempts: 1, failed: false, item: ctx.item, cleanup: () => stage.dispose() });
  }
  return done;
}

export const STAGES = { load: loadStage, doorway: doorwayStage, corner: cornerStage } as const;
export type StageType = keyof typeof STAGES;
