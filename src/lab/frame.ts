// Full-page frame for a game: header with HUD slot, stage, panel, and a footer with the log export.
import { h } from './kit';
import { Log } from '../log';
import type { SketchDef } from './types';

export function renderFrame(app: HTMLElement, def: SketchDef, backHref: string, backLabel: string) {
  const stageEl = h('div.sk-stage');
  const panelEl = h('div#panel.sk-panel');
  const hudEl = h('div.hud');
  const hint = h('span#hint');
  const frame = h('div.sk.layout', {},
    h('header', {}, h('div.brand', {}, h('a', { href: backHref }, backLabel), ' ', def.icon ? def.icon + ' ' : '', def.title, ' ', h('span.sub', {}, def.skill)),
      hudEl),
    h('p#instructions', {}, def.tagline, ' ', hint),
    stageEl, panelEl,
    h('footer', {},
      h('span.mono', {}, `bricksy · ${def.id}`),
      h('a', { href: `${backHref}lab.html` }, 'lab ↗'),
      h('button', { onclick: () => new Log().export(), title: 'Every action, as JSON' }, 'Export log'),
      h('button', { onclick: () => { if (confirm(`Clear ${def.title} progress (streaks, today's daily, bests) and the event log?`)) { new Log().clear(); for (const k of Object.keys(localStorage)) if (k.startsWith(`bricksy.${def.id}.`)) localStorage.removeItem(k); location.reload(); } } }, 'Reset'),
    ),
  );
  app.replaceChildren(frame);
  return def.mount!({ stageEl, panelEl, hudEl, hintEl: hint });
}
