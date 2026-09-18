# bricksy

Small spatial games where you have to see it in your head first. One rule in
every game: **predict → commit → watch reality execute your prediction.**
Each game has a **daily** (the same puzzles for everyone, a shareable result)
and an **endless** mode (lives, score, best).

| Game | URL | You commit to… | Reality then… |
| --- | --- | --- | --- |
| 🚚 **Tight Fit** | `/tightfit/` | a chain: load the van → doorway → the corner, on one item | ten jobs, three stars each (the saga) |
| 📦 **Pack** | `/pack/` | a turn sequence | drops the piece; fits or collides |
| 🧱 **Smuggle** | `/smuggle/` | turns for the next wall (orientation carries over) | flies through or bonks |
| 🪞 **Mirror** | `/mirror/` | "rotation" or "mirror" | turns A to its best fit; uncovered cells show red |
| 🧩 **Assemble** | `/assemble/` | turns and an anchor for every part | parts fly in one by one; the first collision stops the build |
| 🔪 **Cut** | `/cut/` | one of four outlines | cuts the solid, lifts the half away |
| 📐 **Fold** | `/fold/` | which face ends opposite | folds the net, tumbles the cube |
| 🔦 **Shadows** | `/shadows/` | a 3D build, never seeing its silhouettes | casts your build's silhouettes next to the target's |
| 🔢 **Count** | `/count/` | a cube count | turns the stack; hidden cubes in orange |
| ⚡ **Flash** | `/flash/` | a shape rebuilt from memory | overlays the original as a ghost |
| 🎲 **Tilt** | `/tilt/` | which cube reaches the socket | turns the room; cubes fall |
| ⚙️ **Gears** | `/gears/` | direction (then speed) of the last gear | runs the train |
| 🏗️ **Shove** | `/shove/` | a plan of 2–4 moves for a crate | executes it; stops at the first blocked move |
| 🧭 **Wayfind** | `/wayfind/` | a direction at every junction, from a map you saw for seconds | walks the corridor; dead ends are real |
| ♟️ **Mate** | `/mate/` | one slide or turn of one piece | reveals the new shadows; mate or not |

`/` is the hub, grouped by the kind of spatial operation each game asks for
(*turn it · see inside it · move through it*). `/lab.html` is the catalogue
with each game's skill line. `/match.html` is prototype 0, the control
condition — the pack kernel without the packing framing, deliberately left
without the run loop so the two can be compared.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # exact-geometry checks: rotations, cavities/landing, cube nets, and every game's pure model
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
Above the map sits **today's job**: one seeded chain (load → doorway →
corner, sometimes two doorways), the same for everyone, once a day, with its
own stars, share text and day streak; the hub shows it like the other dailies.
`src/tightfit/model.ts` is pure and tested (loads, doorways, rigid-body
corners); `stages.ts` renders; `jobs.ts` is the episode; `main.ts` is the map.

## Product layer (`src/run.ts`)

Every game shares one run loop:

- **Daily**: N rounds seeded from the date, the game id and the round index,
  so the puzzles are identical for everyone that day. Progress is saved after
  every round and restored on reload; a finished daily locks — on return you
  get the result card, not the puzzles. Daily #1 was 2026-09-18.
- **Endless**: three lives, score, best score and best streak.
- **Result card**: Wordle-style 🟩🟥 grid, day streak, dailies played,
  average, your score distribution over every daily, a countdown to the
  next one, Share (Web Share API, clipboard fallback), Practice (endless),
  and *Next daily: …* — the first game you haven't played today.
- **Hub** (`/`): every card shows today's result or that a daily is in
  progress; the header counts how many of the day's dailies you've played.
- Difficulty is a function of the round index in a daily and of the score
  in endless. The verdict and the primary action are mirrored into a banner
  on the stage, so on a phone you never have to scroll to find "Next".
- **? panel** on every game: how to play, the controls, *why this game*
  (the skill it isolates and its bypass defence), and your learning curve —
  first-try accuracy and median time to commit per difficulty level, read
  back from the local event log (`src/progress.ts`). That table is the
  product's answer to "am I getting better at seeing this?".

## Pack (`/pack/`)

A piece hovers over a mold with a hole in it. Queue quarter-turns about the
world axes, then **Drop it**. The piece turns, falls, and either seats flush or
collides and sits proud. A daily of eight pieces (the stage curve below
climbs twice as fast, so round 7 is three turns) or endless with three lives;
stages escalate with score:

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
- **Only the first drop decides a piece.** A miss keeps the piece: you can
  lift it out and try again with the evidence of where it landed, but the
  round already counted — the retry is for learning, not for score.
- **Fits auto-advance** after ~1s to keep rhythm; misses stop and wait.

## The other games

One game per idea from the brainstorm, fifteen in all. Every game keeps the
rule; the *skill* line is the cognitive operation the mechanic is meant to
require, and the design test for each was *"could someone get good at this
without it?"*

| Game | Skill | Bypass defence |
| --- | --- | --- |
| **Smuggle** | rotation planning | orientation carries over between walls, so each wall is planned from where the last left you; par by 0-1 BFS; a fourth wall from level 6; after a bonk, *Show a fit* plays the fewest turns through from where you are (the miss stands) |
| **Mirror** | rotation vs reflection | only chiral, non-planar shapes (planar shapes flip over in 3D and are never chiral); 5 cubes, then 6, 7, 8; from level 2 a third answer — a different shape with one cube moved, provably neither rotation nor mirror — so the guess floor drops from 50% to 33%; the reveal fits A to B over rotations *and* translations |
| **Assemble** | part–whole composition | every part gets turns and an anchor *before* anything moves; the first collision stops the build, so one part at a time with live feedback is impossible; anchors are set by tapping a layer grid of the target or the ghost itself |
| **Cut** | cross-section prediction | distractors are other real cross-sections, filtered to be visibly different; planes nudged off the lattice; six options from level 8 |
| **Fold** | net → solid | all 11 nets, tested; from level 6 two faces are asked and both must be right |
| **Shadows** | 2D → 3D reconstruction | your build's silhouettes stay hidden until commit (else it collapses into Picross 3D); the cube count is fixed so the maximal-object trick fails; 3³ → 4×3×4 → 4³ boxes, up to 13 cubes |
| **Count** | inference behind occlusion | only stacks where every column's top is visible are served, so the count is inferable; ≥2 cubes hidden; visibility is a pure orthographic model so the daily is the same on every screen; footprints 3×3 → 6×6 |
| **Flash** | spatial memory | cube count (4 → 8), then look time (3 → 1.2 s), then a 90° view turn before you build so memory has to survive a rotation |
| **Tilt** | motion under a rotated frame | ≥2 cubes move and the socket is empty beforehand |
| **Gears** | motion through a system | direction, then speed |
| **Shove** | planning under irreversible moves | plans of 2–4 moves execute without pause and stop at the first blocked move; no undo; budget par + 3; levels are generated from the reachable state space so par is exact; later levels need a turn, then add a push-only box with its own socket (the box must move too, so ordering is part of the plan) |
| **Wayfind** | perspective taking · mental maps | mazes get loops so wall-following is a bad strategy; a hit is a walk with *no* wrong turn; later the start heading no longer matches the map's up, so two frames must be aligned; 4×4 → 9×9 rooms; you always start facing a corridor |
| **Mate** | multi-step transformation lookahead | attack = the piece's shadow minus its anchor; the post-move shadow is never previewed; puzzles are brute-forced to a unique answer, forced to be a turn, then a turn about a horizontal axis (the shadow changes shape); from level 8 (endless) it is mate in two — no single move mates, the king steps to the square that leaves you the fewest answers, and every reply must have one |

Shared kit: `src/lab/kit.ts` (single-view stage, voxel meshes, turn queue,
layer builder, grid picker, choices). Pure, tested models sit next to the
games that use them: `count-model`, `shove-model`, `wayfind-model`,
`assemble-model`, `mate-model`, and `nets` (cube folding).
`src/lab/generators.test.ts` runs **every game's round generator at every
level across many seeds** in node — a daily must never fail to generate.

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
- `src/games.ts` — the roster, grouped · `src/game.ts` — entry for every game page (`<html data-game>`)
- `src/lab/` — `kit.ts`, one file per game, `*-model.ts` pure models with `*-model.test.ts`, `index.ts` (catalogue)

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
- A full opponent in Mate (mate in two is the first step toward one) and a
  second turnable crate in Shove (the push-only box is the first step): each
  game ships with the smallest ruleset that makes its skill necessary; the
  dials above are where difficulty grows.
- In dev, `?level=N` on any game page pins the difficulty so late levels can
  be checked without earning them.
