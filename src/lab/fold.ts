// Fold: a cube net with symbols. Which face ends up opposite the marked one? Commit, then it folds.
import * as THREE from 'three';
import { NETS, hinges, hingeRotation, opposite, type Net } from './nets';
import { SketchStage, panel, hud, h, mulberry32, pick, sleep, easeInOut } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';

const SYMBOLS = ['●', '▲', '■', '★', '◆', '✚'];
const COLORS = ['#e5484d', '#46a758', '#3e8ff5', '#f5a524', '#b56be0', '#2ec4b6'];

function faceTexture(symbol: string, color: string, border: string | null) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8eaf0';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = border ?? '#2a2e3a';
  g.lineWidth = border ? 14 : 6;
  g.strokeRect(0, 0, 128, 128);
  g.fillStyle = color;
  g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { ground: -1.6 });
  const H = hud(hudEl, ['right', 'seen']);
  let right = 0, seen = 0;
  let net!: Net, asked = 0, answer = 0, picked = -1;
  let faces: THREE.Mesh[] = [];
  let cubeCentre = new THREE.Vector3();
  let pivots: { pivot: THREE.Group; dx: number; dz: number }[] = [];
  const world = new THREE.Group();
  stage.scene.add(world);
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Fold it ↵') as HTMLButtonElement;
  panelEl.append(h('p', { style: { margin: 0, color: 'var(--muted)' } }, 'Click the face you think ends up opposite the highlighted one.'), h('div#actions', {}, commitB));
  const P = panel(panelEl);
  const frame = () => stage.place(20, 46, stage.fit(2.7, 1.02), [0, -0.3, 0]);
  stage.onResize = frame;

  function setBorder(i: number, border: string | null) {
    const m = faces[i].material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.map = faceTexture(SYMBOLS[i], COLORS[i], border);
    m.needsUpdate = true;
  }

  function build() {
    const rng = mulberry32(Date.now());
    net = pick(NETS, rng);
    asked = Math.floor(rng() * 6);
    answer = opposite(net, asked);
    picked = -1;
    world.clear();
    world.rotation.set(0, 0, 0);
    faces = [];
    pivots = [];
    // Face groups: root at origin; each child hangs off a pivot at the shared edge of its parent.
    const groups: THREE.Group[] = net.map(() => new THREE.Group());
    for (let i = 0; i < net.length; i++) {
      const mat = new THREE.MeshStandardMaterial({ map: faceTexture(SYMBOLS[i], COLORS[i], i === asked ? '#f5a524' : null), side: THREE.DoubleSide, roughness: 0.8 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2; // lie flat, symbol up
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.index = i;
      faces.push(mesh);
      groups[i].add(mesh);
    }
    for (const hg of hinges(net)) {
      const pivot = new THREE.Group();
      pivot.position.set(hg.dx / 2, 0, hg.dz / 2);
      groups[hg.face].position.set(hg.dx / 2, 0, hg.dz / 2);
      pivot.add(groups[hg.face]);
      groups[hg.parent].add(pivot);
      pivots.push({ pivot, dx: hg.dx, dz: hg.dz });
    }
    // Centre the net in view.
    const cx = net.reduce((s, c) => s + c[0], 0) / 6 - net[0][0], cz = net.reduce((s, c) => s + c[1], 0) / 6 - net[0][1];
    groups[0].position.set(-cx, 0, -cz);
    cubeCentre = new THREE.Vector3(-cx, -0.5, -cz); // where the cube's centre sits once folded
    world.position.set(0, 0, 0);
    world.add(groups[0]);
    frame();
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `Which face ends up opposite ${SYMBOLS[asked]}?`;
    H.set('right', right); H.set('seen', seen);
    log.push('present', { sketch: 'fold', net, asked });
  }

  function setFold(angle: number) {
    for (const { pivot, dx, dz } of pivots) {
      const r = hingeRotation(dx, dz, angle);
      pivot.rotation.set(r.axis === 'x' ? r.angle : 0, 0, r.axis === 'z' ? r.angle : 0);
    }
  }

  function onClick(ev: MouseEvent) {
    if (commitB.disabled) return;
    const hit = stage.pickAt(ev, faces)[0];
    if (!hit) return;
    const i = hit.object.userData.index as number;
    if (i === asked) { P.message('That is the marked face itself.', 'bad'); return; }
    if (picked >= 0) setBorder(picked, null);
    picked = i;
    setBorder(picked, '#ffffff');
    P.message(`${SYMBOLS[picked]} picked.`);
  }
  stage.canvas.addEventListener('click', onClick);

  async function commit() {
    if (picked < 0) { P.message('Pick a face first.', 'bad'); return; }
    commitB.disabled = true;
    seen++;
    const ok = picked === answer;
    if (ok) right++;
    log.push('result', { sketch: 'fold', picked, answer, ok });
    await stage.tween(1600, (t) => setFold(easeInOut(t) * Math.PI / 2));
    await sleep(200);
    // Bring the cube to the origin so the tumble turns it in place.
    const shift = cubeCentre.clone().negate();
    await stage.tween(400, (t) => world.position.lerpVectors(new THREE.Vector3(), shift, easeInOut(t)));
    setBorder(answer, '#46a758');
    if (!ok) setBorder(picked, '#e5484d');
    // Tumble so both the marked face and its opposite come into view.
    const axis = new THREE.Vector3(1, 0.6, 0.3).normalize();
    await stage.tween(3200, (t) => world.quaternion.setFromAxisAngle(axis, easeInOut(t) * Math.PI * 2));
    P.message(ok ? `${SYMBOLS[answer]} is opposite ${SYMBOLS[asked]}.` : `${SYMBOLS[answer]} is opposite ${SYMBOLS[asked]} — ${SYMBOLS[picked]} ended up ${describe(picked)}.`, ok ? 'ok' : 'bad');
    H.set('right', right); H.set('seen', seen);
    P.post([{ label: 'Next ↵', primary: true, onClick: build }, { label: 'Unfold', onClick: async () => { await stage.tween(900, (t) => world.quaternion.setFromAxisAngle(axis, (1 - easeInOut(t)) * Math.PI * 2)); await stage.tween(400, (t) => world.position.lerpVectors(shift, new THREE.Vector3(), easeInOut(t))); await stage.tween(1200, (t) => setFold((1 - easeInOut(t)) * Math.PI / 2)); } }]);
  }

  function describe(i: number) {
    // Adjacent faces share an edge with the marked face after folding.
    return i === asked ? 'the same face' : 'next to it (they share an edge)';
  }

  build();
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.canvas.removeEventListener('click', onClick); stage.dispose(); };
}

export const fold: SketchDef = {
  id: 'fold', title: 'Fold', status: 'playable', skill: 'net → solid',
  tagline: 'A flat net of a cube, each face marked. Which face ends up opposite the highlighted one? Commit, then watch it fold.',
  mount,
};
