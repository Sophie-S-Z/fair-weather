// The dusk pass: every daily rule in ADR 0004 item 1 order, then the day rises.
import type { SimEvent, World } from '../types.ts';
import { SEASONS } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import type { DailyRule } from './rule.ts';
import { makeArt } from './art.ts';
import { decaySlights, driftWarmth } from './drift.ts';
import { eat } from './eat.ts';
import { gossip } from './gossip.ts';
import { imitate } from './imitation.ts';
import { mushroomDawn } from './mushroom.ts';
import { leave, newcomer, regrowBushes, returnAway } from './population.ts';
import { updateShells } from './shells.ts';
import { ambientSkyBid } from './sky-bid.ts';

// ADR 0004 item 1, then the ADR 0012 rules. Imitation and return check their own day.
const RULES: readonly DailyRule[] = [
  gossip,
  eat,
  updateShells,
  leave,
  newcomer,
  regrowBushes,
  mushroomDawn,
  driftWarmth,
  decaySlights,
  imitate,
  returnAway,
  makeArt,
  ambientSkyBid,
];

/**
 * Runs all daily rules, expires boosts, resets each creature's light sky warmth for the day, and
 * raises `day`. With `seasonDays`, the season then turns to the next in SEASONS order (thaw to
 * spring) when the new day is a multiple of it (ADR 0014 item 4). No draw of its own.
 */
export function runDusk(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  for (const rule of RULES) events.push(...rule(world, t, rng));
  const newDay = world.day + 1;
  world.boosts = world.boosts.filter((b) => b.untilDay >= newDay);
  for (const c of world.creatures) c.skyLightToday = 0;
  world.day = newDay;
  if (world.seasonDays !== undefined && newDay % world.seasonDays === 0) {
    world.season = SEASONS[(SEASONS.indexOf(world.season) + 1) % SEASONS.length] ?? world.season;
  }
  return events;
}
