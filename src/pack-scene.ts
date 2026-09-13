// Prototype 1 stage: one scene — a mold with a cavity, and a piece hovering above it.
import * as THREE from 'three';
import { applyMoves, bboxMin, type Axis, type Cell, type Move } from './polycube';
import { cellKey, type Landing, type PackPuzzle } from './pack';
import {
  AXIS_VEC, COLOR_BG, COLOR_MARKER, Ticker, addLights, cubeGeo, edgeGeo, edgeMat, easeIn, easeInOut, easeOut,
  fitDistance, highlightGizmo, makeCubeMaterials, makeGizmo, placeCamera, renderGizmo, type Gizmo,
} from './render-common';

export { AXIS_COLOR } from './render-common';

const COLOR_MOLD = 0x8a97b3;
const COLOR_GHOST = 0x9ec2ff;
const HOVER = 2.6;

interface Face { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const neg = (v: THREE.Vector3) => v.clone().negate();
// u × v = n so every quad winds counter-clockwise seen from outside.
const FACES: Face[] = [
  { n: X, u: Y, v: Z }, { n: neg(X), u: Z, v: Y },
  { n: Y, u: Z, v: X }, { n: neg(Y), u: X, v: Z },
  { n: Z, u: X, v: Y }, { n: neg(Z), u: Y, v: X },
];

/** Only the faces between a solid cell and a non-solid one: the outer skin plus the cavity walls. */
function voxelSurface(cells: Cell[]): THREE.BufferGeometry {
  const solid = new Set(cells.map(cellKey));
  const pos: number[] = [], nor: number[] = [];
  const c = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [x, y, z] of cells) {
    for (const f of FACES) {
      if (solid.has(cellKey([x + f.n.x, y + f.n.y, z + f.n.z]))) continue;
      c.set(x, y, z).addScaledVector(f.n, 0.5);
      const corner = (su: number, sv: number) => {
        p.copy(c).addScaledVector(f.u, su * 0.5).addScaledVector(f.v, sv * 0.5);
        pos.push(p.x, p.y, p.z);
        nor.push(f.n.x, f.n.y, f.n.z);
      };
      corner(-1, -1); corner(1, -1); corner(1, 1);
      corner(-1, -1); corner(1, 1); corner(-1, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class PackStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private sun: THREE.DirectionalLight;
  private gizmo: Gizmo;
  private ticker = new Ticker();
  private lookAt = new THREE.Vector3();
  private mold = new THREE.Group();
  private ghost = new THREE.Group();
  private piece = new THREE.Group();
  private pieceCubes: THREE.Mesh[] = [];
  private moldMesh: THREE.Mesh | null = null;
  private mats = makeCubeMaterials();
  private c0 = new THREE.Vector3();
  private hover = new THREE.Vector3();
  /** Radius of the sphere (around lookAt) that must stay in view: mold plus hovering piece. */
  private radius = 6;
  private bob = false;
  private puzzle: PackPuzzle | null = null;
  private w = 1;
  private h = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.scene.background = new THREE.Color(COLOR_BG);
    this.sun = addLights(this.scene);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground, this.mold, this.ghost, this.piece);
    this.gizmo = makeGizmo();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setPuzzle(p: PackPuzzle) {
    this.puzzle = p;
    const { mold } = p;

    // Mold: every lattice cell in the slab minus the cavity, rendered as one skin.
    this.mold.clear();
    const cavity = new Set(p.cavity.map(cellKey));
    const cells: Cell[] = [];
    for (let x = 0; x < mold.w; x++) for (let y = 0; y < mold.h; y++) for (let z = 0; z < mold.d; z++) {
      if (!cavity.has(cellKey([x, y, z]))) cells.push([x, y, z]);
    }
    const geo = voxelSurface(cells);
    const mat = p.stage.glass
      ? new THREE.MeshStandardMaterial({ color: COLOR_MOLD, transparent: true, opacity: 0.2, roughness: 0.35, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: COLOR_MOLD, roughness: 0.75 });
    this.moldMesh = new THREE.Mesh(geo, mat);
    this.moldMesh.receiveShadow = !p.stage.glass;
    this.moldMesh.castShadow = !p.stage.glass;
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: p.stage.glass ? 0xb9c6e4 : 0x0b0d12, transparent: true, opacity: p.stage.glass ? 0.55 : 0.5 }));
    this.mold.add(this.moldMesh, outline);

    // Cavity ghost: the negative shape, only when the mold is glass.
    this.ghost.clear();
    if (p.stage.glass) {
      const fill = new THREE.MeshBasicMaterial({ color: COLOR_GHOST, transparent: true, opacity: 0.1, depthWrite: false });
      const fillMarker = new THREE.MeshBasicMaterial({ color: COLOR_MARKER, transparent: true, opacity: 0.16, depthWrite: false });
      const line = new THREE.LineBasicMaterial({ color: COLOR_GHOST, transparent: true, opacity: 0.6 });
      const lineMarker = new THREE.LineBasicMaterial({ color: COLOR_MARKER, transparent: true, opacity: 0.85 });
      p.cavity.forEach((c, i) => {
        const m = i === p.markerCavity;
        const cube = new THREE.Mesh(cubeGeo, m ? fillMarker : fill);
        cube.position.set(c[0], c[1], c[2]);
        cube.add(new THREE.LineSegments(edgeGeo, m ? lineMarker : line));
        this.ghost.add(cube);
      });
    }

    // Piece: cubes centred on the start bounding box so world-axis turns spin it in place.
    this.piece.clear();
    this.pieceCubes = [];
    this.piece.quaternion.identity();
    this.mats.base.emissiveIntensity = this.mats.marker.emissiveIntensity = 0;
    const ext = [0, 1, 2].map((i) => Math.max(...p.piece.map((c) => c[i])));
    this.c0.set(ext[0] / 2, ext[1] / 2, ext[2] / 2);
    p.piece.forEach((c, i) => {
      const mesh = new THREE.Mesh(cubeGeo, i === p.markerPiece ? this.mats.marker : this.mats.base);
      mesh.position.set(c[0] - this.c0.x, c[1] - this.c0.y, c[2] - this.c0.z);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      this.piece.add(mesh);
      this.pieceCubes.push(mesh);
    });
    const cavX = p.cavityOrigin[0] + Math.max(...p.target.map((c) => c[0])) / 2;
    const cavZ = p.cavityOrigin[2] + Math.max(...p.target.map((c) => c[2])) / 2;
    this.hover.set(cavX, mold.h - 0.5 + HOVER + ext[1] / 2, cavZ);
    this.piece.position.copy(this.hover);
    this.bob = true;

    const top = this.hover.y + ext[1] / 2 + 0.5;
    this.lookAt.set(mold.w / 2 - 0.5, top / 2 - 0.3, mold.d / 2 - 0.5);
    this.radius = Math.hypot(mold.w / 2 + 0.5, top / 2 + 0.5, mold.d / 2 + 0.5);
    this.reframe();
  }

  /** Place the camera so the whole scene fits at the current aspect ratio. */
  private reframe() {
    const p = this.puzzle;
    if (!p) return;
    const dist = fitDistance(this.camera, this.radius, 1.05);
    placeCamera(this.camera, this.sun, p.pose.azimuth, p.pose.elevation, dist, this.lookAt);
  }

  /** Every piece cube is visible, and (for a solid mold) so is the floor of every cavity cell. */
  isReadable() {
    const p = this.puzzle!;
    this.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const c = new THREE.Vector3();
    for (const cube of this.pieceCubes) {
      cube.getWorldPosition(c);
      ray.set(this.camera.position, c.clone().sub(this.camera.position).normalize());
      const hits = ray.intersectObjects(this.pieceCubes, false);
      if (!hits.length || hits[0].object !== cube) return false;
    }
    if (!p.stage.glass && this.moldMesh) {
      for (const cell of p.cavity) {
        c.set(cell[0], cell[1], cell[2]);
        const d = c.distanceTo(this.camera.position);
        ray.set(this.camera.position, c.clone().sub(this.camera.position).normalize());
        const hits = ray.intersectObject(this.moldMesh, false);
        if (hits.length && hits[0].distance < d - 0.5) return false;
      }
    }
    return true;
  }

  animateMove(m: Move, ms = 480) {
    this.bob = false;
    const g = this.piece;
    const q0 = g.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[m.axis], (m.dir * Math.PI) / 2).multiply(q0);
    return this.ticker.tween(ms, (t) => g.quaternion.slerpQuaternions(q0, q1, easeInOut(t)));
  }

  /** Let the piece fall to where the model says it lands. `moves` must be the turns already applied. */
  animateDrop(moves: Move[], landing: Landing) {
    this.bob = false;
    const p = this.puzzle!;
    const g = this.piece;
    const rotated = applyMoves(p.piece, moves);
    const min = bboxMin(rotated);
    // group position = R·c0 − min(R·cells) + origin, so that child cells land on the lattice.
    const target = this.c0.clone().applyQuaternion(g.quaternion)
      .sub(new THREE.Vector3(min[0], min[1], min[2]))
      .add(new THREE.Vector3(landing.origin[0], landing.origin[1], landing.origin[2]));
    const from = g.position.clone();
    const ms = 320 + 55 * Math.max(0, from.y - target.y);
    return this.ticker.tween(ms, (t) => {
      g.position.lerpVectors(from, target, easeIn(t));
    });
  }

  /** Back up to the hover point and back to the start orientation. */
  animateLift(ms = 600) {
    const g = this.piece;
    const from = g.position.clone();
    const q0 = g.quaternion.clone();
    const q1 = new THREE.Quaternion();
    return this.ticker.tween(ms, (t) => {
      const e = easeOut(t);
      g.position.lerpVectors(from, this.hover, e);
      g.quaternion.slerpQuaternions(q0, q1, e);
    }).then(() => { this.bob = true; });
  }

  /** Piece becomes part of the mold: ghost gone, colour settles. */
  fuse() {
    this.ghost.clear();
  }

  pulse(color: number, ms = 900) {
    const mats = [this.mats.base, this.mats.marker];
    for (const m of mats) m.emissive.set(color);
    return this.ticker.tween(ms, (t) => { for (const m of mats) m.emissiveIntensity = 0.85 * (1 - t); });
  }

  /** Brief jolt of the whole scene for a collision. */
  shake(ms = 260, amp = 0.12) {
    const base = this.camera.position.clone();
    return this.ticker.tween(ms, (t) => {
      const k = (1 - t) * amp;
      this.camera.position.set(base.x + Math.sin(t * 40) * k, base.y + Math.cos(t * 37) * k, base.z);
    }).then(() => { this.camera.position.copy(base); });
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.reframe();
  }

  private frame() {
    const now = performance.now();
    this.ticker.update(now);
    if (this.bob) this.piece.position.y = this.hover.y + Math.sin(now / 650) * 0.07;
    const r = this.renderer;
    r.setScissorTest(true);
    r.setViewport(0, 0, this.w, this.h);
    r.setScissor(0, 0, this.w, this.h);
    r.clear();
    r.render(this.scene, this.camera);
    const size = Math.min(168, Math.round(this.w * 0.26));
    renderGizmo(r, this.gizmo, this.camera, this.lookAt, this.w - size - 6, 6, size);
    r.setScissorTest(false);
  }
}
