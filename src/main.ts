// Prototype 1: pack. A run of pieces, each of which must be turned to drop into its hole.
import './style.css';
import './pwa';
import { PackStage, AXIS_COLOR } from './pack-scene';
import { STAGES, stageForScore, makePackPuzzle, land, type PackPuzzle, type Stage } from './pack';
import { MOVES, moveLabel, applyMoves, type Move, type Axis } from './polycube';
import { Log } from './log';
import { Sfx } from './sfx';
import { COLOR_OK, COLOR_BAD } from './render-common';

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

type Phase = 'plan' | 'anim' | 'result' | 'over';
const LIVES = 3;
const MAX_QUEUE = 6;
const BEST_KEY = 'bricksy.pack.best';

const log = new Log();
const sfx = new Sfx();
const stage = new PackStage($<HTMLCanvasElement>('c'));

let puzzle!: PackPuzzle;
let current!: Stage;
let queue: Move[] = [];
let lastMoves: Move[] = [];
let phase: Phase = 'plan';
let score = 0;
let streak = 0;
let lives = LIVES;
let attempt = 1;
let runId = 0;
let firstTry = 0;
let presented = 0;
let results: boolean[] = [];
let best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
let tPresent = 0;
let tFirstInput = 0;

// ---------------------------------------------------------------- dom

const el = {
  score: $('score'), best: $('best'), streak: $('streak'), lives: $('lives'), stageName: $('stageName'), hint: $('hint'),
  mute: $<HTMLButtonElement>('mute'),
  queue: $('queue'), moves: $('moves'),
  undo: $<HTMLButtonElement>('undo'), clear: $<HTMLButtonElement>('clear'), commit: $<HTMLButtonElement>('commit'),
  message: $('message'), post: $('post'),
  retry: $<HTMLButtonElement>('retry'), replay: $<HTMLButtonElement>('replay'), skip: $<HTMLButtonElement>('skip'), next: $<HTMLButtonElement>('next'),
  over: $('over'), overScore: $('overScore'), overBest: $('overBest'), overDetail: $('overDetail'), overResults: $('overResults'), again: $<HTMLButtonElement>('again'), share: $<HTMLButtonElement>('share'),
  stageBox: $('stage'), puzzleId: $('puzzleId'), export: $('export'), reset: $('resetProgress'),
};
const postButtons = [el.retry, el.replay, el.skip, el.next];

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

el.undo.addEventListener('click', undo);
el.clear.addEventListener('click', clearQueue);
el.commit.addEventListener('click', commit);
el.retry.addEventListener('click', retry);
el.replay.addEventListener('click', replay);
el.skip.addEventListener('click', next);
el.next.addEventListener('click', next);
el.again.addEventListener('click', startRun);
el.share.addEventListener('click', share);
el.export.addEventListener('click', () => log.export());
el.mute.addEventListener('click', () => { el.mute.textContent = sfx.toggle() ? '🔇' : '🔊'; });
el.mute.textContent = sfx.muted ? '🔇' : '🔊';
el.reset.addEventListener('click', () => {
  if (!confirm('Clear best score and the event log?')) return;
  log.clear();
  localStorage.removeItem(BEST_KEY);
  location.reload();
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
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
  } else if (phase === 'over' && k === 'enter') {
    startRun();
    e.preventDefault();
  }
});

// ---------------------------------------------------------------- ui helpers

function setPhase(p: Phase) {
  phase = p;
  const plan = p === 'plan';
  for (const b of moveButtons.values()) b.disabled = !plan;
  el.undo.disabled = el.clear.disabled = el.commit.disabled = !plan;
  el.post.hidden = p === 'plan' || p === 'over';
  for (const b of postButtons) b.disabled = p === 'anim';
  el.over.hidden = p !== 'over';
}

function setMessage(text: string, tone: '' | 'ok' | 'bad' = '') {
  el.message.textContent = text;
  el.message.className = tone;
}

function showPost(visible: HTMLButtonElement[], primary: HTMLButtonElement | null) {
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
    p.textContent = 'no turns queued — nothing moves until you drop';
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

function scorePop(text: string) {
  const d = document.createElement('div');
  d.className = 'scorepop';
  d.textContent = text;
  el.stageBox.append(d);
  setTimeout(() => d.remove(), 900);
}

function updateHud() {
  el.score.textContent = String(score);
  el.best.textContent = String(best);
  el.streak.textContent = String(streak);
  el.lives.innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="${i < lives ? '' : 'lost'}">♥</span>`).join('');
  el.stageName.textContent = current.name;
}

async function playMoves(moves: readonly Move[], ms: number, pause: number) {
  for (const m of moves) {
    stage.highlightAxis(m.axis, m.dir);
    sfx.turn();
    await stage.animateMove(m, ms);
    await sleep(pause);
  }
  stage.highlightAxis(null);
}

// ---------------------------------------------------------------- game flow

function startRun() {
  runId = Date.now();
  score = 0;
  streak = 0;
  lives = LIVES;
  firstTry = 0;
  presented = 0;
  results = [];
  log.push('run_start', { runId });
  newPiece();
}

function newPiece() {
  const next = stageForScore(score);
  if (current && next !== current) {
    sfx.levelUp();
    toast(`${next.name}`);
    log.push('stage', { runId, stage: next.name, score });
  }
  current = next;
  const seed = (Math.random() * 2 ** 31) | 0;
  puzzle = makePackPuzzle(current, seed, mulberry32(seed), (p) => {
    stage.setPuzzle(p);
    return stage.isReadable();
  });
  presented++;
  queue = [];
  lastMoves = [];
  attempt = 1;
  tPresent = performance.now();
  tFirstInput = 0;
  renderQueue();
  setPhase('plan');
  setMessage('');
  el.hint.textContent = `${puzzle.distance} turn${puzzle.distance > 1 ? 's' : ''}.`;
  el.puzzleId.textContent = `piece ${puzzle.id} · ${current.name} · seed ${seed}`;
  updateHud();
  log.push('present', {
    runId, puzzleId: puzzle.id, stage: current.name, score, lives, seed,
    piece: puzzle.piece, target: puzzle.target, cavity: puzzle.cavity, mold: puzzle.mold,
    distance: puzzle.distance, marker: puzzle.markerPiece, glass: current.glass, pose: puzzle.pose,
  });
}

function enqueue(m: Move) {
  if (phase !== 'plan') return;
  if (queue.length >= MAX_QUEUE) { shake(el.queue); return; }
  if (!tFirstInput) tFirstInput = performance.now();
  queue.push(m);
  sfx.click();
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
  showPost([], null);
  setPhase('anim');
  setMessage('');
  await playMoves(moves, 460, 120);
  await sleep(120);

  const landing = land(puzzle, applyMoves(puzzle.piece, moves));
  await stage.animateDrop(moves, landing);
  const ok = landing.fits;
  log.push('drop', { puzzleId: puzzle.id, attempt, ok, moves: moves.map(moveLabel), landing: landing.origin, solution: puzzle.solution.map(moveLabel) });

  if (ok) {
    sfx.fit();
    stage.fuse();
    void stage.pulse(COLOR_OK);
    score++;
    streak++;
    if (attempt === 1) firstTry++;
    if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
    scorePop(`+1`);
    updateHud();
    setPhase('result');
    setMessage(attempt === 1 ? 'Fits.' : 'Fits — on the second try.', 'ok');
    showPost([el.next], el.next);
    await sleep(900);
    if ((phase as Phase) === 'result') next(); // auto-advance unless the player already moved on
    return;
  }

  sfx.miss();
  void stage.shake();
  void stage.pulse(COLOR_BAD);
  lives--;
  streak = 0;
  updateHud();
  if (lives <= 0) {
    await sleep(700);
    endRun();
    return;
  }
  setPhase('result');
  setMessage(`Doesn't fit. ${lives} ${lives === 1 ? 'life' : 'lives'} left — look at where it landed versus the hole.`, 'bad');
  showPost([el.retry, el.replay, el.skip], el.retry);
}

async function retry() {
  if (phase !== 'result') return;
  log.push('retry', { puzzleId: puzzle.id, attempt });
  setPhase('anim');
  await stage.animateLift();
  attempt++;
  queue = [];
  renderQueue();
  setPhase('plan');
  setMessage(`Attempt ${attempt}. Piece is back above the hole, in its starting orientation.`);
}

async function replay() {
  if (phase !== 'result') return;
  log.push('replay', { puzzleId: puzzle.id, attempt, moves: lastMoves.map(moveLabel) });
  setPhase('anim');
  await stage.animateLift();
  await sleep(250);
  await playMoves(lastMoves, 950, 320);
  await sleep(150);
  await stage.animateDrop(lastMoves, land(puzzle, applyMoves(puzzle.piece, lastMoves)));
  sfx.thud();
  setPhase('result');
}

function next() {
  if (phase !== 'result') return;
  log.push('next', { puzzleId: puzzle.id });
  newPiece();
}

function endRun() {
  sfx.over();
  log.push('run_over', { runId, score, best, presented, firstTry });
  el.overScore.textContent = String(score);
  el.overBest.textContent = String(best);
  el.overDetail.textContent = `${firstTry} of ${presented} pieces fitted first try · reached “${current.name}”`;
  el.overResults.textContent = results.map((r) => (r ? '🟩' : '🟥')).join('');
  setPhase('over');
}

async function share() {
  const text = `📦 Pack · ${score} fitted · reached ${current.name}\n${results.map((r) => (r ? '🟩' : '🟥')).join('')}\n${location.origin}${location.pathname}`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch { /* cancelled */ }
}

startRun();

if (import.meta.env.DEV) {
  // Experimenter hooks — not part of the game surface.
  Object.assign(window, { bricksy: { get puzzle() { return puzzle; }, log, STAGES } });
}
