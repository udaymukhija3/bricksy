import * as THREE from 'three';
import type { Cell } from '../polycube.ts';
import { SketchStage, h } from './kit.ts';
import { project, type Dims, type View } from './shadows-model.ts';

const BLUE = 0x8aa9ef, AMBER = 0xf5c16c, MATCH = 0x72d6ba, BAD = 0xf28b82;

/** All resources below belong to this scene; shared kit geometries are never disposed. */
function clear(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      geometries.add(obj.geometry);
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(mat);
    }
  });
  group.clear();
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
}

export class ShadowsScene {
  readonly stage: SketchStage;
  private volume = new THREE.Group();
  private proof = new THREE.Group();
  private ghost = new THREE.Group();
  private dims: Dims = { w: 3, h: 3, d: 3 };
  private layer = 0;
  private tiles: THREE.Mesh[] = [];
  private pickTargets: THREE.Object3D[] = [];
  private az = 35;
  private editable = true;
  private epoch = 0;
  private front = h('span.shadow-edge', {}, 'FRONT');
  private side = h('span.shadow-edge', {}, 'RIGHT');
  private onToggle: (cell: Cell) => void;
  private click: (ev: MouseEvent) => void;
  private move: (ev: PointerEvent) => void;

  constructor(container: HTMLElement, onToggle: (cell: Cell) => void) {
    this.onToggle = onToggle;
    // A real cast shadow would disclose a projection before the player commits.
    this.stage = new SketchStage(container, { ground: null, shadows: false });
    this.stage.scene.add(this.volume, this.proof, this.ghost);
    container.append(this.front, this.side);
    this.stage.onResize = () => this.frame();
    this.click = (ev) => {
      if (!this.editable) return;
      const hit = this.stage.pickAt(ev, this.pickTargets)[0];
      if (hit) this.onToggle(hit.object.userData.cell as Cell);
    };
    this.move = (ev) => {
      const hit = this.editable ? this.stage.pickAt(ev, this.pickTargets)[0] : null;
      const key = (hit?.object.userData.cell as Cell | undefined)?.join(',');
      for (const tile of this.tiles) (tile.material as THREE.MeshBasicMaterial).opacity = (tile.userData.cell as Cell).join(',') === key ? 0.32 : 0.09;
      this.stage.canvas.style.cursor = hit ? 'pointer' : 'default';
    };
    this.stage.canvas.addEventListener('click', this.click);
    this.stage.canvas.addEventListener('pointermove', this.move);
    this.stage.canvas.setAttribute('aria-label', '3D build. Tap a square on the selected layer to add or remove a cube. The layer grid provides keyboard controls.');
  }

  frame() {
    const { w, h: height, d } = this.dims;
    this.stage.place(this.az, 29, this.stage.fit(Math.hypot(w, height, d) / 2 + 0.35, 1.03), [(w - 1) / 2, (height - 1) / 2 - 0.12, (d - 1) / 2]);
    const position = (el: HTMLElement, p: THREE.Vector3) => {
      p.project(this.stage.camera);
      el.style.left = `${(p.x + 1) * 50}%`; el.style.top = `${(1 - p.y) * 50}%`;
    };
    position(this.front, new THREE.Vector3((w - 1) / 2, -0.6, d + 0.05));
    position(this.side, new THREE.Vector3(w + 0.05, -0.6, (d - 1) / 2));
  }

  turn(dir: number) { this.az += dir * 90; this.frame(); }

  reset(dims: Dims) { this.epoch++; this.dims = dims; this.az = 35; clear(this.proof); clear(this.ghost); this.frame(); }

  render(cells: Cell[], layer: number, editable: boolean) {
    this.layer = layer; this.editable = editable;
    clear(this.volume); clear(this.proof); clear(this.ghost); this.tiles = []; this.pickTargets = [];
    const { w, h: height, d } = this.dims;
    const boxGeometry = new THREE.BoxGeometry(w, height, d);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial({ color: 0x424859, transparent: true, opacity: 0.65 }));
    boxGeometry.dispose();
    box.position.set((w - 1) / 2, (height - 1) / 2, (d - 1) / 2); this.volume.add(box);

    const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const edges = new THREE.EdgesGeometry(geo);
    for (const cell of cells) {
      const inactive = editable && cell[1] !== layer;
      const opacity = !inactive ? 1 : cell[1] > layer ? 0.16 : 0.4;
      const mat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.5, metalness: 0.1, transparent: inactive, opacity, depthWrite: !inactive });
      const cube = new THREE.Mesh(geo, mat); cube.position.set(...cell);
      cube.userData.cell = cell;
      if (cell[1] === layer) this.pickTargets.push(cube);
      cube.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xd4e0ff, transparent: true, opacity: inactive ? 0.2 : 0.45 })));
      this.volume.add(cube);
    }
    if (!cells.length) { geo.dispose(); edges.dispose(); }

    const plane = new THREE.PlaneGeometry(0.94, 0.94);
    const outline = new THREE.EdgesGeometry(plane);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const tile = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x, editable ? this.layer - 0.49 : -0.51, z);
      tile.userData.cell = [x, layer, z];
      tile.add(new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: editable ? AMBER : 0x424859, transparent: true, opacity: editable ? 0.48 : 0.3 })));
      this.volume.add(tile); this.tiles.push(tile); this.pickTargets.push(tile);
    }
  }

  private point(view: View, col: number, row: number) {
    const { w, h: height, d } = this.dims;
    return view === 'top' ? new THREE.Vector3(col, -0.65, row)
      : view === 'front' ? new THREE.Vector3(col, height - 1 - row, d - 0.3)
        : new THREE.Vector3(w - 0.3, height - 1 - row, d - 1 - col);
  }

  showProjection(view: View, cells: Cell[], target: Set<string>) {
    clear(this.proof); clear(this.ghost);
    const mine = project(cells, this.dims)[view];
    for (const key of new Set([...target, ...mine])) {
      const [col, row] = key.split(',').map(Number);
      const missing = !mine.has(key), extra = !target.has(key);
      const plane = new THREE.PlaneGeometry(0.87, 0.87);
      const tile = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: missing || extra ? BAD : MATCH, side: THREE.DoubleSide, transparent: true, opacity: missing ? 0.05 : 0.45, depthWrite: false }));
      tile.position.copy(this.point(view, col, row));
      if (view === 'top') tile.rotation.x = -Math.PI / 2;
      if (view === 'right') tile.rotation.y = Math.PI / 2;
      tile.add(new THREE.LineSegments(new THREE.EdgesGeometry(plane), new THREE.LineBasicMaterial({ color: missing || extra ? BAD : MATCH, transparent: true, opacity: 0.9 })));
      this.proof.add(tile);
    }
    // Parallel rays make the object-to-plane relationship explicit, without perspective distortion.
    const points: THREE.Vector3[] = [];
    for (const c of cells) {
      const endpoint = view === 'top' ? this.point(view, c[0], c[2])
        : view === 'front' ? this.point(view, c[0], this.dims.h - 1 - c[1])
          : this.point(view, this.dims.d - 1 - c[2], this.dims.h - 1 - c[1]);
      points.push(new THREE.Vector3(...c), endpoint);
    }
    this.proof.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.2 })));
  }

  async cast(view: View, cells: Cell[], target: Set<string>, reduced: boolean) {
    const epoch = this.epoch;
    this.showProjection(view, cells, target);
    const proof = this.proof;
    const materials = new Map<THREE.Material & { opacity: number }, number>();
    proof.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        const mat = obj.material as THREE.Material; materials.set(mat, mat.opacity); mat.opacity = 0;
      }
    });
    await this.stage.tween(reduced ? 1 : 620, (t) => {
      if (epoch !== this.epoch) return;
      for (const [mat, opacity] of materials) mat.opacity = opacity * t;
    });
  }

  showObject(cells: Cell[]) {
    clear(this.proof); clear(this.ghost);
    for (const c of cells) {
      const geo = new THREE.BoxGeometry(1.015, 1.015, 1.015);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.85, depthTest: false }));
      geo.dispose(); outline.position.set(...c); this.ghost.add(outline);
    }
  }

  dispose() {
    this.epoch++;
    this.stage.canvas.removeEventListener('click', this.click);
    this.stage.canvas.removeEventListener('pointermove', this.move);
    clear(this.volume); clear(this.proof); clear(this.ghost);
    this.front.remove(); this.side.remove(); this.stage.dispose();
  }
}
