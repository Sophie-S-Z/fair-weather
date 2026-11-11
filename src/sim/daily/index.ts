// The dusk pass: every daily rule in ADR 0004 item 1 order, then the day rises.
import type { SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { makeArt } from './art.ts';
import { decaySlights, driftWarmth } from './drift.ts';
import { eat } from './eat.ts';
import { gossip } from './gossip.ts';
import { imitate } from './imitation.ts';
import { leave, newcomer, regrowBushes, returnAway } from './population.ts';
import { updateShells } from './shells.ts';

/** One daily rule. Rules that take no draws ignore `rng`. */
export type DailyRule = (world: World, t: Tuning, rng: Rng) => SimEvent[];

// ADR 0004 item 1. Imitation and return check their own day.
const RULES: readonly DailyRule[] = [
  gossip,
  eat,
  updateShells,
  leave,
  newcomer,
  regrowBushes,
  driftWarmth,
  decaySlights,
  imitate,
  returnAway,
  makeArt,
];

/** Runs all daily rules, expires boosts, resets each creature's light sky warmth for the day, and raises `day`. */
export function runDusk(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  for (const rule of RULES) events.push(...rule(world, t, rng));
  const newDay = world.day + 1;
  world.boosts = world.boosts.filter((b) => b.untilDay >= newDay);
  for (const c of world.creatures) c.skyLightToday = 0;
  world.day = newDay;
  return events;
}
