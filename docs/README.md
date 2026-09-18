# Handoffs — one per idea

Each doc opens with the spatial concept (what the mind has to do), then the
bypass test ("could someone get good without it?"), then what exists, then
open questions. Start a thread by reading its doc and checking out its branch.

As of 2026-09-18 every idea is a game with its own page, a daily and an
endless mode (see the README's *other games* table for each one's bypass
defence). The four former concepts (Shove, Wayfind, Assemble, Mate) and the
three former bare sketches (Shadows, Count, Flash) each carry a status note
at the top of their doc saying what shipped and what the model file is.

| Idea | Status | Doc | Branch |
| --- | --- | --- | --- |
| Pack (`/pack/`) | flagship | [handoff-pack.md](handoff-pack.md) | `pack` |
| Transform Combo (`/match.html`) | prototype 0 (control) | [handoff-match.md](handoff-match.md) | `match` |
| Shape Smuggler (`/smuggle/`) | game | [handoff-smuggler.md](handoff-smuggler.md) | `smuggler` |
| Mirror Trap (`/mirror/`) | game | [handoff-mirror.md](handoff-mirror.md) | `mirror` |
| Projection Detective → **Shadows** (`/shadows/`) | game | [handoff-projection.md](handoff-projection.md) | `projection` |
| Hidden Structure → **Count** (`/count/`) | game | [handoff-hidden.md](handoff-hidden.md) | `hidden` |
| Copycat → **Flash** (`/flash/`) | game | [handoff-copycat.md](handoff-copycat.md) | `copycat` |
| Slice (`/cut/`) | game | [handoff-slice.md](handoff-slice.md) | `slice` |
| Gravity Rooms (`/tilt/`) | game | [handoff-gravity.md](handoff-gravity.md) | `gravity` |
| Fold (`/fold/`) | game | [handoff-fold.md](handoff-fold.md) | `fold` |
| Mechanism (gears) (`/gears/`) | game | [handoff-gears.md](handoff-gears.md) | `gears` |
| Spatial Sokoban → **Shove** (`/shove/`) | game | [handoff-sokoban.md](handoff-sokoban.md) | `sokoban` |
| Perspective Maze → **Wayfind** (`/wayfind/`) | game | [handoff-maze.md](handoff-maze.md) | `maze` |
| Assembly → **Assemble** (`/assemble/`) | game | [handoff-assembly.md](handoff-assembly.md) | `assembly` |
| Rotation Chess → **Mate** (`/mate/`) | game | [handoff-chess.md](handoff-chess.md) | `chess` |

Shared rules for every thread:

- Predict → commit → reality executes. Nothing moves before commit.
- Shared code stays shared: `src/polycube.ts`, `src/render-common.ts`,
  `src/lab/kit.ts`, the log schema. Change them in place; never fork a copy
  into one sketch.
- Every action logs. New event fields are fine; renaming existing ones is not.
- Merge to `main` when something is worth keeping; other threads rebase.
