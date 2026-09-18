# Handoff — Pack (flagship)

Branch: `pack`. Entry: `/pack/` (`pack/index.html` → `src/main.ts`). Sibling sketch: Shape Smuggler (`/smuggle/`).

## The spatial concept

Mental rotation. The mind holds a rigid 3D object and simulates a quarter-turn
about a world axis — every cube moves, but the object stays rigid — then
composes two or three such turns. The hard part is not any single turn; it is
keeping the intermediate state stable while applying the next one, and doing it
from a viewpoint where the axes are not aligned with the screen.

## The bypass test

Could someone get good at this without mental rotation? Only by trial and
error. So: nothing moves before commit; hovering a turn only lights its axis;
two attempts per piece, first-try is the metric; every shape is asymmetric
(24 distinct orientations) so the fitting orientation is unique; a level-k
piece is at exact shortest-path distance k, so a one-turn guess cannot solve a
two-turn piece.

## What exists

- Model: `src/polycube.ts` (integer lattice rotations, orientation graph BFS,
  symmetry check) and `src/pack.ts` (stages, hole-from-piece generation,
  droppability, landing/fit). Tests in `src/pack.test.ts`: across 240
  generated puzzles the solution always fits, no single-turn deviation ever
  fits, every wrong drop rests on solid without clipping.
- Stage: `src/pack-scene.ts` — glass or opaque mold from exposed voxel faces,
  ghost cavity, hover bob, quaternion turn animation, gravity drop with
  lattice snap, lift-and-reset, camera jolt.
- Loop: `src/main.ts` — three lives, score, best, six stages by score
  (1 turn → 2 → 5 cubes no marker → random camera → 3 turns → opaque mold),
  auto-advance on fit, retry keeps the piece, run-over summary.
- Sound: `src/sfx.ts` (synthesised). Log: `src/log.ts` (every action, exportable).

## Decisions already made (revisit deliberately, not by accident)

- The hole is generated from the piece → always solvable, unique answer.
- No translation; the piece is centred over the hole.
- Only "droppable" orientations become holes (every column open to the top).
- Misses keep the piece; skipping is allowed after a miss.
- Glass mold until score 16, then opaque.

## Open questions, in the order I'd take them

1. **Feedback on a miss.** Currently: the piece sits proud, red pulse, retry.
   Mirror Trap (lab) shows the better pattern: ghost the *correct* orientation
   for a beat so the player sees how far off they were. Port that.
2. **Emergent holes (real Tetris).** Pieces accumulate; misplacements shape
   the next hole; the well overflows. Better game, fuzzier learning signal.
   Prototype it as a separate mode and compare first-try accuracy and session
   length against the current round-based mode.
3. **Shape Smuggler as a stage.** Same kernel, orientation carries across
   walls, par by search. Cheap to bolt on as a bonus round.
4. **Opaque-mold depth reading.** Stage 6 is a real jump. Options: subtle
   height shading in the hole, a brief "peek" from above, or a shadow drop.
5. **Translation.** Adds placement, dilutes rotation. Only after the above.

## What to measure (log already captures it)

First-try accuracy per stage; ms-to-commit per stage over a session (shrinking
means internalising); which wrong answers recur (sign errors, axis confusion,
order swaps — `drop` events carry the committed sequence and one solution).

## Run

```bash
npm install && npm run dev   # http://localhost:5173
npm test
```
