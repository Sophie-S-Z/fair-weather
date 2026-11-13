// The rules of the interlude activities (spec 6.4), apart from their components. A sketch or a
// path is a flat list of points: x0, y0, x1, y1, and so on.
import type { WorldLite } from '../../sim-host/protocol.ts';

/** The four rhythms to tap at the Door for Two: 1 is a tap and 0 a rest, four beats each. */
export const RHYTHMS: readonly (readonly number[])[] = [
  [1, 0, 1, 0],
  [1, 1, 0, 1],
  [1, 0, 1, 1],
  [1, 1, 1, 0],
];

/** The one rhythm index both sides of the door accept, or -1 when they share none. */
export function sharedRhythm(left: readonly number[], right: readonly number[]): number {
  return left.find((i) => right.includes(i)) ?? -1;
}

/** The most one copy moves a coordinate, in sketch units (spec 6.4). */
const DRIFT = 3;

/** A fixed hash of (generation, index) mapped onto -DRIFT to DRIFT: the same every time, no rng. */
function drift(generation: number, index: number): number {
  let h = Math.imul(generation, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 * DRIFT - DRIFT;
}

/**
 * The sketch after `generation` copies: each copy moves each coordinate by drift(copy, index), so
 * the drift adds up from copy to copy. Generation 0 is the sketch itself.
 */
export function copySketch(points: readonly number[], generation: number): number[] {
  return points.map((p, i) => {
    let v = p;
    for (let g = 1; g <= generation; g++) v += drift(g, i);
    return v;
  });
}

/** The share of the path's points with a visited point within `tolerance`; 0 for an empty path. */
export function traceProgress(
  path: readonly number[],
  visited: readonly number[],
  tolerance: number,
): number {
  const n = Math.floor(path.length / 2);
  if (n === 0) return 0;
  let near = 0;
  for (let i = 0; i < n; i++) {
    const x = path[2 * i] ?? 0;
    const y = path[2 * i + 1] ?? 0;
    for (let j = 0; j + 1 < visited.length; j += 2) {
      if (Math.hypot((visited[j] ?? 0) - x, (visited[j + 1] ?? 0) - y) <= tolerance) {
        near += 1;
        break;
      }
    }
  }
  return near / n;
}

/** Whether a sleeper's dream bubble pops: Old Moss's will not (spec 6.4). */
export function poppable(id: string): boolean {
  return id !== 'moss';
}

/** The most dream bubbles that float at once. */
const MAX_DREAMERS = 6;

/**
 * The creatures whose grudge floats as a dream bubble: sleepers with a scar (a tie with a warmth
 * below 0), coldest tie first, then cast order, at most six. Moss with a scar always has a bubble,
 * asleep or not, in the last place if it is not colder (spec 6.4: its bubble will not pop).
 */
export function dreamers(lite: {
  creatures: readonly Pick<WorldLite['creatures'][number], 'id' | 'state' | 'gone'>[];
  ties: WorldLite['ties'];
}): string[] {
  const coldest = new Map<string, number>();
  for (const t of lite.ties) {
    const w = Math.min(t.ab, t.ba);
    for (const id of [t.a, t.b]) coldest.set(id, Math.min(w, coldest.get(id) ?? 0));
  }
  const scarred = lite.creatures.filter((c) => !c.gone && (coldest.get(c.id) ?? 0) < 0);
  // A stable sort, so cast order breaks a tie.
  const ranked = scarred
    .filter((c) => c.state === 'sleep')
    .sort((a, b) => (coldest.get(a.id) ?? 0) - (coldest.get(b.id) ?? 0))
    .map((c) => c.id)
    .slice(0, MAX_DREAMERS);
  const moss = scarred.find((c) => !poppable(c.id));
  if (moss && !ranked.includes(moss.id)) ranked.splice(Math.min(ranked.length, MAX_DREAMERS - 1), 1, moss.id);
  return ranked;
}
