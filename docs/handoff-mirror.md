# Handoff — Mirror Trap

Branch: `mirror`. Entry: `/mirror/` (`src/lab/mirror.ts`).

## The spatial concept

Distinguishing rotation from reflection — chirality. Two shapes look alike;
one may be a rotated copy, the other a mirror image, and no rotation ever
turns a hand into its mirror. The mind has to try rotations and notice that
the *best* one still leaves something wrong, then recognise that "wrong in a
way rotation can't fix" is a category, not a failed search. This is the classic
Shepard–Metzler item, and the error people make is mistaking a hard rotation
for an impossible one (or vice versa).

## The bypass test

Two-choice questions can be guessed at 50%. Streaks and a growing shape count
punish guessing, but the real defence is the feedback: after commit, A rotates
to its best fit and slides onto B, and the uncovered cells show red — so a
guess teaches nothing while an honest attempt sees exactly the chirality.
Local-feature shortcuts (compare one corner) work for some shapes; 6–7 cube
shapes with similar sub-parts defeat them.

## What exists

- Shapes are non-planar (planar shapes flip over in 3D: never chiral), have 24
  distinct orientations, and their mirror is not among them.
- B is a random non-identity orientation of A (50%) or of mirror(A) (50%).
- Reveal: shortest turn path (BFS) to the orientation with maximum cell
  overlap; B goes to glass; A slides on; for a mirror the uncovered B cells
  remain as red ghosts.
- Layout stacks A over B on narrow screens. Keys 1 / 2 / Enter.

## Open questions

1. **Timing.** Shepard–Metzler's signature is response time rising linearly
   with the angle between shapes. The log already records ms-to-commit; add
   the rotation angle (path length is a proxy) to the `present` event and see
   whether players show the slope — that's evidence of actual rotation.
2. **Three or four candidates.** "Which of these is NOT a rotation of A"
   (one mirror among rotations) raises the chance floor and matches the test
   format the literature uses.
3. **Viewpoint difference.** Render B from a different camera azimuth than A
   so screen-space comparison stops working.
4. **Product fit.** Fast rounds, binary answers, a streak — this is the most
   "daily quiz" shaped sketch. Ten a day with a shareable score is plausible.

## Run

```bash
npm install && npm run dev   # http://localhost:5173/mirror/
```
