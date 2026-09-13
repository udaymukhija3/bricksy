// The lab: one sketch per idea, hash-routed. Sketches register in ROSTER.
import '../style.css';
import '../pwa';
import { h } from './kit';
import type { SketchDef } from './types';
import { smuggler } from './smuggler';
import { mirror } from './mirror';
import { projection } from './projection';
import { hidden } from './hidden';
import { copycat } from './copycat';
import { slice } from './slice';
import { gravity } from './gravity';
import { fold } from './fold';
import { gears } from './gears';
import { concepts } from './concepts';

const ROSTER: SketchDef[] = [
  { id: 'pack', title: 'Pack', tagline: 'Turn the piece so it drops into the hole. Lives, score, stages.', skill: 'mental rotation', status: 'flagship', href: './' },
  { id: 'match', title: 'Transform Combo', tagline: 'Find the turn sequence that maps one shape onto another.', skill: 'rotation sequencing', status: 'playable', href: './match.html' },
  smuggler, mirror, projection, hidden, copycat, slice, gravity, fold, gears, ...concepts,
];

const app = document.getElementById('app')!;
let teardown: (() => void) | null = null;

function renderIndex() {
  const cards = ROSTER.map((s) => {
    const link = s.href ?? `#/${s.id}`;
    return h('a.card', { href: link },
      h('div.card-top', {}, h('span.pill.' + s.status, {}, s.status), h('span.skill', {}, s.skill)),
      h('h3', {}, s.title),
      h('p', {}, s.tagline),
    );
  });
  app.replaceChildren(
    h('header', {}, h('div.brand', {}, 'bricksy ', h('span.sub', {}, 'lab · one sketch per idea')), h('div.hud', {}, h('a', { href: './' }, 'pack ↗'))),
    h('p#instructions', {}, 'Every sketch keeps one rule: ', h('b', {}, 'predict → commit → reality executes'), '. The point is to see which mechanics make the spatial skill necessary, and which of them feel like a game.'),
    h('div.cards', {}, ...cards),
  );
}

function renderSketch(def: SketchDef) {
  const stageEl = h('div.sk-stage');
  const panelEl = h('div#panel.sk-panel');
  const hudEl = h('div.hud');
  const frame = h('div.sk.layout', {},
    h('header', {}, h('div.brand', {}, h('a', { href: '#/' }, '← lab'), ' ', def.title, ' ', h('span.sub', {}, def.skill)), hudEl),
    h('p#instructions', {}, def.tagline, ' ', h('span#hint')),
    stageEl, panelEl,
  );
  app.replaceChildren(frame);
  teardown = def.mount!({ stageEl, panelEl, hudEl, hintEl: frame.querySelector('#hint') as HTMLElement });
}

function route() {
  teardown?.();
  teardown = null;
  const id = location.hash.replace(/^#\/?/, '');
  const def = ROSTER.find((s) => s.id === id && s.mount);
  if (def) renderSketch(def);
  else renderIndex();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
