// The hero's tie as the packs read and change it. world.ts and hero.ts import packs/index.ts, so a
// pack cannot import them; these are their rules, written out once here for every pack.
import type { Creature, Side, Tie, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { clamp } from '../math.ts';

/** True when `c` is the hero of a world that has one: hero.ts isHero. */
export function isHero(world: World, c: Creature): boolean {
  return world.hero !== undefined && c.id === HERO;
}

/** The key of `id`'s tie with the hero: world.ts tieKey. */
function heroKey(id: string): string {
  return id < HERO ? `${id}|${HERO}` : `${HERO}|${id}`;
}

/** `id`'s warmth toward the hero, 0 with no tie. */
export function warmthTowardHero(world: World, id: string): number {
  const tie = world.ties.get(heroKey(id));
  return tie ? (tie.a === id ? tie.ab : tie.ba).warmth : 0;
}

/**
 * `c`'s side of its tie with the hero, made as world.ts ensureTie(world, c, hero) makes it when
 * there is none.
 */
export function heroSide(world: World, c: Creature, hero: Creature, t: Tuning): Side {
  const key = heroKey(c.id);
  let tie = world.ties.get(key);
  if (!tie) {
    const start = (x: Creature, y: Creature): Side => ({
      warmth: clamp((x.opinions[y.id] ?? 0) * t.opinion.weight, -1, 1),
      slights: 0,
    });
    const made: Tie = { a: c.id, b: HERO, ab: start(c, hero), ba: start(hero, c), meetings: 0, lastDay: -1 };
    world.ties.set(key, made);
    tie = made;
  }
  return tie.a === c.id ? tie.ab : tie.ba;
}
