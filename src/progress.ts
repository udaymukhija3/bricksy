// Your learning curve, read back from the local event log: first-try accuracy and time to
// commit, per difficulty level. Each result is attributed to the last `present` of that game.
import { Log, type Event } from './log.ts';

export interface LevelStat { level: number; n: number; hits: number; medianMs: number | null }
export interface Progress { levels: LevelStat[]; n: number; hits: number; days: number; /** Names for level indices when they are stages rather than difficulty levels. */ labels?: string[] }

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const TF_STAGES = ['load', 'doorway', 'corner'];

export function progress(id: string): Progress {
  const events = new Log().events;
  const byLevel = new Map<number, { hits: number; n: number; ms: number[] }>();
  const days = new Set<string>();
  let present: Event | null = null;
  if (id === 'tightfit') {
    // The saga logs one event per stage with its own first-try flag; group by stage type.
    // (Older events carried the stage type in `type` itself.)
    let start: Event | null = null;
    for (const e of events) {
      if (e.type === 'tf_job_start') { start = e; continue; }
      const stageType = e.type === 'tf_stage' ? String(e.stageType) : TF_STAGES.includes(e.type) && 'firstTry' in e ? e.type : null;
      if (!stageType) continue;
      const level = TF_STAGES.indexOf(stageType);
      const s = byLevel.get(level) ?? { hits: 0, n: 0, ms: [] };
      s.n++;
      if (e.firstTry && !e.failed) s.hits++;
      if (start) s.ms.push(e.t - start.t);
      byLevel.set(level, s);
      days.add(new Date(e.t).toDateString());
      start = e; // the next stage's clock starts when this one ended
    }
    const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, s]) => ({ level, n: s.n, hits: s.hits, medianMs: median(s.ms) }));
    return { levels, n: levels.reduce((a, l) => a + l.n, 0), hits: levels.reduce((a, l) => a + l.hits, 0), days: days.size, labels: TF_STAGES };
  }
  for (const e of events) {
    const mine = id === 'pack' ? !('sketch' in e) && 'puzzleId' in e : e.sketch === id;
    if (!mine) continue;
    if (e.type === 'present') { present = e; continue; }
    const isResult = e.type === 'result' || (e.type === 'drop' && e.attempt === 1);
    if (!isResult || !present || typeof e.ok !== 'boolean') continue;
    const level = typeof present.level === 'number' ? present.level : -1;
    const s = byLevel.get(level) ?? { hits: 0, n: 0, ms: [] };
    s.n++;
    if (e.ok) s.hits++;
    s.ms.push(e.t - present.t);
    byLevel.set(level, s);
    days.add(new Date(e.t).toDateString());
  }
  const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, s]) => ({ level, n: s.n, hits: s.hits, medianMs: median(s.ms) }));
  return { levels, n: levels.reduce((a, l) => a + l.n, 0), hits: levels.reduce((a, l) => a + l.hits, 0), days: days.size };
}
