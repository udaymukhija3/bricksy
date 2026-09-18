# Handoff — Fold

Branch: `fold`. Entry: `/fold/` (`src/lab/fold.ts`, model in `src/lab/nets.ts`).

## The spatial concept

Net → solid: predicting how a flat pattern folds into a closed shape, and
which faces become neighbours or opposites. The mind has to track each face
through a hinge rotation while previous folds are still in effect — nested
rotations, each about a moving axis. It's the paper-folding / cube-net item
from spatial batteries, and people who are good at rotating rigid objects are
often surprisingly bad at it because the object is *not* rigid.

## The bypass test

Cube nets have rules ("faces two apart in a straight line are opposite;
in a row of four, the ends are opposite") that solve the opposite-face
question without imagery. That is fine as far as it goes — it's a real
spatial regularity — but the *adjacency* and *orientation* questions ("which
edge of ★ touches ▲, and is ▲ upright?") have no such shortcut and are where
the folding has to be imagined. Move to those.

## What exists

- All 11 cube nets, a hinge tree via BFS from a root face, and a pure folding
  model (`fold()`, `opposite()`) tested for every net: six distinct outward
  normals, every face 0.5 from the centre.
- Rendering: nested pivot groups at shared edges; faces fold *down* so the
  face-up symbols end on the outside; symbols are mirror-symmetric glyphs on
  canvas textures.
- Question: click the face opposite the highlighted one; reveal folds the net,
  recentres the cube, tumbles it; answer face outlined green, wrong pick red.
  "Unfold" replays backwards.

## Open questions

1. **Adjacency and orientation questions** (see bypass). The model already
   gives every face's transform; the UI needs a way to answer "which edge".
2. **Other solids.** Tetrahedron, octahedron, square pyramid nets — different
   hinge angles (not 90°) and the folding model generalises with a per-hinge
   dihedral angle.
3. **The inverse: unfold.** Show a cube with symbols, offer four nets, which
   one folds into it?
4. **Partial fold as scaffolding.** Fold to 45°, let the player look, then
   ask — and remove that later.
5. **Product fit.** High. The fold animation is the second most satisfying
   reveal in the lab after Slice.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/fold/
npm test                     # includes the 11-net folding checks
```
