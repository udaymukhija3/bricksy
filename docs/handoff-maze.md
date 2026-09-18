# Handoff — Perspective Maze

> **Shipped 2026-09-18 as Wayfind** — `/wayfind/`, on the hub, with the daily/endless run loop. Code: `src/lab/wayfind.ts` + `wayfind-model.ts` (tested: connectivity, loop count, shortest walk replays with no wrong turn). What shipped: block-grid mazes with loops, corridor auto-walk between decision cells, grading per decision against BFS distance, a hit = no wrong turn; swoop from map to eyes on early levels, a cut later; random start heading from level 3 (the frame-alignment condition); the trail is drawn on the map at the end. The sections below are the original brief; the open questions still stand.

Branch: `maze`. Entry: `/wayfind/`.

## The spatial concept

Perspective taking plus a mental map. You see the maze from above for three
seconds, then walk it from inside. Every corridor looks alike; the only thing
that tells you where you are is an internal map updated with each turn. The
hard version shows the map *rotated* relative to your starting heading, so
you must align two frames of reference before you can use it at all.

## The bypass test

Wall-following solves any simply-connected maze with no map. So: place the
goal where wall-following is long (interior islands), or count moves against
par so wall-following scores badly. Memory alone is not the target skill —
frame alignment is — which is why the rotated-map stage is the point of the
sketch, not an extra.

## Smallest honest sketch

- Grid maze (recursive backtracker, 7×7 cells) with one interior island.
- Show phase: top-down map for 3 s (later: rotated 90°/180°).
- Walk phase: first-person camera at cell centres, discrete moves (forward,
  turn left/right — no free look); at each junction the player **commits a
  direction toward the goal** before the corridor is revealed.
- Grade: moves vs shortest path; wrong-direction commits at junctions.
- Reuse `voxelMesh` for walls; the camera is just `stage.camera` placed at
  the cell with a yaw.

## What it must prove

That the rotated-map condition costs accuracy at first and recovers with
play (frame alignment being learned), separately from raw memory (measured
by the unrotated condition).

## Why it wasn't sketched yet

First-person controls, a maze generator with the island rule, and a memory
phase are three systems. Doable in a session; not a sketch-sized job.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/wayfind/
```
