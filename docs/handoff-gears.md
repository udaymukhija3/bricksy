# Handoff — Mechanism (gear trains)

Branch: `gears`. Entry: `/lab.html#/gears` (`src/lab/gears.ts`).

## The spatial concept

Propagating motion through a system. Given one moving part, predict the
motion of a part several links away: direction alternates across each mesh,
speed scales by tooth ratio, and a compound gear (two wheels on one axle)
breaks the simple alternation. The reasoning is spatial (which way does this
edge push that edge) but the skill graduates into systems thinking — this is
the sketch that could grow from geometry into physics.

## The bypass test

Direction has a parity shortcut: count the meshes, odd = reversed. That is
legitimate mechanical reasoning, and the compound gears and the speed question
are what stop it from being the whole game. To keep imagery necessary, later
puzzles should hide part of the train (a cover plate) or use belts, racks and
bevel gears, where parity alone does not answer.

## What exists

- Gear profile as an extruded 2D shape; pitch radius = module × teeth / 2.
- Chains of 4–7 gears with a snaking heading, overlap checks, optional
  compound gears (second wheel on the same axle drives the next gear, later
  gears re-placed against the new radius).
- Correct angular velocities and meshing *phases* (teeth interleave when the
  train runs) computed from the contact angle.
- Questions: direction, then direction + speed (faster / same / slower).
  Reveal runs the train for 3 s. Framing adapts to aspect ratio.

## Open questions

1. **Belts and racks.** A belt preserves direction (crossed belt reverses);
   a rack converts rotation to translation. Both are a few lines of model and
   a lot of new reasoning.
2. **Hidden segment.** Cover part of the train; the player must infer the
   number of gears underneath from the visible input/output — a real
   inference puzzle.
3. **Bevel gears / 3D trains.** The move out of the plane is where this
   becomes genuinely spatial rather than parity arithmetic.
4. **Predict a number.** "How many turns does the blue gear make while the
   red makes one?" — quantitative, still predict-commit.
5. **Product fit.** Long-term richest, per the original brainstorm; today's
   sketch is the geometry floor.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/lab.html#/gears
```
