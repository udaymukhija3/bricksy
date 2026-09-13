import './style.css';
import './pwa';
import { Stage, AXIS_COLOR } from './scene';
import { LEVELS, makePuzzle, type Puzzle } from './puzzle';
import { MOVES, moveLabel, applyMoves, shapeKey, type Move, type Axis } from './polycube';
import { Log } from './log';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const cssColor = (n: number) => '#' + n.toString(16).padStart(6, '0');

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- state

type Phase = 'plan' | 'anim' | 'result';
interface Progress {
  levelIdx: number;
  streak: number;
  stats: Record<number, { first: number; total: number }>;
}

const PROGRESS_KEY = 'bricksy.progress.v0';
const STREAK_TO_ADVANCE = 3;
const MAX_ATTEMPTS = 2;
const MAX_QUEUE = 6;

function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (p && typeof p.levelIdx === 'number' && p.levelIdx < LEVELS.length) return p;
  } catch { /* fall through */ }
  return { levelIdx: 0, streak: 0, stats: {} };
}

const log = new Log();
const stage = new Stage($<HTMLCanvasElement>('c'));
const progress = loadProgress();
const saveProgress = () => {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
};

let puzzle!: Puzzle;
let queue: Move[] = [];
let lastMoves: Move[] = [];
let phase: Phase = 'plan';
let attempt = 1;
let tPresent = 0;
let tFirstInput = 0;

// ---------------------------------------------------------------- dom

const el = {
  level: $<HTMLSelectElement>('level'),
  levelName: $('levelName'),
  hint: $('hint'),
  streak: $('streak'),
  acc: $('acc'),
  queue: $('queue'),
  moves: $('moves'),
  undo: $<HTMLButtonElement>('undo'),
  clear: $<HTMLButtonElement>('clear'),
  commit: $<HTMLButtonElement>('commit'),
  message: $('message'),
  post: $('post'),
  retry: $<HTMLButtonElement>('retry'),
  replay: $<HTMLButtonElement>('replay'),
  reveal: $<HTMLButtonElement>('reveal'),
  next: $<HTMLButtonElement>('next'),
  puzzleId: $('puzzleId'),
  export: $('export'),
  reset: $('resetProgress'),
};
const postButtons = [el.retry, el.replay, el.reveal, el.next];

const moveButtons = new Map<Move, HTMLButtonElement>();
for (const m of MOVES) {
  const b = document.createElement('button');
  b.className = 'mv';
  b.style.setProperty('--c', cssColor(AXIS_COLOR[m.axis]));
  b.innerHTML = `<span class="ax">${m.axis.toUpperCase()}</span><span class="deg">${m.dir > 0 ? '+' : '−'}90°</span>`;
  b.title = `Turn ${m.dir > 0 ? '+' : '−'}90° about ${m.axis.toUpperCase()}  (key: ${m.dir > 0 ? m.axis : '⇧' + m.axis})`;
  b.addEventListener('pointerenter', () => stage.highlightAxis(m.axis, m.dir));
  b.addEventListener('pointerleave', () => stage.highlightAxis(null));
  b.addEventListener('click', () => enqueue(m));
  el.moves.append(b);
  moveButtons.set(m, b);
}

for (const [i, l] of LEVELS.entries()) {
  const o = document.createElement('option');
  o.value = String(i);
  o.textContent = `${l.id} · ${l.name}`;
  el.level.append(o);
}

el.level.addEventListener('change', () => {
  progress.levelIdx = Number(el.level.value);
  progress.streak = 0;
  saveProgress();
  log.push('level_select', { level: LEVELS[progress.levelIdx].id });
  newPuzzle();
});
el.undo.addEventListener('click', undo);
el.clear.addEventListener('click', clearQueue);
el.commit.addEventListener('click', commit);
el.retry.addEventListener('click', retry);
el.replay.addEventListener('click', replay);
el.reveal.addEventListener('click', reveal);
el.next.addEventListener('click', next);
el.export.addEventListener('click', () => log.export());
el.reset.addEventListener('click', () => {
  if (!confirm('Reset level progress and clear the event log?')) return;
  log.clear();
  localStorage.removeItem(PROGRESS_KEY);
  location.reload();
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (phase === 'plan') {
    if (k === 'x' || k === 'y' || k === 'z') {
      const dir = e.shiftKey ? -1 : 1;
      enqueue(MOVES.find((m) => m.axis === (k as Axis) && m.dir === dir)!);
    } else if (k === 'backspace') undo();
    else if (k === 'enter') commit();
    else return;
    e.preventDefault();
  } else if (phase === 'result') {
    if ((k === 'enter' || k === 'n') && !el.next.hidden) next();
    else if (k === 'r' && !el.retry.hidden) retry();
    else return;
    e.preventDefault();
  }
});

// ---------------------------------------------------------------- ui helpers

function setPhase(p: Phase) {
  phase = p;
  const plan = p === 'plan';
  for (const b of moveButtons.values()) b.disabled = !plan;
  el.undo.disabled = el.clear.disabled = el.commit.disabled = !plan;
  el.post.hidden = p === 'plan';
  for (const b of postButtons) b.disabled = p === 'anim';
}

function setMessage(text: string, tone: '' | 'ok' | 'bad' = '') {
  el.message.textContent = text;
  el.message.className = tone;
}

function showPost(visible: HTMLButtonElement[], primary: HTMLButtonElement) {
  for (const b of postButtons) {
    b.hidden = !visible.includes(b);
    b.classList.toggle('primary', b === primary);
  }
}

function renderQueue(moves: readonly Move[] = queue, cls = '', label = '') {
  el.queue.replaceChildren();
  if (label) {
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    el.queue.append(l);
  }
  if (!moves.length) {
    const p = document.createElement('span');
    p.className = 'placeholder';
    p.textContent = 'no turns queued — nothing moves until you commit';
    el.queue.append(p);
    return;
  }
  moves.forEach((m, i) => {
    const c = document.createElement('span');
    c.className = `chip ${cls}`;
    c.style.setProperty('--c', cssColor(AXIS_COLOR[m.axis]));
    c.innerHTML = `<span class="n">${i + 1}</span><span class="dot"></span>${moveLabel(m)}`;
    el.queue.append(c);
  });
}

function shake(node: HTMLElement) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

function toast(text: string) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  document.body.append(d);
  setTimeout(() => d.remove(), 2600);
}

function updateHud() {
  // Follow the puzzle on screen, not the progress pointer, so a level-up shows on the next puzzle.
  const level = puzzle?.level ?? LEVELS[progress.levelIdx];
  el.level.value = String(LEVELS.indexOf(level));
  el.levelName.textContent = level.name;
  el.streak.textContent = String(progress.streak);
  const s = progress.stats[level.id];
  el.acc.textContent = s ? `${s.first}/${s.total}` : '–';
}

async function playMoves(moves: readonly Move[], ms: number, pause: number) {
  for (const m of moves) {
    stage.highlightAxis(m.axis, m.dir);
    await stage.animateMove(m, ms);
    await sleep(pause);
  }
  stage.highlightAxis(null);
}

// ---------------------------------------------------------------- game flow

function newPuzzle() {
  const level = LEVELS[progress.levelIdx];
  const seed = (Math.random() * 2 ** 31) | 0;
  puzzle = makePuzzle(level, seed, mulberry32(seed), (p) => {
    stage.setPose(p.pose);
    stage.setShape('you', p.start, p.markerStart);
    stage.setShape('target', p.target, p.markerTarget);
    return stage.isFullyVisible('you') && stage.isFullyVisible('target');
  });
  queue = [];
  lastMoves = [];
  attempt = 1;
  tPresent = performance.now();
  tFirstInput = 0;
  renderQueue();
  setPhase('plan');
  setMessage('');
  el.hint.textContent = level.hint;
  el.puzzleId.textContent = `puzzle ${puzzle.id} · level ${level.id} · ${puzzle.distance} turn${puzzle.distance > 1 ? 's' : ''} · seed ${seed}`;
  updateHud();
  log.push('present', {
    puzzleId: puzzle.id, level: level.id, seed, start: puzzle.start, target: puzzle.target,
    distance: puzzle.distance, marker: puzzle.markerStart, pose: puzzle.pose,
  });
}

function enqueue(m: Move) {
  if (phase !== 'plan') return;
  if (queue.length >= MAX_QUEUE) { shake(el.queue); return; }
  if (!tFirstInput) tFirstInput = performance.now();
  queue.push(m);
  renderQueue();
  log.push('enqueue', { puzzleId: puzzle.id, attempt, move: moveLabel(m), queue: queue.map(moveLabel) });
}

function undo() {
  if (phase !== 'plan' || !queue.length) return;
  const m = queue.pop()!;
  renderQueue();
  log.push('undo', { puzzleId: puzzle.id, attempt, move: moveLabel(m), queue: queue.map(moveLabel) });
}

function clearQueue() {
  if (phase !== 'plan' || !queue.length) return;
  queue = [];
  renderQueue();
  log.push('clear', { puzzleId: puzzle.id, attempt });
}

async function commit() {
  if (phase !== 'plan') return;
  if (!queue.length) { shake(el.queue); return; }
  const moves = [...queue];
  lastMoves = moves;
  const now = performance.now();
  log.push('commit', {
    puzzleId: puzzle.id, attempt, moves: moves.map(moveLabel),
    msSincePresent: Math.round(now - tPresent), msSinceFirstInput: Math.round(now - tFirstInput),
  });
  showPost([], el.next);
  setPhase('anim');
  setMessage('');
  await playMoves(moves, 480, 140);

  // Orientation match, not sequence match: any route to the same orientation counts.
  const ok = shapeKey(applyMoves(puzzle.start, moves)) === shapeKey(puzzle.target);
  log.push('result', { puzzleId: puzzle.id, attempt, ok, moves: moves.map(moveLabel), solution: puzzle.solution.map(moveLabel) });
  void stage.pulse(ok ? 0x46a758 : 0xe5484d);

  const level = puzzle.level;
  const stats = (progress.stats[level.id] ??= { first: 0, total: 0 });
  if (attempt === 1) {
    stats.total++;
    if (ok) { stats.first++; progress.streak++; } else progress.streak = 0;
  }

  let leveledUp = false;
  if (ok && attempt === 1 && progress.streak >= STREAK_TO_ADVANCE && progress.levelIdx < LEVELS.length - 1) {
    progress.levelIdx++;
    progress.streak = 0;
    leveledUp = true;
    log.push('levelup', { level: LEVELS[progress.levelIdx].id });
  }
  saveProgress();
  updateHud();

  setPhase('result');
  if (ok) {
    setMessage(attempt === 1 ? 'Match. Your model of the turn was right.' : 'Match on the second try.', 'ok');
    showPost([el.next], el.next);
    if (leveledUp) toast(`Level up → ${LEVELS[progress.levelIdx].name}`);
  } else if (attempt < MAX_ATTEMPTS) {
    setMessage('Reality disagrees. Compare what you got (left) with the target (right).', 'bad');
    showPost([el.retry, el.replay, el.next], el.retry);
  } else {
    setMessage('Still off. Watch one sequence that works, then move on.', 'bad');
    showPost([el.reveal, el.replay, el.next], el.reveal);
  }
}

async function retry() {
  if (phase !== 'result') return;
  log.push('retry', { puzzleId: puzzle.id, attempt });
  setPhase('anim');
  await stage.resetOrientation();
  attempt++;
  queue = [];
  renderQueue();
  setPhase('plan');
  setMessage(`Attempt ${attempt}. The shape is back where it started.`);
}

async function replay() {
  if (phase !== 'result') return;
  log.push('replay', { puzzleId: puzzle.id, attempt, moves: lastMoves.map(moveLabel) });
  setPhase('anim');
  await stage.resetOrientation();
  await sleep(250);
  await playMoves(lastMoves, 1000, 350);
  setPhase('result');
}

async function reveal() {
  if (phase !== 'result') return;
  log.push('reveal', { puzzleId: puzzle.id, attempt, solution: puzzle.solution.map(moveLabel) });
  setPhase('anim');
  await stage.resetOrientation();
  renderQueue(puzzle.solution, 'solution', 'ONE SOLUTION');
  await sleep(250);
  await playMoves(puzzle.solution, 1000, 350);
  setMessage('That is one sequence that works. Other routes to the same orientation exist.');
  setPhase('result');
  showPost([el.next], el.next);
}

function next() {
  if (phase !== 'result') return;
  log.push('next', { puzzleId: puzzle.id });
  newPuzzle();
}

newPuzzle();

if (import.meta.env.DEV) {
  // Experimenter hooks — not part of the game surface.
  Object.assign(window, { bricksy: { get puzzle() { return puzzle; }, log, progress, LEVELS } });
}
