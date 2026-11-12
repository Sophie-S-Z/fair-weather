// Input-side verb helpers. The Verb types live in story/verbs.ts.
import type { Verb } from '../story/verbs.ts';

export type Point = { x: number; y: number };
export type BenchSpot = Point & { id: string };

/** Keys 1 to 3 pick tools. `bet` is the bet card (UI, M1.8), so it is never a keyboard tool. */
export function keyboardTools(unlocked: readonly Verb[]): Verb[] {
  return unlocked.filter((v) => v !== 'bet').slice(0, 3);
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
