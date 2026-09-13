# Handoff — Projection Detective

Branch: `projection`. Entry: `/lab.html#/projection` (`src/lab/projection.ts`).

## The spatial concept

Reconstructing a 3D object from 2D evidence, and its inverse — mentally
projecting a 3D object onto a plane. This is the original thesis problem:
learners fail not because the idea is hard but because they cannot rebuild the
3D state from a static, symbolic, two-dimensional representation. Three
silhouettes (top, front, right) under-determine the object; the mind has to
propose a solid and check it against each view by projecting it.

## The bypass test — this one matters more than any other

If the player can see their own build's silhouettes while building, the game
collapses into Picross 3D: a cell is filled iff all three views are dark
there, computed cell by cell with no imagery at all. Two rules keep the skill
in the loop, and both are already implemented:

1. **You never see your build's projections until you commit.** You see the
   build in 3D from a 3/4 view and must project it in your head.
2. **The cube count is fixed.** The "maximal object" (intersection of the three
   extrusions) always casts the right silhouettes; requiring exactly N cubes
   forces the player to decide which cells are load-bearing for each view.

Any redesign that violates either rule is a different (and weaker) game.

## What exists

- Views as 2D key sets: top `(x, z)`, front `(x, H-1-y)`, right `(D-1-z, H-1-y)`
  — third-angle layout so the right view's left edge is the front face.
- Hidden objects: random polycubes fitting the box, not flat sheets.
- Input: the layer builder (`kit.ts`) — one W×D grid per layer, live 3D view.
- Commit: your projections rendered next to the targets; solid red = extra,
  outlined red = missing. Success = all three match and count = N; if the
  build differs from the hidden object but is consistent, the hidden object is
  shown as an orange ghost with the message that the views could not tell
  them apart.

## Open questions

1. **The input is the problem.** Layer grids work but feel like a spreadsheet.
   Options: click faces in the 3D view to add/remove cubes (raycast on cube
   faces, add on the hit face's normal); a "column height" mode for the easy
   levels; a lattice of ghost cells to click. Keep rule 1 whatever the input.
2. **Mastermind feedback vs. full disclosure.** Today a miss shows exactly
   which silhouette cells are wrong. Coarser feedback ("2 cells wrong in the
   top view") makes it more of a deduction game and slows the loop. Try both.
3. **Progression.** 3×3×3 with 5–8 cubes, then 4×3×4. Add: hidden internal
   cells (overhangs), two views only (ambiguity as a feature), and the inverse
   task — given the object, *draw* the silhouettes.
4. **The inverse task is the transfer test.** Draw the three views of a shown
   object on grids. No 3D help. If accuracy on that rises with play, the thesis
   holds.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/lab.html#/projection
```
