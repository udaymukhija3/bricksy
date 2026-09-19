// Assemble: a target volume and its parts, each shown turned away from how it fits. Give every
// part its turns and an anchor cell, then build: the parts fly in one by one and the first
// collision stops the build. The whole composition is the unit of prediction.
import * as THREE from 'three';
import type { Cell } from '../polycube.ts';
import { SketchStage, cubeGroup, turnQueue, panel, h, mulberry32, sleep, easeInOut, pulseMats, COLOR_OK, COLOR_BAD, cubeGeo, edgeGeo, tap } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';
import { makePuzzle, build as check, spec, cellKey, type Puzzle, type Plan } from './assemble-model.ts';

const PART_COLORS = [0xb56be0, 0x2ec4b6, 0xf28cb1, 0x9ec26b];
const PART_NAMES = ['purple', 'teal', 'pink', 'olive'];
const TRAY_GAP = 3.2, TRAY_Z = 3.8;

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true, ground: -0.5 });
  const run = new Run({ id: 'assemble', name: 'Assemble', icon: '🧩', dailyRounds: 6 }, hudEl, stageEl);
  let puzzle!: Puzzle, plans: Plan[] = [], active = 0, busy = false, done = false;
  const world = new THREE.Group();
  stage.scene.add(world);
  let ghost!: ReturnType<typeof cubeGroup>;
  let parts: ReturnType<typeof cubeGroup>[] = [];
  let trayPos: THREE.Vector3[] = [];
  let anchorMarks = new THREE.Group();

  // ---- panel: part chips · anchor grid (a layer-by-layer view of the target) · the active part's turn queue · message
  const chipsEl = h('div.parts');
  const anchorsEl = h('div');
  const queuesEl = h('div');
  panelEl.append(chipsEl, anchorsEl, queuesEl);
  const anchorCells = new Map<string, HTMLButtonElement>();

  /** Layer grids of the target; tapping a cell anchors the active part there (same as clicking the ghost). */
  function buildAnchorGrid() {
    anchorsEl.replaceChildren();
    anchorCells.clear();
    const xs = puzzle.target.map((c) => c[0]), ys = puzzle.target.map((c) => c[1]), zs = puzzle.target.map((c) => c[2]);
    const w = Math.max(...xs) + 1, hgt = Math.max(...ys) + 1, d = Math.max(...zs) + 1;
    const cells = new Set(puzzle.target.map(cellKey));
    const wrap = h('div.layers');
    for (let y = 0; y < hgt; y++) {
      const grid = h('div.grid', { style: { gridTemplateColumns: `repeat(${w}, 1fr)` } });
      for (let z = d - 1; z >= 0; z--) for (let x = 0; x < w; x++) {
        const k = cellKey([x, y, z]);
        const inTarget = cells.has(k);
        const b = h('button.cell' + (inTarget ? '' : '.void'), { disabled: inTarget ? null : 'true', title: inTarget ? `anchor at ${k}` : null, onclick: () => setAnchor([x, y, z]) }) as HTMLButtonElement;
        if (inTarget) anchorCells.set(k, b);
        grid.append(b);
      }
      wrap.append(h('div.layer', {}, h('div.layer-label', {}, `layer ${y + 1}${y === 0 ? ' (bottom)' : ''}`), grid));
    }
    anchorsEl.append(h('div.layer-label', {}, `anchor: tap a target cell (far row at the top), or ${tap} the ghost`), wrap);
  }
  function paintAnchorGrid() {
    for (const [k, b] of anchorCells) {
      const owner = plans.findIndex((p) => p.anchor && cellKey(p.anchor) === k);
      b.style.background = owner >= 0 ? '#' + PART_COLORS[owner].toString(16).padStart(6, '0') : '';
      b.style.borderColor = owner >= 0 ? '#f5a524' : '';
      b.classList.toggle('on', owner >= 0);
    }
  }
  function setAnchor(cell: Cell, depth = 0, under = 1) {
    if (busy || done) return;
    plans[active].anchor = cell;
    renderAnchors();
    renderChips();
    paintAnchorGrid();
    log.push('anchor', { sketch: 'assemble', part: active, anchor: cell, depth });
    P.message(`Part ${active + 1}'s handle will land on ${cellKey(cell)}${under > 1 ? ` — ${under} cells under the cursor, ${tap} again for the next one back` : ''}.`);
  }
  const P = panel(panelEl);
  let queues: ReturnType<typeof turnQueue>[] = [];
  const queueBoxes: HTMLElement[] = [];

  function renderChips() {
    chipsEl.replaceChildren(...puzzle.parts.map((_, i) => {
      const plan = plans[i];
      const turns = plan.moves.length;
      return h('button.part' + (i === active ? '.on' : ''), { onclick: () => select(i), style: { '--c': '#' + PART_COLORS[i].toString(16).padStart(6, '0') } },
        h('span.sw'), h('span', {}, `Part ${i + 1}`), h('span.sub', {}, `${turns} turn${turns === 1 ? '' : 's'} · ${plan.anchor ? 'anchor ✓' : 'no anchor'}`));
    }));
  }
  function select(i: number) {
    if (busy) return;
    active = i;
    queueBoxes.forEach((b, j) => { b.hidden = j !== i; queues[j].enabled = j === i && !done; });
    parts.forEach((p, j) => { p.mats.base.emissive.set(j === i ? 0xffffff : 0x000000); p.mats.base.emissiveIntensity = 0.18; });
    renderChips();
    hintEl.textContent = `Part ${i + 1} (${PART_NAMES[i]}): queue its turns, then ${tap} the target cell where its orange handle cube should land.`;
  }

  // ---- scene
  const frame = () => {
    const tx = puzzle.target.map((c) => c[0]), ty = puzzle.target.map((c) => c[1]), tz = puzzle.target.map((c) => c[2]);
    const cx = (Math.min(...tx) + Math.max(...tx)) / 2;
    const trayZ = Math.max(...tz) + TRAY_Z;
    const spanX = Math.max(Math.max(...tx) - Math.min(...tx) + 1, puzzle.parts.length * TRAY_GAP);
    const spanZ = trayZ - Math.min(...tz) + 2;
    stage.place(24, 40, stage.fit(Math.hypot(spanX, Math.max(...ty) + 1.5, spanZ) / 2 + 0.4, 1.06), [cx, 0.4, (Math.min(...tz) + trayZ) / 2 - 0.3]);
  };
  stage.onResize = frame;

  function buildScene() {
    world.clear();
    ghost = cubeGroup(puzzle.target, { ghost: true, color: 0x9ec2ff });
    world.add(ghost.group);
    const tx = puzzle.target.map((c) => c[0]), tz = puzzle.target.map((c) => c[2]);
    const cx = (Math.min(...tx) + Math.max(...tx)) / 2, trayZ = Math.max(...tz) + TRAY_Z;
    parts = []; trayPos = [];
    puzzle.parts.forEach((pt, i) => {
      // Group origin = the handle (cell 0), so turns spin about it and the anchor is where it lands.
      const g = cubeGroup(pt.cells, { marker: 0, color: PART_COLORS[i] });
      const xs = pt.cells.map((c) => c[0]), zs = pt.cells.map((c) => c[2]), ys = pt.cells.map((c) => c[1]);
      const pos = new THREE.Vector3(cx + (i - (puzzle.parts.length - 1) / 2) * TRAY_GAP - (Math.min(...xs) + Math.max(...xs)) / 2, -Math.min(...ys), trayZ - (Math.min(...zs) + Math.max(...zs)) / 2);
      g.group.position.copy(pos);
      trayPos.push(pos.clone());
      world.add(g.group);
      parts.push(g);
    });
    anchorMarks = new THREE.Group();
    world.add(anchorMarks);
    frame();
  }
  function renderAnchors() {
    anchorMarks.clear();
    plans.forEach((plan, i) => {
      if (!plan.anchor) return;
      const m = new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: PART_COLORS[i], roughness: 0.5, depthTest: false, transparent: true, opacity: 0.95 }));
      m.renderOrder = 6;
      m.scale.setScalar(0.5);
      m.position.set(plan.anchor[0], plan.anchor[1], plan.anchor[2]);
      m.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xf5a524 })));
      anchorMarks.add(m);
    });
  }

  function newPuzzle() {
    puzzle = makePuzzle(spec(run.level), mulberry32(run.nextSeed()));
    plans = puzzle.parts.map(() => ({ moves: [], anchor: null }));
    done = false; busy = false;
    buildScene();
    renderAnchors();
    buildAnchorGrid();
    paintAnchorGrid();
    for (const q of queues) q.dispose();
    queues = []; queueBoxes.length = 0;
    queuesEl.replaceChildren();
    puzzle.parts.forEach((_, i) => {
      const box = h('div');
      queuesEl.append(box);
      queueBoxes.push(box);
      const q = turnQueue(box, { commitLabel: 'Build ↵', max: 4, allowEmpty: true, onHover: (a, d) => stage.highlightAxis(a, d), onCommit: () => void startBuild() });
      q.onChange = (moves) => { plans[i].moves = [...moves]; renderChips(); };
      queues.push(q);
    });
    P.message('');
    P.clearPost();
    select(0);
    log.push('present', { sketch: 'assemble', mode: run.mode, level: run.level, target: puzzle.target, parts: puzzle.parts.map((p) => p.cells) });
  }

  // Clicking the same spot again cycles to the cell behind, so occluded target cells are reachable.
  let lastPick = { keys: '', idx: 0 };
  function onClick(ev: MouseEvent) {
    if (busy || done) return;
    const hits = stage.pickAt(ev, ghost.cubes);
    if (!hits.length) return;
    const cells = hits.map((h) => h.object.userData.cell as Cell);
    const keys = cells.map(cellKey).join('|');
    lastPick = keys === lastPick.keys ? { keys, idx: (lastPick.idx + 1) % cells.length } : { keys, idx: 0 };
    setAnchor(cells[lastPick.idx], lastPick.idx, cells.length);
  }
  stage.canvas.addEventListener('click', onClick);

  async function flyIn(i: number, plan: Plan) {
    const g = parts[i].group;
    for (const m of plan.moves) { run.sfx.turn(); await stage.spin(g, m, 240); }
    await sleep(80);
    const from = g.position.clone(), to = new THREE.Vector3(plan.anchor![0], plan.anchor![1], plan.anchor![2]);
    run.sfx.click();
    await stage.tween(480, (t) => { const k = easeInOut(t); g.position.lerpVectors(from, to, k); g.position.y += Math.sin(t * Math.PI) * 1.2; });
    g.position.copy(to);
  }

  async function startBuild() {
    if (busy || done) return;
    const missing = plans.findIndex((p) => !p.anchor);
    if (missing >= 0) { select(missing); P.message(`Part ${missing + 1} has no anchor — ${tap} a target cell for it.`, 'bad'); return; }
    busy = true;
    for (const q of queues) q.enabled = false;
    const out = check(puzzle, plans);
    log.push('commit', { sketch: 'assemble', plans, ok: out.ok, failedAt: out.failedAt, reason: out.reason });
    log.push('result', { sketch: 'assemble', ok: out.ok, failedAt: out.failedAt, reason: out.reason });
    for (let i = 0; i < puzzle.parts.length; i++) {
      select(i);
      await flyIn(i, plans[i]);
      if (out.failedAt === i) {
        void pulseMats(stage.ticker, [parts[i].mats.base, parts[i].mats.marker], COLOR_BAD, 1200);
        run.sfx.thud();
        await stage.shake();
        break;
      }
      void pulseMats(stage.ticker, [parts[i].mats.base], COLOR_OK, 500);
      run.sfx.thud();
      await sleep(120);
    }
    parts.forEach((p) => { p.mats.base.emissive.set(0x000000); });
    done = true; busy = false;
    out.ok ? run.hit() : run.miss();
    const why = out.reason === 'outside' ? `part ${out.failedAt + 1} sticks out of the target` : out.reason === 'overlap' ? `part ${out.failedAt + 1} lands on a part already placed` : '';
    P.message(out.ok ? 'Built. Every part in its place.' : `Collision — ${why}. The build stops there.`, out.ok ? 'ok' : 'bad');
    if (run.over) { run.showOver(newPuzzle); return; }
    P.post([{ label: 'Next ↵', primary: true, onClick: newPuzzle }, ...(out.ok ? [] : [{ label: 'Show solution', onClick: showSolution }])]);
  }

  async function showSolution() {
    if (busy) return;
    busy = true;
    P.clearPost();
    parts.forEach((p, i) => { p.group.position.copy(trayPos[i]); p.group.quaternion.identity(); });
    anchorMarks.clear();
    plans = puzzle.parts.map((pt) => ({ moves: [...pt.solution.moves], anchor: pt.solution.anchor }));
    renderAnchors();
    paintAnchorGrid();
    await sleep(300);
    for (let i = 0; i < puzzle.parts.length; i++) { select(i); await flyIn(i, puzzle.parts[i].solution); void pulseMats(stage.ticker, [parts[i].mats.base], COLOR_OK, 500); await sleep(120); }
    parts.forEach((p) => { p.mats.base.emissive.set(0x000000); });
    busy = false;
    log.push('reveal', { sketch: 'assemble' });
    P.post([{ label: 'Next ↵', primary: true, onClick: newPuzzle }]);
  }

  run.begin(newPuzzle);
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && done) { (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); e.preventDefault(); }
    else if (/^[1-4]$/.test(e.key) && Number(e.key) <= puzzle.parts.length) { select(Number(e.key) - 1); e.preventDefault(); }
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.canvas.removeEventListener('click', onClick); for (const q of queues) q.dispose(); stage.dispose(); };
}

export const assemble: SketchDef = {
  id: 'assemble', title: 'Assemble', status: 'playable', skill: 'part–whole composition', icon: '🧩',
  tagline: 'A ghost of the whole and its parts, each shown turned away from how it fits. Give every part its turns and an anchor, then build — the first collision stops it.',
  about: 'Part–whole composition: several parts, one silhouette, mutual exclusion. Placing one part at a time with live feedback degrades to trial and error, so every part gets its turns and an anchor before anything moves and the first collision stops the build.',
  controls: `1–4 select a part, x y z queue its turns (shift for −90°), ${tap} a ghost cell for its anchor (${tap} again for the cell behind), Enter builds.`,
  mount,
};
