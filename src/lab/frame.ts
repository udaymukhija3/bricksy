// Full-page frame for a game or sketch: header with HUD slot, stage, panel.
import { h } from './kit';
import type { SketchDef } from './types';

export function renderFrame(app: HTMLElement, def: SketchDef, backHref: string, backLabel: string) {
  const stageEl = h('div.sk-stage');
  const panelEl = h('div#panel.sk-panel');
  const hudEl = h('div.hud');
  const hint = h('span#hint');
  const frame = h('div.sk.layout', {},
    h('header', {}, h('div.brand', {}, h('a', { href: backHref }, backLabel), ' ', def.icon ? def.icon + ' ' : '', def.title, ' ', h('span.sub', {}, def.skill)), hudEl),
    h('p#instructions', {}, def.tagline, ' ', hint),
    stageEl, panelEl,
  );
  app.replaceChildren(frame);
  return def.mount!({ stageEl, panelEl, hudEl, hintEl: hint });
}
