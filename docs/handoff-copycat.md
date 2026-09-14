# Handoff — Copycat

Branch: `copycat`. Entry: `/lab.html#/copycat` (`src/lab/copycat.ts`).

## The spatial concept

Spatial working memory, and later, memory that survives a rotation. You see a
shape for a few seconds, it vanishes, and you rebuild it. The interesting
stage is when the build view is turned 90° from the memorised view: a memory
stored as "what it looked like" fails, and only a memory stored as a 3D
model survives. That transition is the thesis in miniature — moving from a
picture to an internal model.

## The bypass test

Chunking strategies (memorise "an L plus a bump") are legitimate spatial
encoding, not bypass. Screen-space memorisation ("blue square top-left") is
the bypass, and the turned-view stage is what defeats it. Compare accuracy
before and after the turn: a drop that recovers with practice is the signal.

## What exists

- Shapes fit a 3×3×3 box; comparison is up to translation (`shapeKey`).
- Show phase with a countdown overlay; builder disabled until the shape is
  gone; the 3D view shows the build live from the same (or turned) viewpoint.
- Reveal: the original as an orange ghost aligned to your build's bounding
  box; message reports missing and extra cells.
- Progression: cubes 4 → 7, look time 3s → 1.5s, then the turned view.

## Open questions

1. **Delay, not just look time.** A 5-second blank between vanish and build
   forces maintenance in memory, which is where the 3D model matters.
2. **Distractor task** during the delay (count backwards) — standard in
   working-memory research; tells us whether the encoding is visual or
   spatial.
3. **Sequence memory.** Show the shape, then show two turns applied to it,
   then ask for the result — this fuses Copycat with pack and is probably the
   more valuable game.
4. **Verdict so far.** A test more than a game. Fold into pack as a mode
   (3) or keep as a drill.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/lab.html#/copycat
```
