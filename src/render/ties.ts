// What the Cosmos view, the Soul view, and the timeline share about ties and picking.

/** A pick snaps to the nearest node within this many screen pixels, so a finger works (spec 12.4). */
export const SNAP_PIXELS = 44;

export type TieKind = 'friend' | 'scar';

/** A friend when both warmths are above `threshold`, a scar when either is below 0, else null. */
export function tieKind(ab: number, ba: number, threshold: number): TieKind | null {
  if (ab > threshold && ba > threshold) return 'friend';
  return ab < 0 || ba < 0 ? 'scar' : null;
}

/** The id of the node nearest (x, y) within `radius`, or null. */
export function nearestNode(
  nodes: readonly { id: string; x: number; y: number }[],
  x: number,
  y: number,
  radius: number,
): string | null {
  let best: string | null = null;
  let bestD = radius;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}
