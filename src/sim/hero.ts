// The player's hero in the sim (ADR 0013 items 1 and 2): what the meeting and movement rules ask
// about it. Every rule here is on only in a world with `hero`.
import type { BidReply, Creature, GiftMove, World } from './types.ts';
import { HERO } from './types.ts';
import type { Tuning } from './tuning.ts';
import { byId } from './world.ts';

/** True when `c` is the hero of a world that has one. */
export function isHero(world: World, c: Creature): boolean {
  return world.hero !== undefined && c.id === HERO;
}

/**
 * Who bids at a meeting of `a` and `b`, when one of them is the hero: the hero when it waved at
 * the other (and the wave is then spent), else the other. Undefined when neither is the hero.
 */
export function heroMeetingBidder(world: World, a: Creature, b: Creature): Creature | undefined {
  const partner = isHero(world, a) ? b : isHero(world, b) ? a : undefined;
  if (!world.hero || !partner) return undefined;
  if (world.hero.waveTo !== partner.id) return partner;
  world.hero.waveTo = null;
  return partner === a ? b : a;
}

/** The hero's standing reply when `replier` is the hero; undefined for anyone else. */
export function heroReply(world: World, replier: Creature): BidReply | undefined {
  return isHero(world, replier) ? world.hero?.reply : undefined;
}

/**
 * The hero's standing gift move when `giver` is the hero, a keep when it has fewer than gift.cost
 * berries; undefined for anyone else.
 */
export function heroGift(world: World, giver: Creature, t: Tuning): GiftMove | undefined {
  if (!world.hero || !isHero(world, giver)) return undefined;
  return giver.berries < t.gift.cost ? 'keep' : world.hero.gift;
}

/** The hero stops where it stands and follows no one. */
export function stopHero(world: World, hero: Creature): void {
  if (world.hero) world.hero.waveTo = null;
  hero.goalX = hero.x;
  hero.goalY = hero.y;
}

/**
 * While the hero follows a creature it waved at, its goal is that creature's spot; once that
 * creature is away, the hero stops. Otherwise its goal stays where the player walked it.
 */
export function aimHero(world: World, hero: Creature): void {
  const to = world.hero?.waveTo;
  if (to === undefined || to === null) return;
  const target = byId(world, to);
  if (target && target.state !== 'away') {
    hero.goalX = target.x;
    hero.goalY = target.y;
  } else {
    stopHero(world, hero);
  }
}
