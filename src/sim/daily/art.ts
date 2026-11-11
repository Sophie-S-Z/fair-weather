// Art at dusk (spec 9.4, ADR 0004 item 10).
import type { SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { activeCreatures, averageWarmth } from '../world.ts';

const KINDS = ['stack', 'spiral', 'chime'] as const;

/**
 * A dusk qualifies when average warmth is above art.minWarmth and the mean berries carried per
 * active creature is above art.minBerries; a dusk that does not resets the streak. From the
 * art.days-th qualifying dusk in a row, one creature makes one piece each dusk.
 *
 * PRNG draws, only on an art dusk: the maker (pick over active creatures in array order), then
 * the kind (pick over [stack, spiral, chime]).
 */
export function makeArt(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const active = activeCreatures(world);
  let berries = 0;
  for (const c of active) berries += c.berries;
  const perCreature = active.length === 0 ? 0 : berries / active.length;
  const qualifies = averageWarmth(world) > t.art.minWarmth && perCreature > t.art.minBerries;
  world.artStreak = qualifies ? world.artStreak + 1 : 0;
  if (world.artStreak < t.art.days) return [];
  const who = rng.pick(active);
  const kind = rng.pick(KINDS);
  return [{ t: 'art', who: who.id, kind }];
}
