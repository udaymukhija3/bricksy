// Instrumentation. Every player action is appended with a timestamp and kept
// in localStorage so a session can be exported and replayed later.

export interface Event { t: number; type: string; [k: string]: unknown }

export class Log {
  private static KEY = 'bricksy.log.v0';
  private events: Event[] = [];

  constructor() {
    try {
      this.events = JSON.parse(localStorage.getItem(Log.KEY) ?? '[]');
    } catch {
      this.events = [];
    }
  }

  get size() { return this.events.length; }

  push(type: string, data: Record<string, unknown> = {}) {
    this.events.push({ t: Date.now(), type, ...data });
    try { localStorage.setItem(Log.KEY, JSON.stringify(this.events)); } catch { /* quota or private mode */ }
  }

  clear() {
    this.events = [];
    try { localStorage.removeItem(Log.KEY); } catch { /* ignore */ }
  }

  export() {
    const blob = new Blob([JSON.stringify(this.events, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bricksy-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
