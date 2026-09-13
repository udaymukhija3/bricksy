// Shape Smuggler: get one piece through a sequence of openings with the fewest turns.
// Orientation carries over from wall to wall, so each wall is planned from where the last left you.
import * as THREE from 'three';
import { applyMoves, bboxMin, extents, isPlanar, normalize, orientations, randomPolycube, rotateCell, shapeKey, type Cell, type Move, MOVES, moveLabel } from '../polycube';
import { SketchStage, cubeGroup, voxelMesh, turnQueue, panel, hud, mulberry32, pick, sleep, pulseMats, easeIn, easeOut, COLOR_OK, COLOR_BAD } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';

const PLATE = 8, MARGIN = 2, GAP = 7;

const silhouette = (cells: Cell[]) => new Set(cells.map(([x, y]) => `${x},${y}`));

/** Where a normalised silhouette sits in the plate: centred, rounded to the lattice. */
function placeSil(cells: Cell[]) {
  const n = normalize(cells);
  const [w, hgt] = extents(n);
  const ox = MARGIN + Math.round((PLATE - 2 * MARGIN - 1 - w) / 2);
  const oy = MARGIN + Math.round((PLATE - 2 * MARGIN - 1 - hgt) / 2);
  return { ox, oy, keys: new Set(n.map(([x, y]) => `${x + ox},${y + oy}`)) };
}

interface Wall { opening: Set<string>; plate: Cell[]; z: number }

function makeRun(cubes: number, walls: number, rng: () => number) {
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
      const plate: Cell[] = [];
      for (let x = 0; x < PLATE; x++) for (let y = 0; y < PLATE; y++) if (!opening.has(`${x},${y}`)) plate.push([x, y, 0]);
      list.push({ opening, plate, z: -GAP * (i + 1) });
      prevSil = silhouette(t.cells);
    }
    if (list.length !== walls) continue;
    return { shape, start, walls: list, par: par(start, list) };
  }
  throw new Error('no run');
}

const passes = (cells: Cell[], wall: Wall) => [...placeSil(cells).keys].every((k) => wall.opening.has(k));

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

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true });
  const H = hud(hudEl, ['wall', 'turns', 'par', 'runs']);
  let cubes = 5, wallsN = 2, runs = 0;
  let run = makeRun(cubes, wallsN, mulberry32(Date.now()));
  let cells: Cell[] = [];
  let moves: Move[] = [];
  let wallIdx = 0;
  let turns = 0;
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
    H.set('wall', `1/${run.walls.length}`);
    H.set('turns', 0);
    H.set('par', run.par);
    H.set('runs', runs);
    hintEl.textContent = `${run.walls.length} walls, ${cubes} cubes. Par ${run.par}.`;
    Q.reset();
    Q.enabled = true;
    P.message('');
    P.clearPost();
    log.push('present', { sketch: 'smuggler', start: run.start, walls: run.walls.map((w) => [...w.opening]), par: run.par });
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
    H.set('turns', turns);

    const wall = run.walls[wallIdx];
    const ok = passes(cells, wall);
    const { ox, oy } = placeSil(cells);
    const from = piece.group.position.clone();
    const front = snapPos(ox, oy, wall.z + 1.2);
    // Slide to the wall (snapping onto the lattice on the way).
    await stage.tween(420, (t) => piece.group.position.lerpVectors(from, front, easeIn(t)));
    log.push('result', { sketch: 'smuggler', wall: wallIdx, ok, cells });
    if (ok) {
      const through = snapPos(ox, oy, restZ(wallIdx + 1));
      await stage.tween(500, (t) => piece.group.position.lerpVectors(front, through, easeOut(t)));
      void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_OK);
      fadeWall(wallMeshes[wallIdx]);
      wallIdx++;
      if (wallIdx >= run.walls.length) {
        const verdict = turns === run.par ? 'Par. Clean.' : turns < run.par ? 'Under par?! (par is a lower bound — please export the log)' : `${turns - run.par} over par.`;
        P.message(`Through all ${run.walls.length} walls in ${turns} turns. ${verdict}`, 'ok');
        runs++;
        if (turns <= run.par + 1) { if (wallsN < 4) wallsN++; else cubes = Math.min(6, cubes + 1); }
        P.post([{ label: 'Next run ↵', primary: true, onClick: () => { run = makeRun(cubes, wallsN, mulberry32(Date.now())); build(); } }]);
        return;
      }
      H.set('wall', `${wallIdx + 1}/${run.walls.length}`);
      await look(wallIdx, true);
      P.message('Through. Next wall.', 'ok');
    } else {
      void stage.shake();
      void pulseMats(stage.ticker, [piece.mats.base, piece.mats.marker], COLOR_BAD);
      const back = front.clone().setZ(restZ(wallIdx));
      await stage.tween(380, (t) => piece.group.position.lerpVectors(front, back, easeOut(t)));
      P.message(`Bonk. The silhouette doesn't fit the opening. It keeps this orientation — plan from here.`, 'bad');
    }
    Q.reset();
    Q.enabled = true;
  }

  build();
  stage.onResize = () => look(Math.min(wallIdx, run.walls.length - 1));
  if (import.meta.env.DEV) Object.assign(window, { lab: { get run() { return run; }, get cells() { return cells; }, passes, MOVES, rotateCell, normalize } });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !Q.enabled) (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); Q.dispose(); stage.dispose(); };
}

export const smuggler: SketchDef = {
  id: 'smuggler', title: 'Shape Smuggler', status: 'playable', skill: 'rotation planning',
  tagline: 'One piece, several walls, each with a different opening. Fewest turns wins — and every turn you make carries into the next wall.',
  mount,
};
