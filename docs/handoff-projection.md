# Handoff — Projection Detective

> **Updated 2026-09-21** — Shadows at `/shadows/` now has a direct 3D workbench, a compact layer editor, undo, saved daily builds, and a sequential projection reveal. The existing daily seeds, cube budgets, and difficulty curve are unchanged. Public GitHub Pages deployment remains blocked by the account billing lock (workflow run 35440962492).

Release branch: `codex/shadows-workbench`, based on `codex/tightfit-moving-day`.
Entry: `/shadows/` (`src/lab/shadows.ts`). The combined release targets the existing
owner-private Site at `https://bricksy-tight-fit.udiboy98.chatgpt.site/shadows/`.
The original Tight Fit checkout and its uncommitted work are preserved.

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
- Input: tap a gold square or an existing cube on the selected 3D layer;
  alternatively use the shared layer builder (`kit.ts`) in compact mode.
  Other layers turn translucent. Camera arrows keep views oblique. The
  accessible grid uses 44px phone targets, named cells and pressed states.
  Keys 1–4 change layer; Backspace / Ctrl+Z / Cmd+Z undo. Clear is undoable.
- Daily drafts save cells and the selected layer per puzzle. Invalid or stale
  drafts cannot change scoring. A commit records its result before animation,
  so reloading or changing mode during a reveal cannot erase or misapply it.
- Commit: top, front and right projections appear in sequence, with parallel
  rays linking cubes to projection planes. Clue cards show matching cells,
  dashed missing outlines and crossed extra cells. They remain unchanged
  while editing in practice. There is no ground-shadow leak before commit.
- Any build with the right cube count and all three matching projections wins.
  A different valid object is explicitly acknowledged. *Show one solution*
  outlines the original in gold; *Fix it · practice* leaves the score intact,
  including on the final daily round. The result card waits for *See results*.
- Model: `shadows-model.ts`; rendering: `shadows-scene.ts`; loop/UI:
  `shadows.ts`; scoped layout: `src/shadows.css`. Reduced-motion preferences
  skip the long fades. Scene-owned GPU resources are released on edits.

## Verification (2026-09-21)

- `npm test`: projection conventions, valid alternative builds, extra-cube
  rejection, corrupt drafts, missing/extra feedback, and 400 deterministic
  solvable cases, plus the existing all-game generator sweep.
- Browser: valid alternative accepted; ten-cube solution accepted; direct
  placement, count limit, clear/undo, daily draft reload, failed build →
  successful practice with unchanged score, reload and mode switch during
  reveal, six-round daily completion and reload lock, final-round practice.
- Phone portrait and landscape checked. Orientation testing uncovered a
  ResizeObserver delivery loop: shared `SketchStage` now schedules resize
  writes on the next animation frame instead of inside the observer callback.

## Open questions

1. **Input discovery.** The direct layer workbench is implemented. Observe
   whether new players understand switching layers without opening help;
   consider a short guided first build if they do not.
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
npm install && npm run dev   # http://localhost:5173/shadows/
```
