// The product layer every game shares: a daily puzzle (same seed for everyone,
// fixed rounds, shareable result) and an endless mode (lives, score, best).
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

const today = () => new Date().toISOString().slice(0, 10);

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

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
  onModeChange: (() => void) | null = null;

  constructor(readonly opts: RunOpts, hudEl: HTMLElement, stageEl: HTMLElement) {
    this.lives = opts.lives ?? 3;
    this.mode = (localStorage.getItem(`bricksy.${opts.id}.mode`) as Mode) || 'daily';
    this.best = Number(localStorage.getItem(`bricksy.${opts.id}.best`)) || 0;
    this.bestStreak = Number(localStorage.getItem(`bricksy.${opts.id}.bestStreak`)) || 0;
    this.hudRoot = hudEl;
    this.overlay = h('div.overlay', { hidden: true });
    stageEl.append(this.overlay);
    this.renderHud();
  }

  get dailyRounds() { return this.opts.dailyRounds ?? 8; }
  /** Difficulty input: round index in a daily, score in endless — so a daily is the same for everyone. */
  get level() { return this.mode === 'daily' ? this.round : this.score; }
  get over() { return this.mode === 'daily' ? this.round >= this.dailyRounds : this.lives <= 0; }
  get dailyDone() { return !!localStorage.getItem(`bricksy.${this.opts.id}.daily.${today()}`); }

  /** Seed for the next round: date-derived in a daily, random otherwise. */
  nextSeed() {
    return this.mode === 'daily' ? hash(`${this.opts.id}|${today()}|${this.round}`) : (Math.random() * 2 ** 31) | 0;
  }

  hit() {
    this.round++;
    this.score++;
    this.streak++;
    this.results.push(true);
    if (this.mode === 'endless' && this.score > this.best) { this.best = this.score; localStorage.setItem(`bricksy.${this.opts.id}.best`, String(this.best)); }
    if (this.streak > this.bestStreak) { this.bestStreak = this.streak; localStorage.setItem(`bricksy.${this.opts.id}.bestStreak`, String(this.bestStreak)); }
    this.sfx.fit();
    this.renderHud();
  }

  miss() {
    this.round++;
    this.streak = 0;
    this.results.push(false);
    if (this.mode === 'endless') this.lives--;
    this.sfx.miss();
    this.renderHud();
  }

  /** Start a fresh run in the current mode. */
  reset() {
    this.score = 0;
    this.streak = 0;
    this.round = 0;
    this.results = [];
    this.lives = this.opts.lives ?? 3;
    this.overlay.hidden = true;
    this.renderHud();
  }

  setMode(m: Mode) {
    if (m === this.mode) return;
    this.mode = m;
    localStorage.setItem(`bricksy.${this.opts.id}.mode`, m);
    this.reset();
    this.onModeChange?.();
  }

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
      this.hudEls.a.innerHTML = `round <b>${Math.min(this.round + 1, this.dailyRounds)}/${this.dailyRounds}</b>`;
      this.hudEls.b.innerHTML = this.results.map((r) => (r ? '🟩' : '🟥')).join('') || '<b>—</b>';
      this.hudEls.c.innerHTML = `streak <b>${this.streak}</b>`;
    } else {
      this.hudEls.a.innerHTML = `score <b>${this.score}</b> · best <b>${this.best}</b>`;
      this.hudEls.b.innerHTML = Array.from({ length: this.opts.lives ?? 3 }, (_, i) => `<span class="${i < this.lives ? '' : 'lost'}">♥</span>`).join('');
      this.hudEls.b.className = 'stat lives';
      this.hudEls.c.innerHTML = `streak <b>${this.streak}</b>`;
    }
  }

  /** Wordle-style summary. */
  shareText() {
    const grid = this.results.map((r) => (r ? '🟩' : '🟥')).join('');
    const head = this.mode === 'daily'
      ? `${this.opts.icon ?? ''} ${this.opts.name} ${today()} · ${this.score}/${this.dailyRounds}`
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

  /** Run-over card. `again` starts a new run. */
  showOver(again: () => void) {
    if (this.mode === 'daily') localStorage.setItem(`bricksy.${this.opts.id}.daily.${today()}`, `${this.score}/${this.dailyRounds}`);
    const title = this.mode === 'daily' ? `${this.score}/${this.dailyRounds} today` : `Run over · ${this.score}`;
    const sub = this.mode === 'daily'
      ? `Same ${this.dailyRounds} puzzles for everyone today. Best streak ${this.bestStreak}.`
      : `Best ${this.best} · best streak ${this.bestStreak}`;
    this.overlay.replaceChildren(h('div.card', {},
      h('h2', {}, title),
      h('p.results', {}, this.results.map((r) => (r ? '🟩' : '🟥')).join('')),
      h('p.muted', {}, sub),
      h('div.row', {},
        h('button.primary', { onclick: () => this.share() }, 'Share'),
        h('button', { onclick: () => { this.reset(); again(); } }, this.mode === 'daily' ? 'Practice (endless) ↵' : 'Play again ↵'),
      ),
    ));
    this.overlay.hidden = false;
    if (this.mode === 'daily') this.sfx.levelUp(); else this.sfx.over();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !this.overlay.hidden) { window.removeEventListener('keydown', onKey); if (this.mode === 'daily') this.setMode('endless'); else { this.reset(); again(); } } };
    window.addEventListener('keydown', onKey);
    // "Practice" from a finished daily switches to endless.
    const practice = this.overlay.querySelector('button:not(.primary)') as HTMLButtonElement;
    if (this.mode === 'daily') practice.onclick = () => this.setMode('endless');
  }
}
