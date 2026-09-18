// Prototype 0 stage: two matched viewports (you / target) sharing one camera pose.
import * as THREE from 'three';
import type { Cell, Move } from './polycube.ts';
import type { CameraPose } from './puzzle.ts';
import {
  AXIS_VEC, COLOR_BG, Ticker, addLights, cubeGeo, edgeGeo, edgeMat, easeInOut, fitDistance, highlightGizmo,
  makeCubeMaterials, makeGizmo, placeCamera, renderGizmo, type Gizmo,
} from './render-common.ts';
import type { Axis } from './polycube.ts';

export { AXIS_COLOR } from './render-common.ts';

const SHAPE_RADIUS = 2.6;
const LOOK_AT = new THREE.Vector3(0, -0.3, 0);
export type ViewName = 'you' | 'target';

interface View {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  group: THREE.Group;
  cubes: THREE.Mesh[];
  base: THREE.MeshStandardMaterial;
  marker: THREE.MeshStandardMaterial;
}

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private views: Record<ViewName, View>;
  private gizmo: Gizmo;
  private ticker = new Ticker();
  private w = 1;
  private h = 1;
  private pose: CameraPose = { azimuth: 38, elevation: 26 };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.views = { you: this.makeView(), target: this.makeView() };
    this.gizmo = makeGizmo();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private makeView(): View {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR_BG);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const sun = addLights(scene);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    ground.receiveShadow = true;
    scene.add(ground);
    const group = new THREE.Group();
    scene.add(group);
    return { scene, camera, sun, group, cubes: [], ...makeCubeMaterials() };
  }

  /** Replace a view's shape. Cubes are centred on the bounding box so world-axis turns rotate in place. */
  setShape(name: ViewName, cells: Cell[], markerIndex: number) {
    const v = this.views[name];
    v.group.clear();
    v.cubes = [];
    v.group.quaternion.identity();
    const centre = [0, 1, 2].map((i) => {
      const xs = cells.map((c) => c[i]);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    });
    cells.forEach((c, i) => {
      const mesh = new THREE.Mesh(cubeGeo, i === markerIndex ? v.marker : v.base);
      mesh.position.set(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      v.group.add(mesh);
      v.cubes.push(mesh);
    });
  }

  /** Both views always share the same camera pose so the comparison is fair. */
  setPose(p: CameraPose) {
    this.pose = p;
    for (const v of Object.values(this.views)) placeCamera(v.camera, v.sun, p.azimuth, p.elevation, fitDistance(v.camera, SHAPE_RADIUS), LOOK_AT);
  }

  /** Stack the two views whenever side-by-side halves would be narrower than they are tall. */
  private get portrait() { return this.w < 1.4 * this.h; }

  /** True when the camera can see the centre of every cube (nothing fully hidden). */
  isFullyVisible(name: ViewName) {
    const v = this.views[name];
    v.group.updateMatrixWorld(true);
    v.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    const p = new THREE.Vector3();
    for (const cube of v.cubes) {
      cube.getWorldPosition(p);
      ray.set(v.camera.position, p.clone().sub(v.camera.position).normalize());
      const hits = ray.intersectObjects(v.cubes, false);
      if (!hits.length || hits[0].object !== cube) return false;
    }
    return true;
  }

  /** Apply one world-axis quarter-turn to the player's shape, animated. */
  animateMove(m: Move, ms = 480) {
    const g = this.views.you.group;
    const q0 = g.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[m.axis], (m.dir * Math.PI) / 2).multiply(q0);
    return this.ticker.tween(ms, (t) => g.quaternion.slerpQuaternions(q0, q1, easeInOut(t)));
  }

  resetOrientation(ms = 420) {
    const g = this.views.you.group;
    const q0 = g.quaternion.clone();
    const q1 = new THREE.Quaternion();
    return this.ticker.tween(ms, (t) => g.quaternion.slerpQuaternions(q0, q1, easeInOut(t)));
  }

  pulse(color: number, ms = 900) {
    const mats = [this.views.you.base, this.views.you.marker];
    for (const m of mats) m.emissive.set(color);
    return this.ticker.tween(ms, (t) => { for (const m of mats) m.emissiveIntensity = 0.8 * (1 - t); });
  }

  highlightAxis(axis: Axis | null, dir: 1 | -1 = 1) {
    highlightGizmo(this.gizmo, axis, dir);
  }

  private resize() {
    const el = this.canvas.parentElement!;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    const portrait = this.portrait;
    this.canvas.parentElement!.classList.toggle('portrait', portrait);
    for (const v of Object.values(this.views)) {
      v.camera.aspect = portrait ? w / (h / 2) : w / 2 / h;
      v.camera.updateProjectionMatrix();
    }
    this.setPose(this.pose);
  }

  private frame() {
    this.ticker.update(performance.now());
    const r = this.renderer;
    r.setScissorTest(true);
    // WebGL viewports measure from the bottom, so in portrait "you" is the upper half.
    const rects = this.portrait
      ? { you: [0, Math.ceil(this.h / 2), this.w, Math.floor(this.h / 2)], target: [0, 0, this.w, Math.ceil(this.h / 2)] }
      : { you: [0, 0, Math.floor(this.w / 2), this.h], target: [Math.floor(this.w / 2), 0, this.w - Math.floor(this.w / 2), this.h] };
    for (const name of ['you', 'target'] as ViewName[]) {
      const [x, y, w, h] = rects[name];
      r.setViewport(x, y, w, h);
      r.setScissor(x, y, w, h);
      r.clear();
      r.render(this.views[name].scene, this.views[name].camera);
    }
    const [yx, yy, yw] = rects.you;
    const size = Math.min(150, Math.round(yw * 0.3));
    renderGizmo(r, this.gizmo, this.views.you.camera, LOOK_AT, yx + yw - size - 6, yy + 6, size);
    r.setScissorTest(false);
  }
}
