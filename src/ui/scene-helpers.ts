// What the game and sandbox screens share about the scene: the creature and bench spot near a
// point, whom a whisper can be about, the cursor's bounds, and the pause toggle.
import type { WorldLite } from '../sim-host/protocol.ts';

type Point = { x: number; y: number };
type Creature = Pick<WorldLite['creatures'][number], 'id' | 'x' | 'y' | 'state' | 'gone'>;

/** Orders by id in code unit order, as Tab picks creatures. */
export const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** The creature not away whose feet are nearest `p`, within `near` scene units, or null. */
export function nearestCreature(creatures: readonly Creature[], p: Point, near: number): string | null {
  let best: string | null = null;
  let bestD = near;
  for (const c of creatures) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (c.state !== 'away' && d <= bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

/** Whom a whisper to `target` can be about: every other named creature (spec 5.3) not gone, in id order. */
export function whisperOthers(
  creatures: readonly Creature[],
  target: string,
  castIds: readonly string[],
): string[] {
  return creatures
    .filter((c) => !c.gone && c.id !== target && castIds.includes(c.id))
    .map((c) => c.id)
    .sort();
}

/** `p` kept inside the scene, edges included. */
export function clampToScene(p: Point, size: { width: number; height: number }): Point {
  return { x: Math.min(size.width, Math.max(0, p.x)), y: Math.min(size.height, Math.max(0, p.y)) };
}

/** The name of the bench spot nearest `p`, in words ("east meadow"), or '' with none. */
export function spotName(spots: readonly (Point & { id: string })[], p: Point): string {
  let best = '';
  let bestD = Infinity;
  for (const s of spots) {
    const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s.id.replace(/-/g, ' ');
    }
  }
  return best;
}

/** The status line for a tool that acts at the cursor: the spot, and the creature near it. */
export const spotLine = (spot: string, nearby: string | null): string =>
  `Spot near: ${spot}${nearby === null ? '' : `, by ${nearby}`}`;

/** A toggle that pauses the sim, and then resumes it at the speed it paused from (1x at first). */
export function createPauseToggle(current: () => number, set: (multiplier: number) => void): () => void {
  let unpause = 1;
  return () => {
    const now = current();
    if (now > 0) {
      unpause = now;
      set(0);
    } else set(unpause);
  };
}
