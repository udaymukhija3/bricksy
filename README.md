# bricksy

Small spatial games where you have to see it in your head first. One rule in
every game: **predict → commit → watch reality execute your prediction.**
Each game has a **daily** (the same puzzles for everyone, a shareable result)
and an **endless** mode (lives, score, best).

| Game | URL | You commit to… | Reality then… |
| --- | --- | --- | --- |
| 🚚 **Tight Fit** | `/tightfit/` | a chain: load the van → doorway → the corner, on one item | ten jobs, three stars each (the saga) |
| 📦 **Pack** | `/pack/` | a turn sequence | drops the piece; fits or collides |
| 🔪 **Cut** | `/cut/` | one of four outlines | cuts the solid, lifts the half away |
| 📐 **Fold** | `/fold/` | which face ends opposite | folds the net, tumbles the cube |
| 🎲 **Tilt** | `/tilt/` | which cube reaches the socket | turns the room; cubes fall |
| 🪞 **Mirror** | `/mirror/` | "rotation" or "mirror" | turns A to its best fit; uncovered cells show red |
| ⚙️ **Gears** | `/gears/` | direction (then speed) of the last gear | runs the train |
| 🧱 **Smuggle** | `/smuggle/` | turns for the next wall (orientation carries over) | flies through or bonks |

`/` is the hub. `/lab.html` keeps the sketches that aren't games yet
(Projection Detective, Hidden Structure, Copycat) and the concept pages.
`/match.html` is prototype 0, the control condition.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # exact-geometry checks: rotations, cavities/landing, cube-net folding
```

Live: https://udaymukhija3.github.io/bricksy/ — deployed by `.github/workflows/pages.yml`
on every push to `main` (builds with `GH_PAGES=1` so asset paths sit under `/bricksy/`).
It is a PWA: on a phone, "Add to Home Screen" gives a full-screen, offline-capable app.

## Mobile

Everything is touch-first: no hover-only affordances (turn buttons light their
axis while a finger is down), targets ≥ 44px, and cameras fit the scene at any
aspect ratio and reframe on rotation. Phone portrait fits scene + controls on
one screen; phones held sideways get the scene on the left and controls on the
right; match mode stacks YOU over TARGET when the halves would be too narrow.

## Tight Fit (`/tightfit/`, `src/tightfit/`)

The saga. Moving day: each job is a chain of stages on **one persistent item**
— load it into the van (pack), carry it through the doorway (smuggle, in the
orientation it was loaded), then the van takes a corner (rigid-body tilt).
Three stars = every stage first try; a stage fails after three tries and the
job restarts. Items and stages are seeded per job so every player gets the same
ten jobs. Episode 1, *First Day*, ends with a boss job that chains four stages.
`src/tightfit/model.ts` is pure and tested (loads, doorways, rigid-body
corners); `stages.ts` renders; `jobs.ts` is the episode; `main.ts` is the map.

## Product layer (`src/run.ts`)

Every game shares one run loop: a daily of N rounds seeded from the date and
the game id (so the puzzles are identical for everyone that day), an endless
mode with three lives, best score and best streak in `localStorage`, a
result card with a Wordle-style 🟩🟥 grid, and Share (Web Share API, falling
back to the clipboard). Difficulty is a function of the round index in a
daily and of the score in endless.

## Pack (`/pack/`)

A piece hovers over a mold with a hole in it. Queue quarter-turns about the
world axes, then **Drop it**. The piece turns, falls, and either seats flush or
collides and sits proud. Three lives, a score, a best score, and stages that
escalate with score:

| Stage (score) | Turns | Cubes | Marker | Mold | Camera | Holes |
| --- | --- | --- | --- | --- | --- | --- |
| One turn (0) | 1 | 4 | yes | glass | fixed | any |
| Two turns (3) | 2 | 4 | yes | glass | fixed | any |
| Deeper holes (6) | 2 | 5 | no | glass | fixed | varied depth |
| New viewpoint (9) | 2 | 5 | no | glass | random | varied depth |
| Three turns (12) | 3 | 5 | no | glass | random | varied depth |
| Solid mold (16) | 3 | 5 | no | opaque | random | varied depth |

Design decisions, each made against the question *"could someone get good at
this without mental rotation?"*:

- **The hole is generated from the piece.** Every round is solvable; with
  asymmetric pieces the fitting orientation is unique. Only *droppable*
  orientations become holes (every column open to the top), so a wrong turn
  always produces a physical collision rather than an impossible state.
- **No translation.** The piece is centred over the hole; orientation is the
  whole problem.
- **Glass first, opaque later.** A glass mold shows the hole as a visible
  negative shape, so early stages isolate rotation. The opaque mold makes
  reading depth from shadows part of the task — a later dial, not the first.
- **Misses cost a life but keep the piece.** You can lift it out and try again
  with the evidence of where it landed. Skipping is allowed; it already cost a life.
- **Fits auto-advance** after ~1s to keep rhythm; misses stop and wait.

## The lab (`/lab.html`)

One sketch per idea from the brainstorm, deduplicated to 15, so they can be
compared by playing rather than by argument. Every sketch keeps the rule. The
card's *skill* line is the cognitive operation the mechanic is meant to require.

| Sketch | Skill | You commit to… | Reality then… |
| --- | --- | --- | --- |
| **Pack** (flagship, `/`) | mental rotation | a turn sequence | drops the piece; fits or collides |
| Transform Combo (`/match.html`) | rotation sequencing | a turn sequence | turns the shape; matches or not |
| Shape Smuggler | rotation planning | turns for the next wall (orientation carries over) | flies through or bonks; par is computed by search |
| Mirror Trap | rotation vs reflection | "rotation" or "mirror" | turns A to its best fit and slides it onto B; uncovered cells show red |
| Projection Detective | 2D → 3D reconstruction | a 3D build, never seeing its silhouettes | casts your build's silhouettes next to the target's |
| Hidden Structure | inference behind occlusion | a cube count | turns the stack; hidden cubes in orange |
| Copycat | spatial memory | a rebuilt shape | overlays the original as a ghost |
| Slice | cross-section prediction | one of four outlines | cuts the solid and lifts the half away |
| Gravity Rooms | motion under a rotated frame | which cube reaches the socket | turns the room; cubes fall |
| Fold | net → solid | which face ends opposite | folds the net; tumbles the cube |
| Mechanism | motion through a system | direction (and speed) of the last gear | runs the train |
| Spatial Sokoban · Perspective Maze · Assembly · Rotation Chess | — | concept: scene + mechanic + bypass analysis | — |

Bypass notes that shaped the sketches:

- **Projection Detective** would collapse into Picross 3D (pure cell logic) if the
  player could see their own build's silhouettes. They can't until commit, and
  the cube count is fixed so the "maximal object" trick doesn't work.
- **Shape Smuggler** keeps orientation between walls, so each wall is planned
  from where the last one left you — not a fresh puzzle.
- **Mirror Trap** uses only chiral, non-planar shapes; planar shapes can be
  flipped over in 3D and are never chiral. (Also: no 4-cube shape is both
  non-planar and asymmetric — the two screw tetracubes are 2-fold symmetric —
  so sketches that need chirality or asymmetry start at 5 cubes.)
- **Slice** distractors are other real cross-sections (of the same solid, or the
  same cut on another solid), filtered to be visibly different; plane offsets
  are nudged off the lattice so no cut passes exactly through mesh vertices.
- **Hidden Structure** only serves stacks where every column's top is visible,
  so the count is inferable, and where at least two cubes are hidden.

`src/lab/kit.ts` is the shared toolkit (single-view stage, voxel meshes, turn
queue, layer builder, grid picker, choices); `src/lab/nets.ts` is a pure cube-net
folding model with tests for all 11 nets.

## Prototype 0 — match (`/match.html`)

Same kernel without the game wrapper: turn the left shape to match the right
one. Two attempts, first-try accuracy tracked, five levels, level-up after three
consecutive first-try successes. Kept as the control condition for comparing
"pure" prediction against the packing framing.

## Shared model

- Turns are exact integer lattice rotations (`src/polycube.ts`). The 24
  orientations of an asymmetric shape form the cube rotation group; BFS over
  it gives shortest paths, and the distance histogram 1/6/11/6 is verified.
- Only shapes whose 24 orientations are all distinct are used.
- A level-*k* puzzle is at exact shortest-path distance *k*: a one-turn guess
  cannot solve a two-turn puzzle.
- Puzzles where the camera fully hides a cube (or, for opaque molds, a hole
  cell) are rejected at generation.

## Instrumentation

Every action is logged to `localStorage` and downloadable via **Export log**.
Event types: `run_start`, `present` (full puzzle: piece, target, cavity, mold,
seed, pose), `enqueue`, `undo`, `clear`, `commit` (ms since presented / since
first input), `drop` or `result` (outcome, moves, landing, one solution),
`retry`, `replay`, `reveal`, `next`, `stage`/`levelup`, `run_over`. Any puzzle
can be reconstructed from its `present` event. In dev, `window.bricksy`
exposes the live puzzle and log.

## Controls

`x` `y` `z` queue +90°, `⇧`+key −90°, `⌫` undo, `↵` commit / next, `r` retry.
Hovering a turn button lights that axis in the gizmo and flips its arrow for −90°.

## Layout

- `src/polycube.ts` — lattice model (no rendering) · `src/polycube.test.ts`
- `src/pack.ts` — stages, hole generation, droppability, landing/fit · `src/pack.test.ts`
- `src/puzzle.ts` — match-mode levels and generation
- `src/render-common.ts` — gizmo, tweens, lights, materials shared by both stages
- `src/pack-scene.ts`, `src/scene.ts` — Three.js stages for pack / match
- `src/main.ts`, `src/match.ts` — game loops
- `src/sfx.ts` — synthesised sound (no assets) · `src/log.ts` — event log
- `src/lab/` — the lab: `index.ts` (router + cards), `kit.ts`, `nets.ts`, one file per sketch, `concepts.ts`

## What these prototypes should tell us

1. Does the pack loop pull on its own — do people start another run?
2. Where does first-try accuracy fall off: second turn, marker gone, deeper
   holes, moved camera, third turn, opaque mold?
3. Do commit times shrink with practice at a fixed stage (internalising), or
   stay flat (still simulating step by step)?
4. Which wrong answers recur — sign errors, axis confusion, order swaps? Every
   miss logs the committed sequence, where it landed, and a solution.
5. Does the framing matter? Same kernel, match vs pack: compare first-try
   accuracy and time per stage across the two logs.

## Deliberately not built yet

- Removing the gizmo (axis convention is prerequisite knowledge, not the skill).
- Translation / multiple candidate holes in pack (would add placement, diluting rotation).
- The transfer test: static drawings of the same problems, no 3D.
- Playable versions of the four concepts (each is a whole game's worth of level design).
- Lives/score wrappers on the lab sketches — they are deliberately bare so the
  mechanic can be judged on its own.
