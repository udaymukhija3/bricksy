// Gravity Rooms: a room with loose cubes. The room is about to turn. Which cube ends up in the socket?
import * as THREE from 'three';
import { rotateCell, type Cell, type Move, MOVES, moveLabel } from '../polycube.ts';
import { SketchStage, cubeGroup, voxelMesh, panel, h, mulberry32, pick, sleep, easeIn, cellKey, COLOR_OK, COLOR_BAD, pulseMats, cubeGeo, edgeGeo } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';

const COLORS = [0xe5484d, 0x46a758, 0x3e8ff5, 0xf5a524, 0xb56be0, 0x2ec4b6];

/** `answers[i]` is the loose cube that lands in `sockets[i]`; one socket, two from level 10. */
interface Room { n: number; fixed: Cell[]; loose: Cell[]; move: Move; final: Cell[]; answers: number[]; sockets: Cell[] }
const SOCKET_COLORS = [0xf5a524, 0xb56be0];

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

export function makeRoom(n: number, looseN: number, fixedN: number, rng: () => number, socketsN = 1): Room {
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
    // Sockets: distinct cubes that move, landing where no cube sits now.
    const movers = loose.map((_, i) => i).filter((i) => cellKey(final[i]) !== cellKey(loose[i]) && !loose.some((c) => cellKey(c) === cellKey(final[i])));
    if (movers.length < socketsN) continue;
    const answers: number[] = [];
    while (answers.length < socketsN) { const a = pick(movers, rng); if (!answers.includes(a)) answers.push(a); }
    return { n, fixed, loose, move, final, answers, sockets: answers.map((a) => final[a]) };
  }
  throw new Error('no room');
}

/** Difficulty by level: more loose cubes, more ledges, then a bigger room. */
export const setup = (level: number) => ({ n: level >= 14 ? 6 : level >= 8 ? 5 : 4, looseN: Math.min(level >= 14 ? 6 : 5, 3 + Math.floor(level / 3)), fixedN: (level >= 14 ? 10 : level >= 8 ? 7 : 4) + Math.floor(level / 4), sockets: level >= 10 ? 2 : 1 });

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true, ground: null });
  const run = new Run({ id: 'tilt', name: 'Tilt', icon: '🎲', dailyRounds: 8 }, hudEl, stageEl);
  let room!: Room;
  const world = new THREE.Group();
  stage.scene.add(world);
  let loose!: ReturnType<typeof cubeGroup>;
  let picks: number[] = [];
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Turn the room ↵') as HTMLButtonElement;
  const instr = h('p', { style: { margin: 0, color: 'var(--muted)' } }, 'Click the cube you think lands in the orange socket after the turn.');
  panelEl.append(instr, h('div#actions', {}, commitB));
  const P = panel(panelEl);
  const off = () => (room.n - 1) / 2;
  const frame = () => stage.place(35, 24, stage.fit((room.n * Math.sqrt(3)) / 2 + 0.4), [0, -0.3, 0]);
  stage.onResize = frame;

  function newRoom() {
    const d = setup(run.level);
    room = makeRoom(d.n, d.looseN, d.fixedN, mulberry32(run.nextSeed()), d.sockets);
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
    room.sockets.forEach((sc, i) => {
      const socket = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: SOCKET_COLORS[i], transparent: true, opacity: 0.18, depthWrite: false }));
      socket.position.set(sc[0] - c, sc[1] - c, sc[2] - c);
      socket.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: SOCKET_COLORS[i] })));
      world.add(socket);
    });
    frame();
    picks = [];
    instr.textContent = room.sockets.length === 2 ? 'Two sockets: click the cube that lands in the orange one, then the cube that lands in the purple one.' : 'Click the cube you think lands in the orange socket after the turn.';
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `The room will turn ${moveLabel(room.move)} (see gizmo). ${room.loose.length} loose cubes.`;
    stage.highlightAxis(room.move.axis, room.move.dir);
    log.push('present', { sketch: 'gravity', mode: run.mode, level: run.level, room: { n: room.n, fixed: room.fixed, loose: room.loose, move: moveLabel(room.move), sockets: room.sockets } });
  }

  /** Picks fill the sockets in order; picking again after both are set starts over. */
  function pickCube(i: number) {
    if (picks.length >= room.sockets.length) picks = [];
    if (!picks.includes(i)) picks.push(i);
    loose.cubes.forEach((cube, j) => { const m = cube.material as THREE.MeshStandardMaterial; const k = picks.indexOf(j); m.emissive.set(k < 0 ? 0x000000 : SOCKET_COLORS[k]); m.emissiveIntensity = 0.5; });
    P.message(room.sockets.length === 2 ? `orange socket: ${picks[0] != null ? `cube ${picks[0] + 1}` : '?'} · purple socket: ${picks[1] != null ? `cube ${picks[1] + 1}` : '?'}` : `Cube ${i + 1} picked.`);
  }
  function onClick(ev: MouseEvent) {
    if (commitB.disabled) return;
    const hit = stage.pickAt(ev, loose.cubes)[0];
    if (!hit) return;
    pickCube(hit.object.userData.index as number);
  }
  stage.canvas.addEventListener('click', onClick);

  async function commit() {
    if (picks.length < room.sockets.length) { P.message(room.sockets.length === 2 ? 'Pick a cube for each socket first.' : 'Pick a cube first.', 'bad'); return; }
    commitB.disabled = true;
    const ok = room.answers.every((a, i) => picks[i] === a);
    log.push('result', { sketch: 'gravity', picks, answers: room.answers, ok });
    await stage.spin(world, room.move, 900);
    await sleep(150);
    // Cubes fall in room coordinates; the room group's rotation carries them into world space.
    const c = off();
    const from = loose.cubes.map((m) => m.position.clone());
    const to = room.final.map(([x, y, z]) => new THREE.Vector3(x - c, y - c, z - c));
    await stage.tween(700, (t) => loose.cubes.forEach((m, i) => m.position.lerpVectors(from[i], to[i], easeIn(t))));
    void pulseMats(stage.ticker, room.answers.map((a) => loose.cubes[a].material as THREE.MeshStandardMaterial), ok ? COLOR_OK : COLOR_BAD);
    stage.highlightAxis(null);
    ok ? run.hit() : run.miss();
    const names = ['orange', 'purple'];
    const truth = room.answers.map((a, i) => `cube ${a + 1} lands in the ${names[i]} socket`).join(', ');
    P.message(ok ? `Right — ${truth}.` : `${truth[0].toUpperCase() + truth.slice(1)} — you said ${picks.map((p) => `cube ${p + 1}`).join(', ')}.`, ok ? 'ok' : 'bad');
    if (run.over) run.showOver(newRoom);
    else P.post([{ label: 'Next ↵', primary: true, onClick: newRoom }]);
  }

  run.begin(newRoom);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (/^[1-6]$/.test(e.key) && !commitB.disabled && Number(e.key) <= loose.cubes.length) pickCube(Number(e.key) - 1);
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.canvas.removeEventListener('click', onClick); stage.dispose(); };
}

export const gravity: SketchDef = {
  id: 'tilt', title: 'Tilt', status: 'playable', skill: 'predicting motion under a rotated frame', icon: '🎲',
  tagline: 'The room is about to turn. Gravity stays down — the room doesn\'t. Pick the cube that ends in the socket, then turn it.',
  about: 'Gravity stays down while the room turns, so you have to imagine motion in a frame that is no longer yours. Rooms are only served when at least two cubes move and the socket starts empty, so nothing can be read off the picture.',
  controls: 'Click a cube (or press 1–6), then Turn the room (Enter). The gizmo shows the turn.',
  mount,
};
