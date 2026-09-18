# Handoff — Shape Smuggler

Branch: `smuggler`. Entry: `/smuggle/` (`src/lab/smuggler.ts`).

## The spatial concept

Rotation *planning* rather than a single rotation. You hold one rigid object
and a sequence of openings; each opening is the object's silhouette in some
orientation along the travel axis. The mind has to (1) read a 2D hole as a
constraint on 3D orientation, (2) find a turn sequence that satisfies it, and
(3) do it again from *wherever the last wall left you* — orientation carries
over. The skill is composing rotations across steps, with a running state.

## The bypass test

Could someone get good without mental rotation? Trial and error is bounded by
the turn counter (par is computed by 0-1 BFS over orientation × walls-passed,
so "fewest turns" is a real score). The remaining shortcut is silhouette
matching in 2D: a lying-flat orientation has an obvious footprint. Deep
openings (silhouettes of standing orientations) and 6-cube pieces push past
that.

## What exists

- Walls are 8×8 plates with the opening centred; `passes()` = the piece's
  silhouette (normalised, centred with the same rounding) ⊆ opening.
- Each wall is generated so the *current* silhouette cannot pass (at least one
  turn is always needed).
- Par via 0-1 BFS over (orientation key, walls passed).
- Passed walls turn to glass so the piece stays visible; the camera advances
  wall to wall; a bonk bounces the piece back keeping its orientation.
- Progression: walls 2 → 4, then cubes 5 → 6. No non-planar 4-cube shape is
  asymmetric, so it starts at 5 cubes.

## Open questions

1. **Score.** "Turns over par" is honest but flat. A per-wall timer, or a
   fuel budget (par + 2 turns for the whole run) with game-over, would give it
   stakes like pack.
2. **Translation through the opening.** Today the piece is centred. Allowing a
   lateral shift (queued, not dragged) turns "does the silhouette fit" into
   "where does it fit" — closer to Tetris, but dilutes rotation.
3. **Oblique travel.** Walls in the XY plane with travel along −Z is a fixed
   frame. A wall tilted 45°, or travel along X for the second wall, would make
   the player re-derive which axis matters.
4. **Merge into pack.** As a bonus round after every N pieces, it reuses
   everything and adds variety without a new game.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/smuggle/
```
