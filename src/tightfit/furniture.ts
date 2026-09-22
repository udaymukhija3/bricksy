import { normalize, type Cell } from '../polycube.ts';

// Small, hand-shaped pieces. Their unit cells are the padded furniture's collision volume.
// Every model is connected and asymmetric, so an orientation puzzle has one fitting pose.
const SHAPES: Record<string, Cell[]> = {
  lamp: [[0,0,0],[1,0,0],[0,1,0],[0,2,0]],
  bookshelf: [[0,0,0],[0,1,0],[0,2,0],[1,0,0]],
  armchair: [[0,0,0],[1,0,0],[0,0,1],[1,0,1],[0,1,0]],
  fridge: [[0,0,0],[0,1,0],[0,2,0],[1,0,0]],
  'drum kit': [[0,0,0],[1,0,0],[0,0,1],[0,1,0],[2,0,0]],
  piano: [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0]],
  aquarium: [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[0,0,1]],
  wardrobe: [[0,0,0],[0,1,0],[0,2,0],[1,0,0],[1,1,0]],
  'bunk bed': [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0]],
  'brass telescope': [[0,0,0],[0,1,0],[0,2,0],[1,2,0],[1,2,1]],
  sofa: [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[0,0,1]],
};

export function furnitureCells(name: string): Cell[] | undefined {
  return SHAPES[name] ? normalize(SHAPES[name]) : undefined;
}

export const FURNITURE_NAMES = Object.keys(SHAPES);
