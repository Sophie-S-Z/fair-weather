// Meeting rules (spec 9.3, ADR 0002, ADR 0003; light boosts per ADR 0004 item 9; the hero per
// ADR 0013 items 2 and 3; the rule pack's three questions per ADR 0013 item 4).
import type { Behavior, BidReply, Creature, DiaryEntry, GiftMove, Side, SimEvent, World } from './types.ts';
import type { Grid } from './grid.ts';
import type { Rng } from './rng.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2, sigmoid } from './math.ts';
import { bellReach, heroFogFactor, heroGift, heroMeetingBidder, heroReply, heroWarmthScale } from './hero.ts';
import { avoidsLens, boostAt, fogAt, inLens, recordLitMeeting } from './light.ts';
import { canMeet, giftCost, giftWarmth } from './packs/index.ts';
import { benchesOf, ensureTie, friendsOf, getTie, side, tieKey } from './world.ts';

const HUNGER_FULL_AT = 3; // ADR 0003 item 2
const DIARY_LENGTH = 20; // spec 9.1

/** 1 when empty, 0 at 3 berries or more (ADR 0003 item 2). */
export function hunger(berries: number): number {
  return 1 - Math.min(berries, HUNGER_FULL_AT) / HUNGER_FULL_AT;
}

/** Chance of a toward reply (ADR 0003 item 4): the replier's effective warmth, Opener, hunger, and light boost. */
export function replyChance(
  w: number,
  opener: number,
  hungerValue: number,
  boost: number,
  t: Tuning,
): number {
  const x = t.bid.gain * (w + t.bid.openerWeight * opener - t.bid.hungerWeight * hungerValue);
  return clamp(sigmoid(x) + boost, 0, 1);
}

/**
 * Warmth blended toward the opinion, clamped (ADR 0002 item 4, amended). After a meeting the
 * opinion equals the warmth, so experience is not counted twice; a rumor pulls toward itself.
 * A missing opinion means no belief: callers pass the warmth, so it does not pull.
 */
export function effectiveWarmth(warmth: number, opinion: number, t: Tuning): number {
  return clamp(warmth + t.opinion.weight * (opinion - warmth), -1, 1);
}

function metToday(world: World, a: Creature, b: Creature): boolean {
  const tie = getTie(world, a.id, b.id);
  return tie !== undefined && tie.meetings > 0 && tie.lastDay === world.day;
}

function byKey(x: { key: string }, y: { key: string }): number {
  return x.key < y.key ? -1 : x.key > y.key ? 1 : 0;
}

/**
 * Pairs of `wander` creatures within meet.radius that have not met today and that the rule pack
 * lets meet (canMeet), sorted by tie key.
 * Each pair is [lower id, higher id]. A creature joins at most one pair: the first in key order.
 * Rebuilds `grid` from `world.creatures` in array order.
 */
export function findMeetings(world: World, grid: Grid, t: Tuning): [Creature, Creature][] {
  const cs = world.creatures;
  grid.rebuild(
    cs.map((c) => c.x),
    cs.map((c) => c.y),
    cs.length,
  );
  const found: { key: string; lo: Creature; hi: Creature }[] = [];
  const near: number[] = [];
  cs.forEach((c, i) => {
    if (c.state !== 'wander') return;
    for (const j of grid.query(c.x, c.y, t.meet.radius, near)) {
      const o = cs[j];
      if (j <= i || !o || o.state !== 'wander' || metToday(world, c, o) || !canMeet(world, c, o)) continue;
      const [lo, hi] = c.id < o.id ? [c, o] : [o, c];
      found.push({ key: tieKey(c.id, o.id), lo, hi });
    }
  });
  found.sort(byKey);
  const taken = new Set<string>();
  const out: [Creature, Creature][] = [];
  for (const { lo, hi } of found) {
    if (taken.has(lo.id) || taken.has(hi.id)) continue;
    taken.add(lo.id);
    taken.add(hi.id);
    out.push([lo, hi]);
  }
  return out;
}

function pickReply(w: number, replier: Creature, boost: number, draw: number, t: Tuning): BidReply {
  if (draw < replyChance(w, replier.dials.opener, hunger(replier.berries), boost, t)) return 'toward';
  return w < t.bid.againstBelowWarmth ? 'against' : 'away';
}

/**
 * The Forgiveness a giver weighs remembered slights against: its own, or with `world.friendsForgive`
 * the mean Forgiveness of its mutual friends (ties warm on both sides) when it has at least
 * mushroom.trustFriends of them and that mean is higher (ADR 0012 item 16). Since one slight is
 * forgiven at a Forgiveness of 1/6 or more, this mostly counts mutual friendships.
 */
function forgivenessOf(world: World, giver: Creature, t: Tuning): number {
  const own = giver.dials.forgiveness;
  if (!world.friendsForgive) return own;
  const mutual = friendsOf(world, giver, t).filter((f) => {
    const tie = getTie(world, giver.id, f.id);
    return tie !== undefined && side(tie, f.id).warmth > t.friend.threshold;
  });
  if (mutual.length < t.mushroom.trustFriends) return own;
  const mean = mutual.reduce((sum, f) => sum + f.dials.forgiveness, 0) / mutual.length;
  return Math.max(own, mean);
}

/** Chance that `giver` gives to its partner before light (ADR 0003 item 6). */
function baseGiveChance(
  world: World,
  giverSide: Side,
  giver: Creature,
  firstMeeting: boolean,
  t: Tuning,
): number {
  if (firstMeeting) return giver.dials.opener;
  const remembered = Math.round(giverSide.slights);
  if (remembered === 0) return 1;
  return remembered > Math.round(t.gift.maxSlightsPerForgiveness * forgivenessOf(world, giver, t)) ? 0 : 1;
}

function pickGift(
  world: World,
  giverSide: Side,
  giver: Creature,
  firstMeeting: boolean,
  boost: number,
  draw: number,
  t: Tuning,
): GiftMove {
  // Below the gift's cost a creature cannot pay for it, so it keeps (and berries never go negative).
  if (giver.berries < giftCost(world, t)) return 'keep';
  const p = clamp(baseGiveChance(world, giverSide, giver, firstMeeting, t) + boost, 0, 1);
  return draw < p ? 'give' : 'keep';
}

function addWarmth(s: Side, d: number): void {
  s.warmth = clamp(s.warmth + d, -1, 1);
}

function replyWarmth(seen: BidReply, t: Tuning): number {
  return seen === 'toward' ? t.warmth.toward : seen === 'away' ? t.warmth.away : t.warmth.against;
}

/**
 * Warmth, slights, and shell for `self`, from what it saw of its partner's gift (ADR 0003 item 8),
 * a received gift worth giftWarmth. `scale` multiplies the warmth change (heroWarmthScale).
 */
function feelGifts(
  world: World,
  self: Creature,
  selfSide: Side,
  ownMove: GiftMove,
  partnerSeen: GiftMove,
  scale: number,
  t: Tuning,
): void {
  if (partnerSeen === 'give') {
    addWarmth(selfSide, giftWarmth(world, t) * scale);
    self.shell.softness = clamp(self.shell.softness + t.shell.giftSoftness, 0, 1);
  } else if (ownMove === 'give') {
    addWarmth(selfSide, t.warmth.keepAfterGift * scale);
    selfSide.slights += 1;
    self.shell.tightness = clamp(self.shell.tightness + t.shell.betrayalTightness, 0, 1);
  }
}

function nearBenchId(world: World, x: number, y: number, t: Tuning): string | null {
  const r2 = t.meet.radius * t.meet.radius;
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of benchesOf(world)) {
    const d = dist2(x, y, s.x, s.y);
    if (d <= r2 && d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

/**
 * A Bellchime's wave reaching `others` (ADR 0013 item 3): each replies to the hero with one draw,
 * in order, never misread, and both sides of their tie change by that reply's warmth. Each reply
 * uses this meeting's light boost, since every listener stands within knack.bellRadius of it.
 */
function bellReplies(
  world: World,
  hero: Creature,
  others: Creature[],
  boost: number,
  t: Tuning,
  rng: Rng,
): SimEvent[] {
  return others.map((c): SimEvent => {
    const tie = ensureTie(world, c, hero, t);
    const own = side(tie, c.id);
    const w = effectiveWarmth(own.warmth, c.opinions[hero.id] ?? own.warmth, t);
    const reply = pickReply(w, c, boost, rng.next(), t);
    addWarmth(own, replyWarmth(reply, t));
    addWarmth(side(tie, hero.id), replyWarmth(reply, t));
    return { t: 'bid', from: hero.id, to: c.id, reply, seenAs: reply };
  });
}

function pushDiary(c: Creature, entries: DiaryEntry[]): void {
  c.diary.push(...entries);
  if (c.diary.length > DIARY_LENGTH) c.diary.splice(0, c.diary.length - DIARY_LENGTH);
}

/**
 * Resolves one meeting between `a` and `b` and returns its events: the bid, then the bidder's
 * gift, then the replier's gift, then, when the meeting is lit (its midpoint in the lens and
 * neither side avoiding it), a `lit` event with the real behaviors.
 *
 * PRNG draws: always exactly seven per meeting, taken up front in this order:
 *   1. bidder tie-break (used only when the Openers are equal: below 0.5, `a` bids)
 *   2. reply (toward when below the reply chance)
 *   3. fog on the reply (a toward is seen as away when below fog.bidFlipFactor x fog)
 *   4. bidder's gift (give when below the give chance)
 *   5. replier's gift
 *   6. fog on the bidder's gift (a give is seen as keep when below fog.giftMisreadFactor x fog)
 *   7. fog on the replier's gift
 *
 * Fog is perception only (ADR 0003 item 5): berries move for the real gift, while warmth,
 * slights, softness, and tightness follow what each side saw.
 *
 * With the hero, the hero's module decides who bids (heroMeetingBidder), the hero's reply, and its
 * gift; the draws for those are still taken, so the order above holds. Its knack (ADR 0013 item 3)
 * scales the fog on its reply and gifts (heroFogFactor) and a local's warmth changes toward it
 * (heroWarmthScale). A Bellchime that bids takes one more reply draw for each other creature its
 * wave reaches (bellReach), after the seven, and adds a `bid` event for each, last.
 */
export function resolveMeeting(world: World, a: Creature, b: Creature, t: Tuning, rng: Rng): SimEvent[] {
  const draw = {
    bidder: rng.next(),
    reply: rng.next(),
    replyFog: rng.next(),
    bidderGift: rng.next(),
    replierGift: rng.next(),
    bidderGiftFog: rng.next(),
    replierGiftFog: rng.next(),
  };
  const tie = ensureTie(world, a, b, t);
  const first = tie.meetings === 0;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const fog = fogAt(world, mx, my, t);
  const boost = (yes: Behavior, no: Behavior): number =>
    boostAt(world, yes, mx, my, t) - boostAt(world, no, mx, my, t);

  // Bid.
  const oa = a.dials.opener;
  const ob = b.dials.opener;
  const bidder = heroMeetingBidder(world, a, b) ?? (oa > ob ? a : ob > oa ? b : draw.bidder < 0.5 ? a : b);
  const replier = bidder === a ? b : a;
  const bidderSide = side(tie, bidder.id);
  const replierSide = side(tie, replier.id);
  const w = effectiveWarmth(replierSide.warmth, replier.opinions[bidder.id] ?? replierSide.warmth, t);
  const replyBoost = boost('toward', 'against');
  const reply = heroReply(world, replier) ?? pickReply(w, replier, replyBoost, draw.reply, t);
  const replyFog = t.fog.bidFlipFactor * fog * heroFogFactor(world, replier, t);
  const replySeen: BidReply = reply === 'toward' && draw.replyFog < replyFog ? 'away' : reply;

  // Gifts.
  const giftBoost = boost('give', 'keep');
  const bidderMove =
    heroGift(world, bidder, t) ?? pickGift(world, bidderSide, bidder, first, giftBoost, draw.bidderGift, t);
  const replierMove =
    heroGift(world, replier, t) ??
    pickGift(world, replierSide, replier, first, giftBoost, draw.replierGift, t);
  const misread = (giver: Creature, m: GiftMove, d: number): GiftMove =>
    m === 'give' && d < t.fog.giftMisreadFactor * fog * heroFogFactor(world, giver, t) ? 'keep' : m;
  const bidderSeen = misread(bidder, bidderMove, draw.bidderGiftFog); // as the replier saw it
  const replierSeen = misread(replier, replierMove, draw.replierGiftFog); // as the bidder saw it

  // Payoffs: real gifts move berries.
  const value = world.season === 'winter' ? t.gift.valueWinter : t.gift.value;
  const cost = giftCost(world, t);
  if (bidderMove === 'give') {
    bidder.berries -= cost;
    replier.berries += value;
  }
  if (replierMove === 'give') {
    replier.berries -= cost;
    bidder.berries += value;
  }

  // Warmth, slights, and shells, from what each side saw.
  const bidderScale = heroWarmthScale(world, bidder, replier, t);
  addWarmth(bidderSide, replyWarmth(replySeen, t) * bidderScale);
  feelGifts(world, bidder, bidderSide, bidderMove, replierSeen, bidderScale, t);
  feelGifts(
    world,
    replier,
    replierSide,
    replierMove,
    bidderSeen,
    heroWarmthScale(world, replier, bidder, t),
    t,
  );

  // Opinions (ADR 0002 item 3).
  bidder.opinions[replier.id] = bidderSide.warmth;
  replier.opinions[bidder.id] = replierSide.warmth;

  // Light boosts: one per distinct real behavior, when the meeting is in the lens.
  const behaviors: Behavior[] = [];
  for (const bh of [reply, bidderMove, replierMove]) {
    if (bh !== 'away' && !behaviors.includes(bh)) behaviors.push(bh);
  }
  const lit = inLens(world, mx, my, t) && !avoidsLens(world, bidder) && !avoidsLens(world, replier);
  if (lit) recordLitMeeting(world, mx, my, behaviors, t);

  // Meeting state, tie count, and bench memory.
  const benchId = nearBenchId(world, mx, my, t);
  for (const c of [a, b]) {
    c.state = 'meet';
    c.stateUntilTick = world.tick + t.meet.durationTicks;
    if (benchId !== null) c.benchMemory = { benchId, day: world.day };
  }
  tie.meetings += 1;
  tie.lastDay = world.day;

  // Diary: the bid and both gifts, on each side, with that side's resulting warmth.
  for (const [c, s, other] of [
    [bidder, bidderSide, replier],
    [replier, replierSide, bidder],
  ] as const) {
    const entry = (kind: DiaryEntry['kind']): DiaryEntry => ({
      tick: world.tick,
      kind,
      with: other.id,
      value: s.warmth,
    });
    pushDiary(c, [entry('bid'), entry('gift'), entry('gift')]);
  }

  const events: SimEvent[] = [
    { t: 'bid', from: bidder.id, to: replier.id, reply, seenAs: replySeen },
    { t: 'gift', from: bidder.id, to: replier.id, move: bidderMove, seenAs: bidderSeen },
    { t: 'gift', from: replier.id, to: bidder.id, move: replierMove, seenAs: replierSeen },
  ];
  if (lit) events.push({ t: 'lit', a: a.id, b: b.id, behaviors });
  events.push(...bellReplies(world, bidder, bellReach(world, bidder, replier, t), replyBoost, t, rng));
  return events;
}
