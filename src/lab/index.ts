// The lab: one sketch per idea, hash-routed. Sketches register in ROSTER.
import '../style.css';
import '../pwa';
import { h } from './kit';
import { renderFrame } from './frame';
import type { SketchDef } from './types';
import { GAMES, PACK } from '../games';
import { concepts } from './concepts';

const ROSTER: SketchDef[] = [
  PACK,
  ...GAMES.map((g) => ({ ...g, href: `${g.id}/` })),
  { id: 'match', title: 'Transform Combo', tagline: 'Find the turn sequence that maps one shape onto another.', skill: 'rotation sequencing', status: 'playable', href: 'match.html' },
  ...concepts,
];

const app = document.getElementById('app')!;
let teardown: (() => void) | null = null;

function renderIndex() {
  const cards = ROSTER.map((s) => {
    const link = s.href ?? `#/${s.id}`;
    return h('a.card', { href: link },
      h('div.card-top', {}, h('span.pill.' + s.status, {}, s.href && s.status !== 'concept' ? 'game' : s.status), h('span.skill', {}, s.skill)),
      h('h3', {}, (s.icon ? s.icon + ' ' : '') + s.title),
      h('p', {}, s.tagline),
    );
  });
  app.replaceChildren(
    h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'lab · one sketch per idea')), h('div.hud', {}, h('a', { href: './' }, 'games ↗'))),
    h('p#instructions', {}, 'Every sketch keeps one rule: ', h('b', {}, 'predict → commit → reality executes'), '. The point is to see which mechanics make the spatial skill necessary, and which of them feel like a game.'),
    h('div.cards', {}, ...cards),
  );
}

function renderSketch(def: SketchDef) {
  teardown = renderFrame(app, def, '#/', '← lab');
}

function route() {
  teardown?.();
  teardown = null;
  const id = location.hash.replace(/^#\/?/, '');
  const def = ROSTER.find((s) => s.id === id && s.mount && !s.href);
  if (def) renderSketch(def);
  else renderIndex();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
