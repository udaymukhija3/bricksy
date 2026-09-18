// The front door: one card per game, grouped by the kind of spatial operation each asks for.
import './style.css';
import './pwa';
import { h } from './lab/kit';
import type { SketchDef } from './lab/types';
import { GROUPS, TIGHT_FIT } from './games';

const app = document.getElementById('app')!;
const card = (g: SketchDef, flag = false) => h('a.card' + (flag ? '.flag' : ''), { href: g.href ?? `${g.id}/` },
  h('div.icon-big', {}, g.icon ?? '▪'),
  h('div', {}, h('h3', {}, g.title), h('p', {}, g.tagline), h('div.card-top', { style: { marginTop: '6px' } }, h('span.skill', {}, g.skill))),
);
app.replaceChildren(
  h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'spatial games')), h('div.hud', {}, h('a', { href: 'lab.html' }, 'lab ↗'))),
  h('p#instructions', {}, 'Small games where you have to see it in your head first. ', h('b', {}, 'Predict, commit, watch reality.'), ' Every game has a daily puzzle (same for everyone) and an endless mode.'),
  h('div.hub', {}, card(TIGHT_FIT, true)),
  ...GROUPS.flatMap((grp) => [
    h('div.group', {}, h('h2', {}, grp.title), h('p.muted', {}, grp.blurb)),
    h('div.hub', {}, ...grp.games.map((g) => card(g))),
  ]),
);
