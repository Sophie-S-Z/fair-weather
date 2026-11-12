// The zoom verb (spec 8, 12.2): Cosmos, Meadow, and Soul, from far to near.

export type ViewName = 'cosmos' | 'meadow' | 'soul';

/**
 * The view after one zoom step. Out goes Soul to Meadow to Cosmos; in goes Cosmos to Meadow, and
 * Meadow to Soul only when a creature is picked, since the Soul view is that creature's.
 */
export function nextView(current: ViewName, dir: 'in' | 'out', picked: string | null): ViewName {
  if (dir === 'out') return current === 'soul' ? 'meadow' : 'cosmos';
  if (current === 'cosmos') return 'meadow';
  return current === 'meadow' && picked === null ? 'meadow' : 'soul';
}
