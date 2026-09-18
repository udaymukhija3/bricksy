// Tight Fit: map → job intro → stages → result. Stars persist per job.
import '../style.css';
import '../pwa.ts';
import '../guard.ts';
import { h, mulberry32 } from '../lab/kit.ts';
import { Sfx } from '../sfx.ts';
import { Log } from '../log.ts';
import { makeItem, type Body } from './model.ts';
import type { Cell } from '../polycube.ts';
import { STAGES } from './stages.ts';
import { EPISODE, JOBS, STAGE_NAMES, dailyJob, shiftJob, type JobDef } from './jobs.ts';
import { today, dayNumber, dailyRecord, statsOf } from '../run.ts';
import { helpCard } from '../lab/frame.ts';
import { TIGHT_FIT } from '../games.ts';

const app = document.getElementById('app')!;
const sfx = new Sfx();
const log = new Log();
const STARS_KEY = 'bricksy.tf.stars';

function hash(s: string) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return x >>> 0;
}
const seeded = (...parts: (string | number)[]) => mulberry32(hash(`tf${EPISODE.id}|${parts.join('|')}`));
const jobSeed = (job: JobDef) => job.seedKey ?? job.id;
const DAILY_KEY = () => `bricksy.tightfit.daily.${today()}`;
const SHIFT_BEST = 'bricksy.tightfit.best';
let shiftDone = 0; // jobs completed in the current shift

function loadStars(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(STARS_KEY) ?? '{}'); } catch { return {}; }
}
function saveStars(id: number, stars: number) {
  const all = loadStars();
  all[id] = Math.max(all[id] ?? 0, stars);
  localStorage.setItem(STARS_KEY, JSON.stringify(all));
}
const starsGlyph = (n: number, total = 3) => '★'.repeat(n) + '☆'.repeat(total - n);

// ---------------------------------------------------------------- map

function renderMap() {
  const stars = loadStars();
  const unlockedUpTo = JOBS.findIndex((j) => !(stars[j.id] > 0));
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  const nodes = JOBS.map((j, i) => {
    const locked = unlockedUpTo >= 0 && i > unlockedUpTo;
    const x = 50 + Math.sin(i * 1.1) * 32;
    const node = h('button.tf-node' + (locked ? '.locked' : '') + (j.boss ? '.boss' : '') + (stars[j.id] ? '.done' : ''), {
      style: { left: `${x}%`, top: `${4 + i * 8.6}%` },
      disabled: locked ? 'true' : null,
      onclick: () => intro(j),
      title: `${j.customer} — ${j.item}`,
    }, h('span.n', {}, j.boss ? '★' : String(j.id)), h('span.tf-stars', {}, starsGlyph(stars[j.id] ?? 0)));
    return { node, x, y: 4 + i * 8.6 };
  });
  const path = nodes.map((n, i) => `${i ? 'L' : 'M'} ${n.x} ${n.y + 3}`).join(' ');
  const svg = `<svg class="tf-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#2f3441" stroke-width="1.6" stroke-dasharray="2 1.5" vector-effect="non-scaling-stroke"/></svg>`;
  const map = h('div.tf-map');
  map.innerHTML = svg;
  for (const n of nodes) map.append(n.node);
  // Today's job: the same chain for everyone, once a day, with its own stars.
  const dn = dayNumber();
  const dj = dailyJob(dn, seeded('daily', dn));
  const rec = dailyRecord('tightfit');
  const st = statsOf('tightfit');
  const dailyCard = h('a.card.flag.tf-daily', { href: '#', onclick: (e: Event) => { e.preventDefault(); if (!rec?.done) intro(dj); } },
    h('div.icon-big', {}, '📅'),
    h('div', {}, h('h3', {}, `Today's job #${dn} — ${dj.customer}’s ${dj.item}`),
      h('p', {}, dj.stages.map((s) => STAGE_NAMES[s.type]).join(' → ')),
      h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, `${dj.cubes} cubes · same job for everyone today`),
        rec?.done ? h('span.today.done', {}, `done · ${starsGlyph(rec.results.filter(Boolean).length === rec.results.length ? 3 : rec.results.filter(Boolean).length >= rec.results.length - 1 ? 2 : 1)} ${rec.results.map((r) => (r ? '🟩' : '🟥')).join('')}`)
          : h('span.today', {}, st.dayStreak ? `play → · day streak ${st.dayStreak}` : 'play →'))));
  // The endless shift: jobs get harder until a stage fails; best is jobs completed.
  const shiftBest = Number(localStorage.getItem(SHIFT_BEST)) || 0;
  const shiftCard = h('a.card.tf-daily', { href: '#', onclick: (e: Event) => { e.preventDefault(); shiftDone = 0; intro(shiftJob(0, mulberry32((Math.random() * 2 ** 31) | 0))); } },
    h('div.icon-big', {}, '🕒'),
    h('div', {}, h('h3', {}, 'Endless shift'),
      h('p', {}, 'Job after job, each a little worse than the last, until a stage beats you. How many can you deliver?'),
      h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, 'endless · three tries per stage'), h('span.today', {}, shiftBest ? `best ${shiftBest} job${shiftBest === 1 ? '' : 's'} · clock in →` : 'clock in →'))));
  const help = h('div.overlay.helpwrap', { hidden: true });
  const closeHelp = () => { help.hidden = true; help.replaceChildren(); };
  const helpB = h('button.icon.help-btn', { title: 'How to play, why this game, your progress', 'aria-label': 'Help', onclick: () => { if (help.hidden) { help.replaceChildren(helpCard(TIGHT_FIT, closeHelp)); help.hidden = false; } else closeHelp(); } }, '?');
  map.append(help);
  try { if (!localStorage.getItem('bricksy.tightfit.seen')) { localStorage.setItem('bricksy.tightfit.seen', '1'); setTimeout(() => helpB.click(), 0); } } catch { /* ignore */ }
  app.replaceChildren(
    h('header', {}, h('div.brand', {}, h('a', { href: '../' }, '← bricksy'), ' 🚚 Tight Fit ', h('span.sub', {}, `Episode ${EPISODE.id} · ${EPISODE.title}`)), h('div.hudwrap', {}, h('div.hud', {}, h('span.stat', {}, `stars `, h('b', {}, `${total}/${JOBS.length * 3}`))), helpB)),
    h('p#instructions', {}, EPISODE.blurb, ' Each job is a chain: load the van, get it through the door, survive the corner. ', h('b', {}, 'Three stars = every stage first try.')),
    dailyCard,
    shiftCard,
    map,
  );
}

// ---------------------------------------------------------------- job

function intro(job: JobDef) {
  const stagesList = job.stages.map((s) => STAGE_NAMES[s.type]).join(' → ');
  const card = h('div.overlay', {}, h('div.card', {},
    h('h2', {}, job.daily ? `Today's job — ${job.customer}’s ${job.item}` : job.shift != null ? `Shift, job ${job.shift + 1} — ${job.customer}’s ${job.item}` : `Job ${job.id} — ${job.customer}’s ${job.item}`),
    h('p.muted', {}, job.line),
    h('p', {}, stagesList),
    h('div.row', {}, h('button.primary', { onclick: () => { card.remove(); void playJob(job); } }, 'Start ↵'), h('button', { onclick: () => card.remove() }, 'Back')),
  ));
  app.append(card);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && card.isConnected) { window.removeEventListener('keydown', onKey); card.remove(); void playJob(job); } };
  window.addEventListener('keydown', onKey);
}

async function playJob(job: JobDef) {
  const stageEl = h('div.sk-stage');
  const panelEl = h('div#panel.sk-panel');
  const hudEl = h('div.hud');
  const hint = h('span#hint');
  const title = h('span');
  app.replaceChildren(h('div.sk.layout', {},
    h('header', {}, h('div.brand', {}, h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); location.reload(); } }, '← map'), ' ', title), hudEl),
    h('p#instructions', {}, h('span.muted', {}, job.line + ' '), hint),
    stageEl, panelEl,
  ));
  let item = makeItem(job.cubes, seeded(jobSeed(job), 'item'));
  const stageResults: boolean[] = [];
  let misses = 0;
  let failed = false;
  const starsEl = h('span.stat.tf-live');
  const stageStat = h('span.stat');
  hudEl.append(stageStat, starsEl);
  const paint = () => { starsEl.textContent = starsGlyph(Math.max(1, 3 - misses)); };
  log.push('tf_job_start', { job: job.id });
  let cleanup: (() => void) | null = null;
  for (const [i, st] of job.stages.entries()) {
    cleanup?.();
    title.textContent = job.daily ? `Today's job · ${job.customer}’s ${job.item}` : job.shift != null ? `Shift · job ${job.shift + 1} · ${job.customer}’s ${job.item}` : `Job ${job.id} · ${job.customer}’s ${job.item}`;
    stageStat.innerHTML = `stage <b>${i + 1}/${job.stages.length}</b> · ${STAGE_NAMES[st.type]}`;
    paint();
    const rng = seeded(jobSeed(job), 'stage', i);
    // The corner scales by company: two other bodies, a third on the boss job and deep into a shift.
    const crowd = (job.boss ? 1 : 0) + (job.shift != null && job.shift >= 3 ? 1 : 0);
    const others: Body[] = st.type === 'corner'
      ? [{ cells: makeItem(4, seeded(jobSeed(job), 'other', 1)), name: 'box of books', color: 0x6b8fd6 }, { cells: [[0, 0, 0], [1, 0, 0]], name: 'crate', color: 0x46a758 },
        ...(crowd ? [{ cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] as Cell[], name: 'lamp', color: 0xb56be0 }] : [])]
      : [];
    const res = await STAGES[st.type]({
      stageEl, panelEl, hintEl: hint, item, itemName: job.item, itemColor: job.color, distance: st.d, rng, others, sfx,
      onAttempt: (ok, attempt) => { if (!ok && attempt === 1) { misses++; paint(); } else if (!ok && attempt > 1) { misses++; paint(); } },
    });
    log.push('tf_stage', { job: job.id, daily: !!job.daily, stage: i, stageType: st.type, firstTry: res.firstTry, attempts: res.attempts, failed: res.failed });
    stageResults.push(!!res.firstTry && !res.failed);
    cleanup = res.cleanup;
    if (res.failed) { failed = true; break; }
    item = res.item;
  }
  const leave = () => { cleanup?.(); cleanup = null; };
  const stars = failed ? 0 : misses === 0 ? 3 : misses === 1 ? 2 : 1;
  if (!failed && !job.daily && job.shift == null) saveStars(job.id, stars);
  let shiftBest = Number(localStorage.getItem(SHIFT_BEST)) || 0;
  if (job.shift != null) {
    if (!failed) shiftDone = job.shift + 1;
    if (shiftDone > shiftBest) { shiftBest = shiftDone; localStorage.setItem(SHIFT_BEST, String(shiftBest)); }
  }
  if (job.daily) {
    // Today's job counts once, failed or not: the record is what the hub and the day streak read.
    while (stageResults.length < job.stages.length) stageResults.push(false);
    localStorage.setItem(DAILY_KEY(), JSON.stringify({ results: stageResults, done: true }));
    const st = statsOf('tightfit');
    if (st.lastDate !== today()) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      st.dayStreak = st.lastDate === today(y) ? st.dayStreak + 1 : 1;
      st.bestDayStreak = Math.max(st.bestDayStreak, st.dayStreak);
      st.lastDate = today(); st.played++; st.totalScore += stars; st.totalRounds += 3;
      localStorage.setItem('bricksy.tightfit.stats', JSON.stringify(st));
    }
  }
  log.push('tf_job_end', { job: job.id, daily: !!job.daily, shift: job.shift, stars, misses, failed });
  if (failed) sfx.over(); else sfx.levelUp();
  const next = job.daily ? undefined : JOBS.find((j) => j.id === job.id + 1);
  const shareDaily = async () => {
    const text = `🚚 Tight Fit #${dayNumber()} · ${starsGlyph(stars)}\n${stageResults.map((r) => (r ? '🟩' : '🟥')).join('')}\n${location.origin}${location.pathname}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } await navigator.clipboard.writeText(text); } catch { /* cancelled */ }
  };
  const shareShift = async () => {
    const text = `🚚 Tight Fit · shift · ${shiftDone} job${shiftDone === 1 ? '' : 's'} delivered\n${location.origin}${location.pathname}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } await navigator.clipboard.writeText(text); } catch { /* cancelled */ }
  };
  const shiftOver = job.shift != null && failed;
  const card = h('div.overlay', {}, h('div.card', {},
    h('h2', {}, shiftOver ? `Shift over · ${shiftDone} job${shiftDone === 1 ? '' : 's'}` : failed ? 'Job failed' : starsGlyph(stars)),
    h('p', {}, failed ? `${job.customer} is going to write a review.` : job.done),
    h('p.muted', {}, shiftOver ? `Best shift ${shiftBest}.` : failed ? 'Every stage allows three tries. Try the job again.' : misses === 0 ? 'Every stage, first try.' : `${misses} ${misses === 1 ? 'retry' : 'retries'} along the way.`),
    h('div.row', {},
      job.daily ? h('button.primary', { onclick: shareDaily }, 'Share')
        : shiftOver ? h('button.primary', { onclick: () => { leave(); card.remove(); shiftDone = 0; void playJob(shiftJob(0, mulberry32((Math.random() * 2 ** 31) | 0))); } }, 'Clock in again ↵')
        : job.shift != null ? h('button.primary', { onclick: () => { leave(); card.remove(); void playJob(shiftJob(job.shift! + 1, mulberry32((Math.random() * 2 ** 31) | 0))); } }, 'Next job ↵')
        : failed ? h('button.primary', { onclick: () => { leave(); card.remove(); void playJob(job); } }, 'Retry ↵')
          : next ? h('button.primary', { onclick: () => { leave(); card.remove(); intro(next); } }, 'Next job ↵')
            : h('button.primary', { onclick: () => { leave(); renderMap(); } }, 'Episode done ↵'),
      job.daily ? h('a.button', { href: '../' }, 'More games') : shiftOver ? h('button', { onclick: shareShift }, 'Share') : null,
      h('button', { onclick: () => { leave(); renderMap(); } }, 'Map'),
    ),
  ));
  stageEl.append(card);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && card.isConnected) { window.removeEventListener('keydown', onKey); (card.querySelector('button.primary') as HTMLButtonElement).click(); } };
  window.addEventListener('keydown', onKey);
}

renderMap();
