// The festival dance spread (ADR 0012 item 6).
import type { SimEvent, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { friendsOf } from './world.ts';

/**
 * Every awake creature that is not dancing starts when at least its danceThreshold (default
 * festival.threshold) of its friends dance. All counts come from the dancers before this call,
 * so array order does not matter. No draws.
 */
export function spreadDance(world: World, t: Tuning): SimEvent[] {
  const starting = world.creatures.filter(
    (c) =>
      !c.dancing &&
      c.state !== 'away' &&
      c.state !== 'sleep' &&
      friendsOf(world, c, t).filter((f) => f.dancing).length >= (c.danceThreshold ?? t.festival.threshold),
  );
  return starting.map((c) => {
    c.dancing = true;
    return { t: 'dance', who: c.id };
  });
}
