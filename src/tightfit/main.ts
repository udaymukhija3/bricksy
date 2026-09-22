// A small moving-day campaign. The geometry and prediction rules live in the stage models.
import '../style.css';
import './tightfit.css';
import '../pwa.ts';
import '../guard.ts';
import { h, mulberry32, toast } from '../lab/kit.ts';
import { Sfx } from '../sfx.ts';
import { Log } from '../log.ts';
import { makeItem, type Body } from './model.ts';
import { furnitureCells } from './furniture.ts';
import { type Cell } from '../polycube.ts';
import { STAGES } from './stages.ts';
import { EPISODE, JOBS, CHAPTERS, DISPATCH, STAGE_NAMES, dailyJob, shiftJob, type JobDef } from './jobs.ts';
import { today, dayNumber, dailyRecord, statsOf } from '../run.ts';
import { feedbackLink } from '../feedback.ts';
import { vanArt, itemArt } from './art.ts';
import { readCheckpoint, type Checkpoint } from './journey.ts';

const app = document.getElementById('app')!;
document.body.classList.add('tightfit');
app.className = 'tf-app';
const sfx = new Sfx();
const log = new Log();
const STARS_KEY = 'bricksy.tf.stars';
const RESUME_KEY = 'bricksy.tf.journey.v1';
const SHIFT_BEST = 'bricksy.tightfit.best';
let shiftDone = 0;
let playing = false;
let mapKeys: AbortController | null = null;

function hash(s: string) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return x >>> 0; }
const seeded = (...parts: (string | number)[]) => mulberry32(hash(`tf${EPISODE.id}|${parts.join('|')}`));
const jobSeed = (job: JobDef) => job.seedKey ?? job.id;
const starsGlyph = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const belongsTo = (name: string) => name + (name.endsWith('s') ? '’' : '’s');
function get(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function put(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Storage is unavailable. Keep this tab open to finish your day.'); } }
function remove(key: string) { try { localStorage.removeItem(key); } catch { /* private browsing */ } }
function loadStars(): Record<number, number> {
  try {
    const raw = JSON.parse(get(STARS_KEY) ?? '{}');
    return Object.fromEntries(JOBS.map((j) => [j.id, Number.isInteger(raw?.[j.id]) && raw[j.id] >= 1 && raw[j.id] <= 3 ? raw[j.id] : 0]));
  } catch { return {}; }
}
function saveStars(id: number, stars: number) { const all = loadStars(); all[id] = Math.max(all[id] ?? 0, stars); put(STARS_KEY, all); }
const checkpoint = () => readCheckpoint(get(RESUME_KEY));
const isCampaign = (job: JobDef) => !job.daily && job.shift == null;
const button = (text: string, action: () => void, primary = false) => h('button' + (primary ? '.primary' : ''), { onclick: action }, text);
const eyebrow = (text: string) => h('span.tf-eyebrow', {}, text);
function soundButton() { const b = button(sfx.muted ? 'Sound off' : 'Sound on', () => { sfx.toggle(); b.textContent = sfx.muted ? 'Sound off' : 'Sound on'; }); b.setAttribute('aria-label', 'Toggle sound'); return b; }

// Native dialogs keep focus in the card and return it to the launching control.
function modal(title: string, content: HTMLElement[], actions: { label: string; run: () => void; primary?: boolean }[]) {
  const d = document.createElement('dialog'); d.className = 'tf-dialog'; d.setAttribute('aria-label', title);
  const close = () => { d.close(); d.remove(); };
  let used = false;
  d.append(h('div.tf-dialog-inner', {}, h('h2', {}, title), ...content,
    h('div.tf-dialog-actions', {}, ...actions.map((a) => button(a.label, () => { if (used) return; used = true; close(); a.run(); }, a.primary)))));
  d.addEventListener('close', () => d.remove(), { once: true });
  document.body.append(d); d.showModal();
  (d.querySelector('button.primary') ?? d.querySelector('button'))?.scrollIntoView({ block: 'nearest' });
  (d.querySelector('button.primary') as HTMLButtonElement | null)?.focus();
  return d;
}

function help() {
  modal('A little help from dispatch', [
    h('p', {}, 'Choose your turns first. Then commit and watch the furniture move. Undo and Clear change your plan before you commit.'),
    h('ol.tf-help-list', {}, h('li', {}, 'Load: match the padded item to the glowing space in the van.'), h('li', {}, 'Doorway: get the same item through the opening. Its orientation carries over.'), h('li', {}, 'Corner: predict which cargo will slide into the marked space.')),
    h('p', {}, 'Each load and doorway allows three tries. Miss the corner prediction and you lose a star, but still complete the delivery. A completed job always unlocks the next one.'),
    h('p.tf-small', {}, 'Keyboard: X, Y, Z turn; Shift reverses; Backspace undoes; Enter commits. In the corner, 1–4 select cargo. Progress stays on this device.')
  ], [{ label: 'Got it', primary: true, run: () => {} }]);
}

function renderMap() {
  playing = false;
  mapKeys?.abort(); mapKeys = new AbortController();
  const stars = loadStars();
  const completed = JOBS.filter((j) => stars[j.id] > 0).length;
  const total = JOBS.reduce((n, j) => n + (stars[j.id] ?? 0), 0);
  const next = JOBS.find((j) => !stars[j.id]);
  const saved = checkpoint();
  const nextJob = saved ? JOBS.find((j) => j.id === saved.jobId)! : next ?? JOBS[0];
  const start = () => intro(nextJob, !!saved);
  const dn = dayNumber();
  const dj = { ...dailyJob(dn, seeded('daily', dn)), date: today(), day: dn };
  const rec = dailyRecord('tightfit');
  const best = Number(get(SHIFT_BEST)) || 0;
  app.replaceChildren(
    h('header.tf-header', {}, h('a.tf-wordmark', { href: './' }, h('span.tf-mark', {}, '↗'), 'Tight Fit', h('span', {}, 'NEIGHBORHOOD MOVERS')),
      h('nav', { 'aria-label': 'Game navigation' }, h('a', { href: '../' }, 'A bricksy game'), soundButton(), button('How to play', help))),
    h('section.tf-hero', {}, h('div.tf-hero-copy', {}, eyebrow('A moving-day puzzle comedy'), h('h1', {}, 'Small van.', h('br'), h('em', {}, 'Big feelings.')),
      h('p', {}, 'Ten deliveries. One very optimistic moving company. Turn, tuck, and squeeze the neighborhood’s most treasured things into place.'),
      button(saved ? 'Continue your delivery →' : completed === JOBS.length ? 'Take another trip →' : completed ? 'Continue your day →' : 'Start your first day →', start, true),
      h('div.tf-hero-note', {}, completed ? `${completed} of 10 delivered · ${total} stars collected` : 'Play in your browser · No account needed')),
      vanArt(), h('span.tf-stamp', {}, 'HANDLE WITH', h('br'), 'a little care')),
    h('section.tf-dispatch', {}, h('div.tf-avatar', {}, 'J'), h('div', {}, eyebrow('Jo · Your dispatcher'), h('p', {}, completed === JOBS.length ? '“The concert is starting. Someone saved you a seat. Not in the van, for once.”' : completed ? '“Your route is right here. The kettle can wait. Actually, no. Bring the kettle.”' : '“First day? Good. You steer the furniture. I’ll handle the customers.”'))),
    h('section.tf-route', {}, h('div.tf-section-heading', {}, h('div', {}, eyebrow('Episode 01'), h('h2', {}, 'Your first day')), h('span.tf-count', {}, `${completed} / 10 delivered`)),
      ...CHAPTERS.map((chapter, ci) => h('section.tf-chapter', {},
        h('div.tf-chapter-heading', {}, h('span.tf-chapter-number', {}, `0${ci + 1}`), h('div', {}, h('h3', {}, chapter.name), h('p', {}, chapter.time))),
        h('p.tf-chapter-note', {}, chapter.note),
        h('div.tf-jobs', {}, ...chapter.jobs.map((id) => {
          const j = JOBS.find((job) => job.id === id)!;
          const locked = id > 1 && !(stars[id - 1] > 0);
          const b = h('button.tf-job' + (stars[id] ? '.delivered' : '') + (id === next?.id ? '.up-next' : ''), { disabled: locked ? 'true' : null, onclick: () => intro(j, saved?.jobId === id), 'aria-label': `${belongsTo(j.customer)} ${j.item}, job ${id}${locked ? ', locked' : stars[id] ? `, ${stars[id]} stars` : ''}` },
            h('span.tf-job-number', {}, String(id).padStart(2,'0')), itemArt(j.item, j.color), h('div.tf-job-copy', {}, h('h4', {}, j.customer), h('p', {}, j.item), h('span.tf-job-state', {}, locked ? 'Finish the previous job' : stars[id] ? `${starsGlyph(stars[id])} Delivered` : id === saved?.jobId ? 'Delivery in progress →' : 'Ready when you are →')));
          return b;
        }))))),
    h('section.tf-extras', {}, h('div', {}, eyebrow('A little more room?'), h('h2', {}, 'Keep the van running.'), h('p', {}, 'A fresh delivery every day, or see how far one shift takes you.')),
      h('div.tf-extra-actions', {}, button(rec?.done ? `Today’s delivery · ${rec.results.filter(Boolean).length}/${rec.results.length} clean stages` : 'Try today’s delivery →', () => rec?.done ? showDaily(rec.results, dj) : intro(dj)),
        button(`Endless shift${best ? ` · best ${best}` : ''} →`, () => { shiftDone = 0; intro(shiftJob(0, mulberry32((Math.random() * 2 ** 31) | 0))); }))),
    h('footer.tf-footer', {}, h('span', {}, 'A small game about making things fit.'), h('a', { href: '../' }, 'More bricksy experiments ↗'), feedbackLink('Tight Fit'), h('span', {}, 'Progress saved on this device')),
  );
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === document.body && !document.querySelector('dialog[open]')) { e.preventDefault(); start(); }
  }, { signal: mapKeys.signal });
}

function showDaily(results: boolean[], job: JobDef) {
  modal('Today’s delivery is done', [h('p.tf-result-grid', {}, results.map((r) => r ? '🟩' : '🟥').join('')), h('p', {}, `${results.filter(Boolean).length} of ${results.length} stages, first try. The van gets a fresh job tomorrow.`)], [
    { label: 'Share your delivery', primary: true, run: () => { void share(`Tight Fit #${job.day} · ${results.map((r) => r ? '🟩' : '🟥').join('')}`); } }, { label: 'Back to your route', run: () => {} }
  ]);
}
async function share(message: string) {
  const text = `🚚 ${message}\n${location.origin}${location.pathname}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Delivery copied.'); } } catch { /* cancelled */ }
}

function intro(job: JobDef, resume = false) {
  if (playing) return;
  const chapter = CHAPTERS.find((c) => c.jobs.includes(job.id));
  const content = [itemArt(job.item, job.color), eyebrow(job.daily ? `Daily delivery #${job.day}` : job.shift != null ? `Shift · delivery ${job.shift + 1}` : `${chapter?.name ?? ''} · job ${job.id}`),
    h('p.tf-quote', {}, job.line), h('p.tf-dispatch-line', {}, isCampaign(job) ? DISPATCH[job.id] : 'Jo: “Another address. Another thing that definitely fits. Probably.”'),
    h('p.tf-stage-list', {}, job.stages.map((s) => STAGE_NAMES[s.type]).join(' → '))];
  modal(`${belongsTo(job.customer)} ${job.item}`, content, [
    { label: resume ? 'Continue delivery →' : job.id === 1 && isCampaign(job) ? 'Let’s learn one turn →' : 'Let’s move it →', primary: true, run: () => { void playJob(job, resume); } },
    { label: 'Back to the route', run: () => {} },
  ]);
}

async function stageBrief(job: JobDef, index: number) {
  const kind = job.stages[index].type;
  const copy = kind === 'doorway' ? `Same ${job.item}, new problem. It keeps the orientation you just left it in. Queue the turns that get it through the opening.` : 'The van is taking a corner. Pick the item you think will slide into the marked space, then watch the cargo move.';
  await new Promise<void>((resolve) => {
    const d = modal(kind === 'doorway' ? 'Mind the doorframe.' : 'Things may shift in transit.', [eyebrow(`Next · ${STAGE_NAMES[kind]}`), h('p', {}, copy)], [{ label: 'Ready →', primary: true, run: resolve }]);
    d.addEventListener('cancel', (e) => e.preventDefault());
  });
}

async function playJob(job: JobDef, resume = false) {
  if (playing) return;
  playing = true; mapKeys?.abort();
  window.scrollTo(0, 0);
  const stageEl = h('div.sk-stage.tf-stage');
  const panelEl = h('div#panel.sk-panel.tf-controls');
  const hint = h('span#hint');
  const title = job.daily ? `Today’s delivery #${job.day}` : job.shift != null ? `Shift · delivery ${job.shift + 1}` : `Job ${job.id} · ${job.customer}`;
  const starsEl = h('span.tf-live');
  const stageStat = h('span.tf-stage-stat');
  app.replaceChildren(h('div.tf-play', {},
    h('header.tf-play-header', {}, h('a', { href: './', title: 'Campaign progress saves between stages' }, '← Route'), h('div', {}, eyebrow(title), h('h2', {}, job.item)), h('div.tf-play-tools', {}, starsEl, soundButton())),
    h('div.tf-stage-progress', {}, ...job.stages.map((s, i) => h('span', { 'data-stage': String(i) }, `${i + 1} · ${STAGE_NAMES[s.type]}`))),
    h('div.tf-play-grid', {}, stageEl, panelEl),
    h('p.tf-play-caption', {}, stageStat, ' · ', hint),
    h('p.tf-save-note', {}, 'Plan first. Commit when you’re ready. ', isCampaign(job) ? 'Your delivery saves between stages.' : 'Three tries for each load and doorway.'),
  ));
  const saved = resume && isCampaign(job) ? checkpoint() : null;
  const valid = saved?.jobId === job.id ? saved : null;
  let item = valid?.item ?? furnitureCells(job.item) ?? makeItem(job.cubes, seeded(jobSeed(job), 'item'));
  const stageResults = valid?.results ?? [];
  let misses = valid?.misses ?? 0;
  let failed = false;
  const firstStage = valid?.stageIndex ?? 0;
  const save = (stageIndex: number) => {
    if (isCampaign(job)) put(RESUME_KEY, { version: 1, jobId: job.id, stageIndex, item, misses, results: stageResults } satisfies Checkpoint);
  };
  const paint = () => { starsEl.textContent = starsGlyph(Math.max(1, 3 - misses)); starsEl.setAttribute('aria-label', `${Math.max(1, 3 - misses)} stars remaining`); };
  log.push('tf_job_start', { job: job.id, resumed: !!valid });
  let cleanup: (() => void) | null = null;
  try {
    for (const [i, st] of job.stages.entries()) {
      if (i < firstStage) continue;
      cleanup?.(); cleanup = null;
      save(i);
      if (i > 0 && isCampaign(job)) await stageBrief(job, i);
      stageStat.textContent = STAGE_NAMES[st.type];
      app.querySelectorAll('[data-stage]').forEach((e) => { e.classList.toggle('active', Number(e.getAttribute('data-stage')) === i); e.classList.toggle('complete', Number(e.getAttribute('data-stage')) < i); });
      paint();
      const crowd = (job.boss ? 1 : 0) + (job.shift != null && job.shift >= 3 ? 1 : 0);
      const others: Body[] = st.type === 'corner' ? [
        { cells: makeItem(4, seeded(jobSeed(job), 'other', 1)), name: 'box of books', color: 0x739a83 },
        { cells: [[0,0,0],[1,0,0]], name: 'crate', color: 0xb48757 },
        ...(crowd ? [{ cells: [[0,0,0],[1,0,0],[0,1,0]] as Cell[], name: 'spare lamp', color: 0xe0b157 }] : []),
      ] : [];
      const res = await STAGES[st.type]({ stageEl, panelEl, hintEl: hint, item, itemName: job.item, itemColor: job.color, distance: st.d, rng: seeded(jobSeed(job), 'stage', i), others, sfx,
        guided: isCampaign(job) && job.id === 1,
        onAttempt: (ok) => { if (!ok) misses++; paint(); },
      });
      cleanup = res.cleanup;
      log.push('tf_stage', { job: job.id, daily: !!job.daily, stage: i, stageType: st.type, firstTry: res.firstTry, attempts: res.attempts, failed: res.failed });
      stageResults.push(res.firstTry && !res.failed);
      if (res.failed) { failed = true; break; }
      item = res.item;
      save(i + 1);
    }
  } catch (error) {
    cleanup?.(); playing = false;
    log.push('error', { game: 'tightfit', message: error instanceof Error ? error.message : String(error) });
    modal('Dispatch needs a moment', [h('p', {}, 'This delivery could not load. Your completed jobs are safe. Return to the route and try again.')], [{ label: 'Back to the route', primary: true, run: renderMap }]);
    return;
  }
  const stars = failed ? 0 : Math.max(1, 3 - misses);
  if (isCampaign(job)) { if (!failed) saveStars(job.id, stars); remove(RESUME_KEY); }
  let best = Number(get(SHIFT_BEST)) || 0;
  if (job.shift != null) { if (!failed) shiftDone = job.shift + 1; if (shiftDone > best) { best = shiftDone; put(SHIFT_BEST, best); } }
  if (job.daily) {
    while (stageResults.length < job.stages.length) stageResults.push(false);
    const date = job.date ?? today();
    put(`bricksy.tightfit.daily.${date}`, { results: stageResults, done: true });
    const stats = statsOf('tightfit');
    if (stats.lastDate !== date) {
      const yesterday = new Date(`${date}T12:00:00`); yesterday.setDate(yesterday.getDate() - 1);
      stats.dayStreak = stats.lastDate === today(yesterday) ? stats.dayStreak + 1 : 1;
      stats.bestDayStreak = Math.max(stats.bestDayStreak, stats.dayStreak);
      stats.lastDate = date; stats.played++; stats.totalScore += stageResults.filter(Boolean).length; stats.totalRounds += stageResults.length;
      put('bricksy.tightfit.stats', stats);
    }
  }
  log.push('tf_job_end', { job: job.id, daily: !!job.daily, shift: job.shift, stars, misses, failed });
  log.flush();
  if (failed) sfx.over(); else sfx.levelUp();
  const next = JOBS.find((j) => j.id === job.id + 1);
  const episodeDone = !failed && isCampaign(job) && !next;
  const leave = () => { cleanup?.(); cleanup = null; playing = false; };
  const again = () => { leave(); void playJob(job); };
  const content = [eyebrow(failed ? 'A small setback' : episodeDone ? 'Episode complete' : 'Signed, sealed, delivered'), itemArt(job.item, job.color),
    h('p.tf-result-stars', {}, starsGlyph(stars)), h('p.tf-quote', {}, failed ? 'Jo: “Nobody’s hurt. The furniture is merely reconsidering.”' : job.done),
    h('p', {}, episodeDone ? 'The piano is in tune. Priya’s lamp lights the stage. The keeper points the telescope at the first star. Someone hands you a sandwich. That’s your first day.' : failed ? 'Three tries used. Take a breath and give this delivery another go.' : misses === 0 ? 'Every stage, first try. Nicely moved.' : `${misses} ${misses === 1 ? 'retry' : 'retries'}. You got it there. That’s what counts.`)];
  const goNext = () => {
    leave();
    if (job.shift != null) { if (failed) shiftDone = 0; void playJob(shiftJob(failed ? 0 : job.shift + 1, mulberry32((Math.random() * 2 ** 31) | 0))); }
    else { renderMap(); if (next && !episodeDone) intro(next); }
  };
  const actions = job.daily ? [{ label: 'Share your delivery', primary: true, run: () => { leave(); renderMap(); void share(`Tight Fit #${job.day} · ${stageResults.map((r) => r ? '🟩' : '🟥').join('')}`); } }]
    : [{ label: job.shift != null ? failed ? 'Start another shift →' : 'Next delivery →' : failed ? 'Try the delivery again →' : episodeDone ? 'Back to the neighborhood →' : 'Next delivery →', primary: true, run: failed && job.shift == null ? again : goNext }];
  actions.push({ label: 'Back to the route', primary: false, run: () => { leave(); renderMap(); } });
  const d = modal(job.shift != null && failed ? `Shift over · ${shiftDone} delivered` : episodeDone ? 'You made a little room.' : failed ? 'Let’s try that again.' : 'A perfect fit.', content, actions);
  d.addEventListener('cancel', (e) => { e.preventDefault(); d.close(); leave(); renderMap(); });
}

renderMap();
