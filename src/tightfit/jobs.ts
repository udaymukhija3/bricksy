// Episode 1 — First Day. Ten jobs; each is a chain of stages on one item.
import type { StageType } from './stages';

export interface JobDef {
  id: number;
  customer: string;
  line: string;
  done: string;
  item: string;
  cubes: number;
  color: number;
  stages: { type: StageType; d: number }[];
  boss?: boolean;
}

export const EPISODE = { id: 1, title: 'First Day', blurb: 'A van, a clipboard, and ten customers who all think their stuff will fit.' };

export const JOBS: JobDef[] = [
  { id: 1, customer: 'Priya', line: '“It’s just a lamp. How hard can it be?”', done: '“Huh. Okay. That was fine.”', item: 'lamp', cubes: 4, color: 0xf5a524, stages: [{ type: 'load', d: 1 }] },
  { id: 2, customer: 'The Duttas', line: '“The bookshelf goes in first. The books stay in it, obviously.”', done: '“Not one book fell out. We’re telling people.”', item: 'bookshelf', cubes: 4, color: 0x8b5e3c, stages: [{ type: 'load', d: 1 }] },
  { id: 3, customer: 'Mr. Hale', line: '“That armchair has been in the family longer than I have.”', done: '“…It looks the same. Good.”', item: 'armchair', cubes: 4, color: 0x6b8fd6, stages: [{ type: 'load', d: 2 }] },
  { id: 4, customer: 'Nadia', line: '“The fridge is full. Don’t ask.”', done: '“Nothing leaked. I’m as surprised as you.”', item: 'fridge', cubes: 4, color: 0xb0bad4, stages: [{ type: 'load', d: 1 }, { type: 'doorway', d: 1 }] },
  { id: 5, customer: 'Sam', line: '“Drum kit. Three flights of stairs. Sorry.”', done: '“You didn’t even hit the cymbal. Respect.”', item: 'drum kit', cubes: 4, color: 0xe5484d, stages: [{ type: 'load', d: 2 }, { type: 'doorway', d: 1 }] },
  { id: 6, customer: 'The Okafors', line: '“Please don’t drop the piano. Please.”', done: '“It’s still in tune. HOW is it still in tune?”', item: 'piano', cubes: 5, color: 0x4a4e63, stages: [{ type: 'load', d: 2 }, { type: 'doorway', d: 2 }] },
  { id: 7, customer: 'Leo', line: '“The aquarium’s empty. Mostly.”', done: '“The fish says thanks. I’m the fish.”', item: 'aquarium', cubes: 4, color: 0x2ec4b6, stages: [{ type: 'load', d: 1 }, { type: 'doorway', d: 1 }, { type: 'corner', d: 0 }] },
  { id: 8, customer: 'Grandma June', line: '“That wardrobe came through this door once. It’ll do it again.”', done: '“Told you. 1974, same door.”', item: 'wardrobe', cubes: 5, color: 0x9a6b3c, stages: [{ type: 'load', d: 2 }, { type: 'doorway', d: 2 }, { type: 'corner', d: 0 }] },
  { id: 9, customer: 'The twins', line: '“Bunk bed. Both halves. Don’t mix up the ladders.”', done: '“Top bunk’s mine.” “No it isn’t.”', item: 'bunk bed', cubes: 5, color: 0x46a758, stages: [{ type: 'load', d: 2 }, { type: 'doorway', d: 2 }, { type: 'corner', d: 0 }] },
  { id: 10, customer: 'The lighthouse keeper', line: '“Everything goes up the spiral stairs. Everything.”', done: '“Ninety-two steps. You didn’t count. I did.”', item: 'brass telescope', cubes: 5, color: 0xd4a017, stages: [{ type: 'load', d: 3 }, { type: 'doorway', d: 2 }, { type: 'doorway', d: 2 }, { type: 'corner', d: 0 }], boss: true },
];

export const STAGE_NAMES: Record<StageType, string> = { load: 'Load the van', doorway: 'The doorway', corner: 'The corner' };
