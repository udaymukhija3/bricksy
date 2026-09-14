// The product roster: games with their own pages. Sketches and concepts stay in the lab.
import type { SketchDef } from './lab/types';
import { slice } from './lab/slice';
import { fold } from './lab/fold';
import { gravity } from './lab/gravity';
import { mirror } from './lab/mirror';
import { gears } from './lab/gears';
import { smuggler } from './lab/smuggler';

export const PACK: SketchDef = { id: 'pack', title: 'Pack', icon: '📦', status: 'flagship', skill: 'mental rotation', tagline: 'Turn the piece so it drops into the hole. Lives, score, stages.', href: 'pack/' };
export const GAMES: SketchDef[] = [slice, fold, gravity, mirror, gears, smuggler];
