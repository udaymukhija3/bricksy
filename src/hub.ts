// The front door: one card per game, grouped by the kind of spatial operation each asks for,
// with today's daily result on each card so the hub is also the day's scorecard.
import './style.css';
import './pwa';
import { h } from './lab/kit';
import type { SketchDef } from './lab/types';
import { GROUPS, TIGHT_FIT } from './games';
import { dailyRecord, dayNumber, statsOf } from './run';

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
  if (rec?.done) return h('span.today.done', {}, `today ${rec.results.filter(Boolean).length}/${rec.results.length} `, h('span.grid', {}, rec.results.map((r) => (r ? '🟩' : '🟥')).join('')));
  if (rec) return h('span.today.partial', {}, `round ${rec.results.length + 1} in progress →`);
  return h('span.today', {}, st.dayStreak ? `daily #${dayNumber()} → · day streak ${st.dayStreak}` : `daily #${dayNumber()} →`);
}

const card = (g: SketchDef, flag = false) => h('a.card' + (flag ? '.flag' : ''), { href: g.href ?? `${g.id}/` },
  h('div.icon-big', {}, g.icon ?? '▪'),
  h('div', {}, h('h3', {}, g.title), h('p', {}, g.tagline), h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, g.skill), status(g))),
);

const done = games.filter((g) => dailyRecord(g.id)?.done).length;
const bestStreak = Math.max(0, ...games.map((g) => statsOf(g.id).dayStreak));
app.replaceChildren(
  h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'spatial games')), h('div.hud', {},
    h('span.stat', {}, `daily #${dayNumber()} · `, h('b', {}, `${done}/${games.length}`), ' played today'),
    bestStreak ? h('span.stat', {}, 'day streak ', h('b', {}, String(bestStreak))) : null,
    h('a', { href: 'lab.html' }, 'lab ↗'))),
  h('p#instructions', {}, 'Small games where you have to see it in your head first. ', h('b', {}, 'Predict, commit, watch reality.'), ' Every game has a daily puzzle — the same for everyone, once a day — and an endless mode.'),
  h('div.hub', {}, card(TIGHT_FIT, true)),
  ...GROUPS.flatMap((grp) => [
    h('div.group', {}, h('h2', {}, grp.title), h('p.muted', {}, grp.blurb)),
    h('div.hub', {}, ...grp.games.map((g) => card(g))),
  ]),
);
