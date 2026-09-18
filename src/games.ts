// The product roster: every game with its own page, grouped by the kind of spatial operation it asks for.
import type { SketchDef } from './lab/types.ts';
import { slice } from './lab/slice.ts';
import { fold } from './lab/fold.ts';
import { gravity } from './lab/gravity.ts';
import { mirror } from './lab/mirror.ts';
import { gears } from './lab/gears.ts';
import { smuggler } from './lab/smuggler.ts';
import { shadows } from './lab/shadows.ts';
import { count } from './lab/count.ts';
import { flash } from './lab/flash.ts';
import { shove } from './lab/shove.ts';
import { wayfind } from './lab/wayfind.ts';
import { assemble } from './lab/assemble.ts';
import { mate } from './lab/mate.ts';

export const TIGHT_FIT: SketchDef = {
  id: 'tightfit', title: 'Tight Fit', icon: '🚚', status: 'flagship', skill: 'saga · load → doorway → corner', href: 'tightfit/',
  tagline: 'Moving day. Load the van, get it through the door, survive the corner — the same sofa the whole way. Ten jobs, three stars each, plus today\'s job.',
  about: 'The saga chains three predictions on one persistent item: the orientation you load it in is the orientation you carry it to the doorway, and the corner then moves it as a rigid body. Nothing resets between stages, so a mental model of the object has to survive across them. Three stars means every stage first try; a stage fails after three tries and the job restarts.',
  controls: 'x y z queue +90° turns, shift+key −90°, backspace undo, Enter commits. Corner stage: pick which body reaches the socket, then Enter.',
};
export const PACK: SketchDef = {
  id: 'pack', title: 'Pack', icon: '📦', status: 'flagship', skill: 'mental rotation', href: 'pack/',
  tagline: 'Turn the piece so it drops into the hole. Eight pieces a day, or endless with three lives.',
  about: 'Mental rotation, inverted: instead of matching a shown orientation you find the turns that make the piece fit a hole. The hole is generated from the piece, so every round is solvable and the fitting orientation is unique; the piece is centred over the hole, so orientation is the whole problem; and a wrong turn always produces a physical collision. Glass molds first, then opaque ones where depth must be read from shadows.',
  controls: 'x y z queue +90° turns, shift+key −90°, backspace undo, Enter drops. After a miss: R lifts it out to try again (the round already counted).',
};

export const GROUPS: { title: string; blurb: string; games: SketchDef[] }[] = [
  { title: 'Turn it', blurb: 'Mental rotation: imagine the object after the turns, then commit.', games: [PACK, smuggler, mirror, assemble] },
  { title: 'See inside it', blurb: 'Structure you cannot see directly: cross-sections, folds, silhouettes, what is hidden, what you remember.', games: [slice, fold, shadows, count, flash] },
  { title: 'Move through it', blurb: 'Motion and planning in a frame that is not yours: tilted rooms, gear trains, tight rooms, mazes, a board.', games: [gravity, gears, shove, wayfind, mate] },
];
export const GAMES: SketchDef[] = GROUPS.flatMap((g) => g.games).filter((g) => g !== PACK);
