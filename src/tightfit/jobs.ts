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
  /** Seeds derive from this instead of the id (today's job uses the date). */
  seedKey?: string;
  daily?: boolean;
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

const DAILY_CUSTOMERS = ['Priya', 'The Duttas', 'Mr. Hale', 'Nadia', 'Sam', 'The Okafors', 'Leo', 'Grandma June', 'The twins', 'Marguerite', 'The Kowalskis', 'Ibrahim'];
const DAILY_ITEMS: { item: string; color: number; line: string; done: string }[] = [
  { item: 'sofa', color: 0xb56be0, line: '“The sofa. It’s a corner sofa. It has opinions.”', done: '“It’s facing the window. That’s where it goes.”' },
  { item: 'wardrobe', color: 0x9a6b3c, line: '“Mind the mirror on the door.”', done: '“Not a scratch. I checked twice.”' },
  { item: 'piano', color: 0x4a4e63, line: '“It was tuned yesterday. Keep it that way.”', done: '“Middle C is still middle C.”' },
  { item: 'fridge', color: 0xb0bad4, line: '“Keep it upright or the compressor sulks.”', done: '“It hums. That’s the good hum.”' },
  { item: 'drum kit', color: 0xe5484d, line: '“The neighbours are watching. Be quick.”', done: '“Quietest the drums have ever been.”' },
  { item: 'aquarium', color: 0x2ec4b6, line: '“Empty. Still fragile. Still heavy.”', done: '“Glass all present. Fish arriving Tuesday.”' },
  { item: 'bookshelf', color: 0x8b5e3c, line: '“Books stay in. That’s the deal.”', done: '“Alphabetical, still. Impressive.”' },
  { item: 'armchair', color: 0x6b8fd6, line: '“Grandfather’s. Treat it like a relative.”', done: '“He’d have approved. Eventually.”' },
];

/** Today's job: one seeded chain of stages, the same for everyone that day. */
export function dailyJob(dayNumber: number, rng: () => number): JobDef {
  const c = DAILY_CUSTOMERS[Math.floor(rng() * DAILY_CUSTOMERS.length)];
  const it = DAILY_ITEMS[Math.floor(rng() * DAILY_ITEMS.length)];
  const cubes = rng() < 0.5 ? 4 : 5;
  const stages: JobDef['stages'] = [{ type: 'load', d: 1 + Math.floor(rng() * 3) }, { type: 'doorway', d: 1 + Math.floor(rng() * 2) }, { type: 'corner', d: 0 }];
  if (rng() < 0.3) stages.splice(2, 0, { type: 'doorway', d: 1 + Math.floor(rng() * 2) });
  return { id: 0, customer: c, line: it.line, done: it.done, item: it.item, cubes, color: it.color, stages, seedKey: `daily${dayNumber}`, daily: true };
}
