// Shadows: read three silhouettes, construct a prediction, then cast it.
import type { Cell } from '../polycube.ts';
import { layerBuilder, panel, h, mulberry32, helpOpen } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';
import { assess, makeCase, project, setup, validCells, VIEWS, type Dims, type View } from './shadows-model.ts';
import { ShadowsScene } from './shadows-scene.ts';
export { makeCase, project, setup } from './shadows-model.ts';

const VIEW_LABEL: Record<View, string> = { top: 'Top', front: 'Front', right: 'Right' };
const VIEW_CAPTION: Record<View, string> = { top: 'back ↑ · front ↓', front: 'left → right', right: 'front → back' };
const SVG_NS = 'http://www.w3.org/2000/svg';

function silhouette(view: View, dims: Dims, target: Set<string>, mine?: Set<string>) {
  const cols = view === 'right' ? dims.d : dims.w, rows = view === 'top' ? dims.d : dims.h;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${cols * 24} ${rows * 24}`);
  svg.setAttribute('role', 'img');
  const description: string[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const key = `${col},${row}`, wanted = target.has(key), placed = mine?.has(key);
    const state = mine ? wanted && placed ? 'match' : wanted ? 'missing' : placed ? 'extra' : 'empty' : wanted ? 'target' : 'empty';
    const rect = document.createElementNS(SVG_NS, 'rect');
    for (const [attr, value] of Object.entries({ x: col * 24 + 2, y: row * 24 + 2, width: 20, height: 20, rx: 3, class: state })) rect.setAttribute(attr, String(value));
    svg.append(rect);
    if (state !== 'empty') description.push(`row ${row + 1} column ${col + 1} ${state}`);
    if (state === 'extra') {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M${col * 24 + 8},${row * 24 + 8}l8,8m0,-8l-8,8`); path.setAttribute('class', 'extra-cross'); svg.append(path);
    }
  }
  svg.setAttribute('aria-label', `${VIEW_LABEL[view]} silhouette: ${description.join('; ')}`);
  return svg;
}

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  const frameEl = stageEl.parentElement!;
  frameEl.classList.add('shadows-game');
  const run = new Run({ id: 'shadows', name: 'Shadows', icon: '🔦', dailyRounds: 6 }, hudEl, stageEl);
  let dims: Dims = { w: 3, h: 3, d: 3 }, n = 5, hidden: Cell[] = [];
  let target = project([], dims), result: ReturnType<typeof assess> | null = null;
  let phase: 'build' | 'cast' | 'result' = 'build', practice = false, generation = 0;
  let presented = 0, firstInput = 0, draftKey = '';
  let LB: ReturnType<typeof layerBuilder>;
  const scene = new ShadowsScene(stageEl, (cell) => { if (canEdit()) LB.toggle(cell); });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const evidenceNote = h('span', {}, 'Three views. One hidden object.');
  const cards = h('div.shadow-clues');
  const evidence = h('section.shadow-evidence', { 'aria-label': 'Silhouette clues' },
    h('div.shadow-section-label', {}, h('b', {}, '01 / READ THE SHADOWS'), evidenceNote), cards);
  frameEl.insertBefore(evidence, stageEl);
  const stageStatus = h('span', { 'aria-live': 'polite' }, 'Shadows hidden until you commit');
  const stageTitle = h('div.shadow-stage-title', {}, h('b', {}, '02 / YOUR BUILD'), stageStatus);
  const sceneHint = h('span', {}, 'Tap the gold layer to place cubes');
  const orbit = (dir: number) => { if (phase === 'cast' || helpOpen(stageEl)) return; scene.turn(dir); log.push('view', { sketch: 'shadows', dir }); };
  const turnLeft = h('button', { 'aria-label': 'View from the left', onclick: () => orbit(-1) }, '↶');
  const turnRight = h('button', { 'aria-label': 'View from the right', onclick: () => orbit(1) }, '↷');
  stageEl.append(stageTitle, h('div.shadow-scene-tools', {}, sceneHint, h('div', {}, turnLeft, turnRight)));

  const count = h('b', {}, '0 / 5');
  const counter = h('div.shadow-count', {}, h('div', {}, h('span.shadow-eyebrow', {}, 'MAKE YOUR PREDICTION'), h('h2', {}, 'Build what casts them.')), h('div', {}, count, h('span', {}, 'cubes')));
  const builderBox = h('div.shadow-builder');
  const undoB = h('button', { onclick: () => { if (canEdit()) { log.push('undo', { sketch: 'shadows' }); LB.undo(); } }, title: 'Backspace or Ctrl/Cmd+Z' }, '↶ Undo') as HTMLButtonElement;
  const clearB = h('button', { onclick: () => { if (canEdit()) { log.push('clear', { sketch: 'shadows' }); LB.clear(); } } }, 'Clear') as HTMLButtonElement;
  const commitB = h('button.primary.shadow-commit', { onclick: () => void commit(), title: 'Enter' }, 'Cast shadows ↵') as HTMLButtonElement;
  const editHelp = h('p.shadow-edit-help', {}, 'Tap a square to add or remove a cube. Change layers to build upward.');
  const controls = h('div.shadow-controls', {}, h('div.shadow-edit-actions', {}, undoB, clearB), commitB);
  panelEl.append(counter, builderBox, editHelp, controls);
  const P = panel(panelEl, null);
  const message = panelEl.querySelector('#message')!;
  message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const clueEls = new Map<View, HTMLElement>();

  function canEdit() { return phase === 'build' && !helpOpen(stageEl) && (!run.over || practice); }

  function drawClues(revealed: View[] = []) {
    cards.replaceChildren(); clueEls.clear();
    for (const view of VIEWS) {
      const shown = revealed.includes(view) && result;
      const errors = shown ? result!.diff[view].missing.size + result!.diff[view].extra.size : 0;
      const label = shown ? errors ? `${errors} ${errors === 1 ? 'mismatch' : 'mismatches'}` : '✓ Match' : VIEW_CAPTION[view];
      const card = h('div.shadow-clue' + (shown ? errors ? '.has-errors' : '.matched' : ''), { 'data-view': view },
        h('div.shadow-clue-title', {}, h('b', {}, VIEW_LABEL[view]), h('span', {}, view === 'top' ? '↓' : view === 'front' ? '↗' : '↖')),
        silhouette(view, dims, target[view], shown ? result!.mine[view] : undefined),
        h('span.shadow-clue-status', {}, label));
      if (shown) card.append(h('button.shadow-inspect', { 'aria-label': `Inspect ${view} shadow`, onclick: () => {
        if (phase !== 'result') return;
        scene.showProjection(view, LB.cells, target[view]);
        for (const [v, el] of clueEls) el.classList.toggle('inspecting', v === view);
        stageStatus.textContent = `${VIEW_LABEL[view]} shadow · ${label}`;
      } }, 'Inspect'));
      cards.append(card); clueEls.set(view, card);
    }
  }

  function saveDraft() {
    if (!draftKey || practice || phase !== 'build' || run.over) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ cells: LB.cells, layer: LB.activeLayer })); } catch { /* optional persistence */ }
  }

  function refresh() {
    const editing = phase === 'build' && !run.over || practice && phase === 'build';
    scene.render(LB.cells, LB.activeLayer, editing);
    count.textContent = `${LB.cells.length} / ${n}`;
    count.classList.toggle('complete', LB.cells.length === n);
    commitB.disabled = !editing || LB.cells.length !== n;
    undoB.disabled = !editing || !LB.canUndo; clearB.disabled = !editing || LB.cells.length === 0;
    LB.enabled = editing;
    commitB.hidden = phase === 'result';
    controls.hidden = phase === 'result';
    editHelp.hidden = phase !== 'build';
    turnLeft.toggleAttribute('disabled', phase === 'cast'); turnRight.toggleAttribute('disabled', phase === 'cast');
    sceneHint.textContent = editing ? `Editing layer ${LB.activeLayer + 1} · tap gold squares` : 'Select a shadow to inspect the projection';
    hintEl.textContent = `${n} cubes. Any build that matches all three views wins.`;
  }

  function newCase() {
    generation++; phase = 'build'; practice = false; result = null;
    ({ dims, n } = setup(run.level));
    const seed = run.nextSeed(); hidden = makeCase(dims, n, mulberry32(seed)); target = project(hidden, dims);
    draftKey = run.mode === 'daily' ? `bricksy.shadows.draft.${run.date}.${seed}.${run.level}` : '';
    builderBox.replaceChildren();
    LB = layerBuilder(builderBox, dims, { compact: true, max: n, onChange: () => {
      firstInput ||= performance.now();
      log.push('edit', { sketch: 'shadows', cells: LB.cells, layer: LB.activeLayer, practice });
      if (!practice) P.message('');
      refresh(); saveDraft();
    }, onLayerChange: (layer) => { refresh(); saveDraft(); log.push('layer', { sketch: 'shadows', layer }); } });
    if (draftKey && !run.over) {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
        if (draft && validCells(draft.cells, dims, n)) { LB.set(draft.cells); LB.activeLayer = draft.layer; }
      } catch { /* a corrupt draft must not stop a daily */ }
    }
    scene.reset(dims); drawClues(); refresh();
    evidenceNote.textContent = 'Three views. One hidden object.';
    stageStatus.textContent = 'Shadows hidden until you commit';
    commitB.textContent = 'Cast shadows ↵'; P.clearPost(); P.message('');
    presented = performance.now(); firstInput = 0;
    log.push('present', { sketch: 'shadows', mode: run.mode, level: run.level, dims, n, hidden, seed });
  }

  function fix() {
    practice = true; phase = 'build';
    evidenceNote.textContent = 'Last cast shown below · check again after editing.';
    stageStatus.textContent = 'Practice · your first attempt is already counted';
    commitB.textContent = 'Check shadows ↵';
    P.clearPost(); P.message('Use the mismatches to adjust your build, then cast again.');
    refresh(); log.push('retry', { sketch: 'shadows' });
  }

  function finishActions(ok: boolean) {
    const next = () => { if (run.over) run.showOver(newCase); else newCase(); };
    P.post([
      { label: run.over ? 'See results ↵' : 'Next object ↵', primary: true, onClick: next },
      ...(!ok ? [{ label: 'Fix it · practice', onClick: fix }] : []),
      { label: 'Show one solution', onClick: () => {
        scene.showObject(hidden); stageStatus.textContent = 'One valid solution is outlined in gold';
        log.push('reveal', { sketch: 'shadows' });
      } },
    ]);
  }

  async function commit() {
    if (!canEdit() || LB.cells.length !== n) return;
    const token = generation, cells = LB.cells, wasPractice = practice;
    phase = 'cast'; result = assess(cells, hidden, dims);
    const verdict = result;
    log.push('commit', { sketch: 'shadows', cells, practice, ms: performance.now() - presented, msSinceFirstInput: firstInput ? performance.now() - firstInput : null });
    // Record before animation: reloading cannot erase a committed miss. A mode switch
    // during the reveal cannot apply this result to the new run.
    if (!wasPractice) {
      log.push('result', { sketch: 'shadows', level: run.level, ok: verdict.ok, cells, badCells: verdict.badCells });
      verdict.ok ? run.hit() : run.miss();
      try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* optional */ }
    } else log.push('practice', { sketch: 'shadows', ok: verdict.ok, cells, badCells: verdict.badCells });
    refresh(); P.clearPost(); P.message('');
    evidenceNote.textContent = '03 / CAST · testing your prediction';
    drawClues();
    const revealed: View[] = [];
    for (const view of VIEWS) {
      stageStatus.textContent = `Casting the ${view} shadow…`;
      clueEls.get(view)?.classList.add('casting');
      await scene.cast(view, cells, target[view], reduced.matches);
      if (token !== generation) return;
      revealed.push(view); drawClues(revealed);
    }
    phase = 'result'; refresh();
    scene.showProjection('front', cells, target.front);
    clueEls.get('front')?.classList.add('inspecting');
    evidenceNote.textContent = '✓ match · outline = missing · × = extra';
    stageStatus.textContent = verdict.ok ? 'All three shadows match' : 'Your cast is ready to inspect';
    const matches = VIEWS.filter((v) => verdict.diff[v].extra.size + verdict.diff[v].missing.size === 0).length;
    P.message(verdict.ok
      ? wasPractice ? 'Solved in practice. Your first attempt stays on the scorecard.'
        : verdict.same ? 'You found it. All three shadows match.' : 'A different object. The same three shadows. That counts.'
      : `${matches}/3 views match. ${verdict.badCells} shadow ${verdict.badCells === 1 ? 'cell needs' : 'cells need'} fixing.`, verdict.ok ? 'ok' : 'bad');
    finishActions(verdict.ok);
  }

  run.begin(newCase);
  const onKey = (e: KeyboardEvent) => {
    if (helpOpen(stageEl) || document.body.hasAttribute('data-over') || e.altKey || e.repeat) return;
    const el = e.target as HTMLElement;
    if (el.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Enter') {
      // Enter on a focused button uses its native action, rather than also committing.
      if (el.closest('button, a')) return;
      e.preventDefault();
      if (phase === 'build') void commit();
      else if (phase === 'result') (panelEl.querySelector('#post button.primary') as HTMLButtonElement | null)?.click();
    } else if (canEdit() && (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)))) {
      e.preventDefault(); LB.undo();
    } else if (canEdit() && !e.metaKey && !e.ctrlKey && /^[1-4]$/.test(e.key)) {
      e.preventDefault(); LB.activeLayer = Number(e.key) - 1;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => { generation++; window.removeEventListener('keydown', onKey); scene.dispose(); evidence.remove(); frameEl.classList.remove('shadows-game'); };
}

export const shadows: SketchDef = {
  id: 'shadows', title: 'Shadows', status: 'playable', skill: '2D → 3D reconstruction', icon: '🔦',
  tagline: 'Read the shadows. Build the object. Commit to find out.',
  about: 'Build an object using exactly the given number of cubes. Your top, front and right shadows must match the three clues. There can be more than one valid answer; every matching build counts. Your shadows stay hidden until you commit, so you have to picture the projections yourself. A miss reveals missing and extra shadow cells; fixing it in practice never changes your first-attempt score.',
  controls: 'Tap gold squares in 3D or use the layer grid to place and remove cubes. Layers run bottom to top; the grid runs back to front. Keys 1–4 select a layer, Backspace or Ctrl/Cmd+Z undoes, Enter casts. View arrows let you inspect the build. Daily builds are saved as you go.',
  mount,
};
