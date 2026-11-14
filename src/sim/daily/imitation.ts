// Imitation every imitation.everyDays dusks (spec 9.4, ADR 0004 item 8).
import type { Creature, DialKey, SimEvent, World } from '../types.ts';
import { DIAL_KEYS } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { createGrid } from '../grid.ts';
import { isHero } from '../hero.ts';
import { friendCount } from '../world.ts';

/**
 * On dusks where day % everyDays === everyDays - 1, each active creature compares itself with one
 * random active neighbor within imitation.radius. When the neighbor is fitter (berries +
 * friendWeight x friends), it copies one random dial with chance imitation.rate. Fitness and
 * dials are read before any copy is applied, so creature order does not matter. The hero neither
 * copies nor is copied (ADR 0013 item 1): it is nobody's neighbor.
 *
 * PRNG draws, per active creature in `world.creatures` order: a neighbor pick (from neighbors in
 * ascending index order; none when there are no neighbors); when the neighbor is fitter, the
 * chance draw; when that copies, a dial pick over [opener, forgiveness, memory, ear, wanderlust].
 */
export function imitate(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const { everyDays, radius, rate, friendWeight } = t.imitation;
  if (world.day % everyDays !== everyDays - 1) return [];
  const cs = world.creatures;
  const grid = createGrid(t.scene.width, t.scene.height, radius);
  grid.rebuild(
    cs.map((c) => c.x),
    cs.map((c) => c.y),
    cs.length,
  );
  const fitness = new Map<Creature, number>();
  for (const c of cs) {
    if (c.state !== 'away' && !isHero(world, c)) {
      fitness.set(c, c.berries + friendWeight * friendCount(world, c, t));
    }
  }
  const copies: { who: Creature; from: Creature; dial: DialKey; value: number }[] = [];
  const near: number[] = [];
  cs.forEach((c, i) => {
    const own = fitness.get(c);
    if (own === undefined) return;
    const neighbors: Creature[] = [];
    for (const j of grid.query(c.x, c.y, radius, near)) {
      const o = cs[j];
      if (j !== i && o && fitness.has(o)) neighbors.push(o);
    }
    if (neighbors.length === 0) return;
    const n = rng.pick(neighbors);
    if ((fitness.get(n) ?? 0) <= own) return;
    if (rng.next() >= rate) return;
    const dial = rng.pick(DIAL_KEYS);
    copies.push({ who: c, from: n, dial, value: n.dials[dial] });
  });
  return copies.map(({ who, from, dial, value }) => {
    who.dials[dial] = value;
    return { t: 'imitate', who: who.id, from: from.id, dial };
  });
}
