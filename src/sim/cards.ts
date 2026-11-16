// Rule cards (ADR 0015 item 8): "When a creature is <when>, it <then>." A card reads what a
// creature is now (its berries and friends), never who it is (spec 19.2), and sets one meeting
// move. Only a world with `cards` has any; nothing here draws.
import type { BidReply, CardThen, CardWhen, Creature, GiftMove, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { giftCost } from './packs/index.ts';
import { friendCount } from './world.ts';

/** True when `c` is in the card's state now. */
function holds(world: World, c: Creature, when: CardWhen, t: Tuning): boolean {
  switch (when) {
    case 'hungry':
      return c.berries < t.gift.cost;
    case 'full':
      return c.berries >= t.forage.carryMax;
    case 'lonely':
      return friendCount(world, c, t) === 0;
    case 'liked':
      return friendCount(world, c, t) >= t.cards.likedFriends;
  }
}

const isReply = (m: CardThen): m is BidReply => m === 'toward' || m === 'away' || m === 'against';

/** The reply the first card that sets a reply and whose state `c` is in sets, or undefined. */
export function cardReply(world: World, c: Creature, t: Tuning): BidReply | undefined {
  for (const k of world.cards ?? []) if (isReply(k.then) && holds(world, c, k.when, t)) return k.then;
  return undefined;
}

/**
 * The gift move the first card that sets a gift and whose state `c` is in sets, or undefined; a
 * keep when the card gives and `c` has fewer berries than a gift costs.
 */
export function cardGift(world: World, c: Creature, t: Tuning): GiftMove | undefined {
  for (const k of world.cards ?? []) {
    if (isReply(k.then) || !holds(world, c, k.when, t)) continue;
    return k.then === 'give' && c.berries < giftCost(world, t) ? 'keep' : k.then;
  }
  return undefined;
}
