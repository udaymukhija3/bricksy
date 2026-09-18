// The product layer every game shares: a daily puzzle (same seed for everyone, fixed rounds,
// shareable result, one play per day) and an endless mode (lives, score, best). Daily progress
// survives a reload; finishing one records a day streak and locks it until tomorrow.
import { h, toast } from './lab/kit';
import { Sfx } from './sfx';

export type Mode = 'daily' | 'endless';

export interface RunOpts {
  /** Short id: used in storage keys and the share text. */
  id: string;
  name: string;
  /** Rounds in a daily; each round is a hit or a miss. */
  dailyRounds?: number;
  lives?: number;
  /** Emoji for the share header. */
  icon?: string;
}

/** Local calendar date, so "today" matches the player's clock. */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Daily #1 was 2026-09-18; the number is the same for everyone, like a crossword's. */
export const EPOCH = Date.UTC(2026, 8, 18);
export const dayNumber = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000) + 1;
/** Dev only: `?level=N` pins the difficulty so high levels can be checked without earning them. */
const DEV_LEVEL = import.meta.env.DEV && new URLSearchParams(location.search).has('level') ? Number(new URLSearchParams(location.search).get('level')) : null;
const msToMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m.getTime() - n.getTime(); };

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const read = <T>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota or private mode */ } };

export interface DailyRecord { results: boolean[]; done: boolean }
export interface Stats { played: number; dayStreak: number; bestDayStreak: number; lastDate: string; totalScore: number; totalRounds: number; /** dailies finished with each score, index = score */ hist: number[] }

/** Today's daily record for a game, as the hub reads it. Legacy "score/N" strings count as done. */
export function dailyRecord(id: string, date = today()): DailyRecord | null {
  const raw = localStorage.getItem(`bricksy.${id}.daily.${date}`);
  if (raw == null) return null;
  try { const v = JSON.parse(raw); if (v && Array.isArray(v.results)) return v as DailyRecord; } catch { /* legacy */ }
  const m = /^(\d+)\/(\d+)$/.exec(raw);
  if (!m) return null;
  const score = Number(m[1]), n = Number(m[2]);
  return { results: Array.from({ length: n }, (_, i) => i < score), done: true };
}
export const statsOf = (id: string): Stats => ({ played: 0, dayStreak: 0, bestDayStreak: 0, lastDate: '', totalScore: 0, totalRounds: 0, hist: [], ...read<Partial<Stats>>(`bricksy.${id}.stats`, {}) });

export class Run {
  mode: Mode;
  score = 0;
  streak = 0;
  lives: number;
  round = 0;
  results: boolean[] = [];
  best: number;
  bestStreak: number;
  readonly sfx = new Sfx();
  private hudEls: Record<string, HTMLElement> = {};
  private hudRoot: HTMLElement;
  private overlay: HTMLElement;
  private countdown: number | null = null;
  private starter: (() => void) | null = null;
  /** @deprecated use begin(); kept so a game may still set it directly. */
  onModeChange: (() => void) | null = null;

  constructor(readonly opts: RunOpts, hudEl: HTMLElement, stageEl: HTMLElement) {
    this.lives = opts.lives ?? 3;
    this.mode = (localStorage.getItem(`bricksy.${opts.id}.mode`) as Mode) || 'daily';
    this.best = Number(localStorage.getItem(`bricksy.${opts.id}.best`)) || 0;
    this.bestStreak = Number(localStorage.getItem(`bricksy.${opts.id}.bestStreak`)) || 0;
    this.hudRoot = hudEl;
    this.overlay = h('div.overlay', { hidden: true });
    stageEl.append(this.overlay);
    this.restoreDaily();
    this.renderHud();
  }

  get dailyRounds() { return this.opts.dailyRounds ?? 8; }
  /** Difficulty input: round index in a daily, score in endless — so a daily is the same for everyone. */
  get level() { return DEV_LEVEL ?? (this.mode === 'daily' ? this.round : this.score); }
  get over() { return this.mode === 'daily' ? this.round >= this.dailyRounds : this.lives <= 0; }
  get dailyDone() { return dailyRecord(this.opts.id)?.done ?? false; }
  get stats() { return statsOf(this.opts.id); }

  /** Seed for the next round: date-derived in a daily, random otherwise. */
  nextSeed() {
    return this.mode === 'daily' ? hash(`${this.opts.id}|${today()}|${this.round}`) : (Math.random() * 2 ** 31) | 0;
  }

  /**
   * Start play: `fn` starts a round and is reused when the mode changes. If today's daily is
   * already finished, the result card shows over whatever `fn` drew and input is parked.
   */
  begin(fn: () => void) {
    this.starter = fn;
    this.onModeChange = fn;
    fn();
    if (this.mode === 'daily' && this.dailyDone) this.showOver(fn);
  }

  hit() {
    if (this.over) return;
    this.round++;
    this.score++;
    this.streak++;
    this.results.push(true);
    if (this.mode === 'endless' && this.score > this.best) { this.best = this.score; localStorage.setItem(`bricksy.${this.opts.id}.best`, String(this.best)); }
    if (this.streak > this.bestStreak) { this.bestStreak = this.streak; localStorage.setItem(`bricksy.${this.opts.id}.bestStreak`, String(this.bestStreak)); }
    this.sfx.fit();
    this.saveDaily();
    this.renderHud();
  }

  miss() {
    if (this.over) return;
    this.round++;
    this.streak = 0;
    this.results.push(false);
    if (this.mode === 'endless') this.lives--;
    this.sfx.miss();
    this.saveDaily();
    this.renderHud();
  }

  /** Start a fresh run in the current mode. */
  reset() {
    this.score = 0;
    this.streak = 0;
    this.round = 0;
    this.results = [];
    this.lives = this.opts.lives ?? 3;
    this.hideOver();
    this.renderHud();
  }

  setMode(m: Mode) {
    if (m === this.mode) return;
    this.mode = m;
    localStorage.setItem(`bricksy.${this.opts.id}.mode`, m);
    this.reset();
    if (m === 'daily') this.restoreDaily();
    this.renderHud();
    (this.starter ?? this.onModeChange)?.();
    if (m === 'daily' && this.dailyDone) this.showOver(this.starter ?? this.onModeChange ?? (() => {}));
  }

  // ---- daily persistence

  private restoreDaily() {
    if (this.mode !== 'daily') return;
    const rec = dailyRecord(this.opts.id);
    if (!rec) return;
    this.results = [...rec.results];
    this.round = Math.min(this.results.length, this.dailyRounds);
    this.score = this.results.filter(Boolean).length;
    let s = 0;
    for (let i = this.results.length - 1; i >= 0 && this.results[i]; i--) s++;
    this.streak = s;
  }
  private saveDaily() {
    if (this.mode !== 'daily') return;
    const done = this.round >= this.dailyRounds;
    write(`bricksy.${this.opts.id}.daily.${today()}`, { results: this.results, done } satisfies DailyRecord);
    if (done) this.recordDailyStats();
  }
  private recordDailyStats() {
    const st = this.stats;
    const t = today();
    if (st.lastDate === t) return; // already counted
    const y = new Date(); y.setDate(y.getDate() - 1);
    st.dayStreak = st.lastDate === today(y) ? st.dayStreak + 1 : 1;
    st.bestDayStreak = Math.max(st.bestDayStreak, st.dayStreak);
    st.lastDate = t;
    st.played++;
    st.totalScore += this.score;
    st.totalRounds += this.dailyRounds;
    st.hist = Array.from({ length: this.dailyRounds + 1 }, (_, i) => (st.hist[i] ?? 0) + (i === this.score ? 1 : 0));
    write(`bricksy.${this.opts.id}.stats`, st);
  }

  // ---- hud

  private renderHud() {
    const root = this.hudRoot;
    if (!this.hudEls.mode) {
      root.replaceChildren();
      const seg = h('div.seg');
      for (const m of ['daily', 'endless'] as Mode[]) seg.append(h('button.seg-btn', { 'data-mode': m, onclick: () => this.setMode(m) }, m));
      this.hudEls.mode = seg;
      this.hudEls.a = h('span.stat');
      this.hudEls.b = h('span.stat');
      this.hudEls.c = h('span.stat');
      this.hudEls.mute = h('button.icon', { title: 'Sound', onclick: () => { this.hudEls.mute.textContent = this.sfx.toggle() ? '🔇' : '🔊'; } }, this.sfx.muted ? '🔇' : '🔊');
      root.append(seg, this.hudEls.a, this.hudEls.b, this.hudEls.c, this.hudEls.mute);
    }
    for (const b of this.hudEls.mode.querySelectorAll('.seg-btn')) b.classList.toggle('on', (b as HTMLElement).dataset.mode === this.mode);
    if (this.mode === 'daily') {
      this.hudEls.a.innerHTML = `#${dayNumber()} · round <b>${Math.min(this.round + 1, this.dailyRounds)}/${this.dailyRounds}</b>`;
      this.hudEls.b.innerHTML = this.results.map((r) => (r ? '🟩' : '🟥')).join('') || '<b>—</b>';
      this.hudEls.b.className = 'stat';
      this.hudEls.c.innerHTML = `streak <b>${this.streak}</b>`;
    } else {
      this.hudEls.a.innerHTML = `score <b>${this.score}</b> · best <b>${this.best}</b>`;
      this.hudEls.b.innerHTML = Array.from({ length: this.opts.lives ?? 3 }, (_, i) => `<span class="${i < this.lives ? '' : 'lost'}">♥</span>`).join('');
      this.hudEls.b.className = 'stat lives';
      this.hudEls.c.innerHTML = `streak <b>${this.streak}</b>`;
    }
  }

  // ---- result card

  /** Wordle-style summary. */
  shareText() {
    const grid = this.results.map((r) => (r ? '🟩' : '🟥')).join('');
    const head = this.mode === 'daily'
      ? `${this.opts.icon ?? ''} ${this.opts.name} #${dayNumber()} · ${this.score}/${this.dailyRounds}`
      : `${this.opts.icon ?? ''} ${this.opts.name} · endless · ${this.score}`;
    return `${head.trim()}\n${grid}\n${location.origin}${location.pathname}`;
  }

  async share() {
    const text = this.shareText();
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch { /* user cancelled */ }
  }

  private hideOver() {
    this.overlay.hidden = true;
    document.body.removeAttribute('data-over');
    if (this.countdown != null) { clearInterval(this.countdown); this.countdown = null; }
  }

  /** Run-over card. `again` starts a new run (a finished daily hands over to endless practice). */
  showOver(again: () => void) {
    const daily = this.mode === 'daily';
    if (daily) this.saveDaily();
    const st = this.stats;
    const title = daily ? `${this.score}/${this.dailyRounds} today` : `Run over · ${this.score}`;
    const sub = daily
      ? `${this.opts.name} #${dayNumber()} · same ${this.dailyRounds} puzzles for everyone. Day streak ${st.dayStreak}${st.bestDayStreak > st.dayStreak ? ` (best ${st.bestDayStreak})` : ''} · ${st.played} played${st.totalRounds ? ` · avg ${(this.dailyRounds * st.totalScore / st.totalRounds).toFixed(1)}/${this.dailyRounds}` : ''}.`
      : `Best ${this.best} · best streak ${this.bestStreak}`;
    const next = h('p.muted.next');
    // Score distribution over every daily played, today's bar highlighted — the Wordle habit.
    const hist = daily && st.played > 1 ? h('div.hist', {}, ...st.hist.map((n, i) => h('div.bar' + (i === this.score ? '.me' : ''), { title: `${n} day${n === 1 ? '' : 's'} at ${i}/${this.dailyRounds}` },
      h('span.k', {}, String(i)), h('span.v', { style: { width: `${Math.max(4, (100 * n) / Math.max(...st.hist, 1))}%` } }, n ? String(n) : '')))) : null;
    const tick = () => { const ms = msToMidnight(); const s = Math.floor(ms / 1000); next.textContent = `Next daily in ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    const again2 = () => { this.hideOver(); if (daily) this.setMode('endless'); else { this.reset(); again(); } };
    const more = h('a.button', { href: import.meta.env.BASE_URL }, 'More games');
    this.overlay.replaceChildren(h('div.card', {},
      h('h2', {}, title),
      h('p.results', {}, this.results.map((r) => (r ? '🟩' : '🟥')).join('')),
      h('p.muted', {}, sub),
      hist,
      daily ? next : null,
      h('div.row', {},
        h('button.primary', { onclick: () => this.share() }, 'Share'),
        h('button', { onclick: again2 }, daily ? 'Practice (endless) ↵' : 'Play again ↵'),
        more,
      ),
    ));
    // A finished daily hands over to the next game not yet played today. The roster is loaded
    // lazily so this module stays light and free of a cycle with the games.
    if (daily) void import('./games').then(({ GROUPS }) => {
      const games = GROUPS.flatMap((g) => g.games);
      const left = games.filter((g) => g.id !== this.opts.id && !dailyRecord(g.id)?.done);
      if (!left.length) { more.textContent = `All ${games.length} dailies done today ✓`; return; }
      const nx = left[0];
      more.replaceChildren(`Next daily: ${nx.icon ?? ''} ${nx.title} →`);
      more.setAttribute('href', `${import.meta.env.BASE_URL}${nx.href ?? `${nx.id}/`}`);
      more.title = `${left.length} of today's dailies left`;
    });
    this.overlay.hidden = false;
    document.body.setAttribute('data-over', '');
    if (daily) { tick(); this.countdown = window.setInterval(tick, 1000); }
    if (daily) this.sfx.levelUp(); else this.sfx.over();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !this.overlay.hidden) { window.removeEventListener('keydown', onKey); again2(); } };
    window.addEventListener('keydown', onKey);
  }
}
