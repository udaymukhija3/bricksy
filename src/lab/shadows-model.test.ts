import { assess, makeCase, project, setup, validCells } from './shadows-model.ts';
import type { Cell } from '../polycube.ts';

const assert = {
  equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); },
  deepEqual(actual: unknown, expected: unknown) { this.equal(JSON.stringify(actual), JSON.stringify(expected)); },
};

const dims = { w: 3, h: 3, d: 3 };
const one = project([[0, 2, 2]], dims);
assert.deepEqual([...one.top], ['0,2']);
assert.deepEqual([...one.front], ['0,0']);
assert.deepEqual([...one.right], ['0,0']);
console.log('ok  projections agree with the top, front and right grid conventions');

// Two different tetrahedral voxel sets cover the same rows in all three views.
// The answer checker must accept both, rather than comparing hidden coordinates.
const hidden: Cell[] = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
const alternate: Cell[] = [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
assert.equal(assess(hidden, hidden, dims).same, true);
const validAlternate = assess(alternate, hidden, dims);
assert.equal(validAlternate.ok, true);
assert.equal(validAlternate.same, false);
assert.equal(validAlternate.badCells, 0);
console.log('ok  a different object with matching silhouettes is a valid answer');

const tooMany: Cell[] = [...hidden, [1, 1, 1]];
assert.equal(assess(tooMany, hidden, dims).badCells, 0);
assert.equal(assess(tooMany, hidden, dims).ok, false);
assert.equal(assess([hidden[0], hidden[0], hidden[1], hidden[2]], hidden, dims).ok, false);
assert.equal(validCells([[0.5, 0, 0]], dims, 5), false);
assert.equal(validCells([[3, 0, 0]], dims, 5), false);
assert.equal(validCells([[0, -1, 0]], dims, 5), false);
assert.equal(validCells(null, dims, 5), false);
assert.equal(validCells([[0, 0]], dims, 5), false);
assert.equal(validCells([[0, 0, 0], [0, 0, 0]], dims, 5), false);
assert.equal(validCells([], dims, 5), true);
console.log('ok  cube budget, duplicates and corrupt saved builds cannot bypass scoring');

const moved = assess([[1, 0, 0]], [[0, 0, 0]], dims);
assert.equal(moved.badCells, 4);
assert.deepEqual([...moved.diff.top.missing], ['0,0']);
assert.deepEqual([...moved.diff.top.extra], ['1,0']);
assert.equal(moved.diff.right.missing.size, 0);
assert.equal(moved.diff.right.extra.size, 0);
console.log('ok  feedback distinguishes extra and missing shadow cells per view');

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
for (const level of [0, 1, 5, 6, 11, 12, 18, 24]) for (let seed = 1; seed <= 50; seed++) {
  const { dims: box, n } = setup(level);
  const cells = makeCase(box, n, rng(seed));
  assert.equal(cells.length, n);
  assert.equal(validCells(cells, box, n), true);
  assert.equal(assess(cells, cells, box).ok, true);
  assert.deepEqual(cells, makeCase(box, n, rng(seed)));
}
console.log('ok  400 generated puzzles are in bounds, solvable and deterministic');
