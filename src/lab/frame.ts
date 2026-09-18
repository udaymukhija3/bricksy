// Full-page frame for a game: header with HUD slot and a help button, stage, panel, and a
// footer with the log export. Help shows why the game exists, the controls, and your own
// learning curve read from the local log.
import { h } from './kit.ts';
import { Log } from '../log.ts';
import { progress } from '../progress.ts';
import { dailyRecord, dayNumber, dateOfDay } from '../run.ts';
import type { SketchDef } from './types.ts';

const fmtMs = (ms: number | null) => (ms == null ? '—' : ms < 10000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);

export function helpCard(def: SketchDef, close: () => void) {
  const p = progress(def.id);
  const rows = p.levels.map((l) => h('tr', {}, h('td', {}, p.labels?.[l.level] ?? (l.level < 0 ? '?' : String(l.level + 1))), h('td', {}, `${l.hits}/${l.n}`), h('td', {}, `${Math.round((100 * l.hits) / l.n)}%`), h('td', {}, fmtMs(l.medianMs))));
  return h('div.card.help', {},
    h('h2', {}, `${def.icon ?? ''} ${def.title}`, h('span.sub', {}, ` ${def.skill}`)),
    h('h4', {}, 'How to play'), h('p', {}, def.tagline), def.controls ? h('p.muted', {}, def.controls) : null,
    def.about ? h('h4', {}, 'Why this game') : null, def.about ? h('p', {}, def.about) : null,
    ...(() => {
      const rows = Array.from({ length: Math.min(7, dayNumber()) }, (_, i) => dayNumber() - i).map((n) => ({ n, r: dailyRecord(def.id, dateOfDay(n)) })).filter((x) => x.r);
      return rows.length ? [h('h4', {}, 'Recent dailies'), h('p.recent', {}, ...rows.flatMap((x) => [h('span', {}, `#${x.n} ${x.r!.results.filter(Boolean).length}/${x.r!.results.length} ${x.r!.results.map((b) => (b ? '🟩' : '🟥')).join('')}${x.r!.done ? '' : ' (in progress)'}`), h('br')]))] : [];
    })(),
    h('h4', {}, 'Your learning curve'),
    p.n
      ? h('div', {}, h('p.muted', {}, `${p.hits}/${p.n} first-try over ${p.days} day${p.days === 1 ? '' : 's'}. Per difficulty level: hits, accuracy, median time to commit.`),
        h('table.curve', {}, h('thead', {}, h('tr', {}, h('th', {}, p.labels ? 'stage' : 'level'), h('th', {}, 'hits'), h('th', {}, 'acc'), h('th', {}, 'time'))), h('tbody', {}, ...rows)))
      : h('p.muted', {}, 'Nothing yet — every commit is logged on this device, and this table fills in as you play.'),
    h('div.row', {}, h('button.primary', { onclick: close }, 'Back to the game')),
  );
}

export function renderFrame(app: HTMLElement, def: SketchDef, backHref: string, backLabel: string) {
  const stageEl = h('div.sk-stage');
  const panelEl = h('div#panel.sk-panel');
  const hudEl = h('div.hud');
  const hint = h('span#hint');
  const help = h('div.overlay.helpwrap', { hidden: true });
  const closeHelp = () => { help.hidden = true; help.replaceChildren(); };
  const openHelp = () => { help.replaceChildren(helpCard(def, closeHelp)); help.hidden = false; };
  const helpB = h('button.icon.help-btn', { title: 'How to play, why this game, your progress', 'aria-label': 'Help', onclick: () => (help.hidden ? openHelp() : closeHelp()) }, '?');
  stageEl.append(help);
  const frame = h('div.sk.layout', {},
    h('header', {}, h('div.brand', {}, h('a', { href: backHref }, backLabel), ' ', def.icon ? def.icon + ' ' : '', def.title, ' ', h('span.sub', {}, def.skill)),
      h('div.hudwrap', {}, hudEl, helpB)),
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
  const teardown = def.mount!({ stageEl, panelEl, hudEl, hintEl: hint });
  // First visit: open the how-to-play card once, over the round that is already drawn.
  try { const k = `bricksy.${def.id}.seen`; if (!localStorage.getItem(k)) { localStorage.setItem(k, '1'); openHelp(); } } catch { /* storage may be unavailable */ }
  return teardown;
}
