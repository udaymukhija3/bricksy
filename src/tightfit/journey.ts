import { JOBS } from './jobs.ts';
import { furnitureCells } from './furniture.ts';
import { orientations, shapeKey, type Cell } from '../polycube.ts';

export interface Checkpoint {
  version: 1;
  jobId: number;
  stageIndex: number;
  item: Cell[];
  misses: number;
  results: boolean[];
}

/** Reject stale/corrupt checkpoints instead of mounting an impossible stage. */
export function readCheckpoint(raw: string | null): Checkpoint | null {
  if (!raw) return null;
  try {
    const x: unknown = JSON.parse(raw);
    if (!x || typeof x !== 'object') return null;
    const p = x as Checkpoint;
    const job = JOBS.find((j) => j.id === p.jobId);
    if (p.version !== 1 || !job || !Number.isInteger(p.stageIndex) || p.stageIndex < 0 || p.stageIndex > job.stages.length) return null;
    if (!Number.isInteger(p.misses) || p.misses < 0 || p.misses > job.stages.length * 3) return null;
    if (!Array.isArray(p.results) || p.results.length !== p.stageIndex || !p.results.every((r) => typeof r === 'boolean')) return null;
    if (!Array.isArray(p.item) || p.item.length < 4 || p.item.length > 8 || !p.item.every((c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && Math.abs(v) < 10))) return null;
    const base = furnitureCells(job.item);
    if (!base || !orientations(base).some((o) => o.key === shapeKey(p.item))) return null;
    return p;
  } catch { return null; }
}
