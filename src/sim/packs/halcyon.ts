// Halcyon (ADR 0013 item 7): gifts cost nothing and warm by a fifth, a keepsake from the hero warms
// its receiver toward the hero, and the seeker, Wisp, chooses once at a dusk to go home or stay.
// There is no fog code: a world starts with none and only `paintFog` adds it, so the scenario keeps
// it clear, and keeps winter out with its season. Nothing here draws.
import type { HalcyonState, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { clamp, dist2 } from '../math.ts';
import { heroSide, warmthTowardHero } from './hero-tie.ts';
import type { RulePack } from './index.ts';

function halcyonOf(world: World): HalcyonState | undefined {
  return world.pack?.id === 'halcyon' ? world.pack : undefined;
}

/**
 * The seeker's choice (ADR 0013 item 7, spec 7.4): home when its warmth toward the hero is at
 * least wisp.minWarmth and Kith's is at least wisp.minKithWarmth, else stay.
 */
function choose(world: World, h: HalcyonState, t: Tuning): 'home' | 'stay' {
  return warmthTowardHero(world, h.seeker) >= t.wisp.minWarmth && h.kithWarmth >= t.wisp.minKithWarmth
    ? 'home'
    : 'stay';
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
