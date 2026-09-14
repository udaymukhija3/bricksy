// Gravity Rooms: a room with loose cubes. The room is about to turn. Which cube ends up in the socket?
import * as THREE from 'three';
import { rotateCell, type Cell, type Move, MOVES, moveLabel } from '../polycube';
import { SketchStage, cubeGroup, voxelMesh, panel, h, mulberry32, pick, sleep, easeIn, cellKey, COLOR_OK, COLOR_BAD, pulseMats, cubeGeo, edgeGeo } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';
import { Run } from '../run';

const COLORS = [0xe5484d, 0x46a758, 0x3e8ff5, 0xf5a524, 0xb56be0, 0x2ec4b6];

interface Room { n: number; fixed: Cell[]; loose: Cell[]; move: Move; final: Cell[]; answer: number; socket: Cell }

/** Where each loose cube settles when gravity points along g (room coordinates). */
function settle(n: number, fixed: Cell[], loose: Cell[], g: Cell): Cell[] {
  const solid = new Set(fixed.map(cellKey));
  const inside = (c: Cell) => c.every((v) => v >= 0 && v < n);
  const order = loose.map((c, i) => ({ i, depth: c[0] * g[0] + c[1] * g[1] + c[2] * g[2] })).sort((a, b) => b.depth - a.depth);
  const out: Cell[] = [...loose];
  for (const { i } of order) {
    let c = loose[i];
    for (;;) {
      const next: Cell = [c[0] + g[0], c[1] + g[1], c[2] + g[2]];
      if (!inside(next) || solid.has(cellKey(next))) break;
      c = next;
    }
    out[i] = c;
    solid.add(cellKey(c));
  }
  return out;
}

function makeRoom(n: number, looseN: number, fixedN: number, rng: () => number): Room {
  for (let tries = 0; tries < 500; tries++) {
    const taken = new Set<string>();
    const rnd = (): Cell => [Math.floor(rng() * n), Math.floor(rng() * n), Math.floor(rng() * n)];
    const fixed: Cell[] = [];
    while (fixed.length < fixedN) { const c = rnd(); if (!taken.has(cellKey(c))) { taken.add(cellKey(c)); fixed.push(c); } }
    let loose: Cell[] = [];
    while (loose.length < looseN) { const c = rnd(); if (!taken.has(cellKey(c))) { taken.add(cellKey(c)); loose.push(c); } }
    loose = settle(n, fixed, loose, [0, -1, 0]); // start at rest under normal gravity
    const move = pick(MOVES, rng);
    // World gravity −Y expressed in room coordinates after the room turns by `move`.
    const inv: Move = { axis: move.axis, dir: move.dir > 0 ? -1 : 1 };
    const g = rotateCell([0, -1, 0], inv);
    const final = settle(n, fixed, loose, g);
    const moved = final.filter((c, i) => cellKey(c) !== cellKey(loose[i])).length;
    if (moved < 2) continue;
    const answer = Math.floor(rng() * looseN);
    if (cellKey(final[answer]) === cellKey(loose[answer])) continue;
    // Socket must not be where any cube already sits.
    if (loose.some((c) => cellKey(c) === cellKey(final[answer]))) continue;
    return { n, fixed, loose, move, final, answer, socket: final[answer] };
  }
  throw new Error('no room');
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true, ground: null });
  const run = new Run({ id: 'tilt', name: 'Tilt', icon: '🎲', dailyRounds: 8 }, hudEl, stageEl);
  /** Difficulty by level: more loose cubes, more ledges, then a bigger room. */
  const setup = (level: number) => ({ n: level >= 8 ? 5 : 4, looseN: Math.min(5, 3 + Math.floor(level / 3)), fixedN: (level >= 8 ? 7 : 4) + Math.floor(level / 4) });
  let room!: Room;
  const world = new THREE.Group();
  stage.scene.add(world);
  let loose!: ReturnType<typeof cubeGroup>;
  let picked = -1;
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Turn the room ↵') as HTMLButtonElement;
  panelEl.append(h('p', { style: { margin: 0, color: 'var(--muted)' } }, 'Click the cube you think lands in the orange socket after the turn.'), h('div#actions', {}, commitB));
  const P = panel(panelEl);
  const off = () => (room.n - 1) / 2;
  const frame = () => stage.place(35, 24, stage.fit((room.n * Math.sqrt(3)) / 2 + 0.4), [0, -0.3, 0]);
  stage.onResize = frame;

  function newRoom() {
    const d = setup(run.level);
    room = makeRoom(d.n, d.looseN, d.fixedN, mulberry32(run.nextSeed()));
    build();
  }

  function build() {
    const n = room.n;
    world.clear();
    world.quaternion.identity();
    const c = off();
    const walls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(n, n, n)), new THREE.LineBasicMaterial({ color: 0x8a97b3 }));
    world.add(walls);
    // Faint floor grid so "down" is legible before the turn.
    const grid = new THREE.GridHelper(n, n, 0x3a4052, 0x2a2e3a);
    grid.position.y = -c - 0.5;
    world.add(grid);
    const fixed = voxelMesh(room.fixed.map(([x, y, z]) => [x - c, y - c, z - c] as Cell), { color: 0x5b6478 });
    world.add(fixed.group);
    loose = cubeGroup(room.loose.map(([x, y, z]) => [x - c, y - c, z - c] as Cell), { colors: COLORS });
    world.add(loose.group);
    const socket = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.18, depthWrite: false }));
    socket.position.set(room.socket[0] - c, room.socket[1] - c, room.socket[2] - c);
    socket.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xf5a524 })));
    world.add(socket);
    frame();
    picked = -1;
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `The room will turn ${moveLabel(room.move)} (see gizmo). ${room.loose.length} loose cubes.`;
    stage.highlightAxis(room.move.axis, room.move.dir);
    log.push('present', { sketch: 'gravity', room: { n: room.n, fixed: room.fixed, loose: room.loose, move: moveLabel(room.move), socket: room.socket } });
  }

  function onClick(ev: MouseEvent) {
    if (commitB.disabled) return;
    const hit = stage.pickAt(ev, loose.cubes)[0];
    if (!hit) return;
    picked = hit.object.userData.index as number;
    loose.cubes.forEach((cube, i) => { (cube.material as THREE.MeshStandardMaterial).emissive.set(i === picked ? 0xffffff : 0x000000); (cube.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35; });
    P.message(`Cube ${picked + 1} picked.`);
  }
  stage.canvas.addEventListener('click', onClick);

  async function commit() {
    if (picked < 0) { P.message('Pick a cube first.', 'bad'); return; }
    commitB.disabled = true;
    const ok = picked === room.answer;
    log.push('result', { sketch: 'gravity', picked, answer: room.answer, ok });
    await stage.spin(world, room.move, 900);
    await sleep(150);
    // Cubes fall in room coordinates; the room group's rotation carries them into world space.
    const c = off();
    const from = loose.cubes.map((m) => m.position.clone());
    const to = room.final.map(([x, y, z]) => new THREE.Vector3(x - c, y - c, z - c));
    await stage.tween(700, (t) => loose.cubes.forEach((m, i) => m.position.lerpVectors(from[i], to[i], easeIn(t))));
    const mat = loose.cubes[room.answer].material as THREE.MeshStandardMaterial;
    void pulseMats(stage.ticker, [mat], ok ? COLOR_OK : COLOR_BAD);
    stage.highlightAxis(null);
    ok ? run.hit() : run.miss();
    P.message(ok ? `Cube ${picked + 1} lands in the socket.` : `Cube ${room.answer + 1} lands in the socket, not ${picked + 1}.`, ok ? 'ok' : 'bad');
    if (run.over) run.showOver(newRoom);
    else P.post([{ label: 'Next ↵', primary: true, onClick: newRoom }]);
  }

  run.onModeChange = newRoom;
  newRoom();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (/^[1-6]$/.test(e.key) && !commitB.disabled && Number(e.key) <= loose.cubes.length) { picked = Number(e.key) - 1; loose.cubes.forEach((cube, i) => { const m = cube.material as THREE.MeshStandardMaterial; m.emissive.set(i === picked ? 0xffffff : 0); m.emissiveIntensity = 0.35; }); P.message(`Cube ${picked + 1} picked.`); }
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.canvas.removeEventListener('click', onClick); stage.dispose(); };
}

export const gravity: SketchDef = {
  id: 'tilt', title: 'Tilt', status: 'playable', skill: 'predicting motion under a rotated frame', icon: '🎲',
  tagline: 'The room is about to turn. Gravity stays down — the room doesn\'t. Pick the cube that ends in the socket, then turn it.',
  mount,
};
