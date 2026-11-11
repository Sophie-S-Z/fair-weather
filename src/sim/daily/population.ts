// Population at dusk: leave, newcomer, bush regrowth, and return (spec 9.4, ADR 0004 items 4, 5, 7).
import type { SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import type { DailyRule } from './rule.ts';
import { clamp } from '../math.ts';
import { activeCreatures, averageWarmth, friendCount, newCreature } from '../world.ts';

/**
 * A creature with population.leaveHungryDusks hungry dusks in a row and fewer than
 * population.leaveMinFriends friends goes away and keeps its memory. Friend counts are read
 * before anyone leaves. No draws.
 */
export const leave: DailyRule = (world, t) => {
  const { leaveHungryDusks, leaveMinFriends } = t.population;
  const leaving = activeCreatures(world).filter(
    (c) => c.hungryDusks >= leaveHungryDusks && friendCount(world, c, t) < leaveMinFriends,
  );
  return leaving.map((c) => {
    c.state = 'away';
    c.vx = 0;
    c.vy = 0;
    return { t: 'leave', who: c.id };
  });
};

/**
 * At most one newcomer arrives at the gate when spare berries (bush total per active creature,
 * or the bush total with none) exceed population.newcomerSparePerCreature and the creature count
 * (away included, since they may return) is below cap.story. No draws.
 */
export const newcomer: DailyRule = (world, t) => {
  let total = 0;
  for (const b of world.bushes) total += b.berries;
  const active = activeCreatures(world).length;
  const spare = active === 0 ? total : total / active;
  if (spare <= t.population.newcomerSparePerCreature || world.creatures.length >= t.cap.story) return [];
  const n = world.nextId;
  const d = t.population.newcomerDial;
  world.nextId += 1;
  const c = newCreature({
    id: `newcomer-${String(n)}`,
    speciesId: t.population.newcomerSpecies,
    name: `Newcomer ${String(n)}`,
    x: t.scene.gateX,
    y: t.scene.gateY,
    berries: 0,
    dials: { opener: d, forgiveness: d, memory: d, ear: d, wanderlust: d },
  });
  world.creatures.push(c);
  return [{ t: 'arrive', who: c.id }];
};

/** Logistic regrowth plus a base, clamped to [0, bush.limit] (ADR 0004 item 4). No draws. */
export const regrowBushes: DailyRule = (world, t) => {
  const { growth, limit, base } = t.bush;
  for (const b of world.bushes) {
    b.berries = clamp(b.berries + growth * b.berries * (1 - b.berries / limit) + base, 0, limit);
  }
  return [];
};

/**
 * On every population.returnEveryDays-th dusk (day % returnEveryDays === returnEveryDays - 1),
 * when average warmth is above population.returnMinAvgWarmth, each away creature returns at the
 * gate with chance population.returnChanceWeekly, its hunger count reset.
 *
 * PRNG draws: one per away creature, in `world.creatures` order, only when the day and the
 * warmth both qualify. Average warmth is read once, before anyone returns.
 */
export function returnAway(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const { returnEveryDays, returnChanceWeekly, returnMinAvgWarmth } = t.population;
  if (world.day % returnEveryDays !== returnEveryDays - 1) return [];
  if (averageWarmth(world) <= returnMinAvgWarmth) return [];
  const events: SimEvent[] = [];
  for (const c of world.creatures.filter((x) => x.state === 'away')) {
    if (rng.next() >= returnChanceWeekly) continue;
    c.state = 'wander';
    c.x = c.goalX = t.scene.gateX;
    c.y = c.goalY = t.scene.gateY;
    c.vx = 0;
    c.vy = 0;
    c.hungryDusks = 0;
    events.push({ t: 'return', who: c.id });
  }
  return events;
}
