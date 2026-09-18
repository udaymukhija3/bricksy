// Mate: pieces attack where their shadow falls. Pick one of your pieces and one move — a slide or
// a quarter-turn — that leaves the red king with no safe square. The shadow after the move is
// never previewed; that is the prediction.
import * as THREE from 'three';
import type { Cell } from '../polycube';
import { SketchStage, cubeGroup, voxelMesh, panel, h, mulberry32, sleep, easeInOut, pulseMats, COLOR_OK, COLOR_BAD, AXIS_COLOR, cssColor, cubeGeo, edgeGeo } from './kit';
import type { SketchDef, MountCtx } from './types';
import { Log } from '../log';
import { Run } from '../run';
import { makePuzzle, apply, isMate, allAttacks, kingSquares, kingReplies, applyKing, matingMoves, spec, key, ACTIONS, actionLabel, type Puzzle, type State, type Action, type P } from './mate-model';

const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const stage = new SketchStage(stageEl, { gizmo: true, ground: null });
  const run = new Run({ id: 'mate', name: 'Mate', icon: '♟️', dailyRounds: 8 }, hudEl, stageEl);
  let puzzle!: Puzzle, state!: State, piece = 0, action: Action | null = null, busy = false, done = false, ply = 1;
  const world = new THREE.Group();
  stage.scene.add(world);
  let groups: ReturnType<typeof cubeGroup>[] = [];
  let king!: THREE.Group;
  const tiles = new THREE.Group();
  const marks = new THREE.Group();

  // ---- panel: piece chips · turn buttons · slide buttons · commit
  const chipsEl = h('div.parts');
  const acts = new Map<string, HTMLButtonElement>();
  const turnsEl = h('div#moves');
  const slidesEl = h('div.dpad.slides');
  for (const a of ACTIONS) {
    const label = a.type === 'turn' ? a.move.axis.toUpperCase() : a.dir[0].toUpperCase();
    const deg = a.type === 'turn' ? `${a.move.dir > 0 ? '+' : '−'}90°` : `slide ${a.dir[1] === '+' ? '+1' : '−1'}`;
    const axis = a.type === 'turn' ? a.move.axis : (a.dir[0] as 'x' | 'z');
    const b = h('button.mv', {
      onclick: () => pickAction(a),
      onpointerenter: () => { if (a.type === 'turn') stage.highlightAxis(a.move.axis, a.move.dir); },
      onpointerleave: () => stage.highlightAxis(null),
      title: actionLabel(a),
    }, h('span.ax', {}, label), h('span.deg', {}, deg)) as HTMLButtonElement;
    b.style.setProperty('--c', cssColor(AXIS_COLOR[axis]));
    acts.set(JSON.stringify(a), b);
    (a.type === 'turn' ? turnsEl : slidesEl).append(b);
  }
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Move ↵') as HTMLButtonElement;
  panelEl.append(chipsEl, h('div.layer-label', {}, 'turn (about the orange pivot cube)'), turnsEl, h('div.layer-label', {}, 'or slide one cell'), slidesEl, h('div#actions', {}, commitB));
  const P = panel(panelEl);

  function renderChips() {
    chipsEl.replaceChildren(...state.pieces.map((_, i) => h('button.part' + (i === piece ? '.on' : ''), { onclick: () => selectPiece(i), style: { '--c': '#3e8ff5' } }, h('span.sw'), h('span', {}, `Piece ${i + 1}`), h('span.sub', {}, `${state.pieces[i].cells.length} cubes`))));
  }
  function renderActions() {
    for (const a of ACTIONS) {
      const b = acts.get(JSON.stringify(a))!;
      b.disabled = done || busy || apply(state, piece, a) === null;
      b.classList.toggle('picked', !!action && same(a, action));
    }
  }
  function highlightPiece(i: number) {
    piece = i;
    groups.forEach((g, j) => { g.mats.base.emissive.set(j === i ? 0xffffff : 0x000000); g.mats.base.emissiveIntensity = 0.22; });
    renderChips();
  }
  function selectPiece(i: number) {
    if (busy || done) return;
    highlightPiece(i);
    action = null;
    renderActions();
  }
  function pickAction(a: Action) {
    if (busy || done) return;
    action = a;
    renderActions();
    P.message(`Piece ${piece + 1}: ${actionLabel(a)}.`);
  }

  // ---- scene
  const n = () => state.n;
  const frame = () => stage.place(30, 56, stage.fit((n() * Math.SQRT2) / 2 + 0.6, 1.05), [(n() - 1) / 2, 0.3, (n() - 1) / 2]);
  stage.onResize = frame;
  const plate = (p: P, color: number, y = -0.46, size = 0.94, opacity = 0.45) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, 0.04, size), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
    m.position.set(p[0], y, p[1]);
    return m;
  };
  function build() {
    world.clear();
    const a: Cell[] = [], b: Cell[] = [];
    for (let x = 0; x < n(); x++) for (let z = 0; z < n(); z++) ((x + z) & 1 ? a : b).push([x, -1, z]);
    world.add(voxelMesh(a, { color: 0x2a2f3c, outline: 0x3a4052 }).group, voxelMesh(b, { color: 0x343a49, outline: 0x3a4052 }).group);
    world.add(tiles, marks);
    king = new THREE.Group();
    // A little shorter than a cube and sunk into its tile, so a piece hovering one cell up clears it.
    const body = new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.5 }));
    body.scale.setScalar(0.85);
    body.position.y = -0.15;
    body.castShadow = true;
    body.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x0b0d12, transparent: true, opacity: 0.6 })));
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0xf5a524 }));
    crown.position.y = 0.375;
    king.add(body, crown);
    world.add(king);
    groups = state.pieces.map((pc) => { const g = cubeGroup(pc.cells, { marker: 0 }); world.add(g.group); return g; });
    syncScene();
    frame();
  }
  const ground = (cells: Cell[]) => -Math.min(...cells.map((c) => c[1]));
  function syncScene() {
    king.position.set(state.king[0], 0, state.king[1]);
    state.pieces.forEach((pc, i) => { groups[i].group.position.set(pc.anchor[0], ground(pc.cells), pc.anchor[1]); });
    tiles.clear();
    for (const k of allAttacks(state)) { const [x, z] = k.split(',').map(Number); tiles.add(plate([x, z], 0x3e8ff5)); }
  }

  function newPuzzle() {
    puzzle = makePuzzle(spec(run.level), mulberry32(run.nextSeed()));
    state = { n: puzzle.n, king: puzzle.king, pieces: puzzle.pieces };
    done = false; busy = false; action = null; ply = 1;
    marks.clear();
    build();
    selectPiece(0);
    commitB.disabled = false;
    commitB.textContent = puzzle.depth === 2 ? 'Move 1 of 2 ↵' : 'Move ↵';
    P.message('');
    P.clearPost();
    hintEl.textContent = puzzle.depth === 2
      ? `Mate in two: your move, the king steps to its safest square, your move. No single move mates now.`
      : `Blue tiles are attacked now. One move covers the king's cell and every neighbour.`;
    log.push('present', { sketch: 'mate', mode: run.mode, level: run.level, n: puzzle.n, king: puzzle.king, pieces: puzzle.pieces, depth: puzzle.depth });
  }

  function onClick(ev: MouseEvent) {
    if (busy || done) return;
    const hit = stage.pickAt(ev, groups.flatMap((g) => g.cubes))[0];
    if (!hit) return;
    const i = groups.findIndex((g) => g.cubes.includes(hit.object as THREE.Mesh));
    if (i >= 0) selectPiece(i);
  }
  stage.canvas.addEventListener('click', onClick);

  async function animate(i: number, a: Action, next: State) {
    const g = groups[i].group;
    if (a.type === 'turn') {
      run.sfx.turn();
      await stage.spin(g, a.move, 520);
      const y0 = g.position.y, y1 = ground(next.pieces[i].cells);
      if (y0 !== y1) await stage.tween(220, (t) => { g.position.y = y0 + (y1 - y0) * easeInOut(t); });
    } else {
      run.sfx.click();
      const from = g.position.clone(), to = new THREE.Vector3(next.pieces[i].anchor[0], from.y, next.pieces[i].anchor[1]);
      await stage.tween(360, (t) => { g.position.lerpVectors(from, to, easeInOut(t)); g.position.y = from.y + Math.sin(t * Math.PI) * 0.4; });
      g.position.copy(to);
    }
    state = next;
    // Cells are rebuilt from the model so the render never drifts from the lattice.
    g.quaternion.identity();
    const fresh = cubeGroup(next.pieces[i].cells, { marker: 0 });
    world.remove(g);
    groups[i] = fresh;
    world.add(fresh.group);
    syncScene();
    stage.highlightAxis(null);
  }

  /** The king's reply: the square that leaves you the fewest mating answers (ties: first). */
  function kingReply(s: State): P {
    const rs = kingReplies(s);
    let best = rs[0], bestN = Infinity;
    for (const r of rs) { const n = matingMoves(applyKing(s, r)).length; if (n < bestN) { best = r; bestN = n; } }
    return best;
  }
  async function animateKing(to: P) {
    const from = king.position.clone(), dest = new THREE.Vector3(to[0], 0, to[1]);
    if (from.distanceTo(dest) < 1e-6) { await stage.tween(300, (t) => { king.position.y = Math.sin(t * Math.PI) * 0.25; }); king.position.y = 0; return; }
    run.sfx.click();
    await stage.tween(420, (t) => { king.position.lerpVectors(from, dest, easeInOut(t)); king.position.y = Math.sin(t * Math.PI) * 0.5; });
    king.position.copy(dest);
  }

  function showVerdict(mate: boolean) {
    marks.clear();
    const att = allAttacks(state);
    marks.add(plate(state.king, att.has(key(state.king)) ? 0xe5484d : 0x46a758, -0.44, 0.7, 0.9));
    for (const p of kingSquares(state)) marks.add(plate(p, att.has(key(p)) ? 0xe5484d : 0x46a758, -0.44, 0.7, 0.9));
    if (mate) void pulseMats(stage.ticker, [king.children[0] instanceof THREE.Mesh ? (king.children[0].material as THREE.MeshStandardMaterial) : groups[0].mats.base], COLOR_BAD, 1400);
  }

  async function commit() {
    if (busy || done) return;
    if (!action) { P.message('Pick a move first.', 'bad'); return; }
    const next = apply(state, piece, action);
    if (!next) { P.message('That move is not legal.', 'bad'); return; }
    busy = true;
    commitB.disabled = true;
    renderActions();
    const mate = isMate(next);
    if (puzzle.depth === 2 && ply === 1 && !mate) {
      // First of two: the move plays, then the king answers, then the board is yours again.
      const isAnswer = piece === puzzle.answer.piece && same(action, puzzle.answer.action);
      log.push('commit', { sketch: 'mate', ply: 1, piece, action, isAnswer });
      await animate(piece, action, next);
      await sleep(250);
      const reply = kingReply(state);
      const moved = key(reply) !== key(state.king);
      await animateKing(reply);
      state = applyKing(state, reply);
      syncScene();
      ply = 2;
      action = null;
      busy = false;
      commitB.disabled = false;
      commitB.textContent = 'Move 2 of 2 ↵';
      renderActions();
      P.message(moved ? `The king stepped to ${key(reply)}. Your second move.` : 'The king stays put. Your second move.');
      return;
    }
    const isAnswer = ply === 1 ? piece === puzzle.answer.piece && same(action, puzzle.answer.action) : (() => { const f = puzzle.followUps?.[key(state.king)]; return !!f && f.piece === piece && same(action, f.action); })();
    log.push('result', { sketch: 'mate', ply, piece, action, ok: mate, isAnswer, answer: puzzle.answer });
    await animate(piece, action, next);
    showVerdict(mate);
    done = true; busy = false;
    mate ? run.hit() : run.miss();
    const safe = kingSquares(state).filter((p) => !allAttacks(state).has(key(p))).length + (allAttacks(state).has(key(state.king)) ? 0 : 1);
    const lost = puzzle.depth === 2 && !mate && !matingMoves({ ...state }).length && ply === 2 ? ' After your first move no mate was possible.' : '';
    P.message(mate ? 'Mate. The king has nowhere to go.' : `Not mate — ${safe} safe square${safe === 1 ? '' : 's'} left (green).${lost}`, mate ? 'ok' : 'bad');
    if (run.over) { run.showOver(newPuzzle); return; }
    P.post([{ label: 'Next ↵', primary: true, onClick: newPuzzle }, ...(mate ? [] : [{ label: 'Show answer', onClick: showAnswer }])]);
  }

  async function showAnswer() {
    if (busy) return;
    busy = true;
    P.clearPost();
    marks.clear();
    state = { n: puzzle.n, king: puzzle.king, pieces: puzzle.pieces };
    build();
    highlightPiece(puzzle.answer.piece);
    await sleep(400);
    const next = apply(state, puzzle.answer.piece, puzzle.answer.action)!;
    await animate(puzzle.answer.piece, puzzle.answer.action, next);
    let text = `Answer: piece ${puzzle.answer.piece + 1}, ${actionLabel(puzzle.answer.action)}.`;
    if (puzzle.depth === 2) {
      await sleep(250);
      const reply = kingReply(state);
      await animateKing(reply);
      state = applyKing(state, reply);
      syncScene();
      const f = puzzle.followUps![key(reply)];
      highlightPiece(f.piece);
      await sleep(300);
      const last = apply(state, f.piece, f.action)!;
      await animate(f.piece, f.action, last);
      text += ` The king goes to ${key(reply)}; then piece ${f.piece + 1}, ${actionLabel(f.action)}.`;
    }
    showVerdict(true);
    void pulseMats(stage.ticker, [groups[puzzle.answer.piece].mats.base], COLOR_OK);
    busy = false;
    P.message(text, 'ok');
    log.push('reveal', { sketch: 'mate' });
    P.post([{ label: 'Next ↵', primary: true, onClick: newPuzzle }]);
  }

  run.begin(newPuzzle);
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') { if (!done && !busy) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (/^[1-3]$/.test(e.key) && Number(e.key) <= state.pieces.length) selectPiece(Number(e.key) - 1);
    else if (k === 'x' || k === 'y' || k === 'z') pickAction({ type: 'turn', move: { axis: k, dir: e.shiftKey ? -1 : 1 } });
    else if (e.key === 'ArrowLeft') pickAction({ type: 'slide', dir: 'x-' });
    else if (e.key === 'ArrowRight') pickAction({ type: 'slide', dir: 'x+' });
    else if (e.key === 'ArrowUp') pickAction({ type: 'slide', dir: 'z-' });
    else if (e.key === 'ArrowDown') pickAction({ type: 'slide', dir: 'z+' });
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.canvas.removeEventListener('click', onClick); stage.dispose(); };
}

export const mate: SketchDef = {
  id: 'mate', title: 'Mate', status: 'playable', skill: 'multi-step transformation lookahead', icon: '♟️',
  tagline: 'Pieces attack where their shadow falls. Turn or slide one piece so the red king has nowhere left — without seeing the new shadow first.',
  about: 'Lookahead over transformations: a piece attacks where its shadow falls, and a turn changes the shadow\'s shape, not just its place. The shadow after your move is never previewed. Puzzles are searched to have exactly one answer, forced to be a turn, then a turn about a horizontal axis, then mate in two with a king that steps to its safest square.',
  controls: '1–3 select a piece, x y z turn it (shift for −90°), arrows slide it, Enter moves.',
  mount,
};
