# Handoff — Transform Combo (match mode, prototype 0)

Branch: `match`. Entry: `/match.html` (`src/match.ts`, stage `src/scene.ts`, levels `src/puzzle.ts`).

## The spatial concept

Finding the transformation between two states: given start and target, produce
the shortest sequence of turns that maps one onto the other — a spatial
combination lock. This is pack's kernel without the game wrapper: the purest
statement of "the only way to evaluate a candidate turn is to simulate it".
Adding reflections and translations to the move set is what turns it into the
full Transform Combo from the brainstorm.

## The bypass test

Same guards as pack: nothing moves before commit, two attempts, asymmetric
shapes, exact shortest-path distance per level. Its job is to be the control
condition — the same skill without lives, score or gravity — so that pack's
framing can be measured against it.

## What exists

- Two matched viewports (stacked on narrow screens), same camera pose, gizmo.
- Five levels (1 turn → 2 → 5 cubes no marker → random camera → 3 turns);
  level-up after three consecutive first-try successes; per-level first-try
  stats; replay-slowly and reveal-solution after the second miss.
- Full event log with the same schema as pack.

## Open questions

1. **Reflections as moves.** Add mirror-X as a seventh move; targets may then
   be mirror images. This is the Transform Combo brainstorm and connects to
   Mirror Trap.
2. **Translation targets.** Show the target displaced; the player queues turns
   and a lattice shift. Small change, tests composition of two operation types.
3. **Static-drawing transfer test lives here.** Same puzzles rendered as
   perspective line drawings, no animation: the "stage 9" of the original
   progression. This thread is the natural home for it.
4. **A/B against pack.** Same session length, compare first-try accuracy and
   time per level from the two logs.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/match.html
```
