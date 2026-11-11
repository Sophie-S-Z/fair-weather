// Warmth drift and slight decay at dusk (spec 9.4, ADR 0004 item 1).
import type { Tuning } from '../tuning.ts';
import type { DailyRule } from './rule.ts';
import { exp2neg } from '../math.ts';
import { byId } from '../world.ts';

/** Both sides of a tie with no meeting today move warmth.dailyDrift of the way toward 0. No draws. */
export const driftWarmth: DailyRule = (world, t) => {
  const keep = 1 - t.warmth.dailyDrift;
  for (const tie of world.ties.values()) {
    if (tie.lastDay === world.day) continue;
    tie.ab.warmth *= keep;
    tie.ba.warmth *= keep;
  }
  return [];
};

/** Half-life in days for a creature's slights: memory.halfLifeMinDays + halfLifeSpanDays x Memory. */
function halfLife(memory: number, t: Tuning): number {
  return t.memory.halfLifeMinDays + t.memory.halfLifeSpanDays * memory;
}

/** Each side's slights decay by exp2neg(1 / half-life), using that side owner's Memory. No draws. */
export const decaySlights: DailyRule = (world, t) => {
  for (const tie of world.ties.values()) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (a) tie.ab.slights *= exp2neg(1 / halfLife(a.dials.memory, t));
    if (b) tie.ba.slights *= exp2neg(1 / halfLife(b.dials.memory, t));
  }
  return [];
};
