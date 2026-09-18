// The front door: one card per game, grouped by the kind of spatial operation each asks for,
// with today's daily result on each card so the hub is also the day's scorecard.
import './style.css';
import './pwa.ts';
import './guard.ts';
import { h } from './lab/kit.ts';
import type { SketchDef } from './lab/types.ts';
import { GROUPS, TIGHT_FIT } from './games.ts';
import { dailyRecord, dayNumber, statsOf } from './run.ts';
import { Log } from './log.ts';

const app = document.getElementById('app')!;
const games = [TIGHT_FIT, ...GROUPS.flatMap((g) => g.games)];

function status(g: SketchDef) {
  const rec = dailyRecord(g.id);
  if (g.id === 'tightfit') {
    let stars = 0;
    try { stars = Object.values(JSON.parse(localStorage.getItem('bricksy.tf.stars') ?? '{}') as Record<string, number>).reduce((a, b) => a + b, 0); } catch { /* none */ }
    const saga = stars ? ` · saga ★ ${stars}/30` : '';
    if (rec?.done) return h('span.today.done', {}, `today's job ${rec.results.map((r) => (r ? '🟩' : '🟥')).join('')}${saga}`);
    return h('span.today', {}, `today's job #${dayNumber()} →${saga}`);
  }
  const st = statsOf(g.id);
  const best = Number(localStorage.getItem(`bricksy.${g.id}.best`)) || 0;
  const bestTxt = best ? ` · endless best ${best}` : '';
  if (rec?.done) return h('span.today.done', {}, `today ${rec.results.filter(Boolean).length}/${rec.results.length} `, h('span.grid', {}, rec.results.map((r) => (r ? '🟩' : '🟥')).join('')), h('span.muted', {}, bestTxt));
  if (rec) return h('span.today.partial', {}, `round ${rec.results.length + 1} in progress →${bestTxt}`);
  return h('span.today', {}, `daily #${dayNumber()} →${st.dayStreak ? ` · day streak ${st.dayStreak}` : ''}`, h('span.muted', {}, bestTxt));
}

const card = (g: SketchDef, flag = false) => h('a.card' + (flag ? '.flag' : ''), { href: g.href ?? `${g.id}/` },
  h('div.icon-big', {}, g.icon ?? '▪'),
  h('div', {}, h('h3', {}, g.title), h('p', {}, g.tagline), h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, g.skill), status(g))),
);

const done = games.filter((g) => dailyRecord(g.id)?.done).length;
const bestStreak = Math.max(0, ...games.map((g) => statsOf(g.id).dayStreak));
// The one call to action: the next daily you haven't played (in progress first), or nothing left today.
const nextUp = games.find((g) => { const r = dailyRecord(g.id); return r && !r.done; }) ?? games.find((g) => !dailyRecord(g.id)?.done);
const cta = nextUp
  ? h('a.button.primary.cta', { href: nextUp.href ?? `${nextUp.id}/` }, `${done ? 'Next' : 'Play'} today's daily: ${nextUp.icon ?? ''} ${nextUp.title} →`)
  : h('span.stat.done', {}, `All ${games.length} dailies done today ✓ — endless is open on every card`);
app.replaceChildren(
  h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'spatial games')), h('div.hud', {},
    h('span.stat', {}, `daily #${dayNumber()} · `, h('b', {}, `${done}/${games.length}`), ' played today'),
    bestStreak ? h('span.stat', {}, 'day streak ', h('b', {}, String(bestStreak))) : null,
    h('a', { href: 'lab.html' }, 'lab ↗'))),
  h('p#instructions', {}, 'Small games where you have to see it in your head first. ', h('b', {}, 'Predict, commit, watch reality.'), ' Every game has a daily puzzle — the same for everyone, once a day — and an endless mode.'),
  h('div.ctarow', {}, cta),
  h('div.hub', {}, card(TIGHT_FIT, true)),
  ...GROUPS.flatMap((grp) => [
    h('div.group', {}, h('h2', {}, grp.title), h('p.muted', {}, grp.blurb)),
    h('div.hub', {}, ...grp.games.map((g) => card(g))),
  ]),
  h('footer', {},
    h('span', {}, 'Everything — streaks, results, the event log — stays on this device. No accounts, no tracking.'),
    h('a', { href: 'https://github.com/udaymukhija3/bricksy' }, 'source ↗'),
    h('button', { onclick: () => new Log().export(), title: 'Every action, as JSON' }, 'Export log'),
    h('button', { onclick: () => { if (confirm('Erase all bricksy data on this device: streaks, today\'s results, bests, stars and the event log?')) { for (const k of Object.keys(localStorage)) if (k.startsWith('bricksy.')) localStorage.removeItem(k); location.reload(); } } }, 'Reset everything'),
  ),
);
