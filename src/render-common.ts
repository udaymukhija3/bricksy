// Rendering helpers shared by the match (prototype 0) and pack (prototype 1) stages.
import * as THREE from 'three';
import type { Axis } from './polycube';

export const AXIS_COLOR: Record<Axis, number> = { x: 0xe5484d, y: 0x46a758, z: 0x3e8ff5 };
export const AXIS_VEC: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
export const UP = new THREE.Vector3(0, 1, 0);
export const COLOR_BG = 0x14161c;
export const COLOR_BASE = 0x6b8fd6;
export const COLOR_MARKER = 0xf5a524;
export const COLOR_OK = 0x46a758;
export const COLOR_BAD = 0xe5484d;

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeIn = (t: number) => t * t * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

interface Tween { start: number; dur: number; fn: (t: number) => void; resolve: () => void }

/** Promise-based tweens driven from the render loop. */
export class Ticker {
  private tweens: Tween[] = [];

  tween(dur: number, fn: (t: number) => void) {
    return new Promise<void>((resolve) => this.tweens.push({ start: performance.now(), dur, fn, resolve }));
  }

  update(now: number) {
    for (const tw of [...this.tweens]) {
      const t = Math.min(1, (now - tw.start) / tw.dur);
      tw.fn(t);
      if (t >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }
  }
}

export function makeCubeMaterials() {
  return {
    base: new THREE.MeshStandardMaterial({ color: COLOR_BASE, roughness: 0.6, metalness: 0.05 }),
    marker: new THREE.MeshStandardMaterial({ color: COLOR_MARKER, roughness: 0.6, metalness: 0.05 }),
  };
}

export const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
export const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
export const edgeMat = new THREE.LineBasicMaterial({ color: 0x0b0d12, transparent: true, opacity: 0.6 });

export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2d3a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
  scene.add(sun);
  return sun;
}

/** Spherical camera placement; the key light rides with the camera so visible faces are always lit. */
export function placeCamera(camera: THREE.Camera, sun: THREE.DirectionalLight, azimuthDeg: number, elevationDeg: number, distance: number, target: THREE.Vector3) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  camera.position.set(
    target.x + distance * Math.cos(el) * Math.sin(az),
    target.y + distance * Math.sin(el),
    target.z + distance * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(target);
  const sunEl = 0.95, sunAz = az + 0.6, r = 22;
  sun.position.set(target.x + r * Math.cos(sunEl) * Math.sin(sunAz), target.y + r * Math.sin(sunEl), target.z + r * Math.cos(sunEl) * Math.cos(sunAz));
  sun.target.position.copy(target);
  sun.target.updateMatrixWorld();
}

// ---------------------------------------------------------------- gizmo

type Sign = '+' | '-';
export interface Gizmo {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  arrows: Record<Axis, Record<Sign, THREE.Group>>;
}

/** Point on a circle of radius r around `axis`, parametrised so increasing θ is the +90° direction. */
function arcPoint(axis: Axis, r: number, th: number) {
  switch (axis) {
    case 'x': return new THREE.Vector3(0, r * Math.cos(th), r * Math.sin(th)); // Y → Z
    case 'y': return new THREE.Vector3(r * Math.sin(th), 0, r * Math.cos(th)); // Z → X
    case 'z': return new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), 0); // X → Y
  }
}

/** A ~270° arc around `axis`, sitting near the axis tip so the three glyphs never overlap. */
function curvedArrow(axis: Axis, dir: 1 | -1, color: number) {
  const r = 0.3, along = 0.72, th0 = 0.45, th1 = Math.PI * 1.6, n = 48;
  const offset = AXIS_VEC[axis].clone().multiplyScalar(along);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const th = dir > 0 ? th0 + ((th1 - th0) * i) / n : th1 - ((th1 - th0) * i) / n;
    pts.push(arcPoint(axis, r, th).add(offset));
  }
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.028, 6, false), mat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 10), mat);
  const end = pts[n];
  const tangent = end.clone().sub(pts[n - 1]).normalize();
  cone.position.copy(end).addScaledVector(tangent, 0.06);
  cone.quaternion.setFromUnitVectors(UP, tangent);
  const g = new THREE.Group();
  g.add(tube, cone);
  g.userData.mat = mat;
  return g;
}

export function makeGizmo(): Gizmo {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.35, 1.35, 1.35, -1.35, 0.1, 50);
  const arrows = {} as Gizmo['arrows'];
  for (const axis of ['x', 'y', 'z'] as Axis[]) {
    const color = AXIS_COLOR[axis];
    const v = AXIS_VEC[axis];
    const pos = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), v.clone().multiplyScalar(1.15)]),
      new THREE.LineBasicMaterial({ color }),
    );
    const neg = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), v.clone().multiplyScalar(-0.7)]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 }),
    );
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), new THREE.MeshBasicMaterial({ color }));
    tip.position.copy(v).multiplyScalar(1.2);
    tip.quaternion.setFromUnitVectors(UP, v);
    arrows[axis] = { '+': curvedArrow(axis, 1, color), '-': curvedArrow(axis, -1, color) };
    arrows[axis]['-'].visible = false;
    scene.add(pos, neg, tip, arrows[axis]['+'], arrows[axis]['-']);
  }
  return { scene, camera, arrows };
}

/** Emphasise one axis, flipping its arrow to show the −90° direction when asked. */
export function highlightGizmo(gizmo: Gizmo, axis: Axis | null, dir: 1 | -1 = 1) {
  for (const a of ['x', 'y', 'z'] as Axis[]) {
    const active = axis === a;
    const shown: Sign = active && dir < 0 ? '-' : '+';
    for (const s of ['+', '-'] as Sign[]) {
      const g = gizmo.arrows[a][s];
      g.visible = s === shown;
      (g.userData.mat as THREE.MeshBasicMaterial).opacity = axis === null ? 0.85 : active ? 1 : 0.2;
      g.scale.setScalar(active ? 1.12 : 1);
    }
  }
}

/** Draw the gizmo in a corner viewport, oriented like `mainCamera`. Call with scissor test on. */
export function renderGizmo(r: THREE.WebGLRenderer, gizmo: Gizmo, mainCamera: THREE.Camera, lookAt: THREE.Vector3, x: number, y: number, size: number) {
  gizmo.camera.position.copy(mainCamera.position).sub(lookAt).setLength(10);
  gizmo.camera.lookAt(0, 0, 0);
  r.setViewport(x, y, size, size);
  r.setScissor(x, y, size, size);
  r.clearDepth();
  r.render(gizmo.scene, gizmo.camera);
}
