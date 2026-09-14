# Handoffs — one per idea

Each doc opens with the spatial concept (what the mind has to do), then the
bypass test ("could someone get good without it?"), then what exists, then
open questions. Start a thread by reading its doc and checking out its branch.

| Idea | Status | Doc | Branch |
| --- | --- | --- | --- |
| Pack | flagship | [handoff-pack.md](handoff-pack.md) | `pack` |
| Transform Combo (match) | playable | [handoff-match.md](handoff-match.md) | `match` |
| Shape Smuggler | playable | [handoff-smuggler.md](handoff-smuggler.md) | `smuggler` |
| Mirror Trap | playable | [handoff-mirror.md](handoff-mirror.md) | `mirror` |
| Projection Detective | playable | [handoff-projection.md](handoff-projection.md) | `projection` |
| Hidden Structure | playable | [handoff-hidden.md](handoff-hidden.md) | `hidden` |
| Copycat | playable | [handoff-copycat.md](handoff-copycat.md) | `copycat` |
| Slice | playable | [handoff-slice.md](handoff-slice.md) | `slice` |
| Gravity Rooms | playable | [handoff-gravity.md](handoff-gravity.md) | `gravity` |
| Fold | playable | [handoff-fold.md](handoff-fold.md) | `fold` |
| Mechanism (gears) | playable | [handoff-gears.md](handoff-gears.md) | `gears` |
| Spatial Sokoban | concept | [handoff-sokoban.md](handoff-sokoban.md) | `sokoban` |
| Perspective Maze | concept | [handoff-maze.md](handoff-maze.md) | `maze` |
| Assembly | concept | [handoff-assembly.md](handoff-assembly.md) | `assembly` |
| Rotation Chess | concept | [handoff-chess.md](handoff-chess.md) | `chess` |

Shared rules for every thread:

- Predict → commit → reality executes. Nothing moves before commit.
- Shared code stays shared: `src/polycube.ts`, `src/render-common.ts`,
  `src/lab/kit.ts`, the log schema. Change them in place; never fork a copy
  into one sketch.
- Every action logs. New event fields are fine; renaming existing ones is not.
- Merge to `main` when something is worth keeping; other threads rebase.
