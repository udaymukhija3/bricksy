// Tight Fit: map → job intro → stages → result. Stars persist per job.
import '../style.css';
import '../pwa';
import { h, mulberry32 } from '../lab/kit';
import { Sfx } from '../sfx';
import { Log } from '../log';
import { makeItem, type Body } from './model';
import { STAGES } from './stages';
import { EPISODE, JOBS, STAGE_NAMES, type JobDef } from './jobs';

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
  app.replaceChildren(
    h('header', {}, h('div.brand', {}, h('a', { href: '../' }, '← bricksy'), ' 🚚 Tight Fit ', h('span.sub', {}, `Episode ${EPISODE.id} · ${EPISODE.title}`)), h('div.hud', {}, h('span.stat', {}, `stars `, h('b', {}, `${total}/${JOBS.length * 3}`)))),
    h('p#instructions', {}, EPISODE.blurb, ' Each job is a chain: load the van, get it through the door, survive the corner. ', h('b', {}, 'Three stars = every stage first try.')),
    map,
  );
}

// ---------------------------------------------------------------- job

function intro(job: JobDef) {
  const stagesList = job.stages.map((s) => STAGE_NAMES[s.type]).join(' → ');
  const card = h('div.overlay', {}, h('div.card', {},
    h('h2', {}, `Job ${job.id} — ${job.customer}’s ${job.item}`),
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
  let item = makeItem(job.cubes, seeded(job.id, 'item'));
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
    title.textContent = `Job ${job.id} · ${job.customer}’s ${job.item}`;
    stageStat.innerHTML = `stage <b>${i + 1}/${job.stages.length}</b> · ${STAGE_NAMES[st.type]}`;
    paint();
    const rng = seeded(job.id, 'stage', i);
    const others: Body[] = st.type === 'corner'
      ? [{ cells: makeItem(4, seeded(job.id, 'other', 1)), name: 'box of books', color: 0x6b8fd6 }, { cells: [[0, 0, 0], [1, 0, 0]], name: 'crate', color: 0x46a758 }]
      : [];
    const res = await STAGES[st.type]({
      stageEl, panelEl, hintEl: hint, item, itemName: job.item, itemColor: job.color, distance: st.d, rng, others, sfx,
      onAttempt: (ok, attempt) => { if (!ok && attempt === 1) { misses++; paint(); } else if (!ok && attempt > 1) { misses++; paint(); } },
    });
    log.push('tf_stage', { job: job.id, stage: i, type: st.type, firstTry: res.firstTry, attempts: res.attempts, failed: res.failed });
    cleanup = res.cleanup;
    if (res.failed) { failed = true; break; }
    item = res.item;
  }
  const leave = () => { cleanup?.(); cleanup = null; };
  const stars = failed ? 0 : misses === 0 ? 3 : misses === 1 ? 2 : 1;
  if (!failed) saveStars(job.id, stars);
  log.push('tf_job_end', { job: job.id, stars, misses, failed });
  if (failed) sfx.over(); else sfx.levelUp();
  const next = JOBS.find((j) => j.id === job.id + 1);
  const card = h('div.overlay', {}, h('div.card', {},
    h('h2', {}, failed ? 'Job failed' : starsGlyph(stars)),
    h('p', {}, failed ? `${job.customer} is going to write a review.` : job.done),
    h('p.muted', {}, failed ? 'Every stage allows three tries. Try the job again.' : misses === 0 ? 'Every stage, first try.' : `${misses} ${misses === 1 ? 'retry' : 'retries'} along the way.`),
    h('div.row', {},
      failed ? h('button.primary', { onclick: () => { leave(); card.remove(); void playJob(job); } }, 'Retry ↵')
        : next ? h('button.primary', { onclick: () => { leave(); card.remove(); intro(next); } }, 'Next job ↵')
          : h('button.primary', { onclick: () => { leave(); renderMap(); } }, 'Episode done ↵'),
      h('button', { onclick: () => { leave(); renderMap(); } }, 'Map'),
    ),
  ));
  stageEl.append(card);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && card.isConnected) { window.removeEventListener('keydown', onKey); (card.querySelector('button.primary') as HTMLButtonElement).click(); } };
  window.addEventListener('keydown', onKey);
}

renderMap();
