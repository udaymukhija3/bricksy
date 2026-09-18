# Handoff — Assembly (3D Tangram / Jigsaw)

> **Shipped 2026-09-18 as Assemble** — `/assemble/`, on the hub, with the daily/endless run loop. Code: `src/lab/assemble.ts` + `assemble-model.ts` (tested: partition, solution builds, wrong anchors/overlaps fail). What shipped: targets cut into 2–3 connected parts by multi-source growth, each shown after a scramble; a turn queue per part (`turnQueue` gained `allowEmpty`) plus an anchor picked by clicking the ghost — repeat clicks cycle to occluded cells; parts fly in on commit and the first collision stops the build. The sections below are the original brief; the open questions still stand.

Branch: `assembly`. Entry: `/assemble/`.

## The spatial concept

Part–whole composition: several odd components and one target volume. Each
part must be turned and placed so that all of them tile the target with no
overlap. The mind alternates between the whole ("this notch needs a bump")
and the parts ("which orientation of this piece has that bump"), and early
choices constrain later ones. It's mental rotation applied to several objects
at once, under a mutual-exclusion constraint.

## The bypass test

Place-one-part-with-live-feedback degrades to trial and error. The keeping
rule: **assign every part an orientation and anchor before anything moves** —
a full plan — then the parts fly in one by one and the first collision stops
the build. That makes the whole composition the unit of prediction.

## Smallest honest sketch

- Target: a random polycube of 8–10 cells, shown as a ghost.
- Parts: cut the target into 3 connected pieces of 2–4 cells (random cut,
  reject pieces with symmetry so orientation is unambiguous).
- Input per part: a turn queue (existing widget) plus an anchor cell chosen
  by clicking a ghost cell of the target (raycast pick). The chosen anchor is
  where the part's marked cube goes.
- Commit: parts fly in order; `applyMoves` + translate; collision = any cell
  outside the target or already filled.
- Model pure and tested: cut, place, collide.

## What it must prove

That whole-plan commits are solvable by people at 3 parts and whether
accuracy tracks pack's rotation accuracy (same skill) or diverges
(composition is its own skill).

## Why it wasn't sketched yet

The anchor-picking UI is the design problem; the geometry is already in
`polycube.ts` and `pack.ts`.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/assemble/
```
