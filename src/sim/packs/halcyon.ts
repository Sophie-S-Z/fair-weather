// Halcyon (ADR 0013 item 7): gifts cost nothing and warm by a fifth, a keepsake from the hero warms
// its receiver toward the hero, and the seeker, Wisp, chooses once at a dusk to go home or stay.
// There is no fog code: a world starts with none and only `paintFog` adds it, so the scenario keeps
// it clear, and keeps winter out with its season. Nothing here draws.
import type { Creature, HalcyonState, Side, Tie, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { clamp, dist2 } from '../math.ts';
import type { RulePack } from './index.ts';

function halcyonOf(world: World): HalcyonState | undefined {
  return world.pack?.id === 'halcyon' ? world.pack : undefined;
}

/** The key of `id`'s tie with the hero: world.ts tieKey, written out (see heroSide). */
function heroKey(id: string): string {
  return id < HERO ? `${id}|${HERO}` : `${HERO}|${id}`;
}

/**
 * `c`'s side of its tie with the hero, made as world.ts ensureTie(world, c, hero) makes it when
 * there is none. It is written out, as fen.ts and hollow.ts write out the hero test, since world.ts
 * imports packs/index.ts and importing it here would make an import cycle.
 */
function heroSide(world: World, c: Creature, hero: Creature, t: Tuning): Side {
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

/**
 * The seeker's choice (ADR 0013 item 7, spec 7.4): home when its warmth toward the hero is at
 * least wisp.minWarmth and Kith's is at least wisp.minKithWarmth, else stay.
 */
function choose(world: World, h: HalcyonState, t: Tuning): 'home' | 'stay' {
  const tie = world.ties.get(heroKey(h.seeker));
  const warmth = tie ? (tie.a === h.seeker ? tie.ab : tie.ba).warmth : 0;
  return warmth >= t.wisp.minWarmth && h.kithWarmth >= t.wisp.minKithWarmth ? 'home' : 'stay';
}

export const halcyon: RulePack = {
  id: 'halcyon',

  /** Nothing to set up: createWorld copies the scenario's Kith warmth and seeker. No draws. */
  setup(): void {},

  /**
   * On the last tick of a day, the seeker chooses once: at the first dusk after it is given a
   * keepsake, or else at the third dusk, within halcyon.chooseByDay days (ADR 0013 item 7): the
   * dusk where `day` (from 0) is chooseByDay − 1. No draws.
   */
  step(world: World, events, t: Tuning) {
    const h = halcyonOf(world);
    if (!h || h.chose !== null || world.tick % world.ticksPerDay !== world.ticksPerDay - 1) return [];
    if (!h.given && world.day < t.halcyon.chooseByDay - 1) return [];
    h.chose = choose(world, h, t);
    return [{ t: h.chose === 'home' ? 'goHome' : 'stay', who: h.seeker }];
  },

  /**
   * `keepsake` gives one of the hero's keepsakes to a creature, not away, within
   * halcyon.keepsakeRadii × meet.radius of the hero: the hero loses it, and the receiver's warmth
   * toward the hero rises by halcyon.keepsakeWarmth, its opinion following as after a meeting (with
   * an `opinion` event, as for `thread`). A keepsake to the seeker marks it given (ADR 0013 item 7).
   * Other verbs do nothing. No draws.
   */
  onVerb(world: World, verb, t: Tuning) {
    const h = halcyonOf(world);
    const hero = world.hero && world.creatures.find((c) => c.id === HERO);
    if (!h || !hero || !world.hero || verb.verb !== 'keepsake') return [];
    const i = world.hero.keepsakes.indexOf(verb.item);
    const to = world.creatures.find((c) => c.id === verb.to && c !== hero && c.state !== 'away');
    const reach = t.halcyon.keepsakeRadii * t.meet.radius;
    if (i < 0 || !to || dist2(to.x, to.y, hero.x, hero.y) > reach * reach) return [];
    world.hero.keepsakes.splice(i, 1);
    const s = heroSide(world, to, hero, t);
    s.warmth = clamp(s.warmth + t.halcyon.keepsakeWarmth, -1, 1);
    to.opinions[HERO] = s.warmth;
    if (to.id === h.seeker) h.given = true;
    return [
      { t: 'keepsake', to: to.id, item: verb.item },
      { t: 'opinion', holder: to.id, about: HERO, value: s.warmth },
    ];
  },

  /** No numbers yet. */
  metrics() {
    return {};
  },
};
