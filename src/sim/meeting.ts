// Meeting rules (spec 9.3, ADR 0002, ADR 0003; light boosts per ADR 0004 item 9).
import type { Behavior, BidReply, Creature, DiaryEntry, GiftMove, Side, SimEvent, World } from './types.ts';
import type { Grid } from './grid.ts';
import type { Rng } from './rng.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2, sigmoid } from './math.ts';
import { avoidsLens, boostAt, fogAt, recordLitMeeting } from './light.ts';
import { benchesOf, ensureTie, getTie, side, tieKey } from './world.ts';

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
 * Pairs of `wander` creatures within meet.radius that have not met today, sorted by tie key.
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
      if (j <= i || !o || o.state !== 'wander' || metToday(world, c, o)) continue;
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

/** Chance that `giver` gives to its partner before light (ADR 0003 item 6). */
function baseGiveChance(giverSide: Side, giver: Creature, firstMeeting: boolean, t: Tuning): number {
  if (firstMeeting) return giver.dials.opener;
  const remembered = Math.round(giverSide.slights);
  return remembered > Math.round(t.gift.maxSlightsPerForgiveness * giver.dials.forgiveness) ? 0 : 1;
}

function pickGift(
  giverSide: Side,
  giver: Creature,
  firstMeeting: boolean,
  boost: number,
  draw: number,
  t: Tuning,
): GiftMove {
  // Below gift.cost a creature cannot pay for a gift, so it keeps (and berries never go negative).
  if (giver.berries < t.gift.cost) return 'keep';
  const p = clamp(baseGiveChance(giverSide, giver, firstMeeting, t) + boost, 0, 1);
  return draw < p ? 'give' : 'keep';
}

function addWarmth(s: Side, d: number): void {
  s.warmth = clamp(s.warmth + d, -1, 1);
}

function replyWarmth(seen: BidReply, t: Tuning): number {
  return seen === 'toward' ? t.warmth.toward : seen === 'away' ? t.warmth.away : t.warmth.against;
}

/** Warmth, slights, and shell for `self`, from what it saw of its partner's gift (ADR 0003 item 8). */
function feelGifts(
  self: Creature,
  selfSide: Side,
  ownMove: GiftMove,
  partnerSeen: GiftMove,
  t: Tuning,
): void {
  if (partnerSeen === 'give') {
    addWarmth(selfSide, t.warmth.giftReceived);
    self.shell.softness = clamp(self.shell.softness + t.shell.giftSoftness, 0, 1);
  } else if (ownMove === 'give') {
    addWarmth(selfSide, t.warmth.keepAfterGift);
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

function pushDiary(c: Creature, entries: DiaryEntry[]): void {
  c.diary.push(...entries);
  if (c.diary.length > DIARY_LENGTH) c.diary.splice(0, c.diary.length - DIARY_LENGTH);
}

/**
 * Resolves one meeting between `a` and `b` and returns its events: the bid, then the bidder's
 * gift, then the replier's gift.
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
  const bidder = oa > ob ? a : ob > oa ? b : draw.bidder < 0.5 ? a : b;
  const replier = bidder === a ? b : a;
  const bidderSide = side(tie, bidder.id);
  const replierSide = side(tie, replier.id);
  const w = effectiveWarmth(replierSide.warmth, replier.opinions[bidder.id] ?? replierSide.warmth, t);
  const reply = pickReply(w, replier, boost('toward', 'against'), draw.reply, t);
  const replySeen: BidReply =
    reply === 'toward' && draw.replyFog < t.fog.bidFlipFactor * fog ? 'away' : reply;

  // Gifts.
  const giftBoost = boost('give', 'keep');
  const bidderMove = pickGift(bidderSide, bidder, first, giftBoost, draw.bidderGift, t);
  const replierMove = pickGift(replierSide, replier, first, giftBoost, draw.replierGift, t);
  const misread = (m: GiftMove, d: number): GiftMove =>
    m === 'give' && d < t.fog.giftMisreadFactor * fog ? 'keep' : m;
  const bidderSeen = misread(bidderMove, draw.bidderGiftFog); // as the replier saw it
  const replierSeen = misread(replierMove, draw.replierGiftFog); // as the bidder saw it

  // Payoffs: real gifts move berries.
  const value = world.season === 'winter' ? t.gift.valueWinter : t.gift.value;
  if (bidderMove === 'give') {
    bidder.berries -= t.gift.cost;
    replier.berries += value;
  }
  if (replierMove === 'give') {
    replier.berries -= t.gift.cost;
    bidder.berries += value;
  }

  // Warmth, slights, and shells, from what each side saw.
  addWarmth(bidderSide, replyWarmth(replySeen, t));
  feelGifts(bidder, bidderSide, bidderMove, replierSeen, t);
  feelGifts(replier, replierSide, replierMove, bidderSeen, t);

  // Opinions (ADR 0002 item 3).
  bidder.opinions[replier.id] = bidderSide.warmth;
  replier.opinions[bidder.id] = replierSide.warmth;

  // Light boosts: one per distinct real behavior, when the meeting is in the lens.
  const behaviors: Behavior[] = [];
  for (const bh of [reply, bidderMove, replierMove]) {
    if (bh !== 'away' && !behaviors.includes(bh)) behaviors.push(bh);
  }
  if (!avoidsLens(world, bidder) && !avoidsLens(world, replier))
    recordLitMeeting(world, mx, my, behaviors, t);

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

  return [
    { t: 'bid', from: bidder.id, to: replier.id, reply, seenAs: replySeen },
    { t: 'gift', from: bidder.id, to: replier.id, move: bidderMove, seenAs: bidderSeen },
    { t: 'gift', from: replier.id, to: bidder.id, move: replierMove, seenAs: replierSeen },
  ];
}
