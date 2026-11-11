/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import { createGrid } from '../../../src/sim/grid.ts';
import { sigmoid } from '../../../src/sim/math.ts';
import {
  effectiveWarmth,
  findMeetings,
  hunger,
  replyChance,
  resolveMeeting,
} from '../../../src/sim/meeting.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Creature, Dials, Scenario, SimEvent, World } from '../../../src/sim/types.ts';
import { byId, createWorld, ensureTie, side } from '../../../src/sim/world.ts';
import { scriptedRng } from './helpers.ts';

const t = parseTuning(tuningJson);

type Spec = { id: string; x?: number; y?: number; berries?: number } & Partial<Dials>;

function makeWorld(specs: Spec[], over: Partial<Scenario> = {}): World {
  return createWorld(1, t, {
    valleyId: 'kith',
    season: 'spring',
    creatures: specs.map(({ id, x, y, berries, ...dials }) => ({
      id,
      speciesId: 'kith',
      name: id,
      x: x ?? 800,
      y: y ?? 450,
      berries: berries ?? 3,
      dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5, ...dials },
    })),
    bushes: [],
    structures: [],
    ...over,
  });
}

/** Two creatures 10 apart; `a` has the higher Opener, so `a` bids and no bidder draw decides. */
function pair(a: Partial<Spec> = {}, b: Partial<Spec> = {}, over: Partial<Scenario> = {}) {
  const w = makeWorld(
    [
      { id: 'a', x: 800, opener: 0.6, ...a },
      { id: 'b', x: 810, opener: 0.4, ...b },
    ],
    over,
  );
  return { w, a: byId(w, 'a')!, b: byId(w, 'b')! };
}

/**
 * The seven draws of one meeting, in resolveMeeting's documented order:
 * bidder tie-break, reply, fog on the reply, bidder's gift, replier's gift,
 * fog on the bidder's gift, fog on the replier's gift.
 */
function draws(d: {
  bidder?: number;
  reply?: number;
  replyFog?: number;
  bidderGift?: number;
  replierGift?: number;
  bidderGiftFog?: number;
  replierGiftFog?: number;
}) {
  return scriptedRng([
    d.bidder ?? 0.5,
    d.reply ?? 0.99,
    d.replyFog ?? 0.99,
    d.bidderGift ?? 0.99,
    d.replierGift ?? 0.99,
    d.bidderGiftFog ?? 0.99,
    d.replierGiftFog ?? 0.99,
  ]);
}

function bidOf(events: SimEvent[]) {
  const e = events.find((x) => x.t === 'bid');
  if (e?.t !== 'bid') throw new Error('no bid event');
  return e;
}

function giftFrom(events: SimEvent[], from: string) {
  const e = events.find((x) => x.t === 'gift' && x.from === from);
  if (e?.t !== 'gift') throw new Error('no gift event');
  return e;
}

function warmth(w: World, from: Creature, to: Creature): number {
  return side(ensureTie(w, from, to, t), from.id).warmth;
}

function setFog(w: World, x: number, y: number, v: number): void {
  const cs = t.fog.cellSize;
  w.fields.fog[Math.floor(y / cs) * w.fields.fogW + Math.floor(x / cs)] = v;
}

/** A tie that has met before, so the later-meeting gift rule applies. */
function metBefore(w: World, a: Creature, b: Creature) {
  const tie = ensureTie(w, a, b, t);
  tie.meetings = 1;
  tie.lastDay = w.day - 1;
  return tie;
}

test('hunger', () => {
  expect(hunger(0)).toBe(1);
  expect(hunger(1.5)).toBe(0.5);
  expect(hunger(3)).toBe(0);
  expect(hunger(7)).toBe(0);
});

test('reply chance uses the spec formula', () => {
  expect(replyChance(0, 0.5, 0, 0, t)).toBe(sigmoid(1));
  expect(replyChance(0.2, 0.4, 0.5, 0, t)).toBe(sigmoid(4 * (0.2 + 0.5 * 0.4 - 0.3 * 0.5)));
});

test('reply chance adds the light boost and clamps to [0, 1]', () => {
  expect(replyChance(0, 0.5, 0, 0.1, t)).toBeCloseTo(sigmoid(1) + 0.1, 12);
  expect(replyChance(1, 1, 0, 0.3, t)).toBe(1);
  expect(replyChance(-1, 0, 1, -0.3, t)).toBe(0);
});

test('the higher Opener bids; a tie uses the PRNG', () => {
  let p = pair({ opener: 0.9 }, { opener: 0.1 });
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({}))).from).toBe('a');
  p = pair({ opener: 0.1 }, { opener: 0.9 });
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({}))).from).toBe('b');
  p = pair({ opener: 0.5 }, { opener: 0.5 });
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ bidder: 0.49 }))).from).toBe('a');
  p = pair({ opener: 0.5 }, { opener: 0.5 });
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ bidder: 0.5 }))).from).toBe('b');
});

test('a meeting uses exactly seven draws', () => {
  const p = pair();
  const rng = draws({});
  resolveMeeting(p.w, p.a, p.b, t, rng);
  expect(rng.used()).toBe(7);
});

test('a non-toward reply is against only when effective warmth is below -0.4', () => {
  const at = (warmth: number, opinion: number) => {
    const p = pair();
    side(ensureTie(p.w, p.a, p.b, t), 'b').warmth = warmth;
    p.b.opinions.a = opinion;
    return bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0.99 }))).reply;
  };
  expect(at(-0.41, -0.41)).toBe('against'); // effective -0.41
  expect(at(-0.4, -0.4)).toBe('away'); // effective -0.4, not below
  expect(at(-0.41, 0)).toBe('away'); // stored warmth below -0.4, effective -0.205
  expect(at(-0.3, -0.6)).toBe('against'); // stored warmth above -0.4, effective -0.45
});

test('effective warmth blends warmth toward the opinion: 0.4 with opinion -0.6 gives -0.1', () => {
  expect(effectiveWarmth(0.4, -0.6, t)).toBeCloseTo(-0.1, 12);
  expect(effectiveWarmth(0.9, 1, t)).toBeCloseTo(0.95, 12);
  expect(effectiveWarmth(-1, -1, t)).toBe(-1);
});

test('a missing opinion means no belief: the reply uses the stored warmth', () => {
  const p = pair();
  side(ensureTie(p.w, p.a, p.b, t), 'b').warmth = -0.41;
  expect(p.b.opinions.a).toBeUndefined();
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0.99 }))).reply).toBe('against'); // effective -0.41
});

test('after a meeting with no rumor, effective warmth equals the stored warmth', () => {
  const p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0 }));
  for (const [x, y] of [
    [p.a, p.b],
    [p.b, p.a],
  ] as const) {
    const stored = warmth(p.w, x, y);
    expect(stored).not.toBe(0);
    expect(effectiveWarmth(stored, x.opinions[y.id]!, t)).toBe(stored);
  }
});

test('the reply is toward when the draw is below the reply chance', () => {
  const p = pair({}, { opener: 0.4, berries: 3 });
  const pT = replyChance(0, 0.4, 0, 0, t);
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: pT - 1e-9 }))).reply).toBe('toward');
  const q = pair({}, { opener: 0.4, berries: 3 });
  expect(bidOf(resolveMeeting(q.w, q.a, q.b, t, draws({ reply: pT }))).reply).toBe('away');
});

test('fog 1 turns a toward reply into a seen away when the draw is below 0.5', () => {
  const p = pair();
  setFog(p.w, 805, 450, 1);
  const ev = bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, replyFog: 0.49 })));
  expect(ev.reply).toBe('toward');
  expect(ev.seenAs).toBe('away');
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(t.warmth.away, 12);
});

test('fog 1 leaves a toward reply when the draw is 0.5 or more', () => {
  const p = pair();
  setFog(p.w, 805, 450, 1);
  const ev = bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, replyFog: 0.5 })));
  expect(ev.seenAs).toBe('toward');
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(t.warmth.toward, 12);
});

test('fog never changes an away or against reply', () => {
  const p = pair();
  setFog(p.w, 805, 450, 1);
  const ev = bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0.99, replyFog: 0 })));
  expect(ev.seenAs).toBe('away');
});

test('a first meeting gives with chance equal to Opener', () => {
  let p = pair({ opener: 0.6 });
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0.59 })), 'a').move).toBe('give');
  p = pair({ opener: 0.6 });
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0.6 })), 'a').move).toBe('keep');
  p = pair({}, { opener: 0.4 });
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ replierGift: 0.39 })), 'b').move).toBe('give');
});

test('later, a creature with Forgiveness 0.5 gives at 2 remembered slights and keeps at 3', () => {
  let p = pair({ forgiveness: 0.5 });
  side(metBefore(p.w, p.a, p.b), 'a').slights = 2;
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0.99 })), 'a').move).toBe('give');
  p = pair({ forgiveness: 0.5 });
  side(metBefore(p.w, p.a, p.b), 'a').slights = 3;
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 })), 'a').move).toBe('keep');
});

test('Forgiveness 0 and Memory 1: a slight faded to 0.51 still keeps; at 0.49 it is forgotten and gives', () => {
  let p = pair({ forgiveness: 0, memory: 1 });
  side(metBefore(p.w, p.a, p.b), 'a').slights = 0.51;
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 })), 'a').move).toBe('keep');
  p = pair({ forgiveness: 0, memory: 1 });
  side(metBefore(p.w, p.a, p.b), 'a').slights = 0.49;
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0.99 })), 'a').move).toBe('give');
});

test('a gift costs the giver 1 and gives the receiver 3; in winter the receiver gets 2', () => {
  let p = pair({ berries: 3 }, { berries: 3 });
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 }));
  expect(p.a.berries).toBe(2);
  expect(p.b.berries).toBe(6);
  p = pair({ berries: 3 }, { berries: 3 }, { season: 'winter' });
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 }));
  expect(p.a.berries).toBe(2);
  expect(p.b.berries).toBe(5);
  p = pair({ berries: 3 }, { berries: 3 });
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0, replierGift: 0 }));
  expect(p.a.berries).toBe(5);
  expect(p.b.berries).toBe(5);
});

test('a fog-misread gift moves berries but the receiver sees a keep', () => {
  const p = pair();
  setFog(p.w, 805, 450, 1);
  const ev = resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0, bidderGiftFog: 0.49 }));
  const g = giftFrom(ev, 'a');
  expect(g.move).toBe('give');
  expect(g.seenAs).toBe('keep');
  expect(p.a.berries).toBe(2);
  expect(p.b.berries).toBe(6);
  expect(warmth(p.w, p.b, p.a)).toBe(0); // no gift seen, no warmth
  expect(p.b.shell.softness).toBe(0);
  // b kept for real, so a's own gift met a keep:
  expect(side(ensureTie(p.w, p.a, p.b, t), 'a').slights).toBe(1);
});

test('a fog-misread partner gift counts as a keep after your gift', () => {
  const p = pair();
  setFog(p.w, 805, 450, 1);
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0, replierGift: 0, replierGiftFog: 0.49 }));
  const tie = ensureTie(p.w, p.a, p.b, t);
  expect(side(tie, 'a').slights).toBe(1);
  expect(p.a.shell.tightness).toBeCloseTo(t.shell.betrayalTightness, 12);
  expect(side(tie, 'b').slights).toBe(0);
  expect(p.a.berries).toBe(5); // both gifts moved berries
});

test('warmth changes match the table: +0.10, -0.05, -0.15, +0.15, -0.20', () => {
  // toward
  let p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0 }));
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(0.1, 12);
  expect(warmth(p.w, p.b, p.a)).toBe(0);
  // away
  p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0.99 }));
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(-0.05, 12);
  // against
  p = pair();
  side(ensureTie(p.w, p.a, p.b, t), 'b').warmth = -0.5;
  p.b.opinions.a = -0.5; // effective -0.5, so the reply is against
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0.99 }));
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(-0.15, 12);
  expect(warmth(p.w, p.b, p.a)).toBe(-0.5);
  // gift received (+0.15 to b) and keep after your gift (-0.20 to a), with a toward bid (+0.10 to a)
  p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0 }));
  expect(warmth(p.w, p.b, p.a)).toBeCloseTo(0.15, 12);
  expect(warmth(p.w, p.a, p.b)).toBeCloseTo(0.1 - 0.2, 12);
});

test('keep after a gift adds one slight and 0.1 tightness to the giver', () => {
  const p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 }));
  const tie = ensureTie(p.w, p.a, p.b, t);
  expect(side(tie, 'a').slights).toBe(1);
  expect(p.a.shell.tightness).toBeCloseTo(0.1, 12);
  expect(side(tie, 'b').slights).toBe(0);
  expect(p.b.shell.tightness).toBe(0);
});

test('a gift received adds 0.05 softness', () => {
  const p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 }));
  expect(p.b.shell.softness).toBeCloseTo(0.05, 12);
  expect(p.a.shell.softness).toBe(0);
});

test('a creature with 0 berries keeps', () => {
  const p = pair({ berries: 0, opener: 1 });
  const ev = resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0 }));
  expect(giftFrom(ev, 'a').move).toBe('keep');
  expect(p.a.berries).toBe(0);
});

test('after a meeting each side sets its opinion of the other to its tie warmth', () => {
  const p = pair();
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0 }));
  expect(p.a.opinions.b).toBe(warmth(p.w, p.a, p.b));
  expect(p.b.opinions.a).toBe(warmth(p.w, p.b, p.a));
});

test('a meeting sets both to meet for durationTicks and counts on the tie', () => {
  const p = pair();
  p.w.tick = 100;
  p.w.day = 3;
  resolveMeeting(p.w, p.a, p.b, t, draws({}));
  for (const c of [p.a, p.b]) {
    expect(c.state).toBe('meet');
    expect(c.stateUntilTick).toBe(100 + t.meet.durationTicks);
    expect(c.benchMemory).toBeNull();
  }
  const tie = ensureTie(p.w, p.a, p.b, t);
  expect(tie.meetings).toBe(1);
  expect(tie.lastDay).toBe(3);
});

test('a meeting within meet.radius of a bench sets both bench memories', () => {
  const p = pair({}, {}, { structures: [{ id: 'bench-1', kind: 'bench', x: 805, y: 450 + t.meet.radius }] });
  p.w.day = 2;
  resolveMeeting(p.w, p.a, p.b, t, draws({}));
  expect(p.a.benchMemory).toEqual({ benchId: 'bench-1', day: 2 });
  expect(p.b.benchMemory).toEqual({ benchId: 'bench-1', day: 2 });
  const q = pair({}, {}, { structures: [{ id: 'bench-1', kind: 'bench', x: 805, y: 451 + t.meet.radius }] });
  resolveMeeting(q.w, q.a, q.b, t, draws({}));
  expect(q.a.benchMemory).toBeNull();
});

test('events carry the real move and what was seen', () => {
  const p = pair();
  const ev = resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0 }));
  expect(ev).toEqual([
    { t: 'bid', from: 'a', to: 'b', reply: 'toward', seenAs: 'toward' },
    { t: 'gift', from: 'a', to: 'b', move: 'give', seenAs: 'give' },
    { t: 'gift', from: 'b', to: 'a', move: 'keep', seenAs: 'keep' },
  ]);
});

test('the diary gets one entry per bid and per gift on each side, with the resulting warmth, last 20 kept', () => {
  const p = pair();
  p.w.tick = 7;
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0 }));
  const wa = warmth(p.w, p.a, p.b);
  const wb = warmth(p.w, p.b, p.a);
  expect(p.a.diary).toEqual([
    { tick: 7, kind: 'bid', with: 'b', value: wa },
    { tick: 7, kind: 'gift', with: 'b', value: wa },
    { tick: 7, kind: 'gift', with: 'b', value: wa },
  ]);
  expect(p.b.diary.map((d) => [d.kind, d.with, d.value])).toEqual([
    ['bid', 'a', wb],
    ['gift', 'a', wb],
    ['gift', 'a', wb],
  ]);
  const rng = createRng(3);
  for (let i = 0; i < 10; i++) resolveMeeting(p.w, p.a, p.b, t, rng);
  expect(p.a.diary).toHaveLength(20);
  expect(p.b.diary).toHaveLength(20);
});

test('warmth stays in [-1, 1] after 100 hostile meetings', () => {
  const p = pair({ opener: 1, forgiveness: 1 }, { opener: 0, forgiveness: 0 });
  const tie = ensureTie(p.w, p.a, p.b, t);
  tie.ab.warmth = -0.95;
  tie.ba.warmth = -0.95;
  const rng = createRng(11);
  let lowest = 0;
  for (let i = 0; i < 100; i++) {
    p.a.berries = 3; // a gives into b's keeps until its slights pass round(3 x Forgiveness)
    p.b.berries = 0;
    resolveMeeting(p.w, p.a, p.b, t, rng);
    lowest = Math.min(lowest, side(tie, 'a').warmth);
    for (const s of [tie.ab, tie.ba]) {
      expect(s.warmth).toBeGreaterThanOrEqual(-1);
      expect(s.warmth).toBeLessThanOrEqual(1);
    }
    for (const c of [p.a, p.b]) {
      expect(c.shell.tightness).toBeLessThanOrEqual(1);
      expect(c.shell.softness).toBeLessThanOrEqual(1);
    }
  }
  expect(lowest).toBe(-1);
});

test('light: a lit meeting records a boost for each behavior that happened', () => {
  const p = pair();
  p.w.fields.light = { x: 805, y: 450 };
  resolveMeeting(p.w, p.a, p.b, t, draws({ reply: 0, bidderGift: 0, bidderGiftFog: 0 }));
  expect(p.w.boosts.map((b) => b.behavior)).toEqual(['toward', 'give', 'keep']);
  expect(p.w.boosts[0]).toEqual({ behavior: 'toward', x: 805, y: 450, untilDay: p.w.day + t.light.days });
  const q = pair();
  q.w.fields.light = { x: 805, y: 450 };
  resolveMeeting(q.w, q.a, q.b, t, draws({ reply: 0.99, bidderGift: 0, replierGift: 0 }));
  expect(q.w.boosts.map((b) => b.behavior)).toEqual(['give']); // an away reply adds none
});

test('light: a toward boost nearby raises the reply chance, an against boost lowers it', () => {
  const pT = replyChance(0, 0.4, 0, 0, t);
  const p = pair();
  p.w.boosts.push({ behavior: 'toward', x: 900, y: 450, untilDay: 0 });
  expect(bidOf(resolveMeeting(p.w, p.a, p.b, t, draws({ reply: pT + 0.14 }))).reply).toBe('toward');
  const q = pair();
  q.w.boosts.push({ behavior: 'against', x: 900, y: 450, untilDay: 0 });
  expect(bidOf(resolveMeeting(q.w, q.a, q.b, t, draws({ reply: pT - 0.14 }))).reply).toBe('away');
});

test('light: a give boost lets a Grudger give; a keep boost lowers giving', () => {
  const p = pair({ forgiveness: 0 });
  side(metBefore(p.w, p.a, p.b), 'a').slights = 1;
  p.w.boosts.push({ behavior: 'give', x: 805, y: 450, untilDay: 0 });
  expect(giftFrom(resolveMeeting(p.w, p.a, p.b, t, draws({ bidderGift: 0.14 })), 'a').move).toBe('give');
  const q = pair({ opener: 0.6 });
  q.w.boosts.push({ behavior: 'keep', x: 805, y: 450, untilDay: 0 });
  expect(giftFrom(resolveMeeting(q.w, q.a, q.b, t, draws({ bidderGift: 0.46 })), 'a').move).toBe('keep');
});

test('findMeetings pairs wander creatures within meet.radius, sorted by tie key', () => {
  const w = makeWorld([
    { id: 'd', x: 100, y: 100 },
    { id: 'c', x: 110, y: 100 },
    { id: 'b', x: 800, y: 450 },
    { id: 'a', x: 800 + t.meet.radius, y: 450 },
    { id: 'e', x: 1500, y: 800 },
    { id: 'f', x: 1500 + t.meet.radius + 1, y: 800 },
  ]);
  const grid = createGrid(t.scene.width, t.scene.height, t.meet.radius);
  const ids = findMeetings(w, grid, t).map(([x, y]) => [x.id, y.id]);
  expect(ids).toEqual([
    ['a', 'b'],
    ['c', 'd'],
  ]);
});

test('a pair meets at most once per day; a creature joins at most one meeting per tick', () => {
  const w = makeWorld([
    { id: 'c', x: 800, y: 450 },
    { id: 'a', x: 805, y: 450 },
    { id: 'b', x: 810, y: 450 },
    { id: 'z', x: 300, y: 300 },
    { id: 'y', x: 305, y: 300 },
  ]);
  const grid = createGrid(t.scene.width, t.scene.height, t.meet.radius);
  const ids = () => findMeetings(w, grid, t).map(([x, y]) => `${x.id}|${y.id}`);
  expect(ids()).toEqual(['a|b', 'y|z']); // a|c and b|c lose: a and b are taken
  const tie = ensureTie(w, byId(w, 'a')!, byId(w, 'b')!, t);
  tie.meetings = 1;
  tie.lastDay = w.day;
  expect(ids()).toEqual(['a|c', 'y|z']);
  w.day += 1;
  expect(ids()).toEqual(['a|b', 'y|z']);
  byId(w, 'y')!.state = 'meet';
  byId(w, 'a')!.state = 'sleep';
  expect(ids()).toEqual(['b|c']);
});
