// The front door: one card per game.
import './style.css';
import './pwa';
import { h } from './lab/kit';
import { GAMES, PACK } from './games';

const app = document.getElementById('app')!;
const card = (g: typeof PACK, flag = false) => h('a.card' + (flag ? '.flag' : ''), { href: g.href ?? `${g.id}/` },
  h('div.icon-big', {}, g.icon ?? '▪'),
  h('div', {}, h('h3', {}, g.title), h('p', {}, g.tagline), h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, g.skill))),
);
app.replaceChildren(
  h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'spatial games')), h('div.hud', {}, h('a', { href: 'lab.html' }, 'lab ↗'))),
  h('p#instructions', {}, 'Small games where you have to see it in your head first. ', h('b', {}, 'Predict, commit, watch reality.'), ' Every game has a daily puzzle (same for everyone) and an endless mode.'),
  h('div.hub', {}, card(PACK, true), ...GAMES.map((g) => card(g))),
);
