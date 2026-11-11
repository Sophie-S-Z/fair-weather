// Whole-world metrics the story reads (ADR 0011 item 3).
import type { World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { byCodeUnit } from './math.ts';
import { averageWarmth, byId, side } from './world.ts';

export type MetricSpec = { kind: 'maxBerries' } | { kind: 'averageWarmth' } | { kind: 'friendPairs' };

/**
 * maxBerries: the id of the creature with the most berries (ties go to the lower id, by code unit;
 * '' with no creatures). averageWarmth: mean tie warmth. friendPairs: ties where both sides are
 * above friend.threshold and neither creature is away.
 */
export function metric(world: World, m: MetricSpec, tuning: Tuning): string | number {
  switch (m.kind) {
    case 'maxBerries': {
      let best: { id: string; berries: number } | undefined;
      for (const c of world.creatures) {
        if (
          !best ||
          c.berries > best.berries ||
          (c.berries === best.berries && byCodeUnit(c.id, best.id) < 0)
        ) {
          best = c;
        }
      }
      return best?.id ?? '';
    }
    case 'averageWarmth':
      return averageWarmth(world);
    case 'friendPairs':
      return friendPairs(world, tuning);
  }
}

/** Ties where both sides are above friend.threshold and neither creature is away. */
export function friendPairs(world: World, tuning: Tuning): number {
  let n = 0;
  for (const tie of world.ties.values()) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (!a || !b || a.state === 'away' || b.state === 'away') continue;
    if (side(tie, a.id).warmth > tuning.friend.threshold && side(tie, b.id).warmth > tuning.friend.threshold)
      n++;
  }
  return n;
}
