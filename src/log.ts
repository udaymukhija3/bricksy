// Instrumentation. Every player action is appended with a timestamp and kept
// in localStorage so a session can be exported and replayed later. All Log
// instances on a page share one store; it is capped (oldest events drop) and
// written on a short debounce so a busy round never re-serialises megabytes
// per click.

export interface Event { t: number; type: string; [k: string]: unknown }

const KEY = 'bricksy.log.v0';
const MAX = 4000;
let events: Event[] | null = null;
let timer: number | null = null;

function load(): Event[] {
  if (events) return events;
  try { events = JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { events = []; }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
  return events!;
}
function flush() {
  if (timer != null) { clearTimeout(timer); timer = null; }
  if (!events) return;
  try { localStorage.setItem(KEY, JSON.stringify(events)); } catch { /* quota or private mode */ }
}

export class Log {
  constructor() { load(); }

  get size() { return load().length; }

  push(type: string, data: Record<string, unknown> = {}) {
    const ev = load();
    ev.push({ t: Date.now(), type, ...data });
    if (ev.length > MAX) ev.splice(0, ev.length - MAX);
    if (timer == null) timer = window.setTimeout(flush, 300);
  }

  flush() { flush(); }

  clear() {
    events = [];
    if (timer != null) { clearTimeout(timer); timer = null; }
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  export() {
    flush();
    const blob = new Blob([JSON.stringify(load(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bricksy-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
