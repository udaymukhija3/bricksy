# Handoff — Slice

Branch: `slice`. Entry: `/cut/` (`src/lab/slice.ts`).

## The spatial concept

Cross-sectioning: holding a solid in mind, imagining a plane passing through
it, and reading off the 2D shape where they meet. Unlike rotation, the answer
is a *different kind of object* (a 2D figure) from the input (a 3D solid), and
the hard cases are tilted planes, off-centre cuts, and solids with holes.
People who are fine at rotation are often bad at this; it is a distinct skill
(the Santa Barbara Solids Test measures it).

## The bypass test

Could someone get good without imagining the cut? Multiple choice invites
elimination, so distractors must be *plausible* — real cross-sections of the
same solid at other planes, or the same plane through other solids — and
visibly distinct from the answer. Memorisation is blocked by the product space
(10 solids × 10 cuts today; both lists are trivial to extend).

## What exists

- Cross-section extraction: triangle–plane intersection over a non-indexed
  geometry, segments chained into closed loops, Douglas–Peucker simplified,
  described by loop count / corner count / area / aspect. Plane offsets are
  nudged 0.0137 off the lattice so no cut passes exactly through a mesh vertex
  (this fixed degenerate loops); open chains and slivers are rejected.
- Distractor selection: candidates filtered by `similar()` (same loop count,
  same corner class, area within 30%, aspect within ~20%).
- Reveal: the blade sweeps in, the solid is rendered as two clipped copies,
  the upper half lifts along the normal, the section face is drawn in orange
  on both halves.
- Four choices as SVG outlines at a common scale.

## Open questions

1. **Is multiple choice the right input?** Alternatives: draw the outline on a
   grid (harder to grade fairly), or pick from more candidates (8) with two
   correct answers to reduce elimination.
2. **Difficulty dial.** Currently random. Order: axis-aligned through centre →
   off-centre → single tilt → double tilt → solids with holes → compound solids.
3. **Compound solids.** Union of two primitives (cylinder through cube, etc.)
   makes sections much richer. The extraction already handles it if the mesh
   is one geometry; try `BufferGeometryUtils.mergeGeometries`.
4. **Show the cut from inside.** After the reveal, a short camera move to look
   straight down the normal at the face — the "aha" moment for tilted cuts.
5. **Product shape.** Daily set of five cuts? Streak? It stands alone.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/cut/
```
