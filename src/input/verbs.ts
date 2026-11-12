// Input-side verb helpers. The Verb types live in story/verbs.ts.
import { WORLD_VERBS } from '../story/verbs.ts';
import type { Rect } from '../sim/types.ts';
import type { Verb, WorldVerb } from '../story/verbs.ts';

export type Point = { x: number; y: number };
export type BenchSpot = Point & { id: string };

const WORLD_VERB_SET: ReadonlySet<Verb> = new Set(WORLD_VERBS);

/**
 * Keys 1 to 3 pick tools: the world verbs only, of which a chapter has at most three (ADR 0012
 * item 8). `bet` is the bet card, and listen and the mind verbs are never tools.
 */
export function keyboardTools(unlocked: readonly Verb[]): WorldVerb[] {
  return unlocked.filter((v): v is WorldVerb => WORLD_VERB_SET.has(v));
}

/** The bench spot nearest to (x, y), or the point itself when the scene has no bench spots. */
export function snapToBench(p: Point, spots: readonly BenchSpot[]): Point {
  let best: Point = p;
  let bestD = Infinity;
  for (const s of spots) {
    const d = (s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = { x: s.x, y: s.y };
    }
  }
  return best;
}

/** The point clamped into the nearest water rectangle, or null with no water. */
export function snapToWater(p: Point, water: readonly Rect[]): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const r of water) {
    const x = Math.min(Math.max(p.x, r.x), r.x + r.w);
    const y = Math.min(Math.max(p.y, r.y), r.y + r.h);
    const d = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}
