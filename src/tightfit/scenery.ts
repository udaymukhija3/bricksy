import * as THREE from 'three';
import { applyMoves, bboxMin, orientations, shapeKey, type Cell } from '../polycube.ts';
import { AXIS_VEC } from '../render-common.ts';
import type { PackPuzzle } from '../pack.ts';
import { furnitureCells } from './furniture.ts';

export const SKY = 0xece6d6;
const GREEN = 0x335d48;

function box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], color: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .85 }));
  m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

function sign(parent: THREE.Object3D, words: string, w: number, h: number, pos: [number, number, number], color = '#335d48') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2dfb8'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.font = 'bold 58px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words, 256, 84);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  m.position.set(...pos); parent.add(m);
}

/** Surface details stay attached to the same physical item as it turns between stages. */
export function dressFurniture(parent: THREE.Group, current: Cell[], center: THREE.Vector3, name: string) {
  const canonical = furnitureCells(name);
  if (!canonical) return;
  const pose = orientations(canonical).find((o) => o.key === shapeKey(current));
  if (!pose) return;
  const detail = new THREE.Group();
  const rotated = applyMoves(canonical, pose.path), min = bboxMin(rotated);
  for (const m of pose.path) detail.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[m.axis], m.dir * Math.PI / 2));
  const currentMin = bboxMin(current);
  detail.position.set(currentMin[0] - min[0] - center.x, currentMin[1] - min[1] - center.y, currentMin[2] - min[2] - center.z);
  const top = Math.max(...canonical.map((c) => c[1]));
  for (const [x, y, z] of canonical) {
    // Only decorate exposed faces, leaving every collision boundary visible.
    if (canonical.some((c) => c[0] === x && c[1] === y && c[2] === z + 1)) continue;
    const front = z + .505;
    if (name === 'bookshelf' || name === 'wardrobe' || name === 'bunk bed') {
      box(detail, [.86,.74,.018], [x,y,front], 0x4e382d);
      for (let j = 0; j < 4; j++) box(detail, [.13,.45 + j % 2 * .13,.025], [x - .3 + j * .2,y - .05,front + .015], [0xe7bb6d,0xa2bb99,0xb97352,0xe4d8b8][j]);
      box(detail, [.95,.08,.035], [x,y - .38,front + .02], 0xcc9b62);
    } else if (name === 'piano') {
      box(detail, [.9,.2,.02], [x,y - .25,front], 0xf5ebd3);
      for (let j = 0; j < 5; j++) box(detail, [.06,.13,.025], [x - .36 + j * .17,y - .21,front + .02], 0x28372f);
      box(detail, [.7,.08,.02], [x,y + .25,front], 0xb58a4b);
    } else if (name === 'lamp') {
      if (y === top) { box(detail, [.9,.8,.018], [x,y,front], 0xf9d681); for (let j = 0; j < 5; j++) box(detail, [.025,.75,.02], [x - .36 + j * .18,y,front + .02], 0xd9a951); }
      else { box(detail, [.86,.86,.016], [x,y,front], 0x9e773c); box(detail, [.13,.92,.025], [x,y,front + .02], 0xe4b35d); }
    } else if (name === 'fridge') {
      box(detail, [.86,.87,.02], [x,y,front], 0xe3dcc6);
      box(detail, [.06,.42,.04], [x - .26,y,front + .02], 0x637768);
      if (y === top) box(detail, [.19,.24,.035], [x + .15,y,front + .03], 0xdb9b75);
    } else if (name === 'aquarium') {
      box(detail, [.85,.73,.02], [x,y,front], 0xa4c9b8);
      const fish = box(detail, [.3,.14,.03], [x,y,front + .025], 0xe5a260); fish.rotation.z = .2;
      box(detail, [.84,.08,.03], [x,y - .4,front + .02], 0x436b54);
    } else if (name === 'armchair' || name === 'sofa') {
      box(detail, [.84,.79,.02], [x,y,front], 0xd99873);
      box(detail, [.7,.025,.03], [x,y - .24,front + .02], 0xb87653);
      box(detail, [.025,.65,.03], [x - .31,y,front + .02], 0xe9b58e);
    } else {
      const circle = new THREE.Mesh(new THREE.CircleGeometry(.35, 24), new THREE.MeshStandardMaterial({ color: name === 'drum kit' ? 0xf1dfb9 : 0x314c48, roughness: .6 }));
      circle.position.set(x,y,front + .02); detail.add(circle);
    }
  }
  parent.add(detail);
}

export function dressVan(scene: THREE.Scene, piece: THREE.Group, center: THREE.Vector3, puzzle: PackPuzzle, name: string) {
  scene.background = new THREE.Color(SKY);
  dressFurniture(piece, puzzle.piece, center, name);
  const { w, d } = puzzle.mold;
  const g = new THREE.Group(); scene.add(g);
  box(g, [w + .7,.35,d + .7], [(w - 1)/2,-.65,(d - 1)/2], GREEN);
  // A cutaway cargo hold keeps the packing slot and its depth readable.
  box(g, [w,.7,.18], [(w - 1)/2,-.12,-.68], GREEN);
  box(g, [w,.35,.18], [(w - 1)/2,-.32,d - .3], 0xdca755);
  box(g, [2.1,2.3,d + .5], [w + .55,.35,(d - 1)/2], GREEN);
  box(g, [1.85,.95,.03], [w + .55,1.05,d - .22], 0xa9c8b7);
  box(g, [.08,1,.04], [w + .1,1.05,d - .19], 0xe4d3ac);
  for (const x of [1, w + .55]) for (const z of [-.68,d - .3]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.63,.63,.35,20), new THREE.MeshStandardMaterial({color:0x293c35}));
    wheel.rotation.x = Math.PI/2; wheel.position.set(x,-.76,z); g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.38,16), new THREE.MeshStandardMaterial({color:0xcbbd9e}));
    hub.rotation.x = Math.PI/2; hub.position.copy(wheel.position); g.add(hub);
  }
  sign(g, 'Tight Fit', 1.6,.5, [w + .55,-.02,d - .17]);
  box(g, [.1,.28,.65], [w + 1.63,.15,d - .85], 0xf3d581);
  box(g, [w + 5,.12,d + 3], [w/2,-1.46,d/2], 0xd8d9c0);
}

export function dressDoor(scene: THREE.Scene) {
  scene.background = new THREE.Color(SKY);
  box(scene, [9,.2,7], [3.5,-.66,0], 0xd3d2b9);
  box(scene, [8.5,.24,.7], [3.5,7.55,0], GREEN);
  for (const x of [-.65,7.65]) box(scene, [.3,8.5,.6], [x,3.4,0], 0xc3a57c);
  sign(scene, 'Please mind the paint', 3,.6, [3.5,6.8,.53]);
  for (const x of [-1.2,8.2]) {
    box(scene, [.7,.9,.7], [x,-.1,1], 0xb97d56);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),new THREE.MeshStandardMaterial({color:0x658461}));
    leaves.position.set(x,.65,1); scene.add(leaves);
  }
}

export function disposeScenery(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) { if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose(); m.dispose(); }
}
