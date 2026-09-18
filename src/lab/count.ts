// Count: a stack of cubes seen from one viewpoint. Some are hidden. How many cubes are there?
// Commit, then the stack turns and the hidden ones light up orange.
import * as THREE from 'three';
import { SketchStage, cubeGroup, panel, h, mulberry32, pulseMats, COLOR_OK, COLOR_BAD, easeInOut, COLOR_MARKER } from './kit.ts';
import type { SketchDef, MountCtx } from './types.ts';
import { Log } from '../log.ts';
import { Run } from '../run.ts';
import { makeStack, type Stack } from './count-model.ts';

/** Difficulty by level: footprint first, then height. */
export const setup = (level: number) => (level < 3 ? { base: 3, maxH: 3 } : level < 6 ? { base: 4, maxH: 3 } : level < 9 ? { base: 4, maxH: 4 } : level < 14 ? { base: 5, maxH: 4 } : { base: 6, maxH: 4 });

function mount({ stageEl, panelEl, hudEl, hintEl }: MountCtx) {
  const log = new Log();
  // Narrow FOV ≈ orthographic, so what the pure model calls hidden is hidden on screen too.
  const stage = new SketchStage(stageEl, { ground: -0.5, fov: 14 });
  const run = new Run({ id: 'count', name: 'Count', icon: '🔢', dailyRounds: 8 }, hudEl, stageEl);
  let stack!: Stack, base = 3, maxH = 3;
  let group!: ReturnType<typeof cubeGroup>;
  const frame = () => stage.place(stack.az, stack.el, stage.fit(Math.hypot(base, maxH, base) / 2 + 0.6), [(base - 1) / 2, (maxH - 1) / 2 - 0.4, (base - 1) / 2]);
  stage.onResize = frame;
  const world = new THREE.Group();
  stage.scene.add(world);

  let guess = 1;
  const num = h('input.num', { type: 'number', inputmode: 'numeric', min: 1, max: 99, value: '1', 'aria-label': 'cubes in total' }) as HTMLInputElement;
  num.addEventListener('input', () => { guess = Math.max(1, Math.min(99, Number(num.value) || 1)); });
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  const stepper = h('div.stepper', {}, h('span', {}, 'cubes in total:'), h('button', { onclick: () => setGuess(guess - 5), 'aria-label': 'minus five' }, '−5'), h('button', { onclick: () => setGuess(guess - 1), 'aria-label': 'minus one' }, '−'), num, h('button', { onclick: () => setGuess(guess + 1), 'aria-label': 'plus one' }, '+'), h('button', { onclick: () => setGuess(guess + 5), 'aria-label': 'plus five' }, '+5'));
  const commitB = h('button.primary', { onclick: commit, title: 'Enter' }, 'Commit ↵') as HTMLButtonElement;
  panelEl.append(h('div#actions', { style: { justifyContent: 'space-between', flexWrap: 'wrap' } }, stepper, commitB));
  const P = panel(panelEl);
  function setGuess(v: number) { guess = Math.max(1, Math.min(99, v)); num.value = String(guess); }

  function newCase() {
    ({ base, maxH } = setup(run.level));
    stack = makeStack(base, maxH, mulberry32(run.nextSeed()));
    world.clear();
    group = cubeGroup(stack.cells);
    world.add(group.group);
    group.group.position.set(0, 0, 0);
    group.group.rotation.set(0, 0, 0);
    frame();
    setGuess(1);
    commitB.disabled = false;
    P.message('');
    P.clearPost();
    hintEl.textContent = `${base}×${base} footprint, columns up to ${maxH} high. Every column's top is visible; cubes rest on cubes.`;
    log.push('present', { sketch: 'count', mode: run.mode, level: run.level, cells: stack.cells, hidden: stack.hidden.length, az: stack.az, el: stack.el });
  }

  async function commit() {
    if (commitB.disabled) return;
    commitB.disabled = true;
    num.blur();
    const ok = guess === stack.cells.length;
    log.push('result', { sketch: 'count', guess, actual: stack.cells.length, hidden: stack.hidden.length, ok });
    // Tint the hidden cubes, then turn the structure one and a half times so it ends with its back to you.
    for (const i of stack.hidden) group.cubes[i].material = new THREE.MeshStandardMaterial({ color: COLOR_MARKER, roughness: 0.6 });
    void pulseMats(stage.ticker, [group.mats.base], ok ? COLOR_OK : COLOR_BAD);
    const pivot = new THREE.Vector3((base - 1) / 2, 0, (base - 1) / 2);
    await stage.tween(3200, (t) => {
      const a = easeInOut(t) * Math.PI * 3;
      group.group.position.set(pivot.x - (pivot.x * Math.cos(a) - pivot.z * Math.sin(a)), 0, pivot.z - (pivot.x * Math.sin(a) + pivot.z * Math.cos(a)));
      group.group.rotation.y = a;
    });
    ok ? run.hit() : run.miss();
    P.message(`${stack.cells.length} cubes — ${stack.hidden.length} were hidden (orange). ${ok ? 'You had it.' : `You said ${guess}.`}`, ok ? 'ok' : 'bad');
    if (run.over) run.showOver(newCase);
    else P.post([{ label: 'Next ↵', primary: true, onClick: newCase }]);
  }

  run.begin(newCase);
  const onKey = (e: KeyboardEvent) => {
    if (document.activeElement === num && e.key !== 'Enter') return;
    if (e.key === 'Enter') { if (!commitB.disabled) commit(); else (panelEl.querySelector('#post:not([hidden]) button.primary') as HTMLButtonElement | null)?.click(); }
    else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') setGuess(guess + 1);
    else if (e.key === 'ArrowDown' || e.key === '-') setGuess(guess - 1);
    else if (/^[0-9]$/.test(e.key) && !commitB.disabled) { num.focus(); return; }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); stage.dispose(); };
}

export const count: SketchDef = {
  id: 'count', title: 'Count', status: 'playable', skill: 'inference behind occlusion', icon: '🔢',
  tagline: 'A stack seen from one angle. Some cubes are hidden behind others. How many cubes are there? Commit, then it turns around.',
  about: 'Counting a stack from one viewpoint means inferring what is hidden from what rests on what. Only stacks where every column\'s top is visible are served, so the count is always inferable, and at least two cubes are always hidden.',
  controls: 'Type or step the number, then Commit (Enter). Arrow keys nudge it.',
  mount,
};
