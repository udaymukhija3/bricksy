// Shape Smuggler: get one piece through a sequence of openings with the fewest turns.
// Orientation carries over from wall to wall, so each wall is planned from where the last left you.
import * as THREE from 'three';
import { applyMoves, bboxMin, isPlanar, normalize, orientations, randomPolycube, rotateCell, shapeKey, type Cell, type Move, MOVES, moveLabel } from '../polycube.ts';
import { SketchStage, cubeGroup, voxelMesh, turnQueue, panel, mulberry32, pick, sleep, pulseMats, easeIn, easeOut, COLOR_OK, COLOR_BAD, AXIS_VEC } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

import { PLATE, GAP, silhouette, placeSil, passes, plateFor, type Wall } from '../smuggle-model.ts';

export function makeRun(cubes: number, walls: number, rng: () => number) {
  for (let tries = 0; tries < 200; tries++) {
    const shape = randomPolycube(cubes, rng);
    if (cubes >= 5 && isPlanar(shape)) continue; // no non-planar tetracube is asymmetric
    const all = orientations(shape);
    if (all.length !== 24) continue;
    const start = pick(all, rng).cells;
    const list: Wall[] = [];
    let prevSil = silhouette(start);
    for (let i = 0; i < walls; i++) {
      // A wall the current silhouette cannot pass, so at least one turn is needed.
      const cands = all.filter((o) => {
        const s = placeSil(o.cells).keys;
        const cur = placeSil([...prevSil].map((k) => k.split(',').map(Number) as unknown as Cell).map(([x, y]) => [x, y, 0] as Cell)).keys;
        return ![...cur].every((k) => s.has(k));
      });
      if (!cands.length) break;
      const t = pick(cands, rng);
      const opening = placeSil(t.cells).keys;
      list.push({ opening, plate: plateFor(opening), z: -GAP * (i + 1) });
      prevSil = silhouette(t.cells);
    }
    if (list.length !== walls) continue;
    return { shape, start, walls: list, par: par(start, list) };
  }
  throw new Error('no run');
}

/** Difficulty by level: five cubes, then six; a fourth wall from level 6. */
export const cubesFor = (level: number) => (level < 3 ? 5 : 6);
export const wallsFor = (level: number) => (level < 6 ? 3 : 4);

/** Fewest turns to pass every wall: 0-1 BFS over (orientation, walls passed). */
function par(start: Cell[], walls: Wall[]) {
  const dist = new Map<string, number>();
  const dq: { cells: Cell[]; passed: number; cost: number }[] = [{ cells: normalize(start), passed: 0, cost: 0 }];
  dist.set(`${shapeKey(start)}|0`, 0);
  while (dq.length) {
    dq.sort((a, b) => a.cost - b.cost);
    const s = dq.shift()!;
    if (s.passed === walls.length) return s.cost;
    const k = `${shapeKey(s.cells)}|${s.passed}`;
    if (dist.get(k)! < s.cost) continue;
    const push = (cells: Cell[], passed: number, cost: number) => {
      const kk = `${shapeKey(cells)}|${passed}`;
      if ((dist.get(kk) ?? Infinity) > cost) { dist.set(kk, cost); dq.push({ cells, passed, cost }); }
    };
    if (passes(s.cells, walls[s.passed])) push(s.cells, s.passed + 1, s.cost);
    for (const m of MOVES) push(normalize(s.cells.map((c) => rotateCell(c, m))), s.passed, s.cost + 1);
  }
  return Infinity;
}

/** Fewest turns from this orientation through one wall: BFS over orientations. */
export function fitFrom(cells: Cell[], wall: Wall): Move[] {
  const start = normalize(cells);
  const seen = new Map<string, Move[]>([[shapeKey(start), []]]);
  const q: Cell[][] = [start];
  for (let i = 0; i < q.length; i++) {
    const c = q[i], path = seen.get(shapeKey(c))!;
    if (passes(c, wall)) return path;
    for (const m of MOVES) {
      const n = normalize(c.map((x) => rotateCell(x, m)));
      if (!seen.has(shapeKey(n))) { seen.set(shapeKey(n), [...path, m]); q.push(n); }
    }
  }
  return [];
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true });
  // Each wall is a round: a hit if you pass it on the first send, a miss on the first bonk.
  const game = new Run({ id: 'smuggle', name: 'Smuggle', icon: '🧱', dailyRounds: 6 }, hudEl, stageEl);
  let run!: ReturnType<typeof makeRun>;
  let cells: Cell[] = [];
  let moves: Move[] = [];
  let wallIdx = 0;
  let turns = 0;
  let wallMissed = false;
  // A run spans several rounds, so a daily reload must rebuild *this* run, not draw a new one from
  // the current round's seed: the run's start round and every turn made so far are kept for today.
  let startRound = 0;
  let runLevel = 0; // the level this run was drawn at (a restored run keeps it, whatever the round now is)
  interface SavedRun { startRound: number; moves: Move[]; wallIdx: number; turns: number; wallMissed: boolean }
  const RUN_KEY = () => `bricksy.smuggle.run.${game.date}`;
  const saveRun = () => { if (game.mode === 'daily') try { localStorage.setItem(RUN_KEY(), JSON.stringify({ startRound, moves, wallIdx, turns, wallMissed } satisfies SavedRun)); } catch { /* quota or private mode */ } };
  const clearRun = () => { try { localStorage.removeItem(RUN_KEY()); } catch { /* ignore */ } };
  const loadRun = (): SavedRun | null => {
    if (game.mode !== 'daily') return null;
    try {
      const v = JSON.parse(localStorage.getItem(RUN_KEY()) ?? 'null') as SavedRun | null;
      // Only a state that agrees with the rounds already recorded: walls passed, plus one if the current wall was bonked.
      return v && Array.isArray(v.moves) && v.startRound + v.wallIdx + (v.wallMissed ? 1 : 0) === game.round && game.round < game.dailyRounds ? v : null;
    } catch { return null; }
  };
  let piece!: ReturnType<typeof cubeGroup>;
  let wallMeshes: ReturnType<typeof voxelMesh>[] = [];
  const world = new THREE.Group();
  stage.scene.add(world);
  const cx = (PLATE - 1) / 2, cy = (PLATE - 1) / 2;

  const Q = turnQueue(panelEl, { commitLabel: 'Send it ↵', onHover: (a, d) => stage.highlightAxis(a, d), onCommit: commit });
  const P = panel(panelEl);

  function restZ(i: number) { return i === 0 ? 3.5 : run.walls[i - 1].z - GAP / 2; }

  function build() {
    world.clear();
    wallMeshes = run.walls.map((w) => {
      const m = voxelMesh(w.plate, { color: 0x7d8aa6 });
      m.group.position.z = w.z;
      world.add(m.group);
      return m;
    });
    cells = normalize(run.start);
    moves = [];
    wallIdx = 0;
    turns = 0;
    piece = cubeGroup(run.start, { center: true, marker: 0 });
    piece.group.position.set(cx, cy, restZ(0));
    world.add(piece.group);
    look(0);
    wallMissed = false;
    status();
    Q.reset();
    Q.enabled = true;
    P.message('');
    P.clearPost();
    log.push('present', { sketch: 'smuggler', mode: game.mode, level: runLevel, start: run.start, walls: run.walls.map((w) => [...w.opening]), par: run.par });
  }

  function status() {
    hintEl.textContent = `Wall ${Math.min(wallIdx + 1, run.walls.length)}/${run.walls.length} · ${turns} turn${turns === 1 ? '' : 's'} used · par ${run.par} · ${run.shape.length} cubes.`;
  }

  function newRun() {
    const saved = loadRun();
    if (saved) { restore(saved); return; }
    startRound = game.round;
    runLevel = game.level;
    run = makeRun(cubesFor(game.level), wallsFor(game.level), mulberry32(game.nextSeed()));
    build();
    saveRun();
  }

  /** Rebuild today's run from its start round and replay the turns made so far, without animation. */
  function restore(saved: SavedRun) {
    startRound = saved.startRound;
    runLevel = saved.startRound;
    run = makeRun(cubesFor(saved.startRound), wallsFor(saved.startRound), mulberry32(game.seedFor(saved.startRound)));
    build();
    for (const m of saved.moves) {
      piece.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[m.axis], (m.dir * Math.PI) / 2));
      moves.push(m);
      cells = normalize(cells.map((c) => rotateCell(c, m)));
    }
    wallIdx = Math.min(saved.wallIdx, run.walls.length - 1);
    turns = saved.turns;
    wallMissed = saved.wallMissed;
    for (let i = 0; i < wallIdx; i++) fadeWall(wallMeshes[i]);
    if (moves.length) { const { ox, oy } = placeSil(cells); piece.group.position.copy(snapPos(ox, oy, restZ(wallIdx))); }
    look(wallIdx);
    status();
    if (wallMissed) { P.message('Bonked this wall before the reload — it keeps this orientation; plan from here.', 'bad'); offerFit(); }
    else if (wallIdx) P.message(`Back at wall ${wallIdx + 1}.`);
  }

  function look(i: number, animate = false) {
    const z = i < run.walls.length ? (restZ(i) + run.walls[i].z) / 2 : run.walls[run.walls.length - 1].z - 3;
    const target = new THREE.Vector3(cx + 0.5, cy - 0.5, z);
    const dist = stage.fit(7);
    if (!animate) { stage.place(30, 18, dist, target); return; }
    const from = stage.lookAt.clone();
    return stage.tween(600, (t) => stage.place(30, 18, dist, from.clone().lerp(target, easeOut(t))));
  }

  /** A passed wall turns to glass so the piece stays visible behind it. */
  function fadeWall(w: ReturnType<typeof voxelMesh>) {
    w.mat.transparent = true;
    w.mat.depthWrite = false;
    w.mesh.castShadow = false;
    const line = (w.group.children[1] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    void stage.tween(500, (t) => { w.mat.opacity = 1 - 0.88 * t; line.opacity = 0.55 - 0.35 * t; });
  }

  /** Group position that puts the rotated cells on the lattice at (ox, oy, z). */
  function snapPos(ox: number, oy: number, z: number) {
    const rotated = applyMoves(run.start, moves);
    const min = bboxMin(rotated);
    return piece.c0.clone().applyQuaternion(piece.group.quaternion).sub(new THREE.Vector3(min[0], min[1], min[2])).add(new THREE.Vector3(ox, oy, z));
  }

  async function commit(queued: Move[]) {
    Q.enabled = false;
    P.clearPost();
    log.push('commit', { sketch: 'smuggler', wall: wallIdx, moves: queued.map(moveLabel), turnsSoFar: turns });
    for (const m of queued) {
      stage.highlightAxis(m.axis, m.dir);
      await stage.spin(piece.group, m);
      moves.push(m);
      cells = normalize(cells.map((c) => rotateCell(c, m)));
      await sleep(90);
    }
    stage.highlightAxis(null);
    turns += queued.length;
    status();

    const wall = run.walls[wallIdx];
    const ok = passes(cells, wall);
    const { ox, oy } = placeSil(cells);
    const from = piece.group.position.clone();
    const front = snapPos(ox, oy, wall.z + 1.2);
    // Slide to the wall (snapping onto the lattice on the way).
    await stage.tween(420, (t) => piece.group.position.lerpVectors(from, front, easeIn(t)));
    log.push('result', { sketch: 'smuggler', wall: wallIdx, ok, firstTry: !wallMissed, cells });
    if (ok) {
      const through = snapPos(ox, oy, restZ(wallIdx + 1));
      await stage.tween(500, (t) => piece.group.position.lerpVectors(front, through, easeOut(t)));
      void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_OK);
      fadeWall(wallMeshes[wallIdx]);
      if (!wallMissed) game.hit();
      wallMissed = false;
      wallIdx++;
      if (game.over || wallIdx >= run.walls.length) clearRun(); else saveRun();
      if (game.over) { status(); game.showOver(newRun); return; }
      if (wallIdx >= run.walls.length) {
        const verdict = turns === run.par ? 'Par. Clean.' : turns < run.par ? 'Under par?!' : `${turns - run.par} over par.`;
        P.message(`Through all ${run.walls.length} walls in ${turns} turns. ${verdict}`, 'ok');
        status();
        P.post([{ label: 'Next run ↵', primary: true, onClick: newRun }]);
        return;
      }
      status();
      await look(wallIdx, true);
      P.message('Through. Next wall.', 'ok');
    } else {
      void stage.shake();
      void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_BAD);
      const back = front.clone().setZ(restZ(wallIdx));
      await stage.tween(380, (t) => piece.group.position.lerpVectors(front, back, easeOut(t)));
      if (!wallMissed) { wallMissed = true; game.miss(); }
      if (game.over) clearRun(); else saveRun();
      if (game.over) { game.showOver(newRun); return; }
      P.message(`Bonk. The silhouette doesn't fit the opening. It keeps this orientation — plan from here.`, 'bad');
      offerFit();
    }
    Q.reset();
    Q.enabled = true;
  }

  /** Never stuck: after a bonk, reality can show the fewest turns that pass from here (the miss stands). */
  function offerFit() {
    P.post([{ label: 'Show a fit', onClick: () => { const seq = fitFrom(cells, run.walls[wallIdx]); log.push('reveal', { sketch: 'smuggler', wall: wallIdx, moves: seq.map(moveLabel) }); Q.render(seq, 'solution', 'A FIT'); void commit(seq); } }]);
  }

  game.begin(newRun);
  stage.onResize = () => look(Math.min(wallIdx, run.walls.length - 1));
  if (import.meta.env.DEV) Object.assign(window, { lab: { get run() { return run; }, get cells() { return cells; }, passes, MOVES, rotateCell, normalize } });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !Q.enabled) (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); Q.dispose(); stage.dispose(); };
}

export const smuggler: SketchDef = {
  id: 'smuggle', title: 'Smuggle', status: 'playable', skill: 'rotation planning', icon: '🧱',
  tagline: 'One piece, three walls, each with a different opening. Every turn you make carries into the next wall.',
  about: 'Rotation planning: three walls, one piece, and your orientation carries over from wall to wall, so each opening is planned from where the last one left you. Par is computed by search, so you can see how far from the shortest route you were.',
  controls: 'x y z turn +90°, shift+key −90°, backspace undo, Enter commits the turns for the next wall.',
  mount,
};
