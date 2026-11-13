// Warmth drift and slight decay at dusk (spec 9.4, ADR 0004 item 1; the Mosscoat per ADR 0013
// item 3).
import type { Tuning } from '../tuning.ts';
import type { DailyRule } from './rule.ts';
import { heroMemoryScale } from '../hero.ts';
import { exp2neg } from '../math.ts';
import { byId } from '../world.ts';

/**
 * Both sides of a tie with no meeting today move warmth.dailyDrift of the way toward 0, divided by
 * that side's heroMemoryScale (half for a local's side toward a Mosscoat). No draws.
 */
export const driftWarmth: DailyRule = (world, t) => {
  const drift = t.warmth.dailyDrift;
  for (const tie of world.ties.values()) {
    if (tie.lastDay === world.day) continue;
    tie.ab.warmth *= 1 - drift / heroMemoryScale(world, tie.a, tie.b, t);
    tie.ba.warmth *= 1 - drift / heroMemoryScale(world, tie.b, tie.a, t);
  }
  return [];
};

/** Half-life in days for a creature's slights: memory.halfLifeMinDays + halfLifeSpanDays x Memory. */
function halfLife(memory: number, t: Tuning): number {
  return t.memory.halfLifeMinDays + t.memory.halfLifeSpanDays * memory;
}

/**
 * Each side's slights decay by exp2neg(1 / half-life), using that side owner's Memory, × that
 * side's heroMemoryScale up to 1 (doubled for a local's side toward a Mosscoat). No draws.
 */
export const decaySlights: DailyRule = (world, t) => {
  const memory = (m: number, holder: string, about: string): number =>
    Math.min(1, heroMemoryScale(world, holder, about, t) * m);
  for (const tie of world.ties.values()) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (a) tie.ab.slights *= exp2neg(1 / halfLife(memory(a.dials.memory, tie.a, tie.b), t));
    if (b) tie.ba.slights *= exp2neg(1 / halfLife(memory(b.dials.memory, tie.b, tie.a), t));
  }
  return [];
};
