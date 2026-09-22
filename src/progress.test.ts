import { progress } from './progress.ts';

const events = [
  { t: 1000, type: 'present', puzzleId: 'pack-a', level: 0 },
  { t: 2000, type: 'drop', puzzleId: 'pack-a', attempt: 1, ok: false },
  { t: 3000, type: 'present', sketch: 'shove', level: 1 },
  { t: 4000, type: 'result', sketch: 'shove', ok: true },
  { t: 5000, type: 'present', sketch: 'slice', level: 2 },
  { t: 6000, type: 'result', sketch: 'slice', ok: true },
];
Object.assign(globalThis, { localStorage: { getItem: () => JSON.stringify(events) }, window: { addEventListener: () => {} } });
for (const [id, n, hits] of [['pack',1,0],['shove',1,1],['mirror',0,0],['cut',1,1]] as const) {
  const p = progress(id);
  if (p.n !== n || p.hits !== hits) throw new Error(`${id}: expected ${hits}/${n}, received ${p.hits}/${p.n}`);
  console.log(`ok   ${id} learning curve only includes its own attempts`);
}
