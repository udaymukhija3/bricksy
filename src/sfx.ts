// Synthesised sound effects — no assets, a few oscillators.
export class Sfx {
  private ctx: AudioContext | null = null;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem('bricksy.muted') === '1';
  }

  toggle() {
    this.muted = !this.muted;
    localStorage.setItem('bricksy.muted', this.muted ? '1' : '0');
    return this.muted;
  }

  private ac() {
    if (this.muted) return null;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.12, at = 0, slideTo?: number) {
    const ac = this.ac();
    if (!ac) return;
    const t0 = ac.currentTime + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + ms / 1000);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + ms / 1000 + 0.02);
  }

  click() { this.tone(880, 50, 'square', 0.04); }
  turn() { this.tone(300, 120, 'triangle', 0.08, 0, 420); }
  thud() { this.tone(110, 180, 'triangle', 0.25, 0, 45); }
  fit() { this.thud(); this.tone(660, 140, 'sine', 0.12, 0.05); this.tone(990, 260, 'sine', 0.12, 0.15); }
  miss() { this.thud(); this.tone(200, 320, 'sawtooth', 0.08, 0.02, 120); }
  levelUp() { for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone(f, 180, 'sine', 0.1, i * 0.09); }
  over() { for (const [i, f] of [392, 330, 262, 196].entries()) this.tone(f, 300, 'triangle', 0.1, i * 0.18); }
}
