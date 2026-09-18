// The lab: the catalogue with each game's skill line, plus prototype 0. Every idea from the
// brainstorm is now a game with its own page; this page is the index that keeps the skill
// each mechanic is meant to require next to the mechanic.
import '../style.css';
import '../pwa.ts';
import '../guard.ts';
import { h } from './kit.ts';
import type { SketchDef } from './types.ts';
import { GAMES, PACK, TIGHT_FIT } from '../games.ts';

const ROSTER: SketchDef[] = [
  TIGHT_FIT,
  PACK,
  ...GAMES.map((g) => ({ ...g, href: `${g.id}/` })),
  { id: 'match', title: 'Transform Combo', tagline: 'Prototype 0, the control condition: the pack kernel without the packing framing. Turn the left shape to match the right one.', skill: 'rotation sequencing', status: 'playable', href: 'match.html' },
];

const app = document.getElementById('app')!;
const cards = ROSTER.map((s) => h('a.card', { href: s.href },
  h('div.card-top', {}, h('span.pill.' + s.status, {}, s.status === 'flagship' ? 'flagship' : 'game'), h('span.skill', {}, s.skill)),
  h('h3', {}, (s.icon ? s.icon + ' ' : '') + s.title),
  h('p', {}, s.tagline),
));
app.replaceChildren(
  h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'lab · one game per idea')), h('div.hud', {}, h('a', { href: './' }, 'games ↗'))),
  h('p#instructions', {}, 'Every game keeps one rule: ', h('b', {}, 'predict → commit → reality executes'), '. The skill line under each card is the cognitive operation the mechanic is meant to require — the design test for every one was "could someone get good at this without it?"'),
  h('div.cards', {}, ...cards),
);
