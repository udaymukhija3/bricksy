# Handoff — Hidden Structure

Branch: `hidden`. Entry: `/lab.html#/hidden` (`src/lab/hidden.ts`).

## The spatial concept

Inference behind occlusion. From one viewpoint you see some cubes; others are
hidden behind them, and you must reason about what *must* exist: a visible
cube above the ground is resting on something; a column whose top you can see
has a known height. The mind builds a 3D model that includes the parts it
cannot see, using support and continuity as constraints. This is the "count
the cubes" test item, and the failure mode is counting only what's visible.

## The bypass test

A count is a single number, so guessing near the visible count plus a bit
works sometimes. The generator requires at least two hidden cubes and no more
than half hidden, and every column's top face visible (so heights are
inferable and the answer is determined, not a guess). Progression to 4×4
footprints and height 4 makes "visible + a bit" unreliable.

## What exists

- Heightmap stacks (cubes rest on cubes) on a base × base footprint.
- Visibility by raycast from the camera to each camera-facing face centre of
  every cube; a cube is visible if any such ray hits it first.
- Generation retries until the case has ≥2 hidden, ≤half hidden, and all
  column tops visible.
- Reveal: hidden cubes tint orange, the stack turns a full circle about its
  centre. Stepper input, ± / arrow keys, Enter.

## Open questions

1. **Ask for the structure, not the count.** "Build the whole stack" with the
   layer builder is the honest version; the count is a proxy. Grade on cell
   set; show which hidden cubes were missed.
2. **Overhangs.** Dropping the heightmap convention makes the hidden part
   genuinely ambiguous — then the question becomes "minimum cubes consistent
   with what you see", which is a different (and interesting) skill.
3. **Two views.** A second camera angle that resolves the ambiguity turns it
   into a small Projection Detective — probably merge with that thread.
4. **Verdict so far.** Works as a drill; nothing about it pulls. Unless
   (1) changes that, it stays a lab exercise.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/lab.html#/hidden
```
