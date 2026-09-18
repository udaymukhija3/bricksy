# Handoff — Spatial Sokoban

> **Shipped 2026-09-18 as Shove** — `/shove/`, on the hub, with the daily/endless run loop. Code: `src/lab/shove.ts` + `shove-model.ts` (tested: apply/turn rules, solver, generator par exactness, needTurn). What shipped: one crate (L3, later L4/T4), turns about its pivot from an adjacent cell, plans of 2–4 moves, no undo, budget par + 3, BFS-generated sockets at exact par; interior only is drawn with a fence at the border; from level 6 a push-only box with its own socket joins the room (the box must move too); a second turnable crate is the next dial. The sections below are the original brief; the open questions still stand.

Branch: `sokoban`. Entry: `/shove/`.

## The spatial concept

Planning under irreversible moves. Each push or turn of a crate changes which
future moves remain possible; a crate against a wall cannot be pulled back.
The mind has to simulate the *state space*, not just the geometry: "if I turn
this here, can it still fit through there later?" Sokoban's depth comes from
a tiny rule set; the 3D version adds orientation to position, so a crate can
be in the right place in the wrong orientation.

## The bypass test

Single-step moves with free undo make it trial and error — the classic
Sokoban failure for learning. The rule that keeps simulation necessary: you
commit a **plan of 2–4 moves** at a time and it executes without pause; undo
is scarce (a budget per level) or absent. Dead ends must be real and visible.

## Smallest honest sketch

- A room on a 7×7 grid, 1–2 polycube crates (L-tricubes), one target socket
  per crate, a player token. Moves: step, push (crate moves one cell in the
  push direction if free), turn (quarter-turn a crate you're adjacent to,
  if the swept cells are free).
- Plan input: a queue of 2–4 moves (reuse `turnQueue`'s chip pattern with
  direction arrows). Commit executes all.
- Model must be pure and tested: `apply(state, move)` → new state or "blocked".
- **Generator with a solver.** Generate rooms backwards from the solved state
  (reverse pushes) so every level is solvable; BFS the state space to get par
  and to reject trivial levels (par < 6) and unreadable ones (par > 20).

## What it must prove

That planning depth (moves per commit) trades off against accuracy in a way
that improves with play. Log plan length, blocked moves, undo use, par vs
actual.

## Why it wasn't sketched yet

The generator-with-solver is the real work; without it, hand-made levels
would be judged on their design rather than the mechanic.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/shove/
```
