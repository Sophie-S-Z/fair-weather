// Ambient sky bids at dusk (ADR 0012 item 4).
import type { Creature } from '../types.ts';
import type { DailyRule } from './rule.ts';

/**
 * In a world with ambientSkyBids, with chance sky.ambientBidChance, the awake creature with the
 * highest sky warmth (a tie goes to the lower id) bids to the sky. The story director answers it.
 *
 * PRNG draws: one, only when world.ambientSkyBids is set, even with nobody awake.
 */
export const ambientSkyBid: DailyRule = (world, t, rng) => {
  if (!world.ambientSkyBids || rng.next() >= t.sky.ambientBidChance) return [];
  let best: Creature | undefined;
  for (const c of world.creatures) {
    if (c.state === 'away' || c.state === 'sleep') continue;
    if (!best || c.skyWarmth > best.skyWarmth || (c.skyWarmth === best.skyWarmth && c.id < best.id)) best = c;
  }
  return best ? [{ t: 'skyBid', who: best.id, ambient: true }] : [];
};
