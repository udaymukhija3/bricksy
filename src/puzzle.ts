import {
  applyMoves, bboxMin, isPlanar, normalize, orientations, randomPolycube, shapeKey,
  type Cell, type Move,
} from './polycube.ts';

export interface Level {
  id: number;
  name: string;
  hint: string;
  /** Minimum number of quarter-turns needed (exact shortest-path distance). */
  distance: number;
  cubes: number;
  /** Colour one cube distinctly so it can be tracked through the turn. */
  marker: boolean;
  /** Randomise the viewpoint per puzzle so screen-space memorisation stops working. */
  randomCamera: boolean;
  nonPlanar: boolean;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'One turn', hint: 'One quarter-turn about X, Y or Z.', distance: 1, cubes: 4, marker: true, randomCamera: false, nonPlanar: false },
  { id: 2, name: 'Two turns', hint: 'Two quarter-turns. Compose them in your head before you commit.', distance: 2, cubes: 4, marker: true, randomCamera: false, nonPlanar: false },
  { id: 3, name: 'No marker', hint: 'Five cubes, no marker cube. Track the whole shape.', distance: 2, cubes: 5, marker: false, randomCamera: false, nonPlanar: true },
  { id: 4, name: 'New viewpoint', hint: 'The camera moves every puzzle. Read the axes off the gizmo, not the screen.', distance: 2, cubes: 5, marker: false, randomCamera: true, nonPlanar: true },
  { id: 5, name: 'Three turns', hint: 'Three quarter-turns from a moving viewpoint.', distance: 3, cubes: 5, marker: false, randomCamera: true, nonPlanar: true },
];

export interface CameraPose { azimuth: number; elevation: number }
export const DEFAULT_POSE: CameraPose = { azimuth: 38, elevation: 26 };

export interface Puzzle {
  id: string;
  level: Level;
  seed: number;
  start: Cell[];
  target: Cell[];
  /** One shortest sequence; the player may find a different one of the same orientation. */
  solution: Move[];
  distance: number;
  markerStart: number;
  markerTarget: number;
  pose: CameraPose;
}

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate a puzzle for a level. `accept` lets the caller reject candidates on
 * criteria the pure model cannot see (e.g. a cube hidden from the camera).
 */
export function makePuzzle(level: Level, seed: number, rng: () => number, accept: (p: Puzzle) => boolean): Puzzle {
  let last: Puzzle | null = null;
  for (let tries = 0; tries < 400; tries++) {
    const start = randomPolycube(level.cubes, rng);
    if (level.nonPlanar && isPlanar(start)) continue;
    const os = orientations(start);
    if (os.length !== 24) continue; // symmetric shapes make the target ambiguous

    const maxD = Math.max(...os.map((o) => o.dist));
    const distance = Math.min(level.distance, maxD);
    const cands = os.filter((o) => o.dist === distance);
    const pick = cands[Math.floor(rng() * cands.length)];

    const rotated = applyMoves(start, pick.path);
    const min = bboxMin(rotated);
    const target = normalize(rotated);
    const markerStart = level.marker ? Math.floor(rng() * start.length) : -1;
    let markerTarget = -1;
    if (markerStart >= 0) {
      const mc = rotated[markerStart];
      markerTarget = target.findIndex(
        (c) => c[0] === mc[0] - min[0] && c[1] === mc[1] - min[1] && c[2] === mc[2] - min[2],
      );
    }
    const pose: CameraPose = level.randomCamera
      ? { azimuth: 90 * Math.floor(rng() * 4) + 15 + rng() * 60, elevation: 14 + rng() * 32 }
      : DEFAULT_POSE;

    last = {
      id: fnv(`${shapeKey(start)}|${shapeKey(target)}|${pose.azimuth.toFixed(1)}`),
      level, seed, start, target, solution: pick.path, distance, markerStart, markerTarget, pose,
    };
    if (accept(last) || tries > 300) return last;
  }
  if (last) return last;
  throw new Error('could not generate a puzzle');
}
