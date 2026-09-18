// Pure doorway/wall model shared by the Smuggle game and Tight Fit's doorway stage.
import { extents, normalize, type Cell } from './polycube.ts';

export const PLATE = 8, MARGIN = 2, GAP = 7;

export const silhouette = (cells: Cell[]) => new Set(cells.map(([x, y]) => `${x},${y}`));

/** Where a normalised silhouette sits in the plate: centred, rounded to the lattice. */
export function placeSil(cells: Cell[]) {
  const n = normalize(cells);
  const [w, hgt] = extents(n);
  const ox = MARGIN + Math.round((PLATE - 2 * MARGIN - 1 - w) / 2);
  const oy = MARGIN + Math.round((PLATE - 2 * MARGIN - 1 - hgt) / 2);
  return { ox, oy, keys: new Set(n.map(([x, y]) => `${x + ox},${y + oy}`)) };
}

export interface Wall { opening: Set<string>; plate: Cell[]; z: number }

export const passes = (cells: Cell[], wall: Wall) => [...placeSil(cells).keys].every((k) => wall.opening.has(k));

/** Plate cells for an opening. */
export function plateFor(opening: Set<string>): Cell[] {
  const plate: Cell[] = [];
  for (let x = 0; x < PLATE; x++) for (let y = 0; y < PLATE; y++) if (!opening.has(`${x},${y}`)) plate.push([x, y, 0]);
  return plate;
}
