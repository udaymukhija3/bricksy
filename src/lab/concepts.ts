// Concept vignettes: ideas that are whole games and can't be sketched honestly in a sitting.
// Each renders a scene of what it would look like, and states the mechanic and its bypass risk.
import * as THREE from 'three';
import type { Cell } from '../polycube';
import { SketchStage, cubeGroup, voxelMesh, h, mulberry32 } from './kit';
import type { SketchDef, MountCtx } from './types';

interface View { az: number; el: number; r: number; target: [number, number, number] }

interface Concept {
  def: Omit<SketchDef, 'mount' | 'status'>;
  notes: { mechanic: string; predict: string; commit: string; consequence: string; bypass: string; why: string };
  scene: (stage: SketchStage, world: THREE.Group) => View;
}

const floor = (w: number, d: number, color = 0x2a2e3a) => {
  const cells: Cell[] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) cells.push([x, -1, z]);
  return voxelMesh(cells, { color, outline: 0x3a4052 }).group;
};

const CONCEPTS: Concept[] = [
  {
    def: { id: 'sokoban', title: 'Spatial Sokoban', tagline: 'Push and turn awkward crates through a tight room. Every move changes which future moves are still possible.', skill: 'planning under irreversible moves' },
    notes: {
      mechanic: 'A room, a few polycube crates, target sockets. You push (never pull) and quarter-turn crates. Walls and other crates block.',
      predict: 'Before each move you commit a short plan — 2 to 4 moves — not one step.',
      commit: 'The plan executes without pause. If a crate wedges in a corner, it stays wedged.',
      consequence: 'Dead ends are real: a crate against a wall cannot be pulled back. Undo is a scarce resource, or absent.',
      bypass: 'High if single steps are allowed with free undo — it becomes trial and error. The plan-length rule and scarce undo are what force simulation.',
      why: 'Needs a level design language (solvable, interesting, non-trivial dead ends) before the mechanic can be judged. A generator that guarantees solvable-but-tight rooms is the real work.',
    },
    scene: (_stage, world) => {
      world.add(floor(7, 7));
      const walls: Cell[] = [];
      for (let i = 0; i < 7; i++) walls.push([i, 0, 0], [i, 0, 6], [0, 0, i], [6, 0, i]);
      walls.push([3, 0, 1], [3, 0, 2], [3, 1, 1], [2, 0, 4]);
      world.add(voxelMesh(walls, { color: 0x5b6478 }).group);
      const crate = cubeGroup([[1, 0, 1], [1, 0, 2], [2, 0, 2]], { color: 0xf5a524 });
      const crate2 = cubeGroup([[4, 0, 4], [4, 1, 4], [5, 0, 4]], { color: 0xf5a524 });
      world.add(crate.group, crate2.group);
      const socket = cubeGroup([[4, 0, 1], [5, 0, 1], [5, 0, 2]], { ghost: true, color: 0x46a758 });
      world.add(socket.group);
      const player = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshStandardMaterial({ color: 0x3e8ff5 }));
      player.position.set(1, 0, 5);
      player.castShadow = true;
      world.add(player);
      return { az: 35, el: 40, r: 5.5, target: [3, -0.5, 3] };
    },
  },
  {
    def: { id: 'maze', title: 'Perspective Maze', tagline: 'See the map for three seconds. Then walk it from the inside, from a viewpoint that keeps turning.', skill: 'perspective taking · mental maps' },
    notes: {
      mechanic: 'A maze shown from above, briefly. Then first-person navigation with the map gone. Later: the map is shown rotated relative to your start heading.',
      predict: 'At each junction you say which way the goal is before you can see down the corridor.',
      commit: 'You walk the whole corridor; wrong turns cost time and, later, moves.',
      consequence: 'Dead ends. A running "where am I on the map" that you cannot check until the end.',
      bypass: 'Low — but the skill is spatial memory plus perspective-taking, and it is hard to separate the two. Wall-following solves mazes without any map, so the goal must be somewhere wall-following cannot find quickly.',
      why: 'First-person controls, a maze generator with the wall-following defence, and a memory phase are three separate systems. Doable, not a sketch.',
    },
    scene: (_stage, world) => {
      const rng = mulberry32(7);
      const n = 9;
      const walls: Cell[] = [];
      for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
        const edge = x === 0 || z === 0 || x === n - 1 || z === n - 1;
        const inner = x % 2 === 0 && z % 2 === 0;
        const rnd = (x % 2 === 0 || z % 2 === 0) && rng() < 0.42;
        if ((edge && !(x === 1 && z === 0) && !(x === n - 2 && z === n - 1)) || inner || rnd) walls.push([x, 0, z], [x, 1, z]);
      }
      world.add(floor(n, n), voxelMesh(walls, { color: 0x6b7590 }).group);
      const eye = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0x3e8ff5 }));
      eye.position.set(1, 0.2, 1);
      eye.rotation.x = Math.PI / 2;
      world.add(eye);
      const goal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x46a758 }));
      goal.position.set(n - 2, -0.4, n - 2);
      world.add(goal);
      return { az: 30, el: 55, r: 7, target: [n / 2 - 0.5, -0.5, n / 2 - 0.5] };
    },
  },
  {
    def: { id: 'assembly', title: 'Assembly', tagline: 'Several odd components and a target silhouette. Which orientations and positions make them one object?', skill: 'part–whole composition' },
    notes: {
      mechanic: 'Three to five polycube parts, one target volume. Each part must be turned and placed; parts cannot overlap.',
      predict: 'You assign each part an orientation and an anchor cell before anything moves — a full assembly plan.',
      commit: 'Parts fly to their places in order. The first collision stops the build.',
      consequence: 'A wrong part leaves a visible gap or a visible overlap. Later parts may no longer fit because of an early choice.',
      bypass: 'Medium. If parts can be placed one at a time with live feedback, it degrades to trial and error. Planning the whole assembly is what keeps mental rotation and composition in the loop.',
      why: 'Placement needs a 3D positioning UI that stays predict-first. That UI is the unsolved design problem, not the geometry (which the pack model already handles).',
    },
    scene: (_stage, world) => {
      world.add(floor(6, 6));
      const target = cubeGroup([[1, 0, 1], [2, 0, 1], [3, 0, 1], [1, 1, 1], [1, 0, 2], [2, 0, 2], [3, 0, 2], [3, 1, 2], [2, 1, 1]], { ghost: true, color: 0x9ec2ff });
      world.add(target.group);
      const parts = [
        cubeGroup([[0, 0, 0], [1, 0, 0], [1, 1, 0]], { color: 0xe5484d, center: true }),
        cubeGroup([[0, 0, 0], [0, 0, 1], [1, 0, 1]], { color: 0x46a758, center: true }),
        cubeGroup([[0, 0, 0], [1, 0, 0], [1, 0, 1]], { color: 0xf5a524, center: true }),
      ];
      parts[0].group.position.set(-1.5, 2.2, 4.5); parts[0].group.rotation.y = 0.6;
      parts[1].group.position.set(5.5, 2.6, 1); parts[1].group.rotation.x = 0.8;
      parts[2].group.position.set(2, 3.4, -1.5); parts[2].group.rotation.z = 1.1;
      for (const p of parts) world.add(p.group);
      return { az: 30, el: 30, r: 5.5, target: [2, 0.5, 1.5] };
    },
  },
  {
    def: { id: 'chess', title: 'Rotation Chess', tagline: 'Pieces attack according to their orientation, not just their square. Think several turns of spatial transformation ahead.', skill: 'multi-step transformation lookahead' },
    notes: {
      mechanic: 'A small board. Each piece is a polycube; its attack pattern is its shape projected onto the board in its current orientation. A move is either a slide or a quarter-turn.',
      predict: 'You commit a move without a preview of the resulting attack map.',
      commit: 'The board updates; captures resolve.',
      consequence: 'Leaving a piece attacked is the consequence; an opponent (or a puzzle "mate in two") makes it bite.',
      bypass: 'Low for the spatial part — you cannot play without imagining rotated attack patterns — but the strategic layer can dominate, and then the game is about chess-like planning rather than spatial skill.',
      why: 'Needs an opponent or a puzzle corpus. Balance and rules design are the work; the rendering is trivial.',
    },
    scene: (_stage, world) => {
      const cells: Cell[] = [];
      for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) cells.push([x, -1, z]);
      const board = voxelMesh(cells, { color: 0x2a2e3a, outline: 0x3a4052 }).group;
      world.add(board);
      const light = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x353a48, transparent: true, opacity: 0.6 }));
      light.rotation.x = -Math.PI / 2;
      light.position.set(2.5, -0.49, 2.5);
      world.add(light);
      const p1 = cubeGroup([[1, 0, 1], [1, 1, 1], [2, 0, 1]], { color: 0x3e8ff5 });
      const p2 = cubeGroup([[4, 0, 4], [4, 1, 4], [4, 2, 4], [3, 0, 4]], { color: 0xe5484d });
      world.add(p1.group, p2.group);
      const attacks = cubeGroup([[3, 0, 1], [1, 0, 2], [1, 0, 0], [2, 0, 2]], { ghost: true, color: 0x3e8ff5 });
      attacks.group.scale.y = 0.15;
      attacks.group.position.y = -0.42;
      world.add(attacks.group);
      return { az: 30, el: 38, r: 4.8, target: [2.5, -0.2, 2.5] };
    },
  },
];

function mountConcept(c: Concept) {
  return ({ stageEl, panelEl, hintEl }: MountCtx) => {
    const stage = new SketchStage(stageEl, { ground: -1.0 });
    const world = new THREE.Group();
    stage.scene.add(world);
    const view = c.scene(stage, world);
    const place = () => stage.place(view.az, view.el, stage.fit(view.r), view.target);
    place();
    stage.onResize = place;
    stage.onFrame = (now) => { world.rotation.y = Math.sin(now / 4000) * 0.12; };
    hintEl.textContent = 'Concept — a scene of what it would look like, not a playable sketch.';
    const n = c.notes;
    panelEl.append(h('div.concept', {},
      h('h4', {}, 'Mechanic'), h('p', {}, n.mechanic),
      h('h4', {}, 'What you predict'), h('p', {}, n.predict),
      h('h4', {}, 'Commit'), h('p', {}, n.commit),
      h('h4', {}, 'Consequence'), h('p', {}, n.consequence),
      h('h4', {}, 'Bypass risk'), h('p', {}, n.bypass),
      h('h4', {}, 'Why it is not a sketch yet'), h('p', {}, n.why),
    ));
    return () => stage.dispose();
  };
}

export const concepts: SketchDef[] = CONCEPTS.map((c) => ({ ...c.def, status: 'concept', mount: mountConcept(c) }));
