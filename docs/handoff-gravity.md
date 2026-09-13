# Handoff — Gravity Rooms

Branch: `gravity`. Entry: `/lab.html#/gravity` (`src/lab/gravity.ts`).

## The spatial concept

Predicting motion after a change of reference frame. The room turns; gravity
does not. To know where a cube ends up you must (1) rotate the whole scene in
your head, (2) work out which wall is now the floor, (3) simulate each cube
falling in order, with cubes landing on cubes. It composes mental rotation with
a physical simulation — the only sketch that requires two transformations at
once — and it was the hardest genuine prediction in the lab at three cubes.

## The bypass test

Could someone get good without the simulation? A shortcut exists: "after turn
X, the new floor is wall Y" can be memorised as a lookup table (6 turns → 6
floors). That gets the floor but not the landing order, so the fixed blocks
and cube-on-cube stacking are what keep the simulation necessary. Keep them.

## What exists

- Model: `settle(n, fixed, loose, g)` — cubes fall along gravity direction
  `g` (in room coordinates) in depth order, blocked by walls, fixed blocks and
  already-settled cubes. World gravity in room coordinates after turn `m` is
  `rotateCell([0,-1,0], inverse(m))`.
- Generation: loose cubes start settled under normal gravity; at least two must
  move; the socket is the answer cube's final cell and must be empty now.
- Reveal: the room group turns (quaternion), then cubes tween to their final
  room-coordinate positions — the group's rotation carries them into world.
- Input: click a cube (raycast pick) or keys 1–6.

## Open questions

1. **Two turns.** Settle between turns or only at the end? Settling between is
   the honest physics and much harder. Make it a later stage.
2. **Predict the whole end state**, not one cube: the layer builder from
   `kit.ts` could take a full configuration. Grading is then cell-by-cell.
3. **Room design.** Random fixed blocks are fine for a sketch; designed ledges
   and funnels make readable puzzles. A small hand-authored set would tell us
   more than more randomness.
4. **Show the frame change.** After the turn, a brief "gravity arrow" in room
   coordinates before the cubes fall would separate the two skills for
   learners; removing it later is the scaffolding step.
5. **Product shape.** This one wants a level sequence, not a random stream.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/lab.html#/gravity
```
