// Gossip at dusk (spec 9.4, ADR 0002 items 5 and 6).
import type { Creature, SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { activeCreatures, friendsOf } from '../world.ts';

/** True when `c` holds an opinion of `about` with this sign (ADR 0002 item 5). */
export function holds(c: Creature, about: string, sign: 1 | -1, t: Tuning): boolean {
  const v = c.opinions[about];
  return v !== undefined && Math.abs(v) >= t.opinion.holdAt && Math.sign(v) === sign;
}

/** The held opinion with the largest absolute value about neither the sharer nor the listener; ties go to the lower id. */
function opinionToShare(
  sharer: Creature,
  listener: Creature,
  t: Tuning,
): { about: string; sign: 1 | -1 } | null {
  let best: string | null = null;
  let bestAbs = 0;
  for (const [about, v] of Object.entries(sharer.opinions)) {
    if (about === listener.id || about === sharer.id) continue;
    const a = Math.abs(v);
    if (a < t.opinion.holdAt) continue;
    if (best === null || a > bestAbs || (a === bestAbs && about < best)) {
      best = about;
      bestAbs = a;
    }
  }
  if (best === null) return null;
  return { about: best, sign: (sharer.opinions[best] ?? 0) < 0 ? -1 : 1 };
}

function compareShares(x: { about: string; sign: number }, y: { about: string; sign: number }): number {
  if (x.about !== y.about) return x.about < y.about ? -1 : 1;
  return y.sign - x.sign; // positive before negative
}

/**
 * Each active creature shares one opinion with each of its friends. All shares and adoptions
 * are decided from the opinions held before this dusk, then applied, so creature order does not
 * change who hears what. A listener that already holds the same sign keeps its own value.
 *
 * PRNG draws: listeners in `world.creatures` order; for each listener, the opinions it hears in
 * order of subject id (code units), positive before negative; for each such opinion whose
 * subject the listener has not already adopted this dusk, that the listener does not already
 * hold with that sign, and that at least one of its friends holds,
 * when the listener's Ear is below gossip.simpleEarBelow, one draw per holder among its friends,
 * in id order. Complex contagion takes no draws. A listener adopts at most one opinion per
 * subject: the first that succeeds.
 */
export function gossip(world: World, t: Tuning, rng: Rng): SimEvent[] {
  const active = activeCreatures(world);
  const heard = new Map<Creature, { about: string; sign: 1 | -1 }[]>();
  for (const sharer of active) {
    for (const listener of friendsOf(world, sharer, t)) {
      const share = opinionToShare(sharer, listener, t);
      if (!share) continue;
      const list = heard.get(listener) ?? [];
      if (!list.some((s) => s.about === share.about && s.sign === share.sign)) list.push(share);
      heard.set(listener, list);
    }
  }

  const adopted: { holder: Creature; about: string; value: number }[] = [];
  for (const listener of active) {
    const shares = heard.get(listener);
    if (!shares) continue;
    shares.sort(compareShares);
    const friends = friendsOf(world, listener, t);
    const done = new Set<string>();
    for (const { about, sign } of shares) {
      const holders = friends.filter((f) => holds(f, about, sign, t));
      if (done.has(about) || holds(listener, about, sign, t) || holders.length === 0) continue;
      let takes = false;
      if (listener.dials.ear < t.gossip.simpleEarBelow) {
        for (let i = 0; i < holders.length; i++) {
          if (rng.next() < t.gossip.simpleChance) takes = true;
        }
      } else {
        takes = holders.length / friends.length >= listener.dials.ear;
      }
      if (!takes) continue;
      done.add(about);
      let sum = 0;
      for (const h of holders) sum += h.opinions[about] ?? 0;
      adopted.push({ holder: listener, about, value: sum / holders.length });
    }
  }

  return adopted.map(({ holder, about, value }) => {
    holder.opinions[about] = value;
    return { t: 'opinion', holder: holder.id, about, value };
  });
}
