// The player's hero in the sim (ADR 0013 items 1 to 3): what the meeting, movement, and dusk rules
// ask about it, and its six knacks. Every rule here is on only in a world with `hero`, and each
// knack only with the hero of that kind; for anyone else each term is the plain rule (a factor of
// 1, the usual speed, no extra repliers).
import type { BidReply, Bush, Creature, GiftMove, HeroKind, World } from './types.ts';
import { HERO } from './types.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2 } from './math.ts';
import { canMeet, giftCost } from './packs/index.ts';
import { byId, ensureTie, side } from './world.ts';

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
 * The hero's standing gift move when `giver` is the hero, a keep when it has fewer berries than a
 * gift costs (giftCost); undefined for anyone else.
 */
export function heroGift(world: World, giver: Creature, t: Tuning): GiftMove | undefined {
  if (!world.hero || !isHero(world, giver)) return undefined;
  return giver.berries < giftCost(world, t) ? 'keep' : world.hero.gift;
}

/** The hero stops where it stands and follows no one. */
export function stopHero(world: World, hero: Creature): void {
  if (world.hero) world.hero.waveTo = null;
  hero.goalX = hero.x;
  hero.goalY = hero.y;
}

/**
 * Aims the hero for this tick and returns whether it should steer. While it follows a creature it
 * waved at, its goal is that creature's spot; once that creature is away, the hero stops.
 * Otherwise its goal stays where the player walked it. Within move.arriveRadius of its goal it
 * waits, with no velocity, since it never picks a new goal.
 */
export function aimHero(world: World, hero: Creature, t: Tuning): boolean {
  const to = world.hero?.waveTo;
  if (to !== undefined && to !== null) {
    const target = byId(world, to);
    if (target && target.state !== 'away') {
      hero.goalX = target.x;
      hero.goalY = target.y;
    } else {
      stopHero(world, hero);
    }
  }
  const r = t.move.arriveRadius;
  if (dist2(hero.x, hero.y, hero.goalX, hero.goalY) > r * r) return true;
  hero.vx = 0;
  hero.vy = 0;
  return false;
}

/** The hero's kind when `about` is the hero and `holder` is a local; undefined otherwise. */
function kindToward(world: World, holder: string, about: string): HeroKind | undefined {
  return world.hero && about === HERO && holder !== HERO ? world.hero.kind : undefined;
}

/**
 * The share of the fog that can misread what `c` shows, its reply or its gifts (ADR 0013 item 3):
 * knack.lanternFog for a Lantern-bearer, 0 for a Glassling, 1 for anyone else.
 */
export function heroFogFactor(world: World, c: Creature, t: Tuning): number {
  if (!isHero(world, c)) return 1;
  const kind = world.hero?.kind;
  return kind === 'lantern' ? t.knack.lanternFog : kind === 'glassling' ? 0 : 1;
}

/** Top speed: move.speed, × knack.kiteSpeed for a Kite-rider (ADR 0013 item 3). */
export function topSpeed(world: World, c: Creature, t: Tuning): number {
  return isHero(world, c) && world.hero?.kind === 'kite' ? t.move.speed * t.knack.kiteSpeed : t.move.speed;
}

/**
 * The factor on each meeting warmth change on `holder`'s side toward `about` (ADR 0013 item 3):
 * knack.glassWarmth when `about` is a Glassling and `holder` a local, else 1.
 */
export function heroWarmthScale(world: World, holder: Creature, about: Creature, t: Tuning): number {
  return kindToward(world, holder.id, about.id) === 'glassling' ? t.knack.glassWarmth : 1;
}

/**
 * The factor on Memory for `holder`'s side toward `about` (ADR 0013 item 3): knack.mossMemory when
 * `about` is a Mosscoat and `holder` a local, else 1. Slights fade with Memory min(1, factor ×
 * Memory).
 */
export function heroMemoryScale(world: World, holder: string, about: string, t: Tuning): number {
  return kindToward(world, holder, about) === 'mosscoat' ? t.knack.mossMemory : 1;
}

/**
 * The factor on warmth.dailyDrift for `holder`'s side toward `about` (ADR 0013 item 3):
 * knack.mossDrift when `about` is a Mosscoat and `holder` a local, else 1.
 */
export function heroDriftScale(world: World, holder: string, about: string, t: Tuning): number {
  return kindToward(world, holder, about) === 'mosscoat' ? t.knack.mossDrift : 1;
}

/**
 * A Seedcarrier plants a gift at its spot (ADR 0013 item 3): it pays knack.seedCost berries for a
 * bush with no berries that fills at the dusk knack.seedDays days on (regrowBushes). Changes
 * nothing for another kind or a hero with fewer than knack.seedCost berries. No draws.
 */
export function plantGift(world: World, t: Tuning): void {
  const hero = byId(world, HERO);
  if (world.hero?.kind !== 'seedcarrier' || !hero || hero.berries < t.knack.seedCost) return;
  hero.berries -= t.knack.seedCost;
  const gift = { from: HERO, readyDay: world.day + t.knack.seedDays, found: [] };
  world.bushes.push({ id: `bush-${String(world.nextId)}`, x: hero.x, y: hero.y, berries: 0, gift });
  world.nextId += 1;
}

/**
 * After `taker` takes a berry from `bush`: when it is a gift and `taker` has not taken from it
 * before, `taker`'s warmth toward the planter rises by knack.seedWarmth (ADR 0013 item 3). The
 * planter's own takes count for nothing.
 */
export function takeFromGift(world: World, bush: Bush, taker: Creature, t: Tuning): void {
  const gift = bush.gift;
  const from = gift && byId(world, gift.from);
  if (!gift || !from || from === taker || gift.found.includes(taker.id)) return;
  gift.found.push(taker.id);
  const s = side(ensureTie(world, taker, from, t), taker.id);
  s.warmth = clamp(s.warmth + t.knack.seedWarmth, -1, 1);
}

/**
 * The other creatures a Bellchime's wave reaches when it bids to `partner` (ADR 0013 item 3):
 * every `wander` creature but the two within knack.bellRadius of the hero that the rule pack lets
 * meet it (canMeet, ADR 0013 item 4), in creature order. Empty when `bidder` is not a Bellchime hero.
 */
export function bellReach(world: World, bidder: Creature, partner: Creature, t: Tuning): Creature[] {
  if (!isHero(world, bidder) || world.hero?.kind !== 'bellchime') return [];
  const r2 = t.knack.bellRadius * t.knack.bellRadius;
  return world.creatures.filter(
    (c) =>
      c !== bidder &&
      c !== partner &&
      c.state === 'wander' &&
      dist2(c.x, c.y, bidder.x, bidder.y) <= r2 &&
      canMeet(world, bidder, c),
  );
}
