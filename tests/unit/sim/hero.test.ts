/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a hero */
// The hero in the sim (ADR 0013 items 1, 2, and 8).
import { expect, test } from 'vitest';
import { runGolden } from '../../golden/run-golden.ts';
import { applyCommand } from '../../../src/sim/commands.ts';
import { gossip } from '../../../src/sim/daily/gossip.ts';
import { imitate } from '../../../src/sim/daily/imitation.ts';
import { decaySlights, driftWarmth } from '../../../src/sim/daily/drift.ts';
import { leave, regrowBushes } from '../../../src/sim/daily/population.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { exp2neg } from '../../../src/sim/math.ts';
import { resolveMeeting } from '../../../src/sim/meeting.ts';
import { moveCreatures } from '../../../src/sim/move.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { step } from '../../../src/sim/step.ts';
import type { Command, HeroKind, Scenario, World } from '../../../src/sim/types.ts';
import { HERO } from '../../../src/sim/types.ts';
import { ensureTie, getTie, side } from '../../../src/sim/world.ts';
import type { CreatureSpec } from './helpers.ts';
import { befriend, get, makeWorld, scriptedRng, setWarmth, tuning as t } from './helpers.ts';

type HeroSpec = NonNullable<Scenario['hero']>;

/** A world with these locals and a lantern hero named Wren at (800, 450) with 3 berries. */
function heroWorld(locals: CreatureSpec[], hero: Partial<HeroSpec> = {}, over: Partial<Scenario> = {}) {
  const spec: HeroSpec = {
    kind: 'lantern',
    name: 'Wren',
    x: 800,
    y: 450,
    berries: 3,
    keepsakes: [],
    rumor: null,
  };
  return makeWorld(locals, { hero: { ...spec, ...hero }, ...over });
}

const none = () => scriptedRng([]);
const run = (w: World, cmd: Command) => applyCommand(w, cmd, t, none());

test('the hero is the last creature, with its kind as species and a toward-and-give manner', () => {
  const w = heroWorld([{ id: 'a' }, { id: 'b' }], { kind: 'kite', berries: 2, keepsakes: ['acorn'] });
  expect(w.creatures.map((c) => c.id)).toEqual(['a', 'b', HERO]);
  expect(get(w, HERO)).toMatchObject({
    speciesId: 'kite',
    name: 'Wren',
    x: 800,
    y: 450,
    berries: 2,
    state: 'wander',
    dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
    shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
  });
  expect(w.hero).toEqual({ kind: 'kite', reply: 'toward', gift: 'give', waveTo: null, keepsakes: ['acorn'] });
  expect(makeWorld([{ id: 'a' }])).not.toHaveProperty('hero');
});

test('a rumor becomes the first opinion of locals whose Ear is at or below its strength', () => {
  const w = heroWorld(
    [
      { id: 'low', ear: 0.3 },
      { id: 'edge', ear: 0.4 },
      { id: 'high', ear: 0.5 },
    ],
    {
      rumor: { value: -0.6, strength: 0.4 },
    },
  );
  expect(get(w, 'low').opinions).toEqual({ hero: -0.6 });
  expect(get(w, 'edge').opinions).toEqual({ hero: -0.6 });
  expect(get(w, 'high').opinions).toEqual({});
  expect(get(w, HERO).opinions).toEqual({});
  const tie = ensureTie(w, get(w, 'low'), get(w, HERO), t);
  expect(side(tie, 'low').warmth).toBeCloseTo(-0.3, 12);
  expect(side(tie, HERO).warmth).toBe(0);
  expect(get(heroWorld([{ id: 'low', ear: 0 }]), 'low').opinions).toEqual({});
});

test('walk to a point moves only the hero; it stops there and picks no goal', () => {
  const w = heroWorld([{ id: 'a', x: 100, y: 100 }], { x: 200, y: 450 });
  const a = get(w, 'a');
  const hero = get(w, HERO);
  w.hero!.waveTo = 'a';
  run(w, { t: 'walk', x: 400, y: 450 });
  expect([hero.goalX, hero.goalY]).toEqual([400, 450]);
  expect([a.goalX, a.goalY]).toEqual([100, 100]);
  expect(w.hero!.waveTo).toBeNull();
  a.state = 'sleep'; // the local takes no draws, so any draw is the hero's
  for (let i = 0; i < 200; i++) moveCreatures(w, t, none());
  expect(Math.hypot(hero.x - 400, hero.y - 450)).toBeLessThanOrEqual(t.move.arriveRadius);
  expect([hero.goalX, hero.goalY]).toEqual([400, 450]);
  run(w, { t: 'walk', x: -50, y: 2000 });
  expect([hero.goalX, hero.goalY]).toEqual([0, t.scene.height]);
});

test('walk to a creature makes the hero follow it and bid at their meeting', () => {
  // `a` has the higher Opener, so `a` would bid at any meeting the hero did not wave at.
  const w = heroWorld([{ id: 'a', x: 1400, y: 200, opener: 0.9 }], { x: 200, y: 700 });
  const a = get(w, 'a');
  const hero = get(w, HERO);
  run(w, { t: 'walk', to: 'a' });
  expect(w.hero!.waveTo).toBe('a');
  for (let i = 0; i < 2000; i++) {
    const bid = step(w, [], t).find((e) => e.t === 'bid');
    if (bid) {
      expect(bid).toMatchObject({ from: HERO, to: 'a' });
      expect(w.hero!.waveTo).toBeNull();
      return;
    }
    expect([hero.goalX, hero.goalY]).toEqual([a.x, a.y]);
  }
  throw new Error('the hero never met the creature it followed');
});

test('the hero stops following a creature that goes away', () => {
  const w = heroWorld([{ id: 'a', x: 1400 }], { x: 200 });
  run(w, { t: 'walk', to: 'a' });
  get(w, 'a').state = 'away';
  moveCreatures(w, t, createRng(1));
  const hero = get(w, HERO);
  expect(w.hero!.waveTo).toBeNull();
  expect([hero.goalX, hero.goalY]).toEqual([hero.x, hero.y]);
});

test('water stops the hero with its goal at its own spot, and it picks no goal', () => {
  const w = heroWorld([], { x: 400, y: 450 }, { water: [{ x: 700, y: 0, w: 60, h: 900 }] });
  const hero = get(w, HERO);
  run(w, { t: 'walk', x: 1200, y: 450 });
  let stopped = false;
  for (let i = 0; i < 200 && !stopped; i++) {
    moveCreatures(w, t, none());
    stopped = hero.goalX !== 1200;
  }
  expect(stopped).toBe(true);
  expect([hero.goalX, hero.goalY]).toEqual([hero.x, hero.y]);
  expect([hero.vx, hero.vy]).toEqual([0, 0]);
  expect(hero.x).toBeLessThan(700 - t.bank.side);
  const at = [hero.x, hero.y];
  for (let i = 0; i < 20; i++) moveCreatures(w, t, none());
  expect([hero.x, hero.y]).toEqual(at);
});

test('water stops a hero that follows a creature, and the wave is spent', () => {
  const w = heroWorld(
    [{ id: 'a', x: 1200, y: 450 }],
    { x: 400, y: 450 },
    { water: [{ x: 700, y: 0, w: 60, h: 900 }] },
  );
  get(w, 'a').state = 'sleep'; // stays put on the far side and takes no draws
  run(w, { t: 'walk', to: 'a' });
  const hero = get(w, HERO);
  for (let i = 0; i < 200 && w.hero!.waveTo !== null; i++) moveCreatures(w, t, none());
  expect(w.hero!.waveTo).toBeNull();
  expect([hero.goalX, hero.goalY]).toEqual([hero.x, hero.y]);
  expect(hero.x).toBeLessThan(700 - t.bank.side);
});

test('after overPoke the hero keeps its goal inside the lens', () => {
  const w = heroWorld([]);
  const hero = get(w, HERO);
  run(w, { t: 'shine', x: hero.x, y: hero.y });
  run(w, { t: 'overPoke' });
  for (let i = 0; i < 5; i++) moveCreatures(w, t, none());
  expect([hero.goalX, hero.goalY]).toEqual([800, 450]);
  expect([hero.x, hero.y]).toEqual([800, 450]);
});

test('a scenario creature may not use the hero id alongside a hero', () => {
  expect(() => heroWorld([{ id: HERO }])).toThrow(/hero/);
});

test('arrangeMeeting with the hero moves only the other creature, to the hero', () => {
  const w = heroWorld([{ id: 'a', x: 100, y: 100 }], { x: 600, y: 300 });
  const hero = get(w, HERO);
  run(w, { t: 'arrangeMeeting', a: 'a', b: HERO });
  expect([get(w, 'a').goalX, get(w, 'a').goalY]).toEqual([600, 300]);
  expect([hero.goalX, hero.goalY]).toEqual([600, 300]);
  run(w, { t: 'walk', x: 900, y: 300 });
  run(w, { t: 'arrangeMeeting', a: HERO, b: 'a' });
  expect([hero.goalX, hero.goalY]).toEqual([900, 300]);
});

test('the hero never leaves by hunger, never gossips, and is never imitated', () => {
  const w = heroWorld([{ id: 'a', ear: 0.5 }, { id: 'b' }]);
  const hero = get(w, HERO);
  for (const c of w.creatures) c.hungryDusks = t.population.leaveHungryDusks;
  expect(leave(w, t, none())).toEqual([
    { t: 'leave', who: 'a' },
    { t: 'leave', who: 'b' },
  ]);
  expect(hero.state).toBe('wander');

  // A listener whose only friend is the hero hears nothing from it.
  const g = heroWorld([{ id: 'a', ear: 0.5 }, { id: 'b' }, { id: 'c' }]);
  befriend(g, 'a', HERO);
  get(g, HERO).opinions.b = -0.9;
  expect(gossip(g, t, none())).toEqual([]);
  // With a local friend holding the same opinion, the hero's own value does not count.
  befriend(g, 'a', 'c');
  get(g, 'c').opinions.b = -0.5;
  expect(gossip(g, t, none())).toEqual([{ t: 'opinion', holder: 'a', about: 'b', value: -0.5 }]);

  // Imitation: the hero has no neighbor to copy and is nobody's neighbor, so no draws at all.
  const m = heroWorld([{ id: 'a', berries: 0 }], { berries: 9 });
  m.day = t.imitation.everyDays - 1;
  expect(imitate(m, t, none())).toEqual([]);
});

test('walk and manner with bad values are ignored', () => {
  const w = heroWorld([{ id: 'a' }, { id: 'gone' }]);
  get(w, 'gone').state = 'away';
  const before = structuredClone(w);
  for (const cmd of [
    { t: 'walk', to: HERO },
    { t: 'walk', to: 'nobody' },
    { t: 'walk', to: 'gone' },
    { t: 'walk', x: NaN, y: 100 },
    { t: 'walk', x: 100, y: Infinity },
    { t: 'manner', reply: 'shrug' as 'toward', gift: 'give' },
    { t: 'manner', reply: 'toward', gift: 'hoard' as 'give' },
  ] satisfies Command[]) {
    expect(run(w, cmd)).toEqual([]);
  }
  expect(w).toEqual(before);
  run(w, { t: 'manner', reply: 'against', gift: 'keep' });
  expect(w.hero).toMatchObject({ reply: 'against', gift: 'keep' });
});

// The six knacks (ADR 0013 item 3). Each test runs the hero of that kind against the same world
// with a Lantern-bearer (or, for the Lantern-bearer, a Kite-rider) as control.

/** How `from` feels about `to`, 0 with no tie. */
const warmthOf = (w: World, from: string, to: string) => {
  const tie = getTie(w, from, to);
  return tie ? side(tie, from).warmth : 0;
};

test('fog 1 flips a Lantern-bearer toward reply at half the chance it flips a local one', () => {
  // The local bids; the hero replies toward and gives. Fog 1 everywhere: a local's toward is
  // misread below 0.5, a Lantern-bearer's below 0.25.
  const meet = (kind: HeroKind, fogDraw: number) => {
    const w = heroWorld([{ id: 'a' }], { kind });
    w.fields.fog.fill(1);
    return resolveMeeting(
      w,
      get(w, 'a'),
      get(w, HERO),
      t,
      scriptedRng([0, 0, fogDraw, 0.9, 0, 0.9, fogDraw]),
    );
  };
  expect(meet('lantern', 0.3)).toMatchObject([
    { t: 'bid', from: 'a', to: HERO, reply: 'toward', seenAs: 'toward' },
    { t: 'gift', from: 'a', move: 'keep' },
    { t: 'gift', from: HERO, move: 'give', seenAs: 'give' },
  ]);
  expect(meet('kite', 0.3)).toMatchObject([
    { t: 'bid', reply: 'toward', seenAs: 'away' },
    { t: 'gift', from: 'a', move: 'keep' },
    { t: 'gift', from: HERO, move: 'give', seenAs: 'keep' },
  ]);
  expect(meet('lantern', 0.24)).toMatchObject([
    { t: 'bid', seenAs: 'away' },
    { t: 'gift', from: 'a' },
    { t: 'gift', from: HERO, seenAs: 'keep' },
  ]);
  // A local's reply to the Lantern-bearer's wave is misread as usual.
  const w = heroWorld([{ id: 'a' }]);
  w.fields.fog.fill(1);
  w.hero!.waveTo = 'a';
  expect(
    resolveMeeting(w, get(w, 'a'), get(w, HERO), t, scriptedRng([0, 0, 0.3, 0.9, 0.9, 0, 0]))[0],
  ).toMatchObject({ from: HERO, to: 'a', reply: 'toward', seenAs: 'away' });
});

test('a Glassling is never misread, and a gift to a local raises its warmth by 0.225', () => {
  // The hero waved, so it bids and the local's only warmth change is the hero's gift. The local's
  // reply is not the hero's, so its fog draw (0.9) is set to read it true.
  const meet = (kind: HeroKind, fog: number) => {
    const w = heroWorld([{ id: 'a' }], { kind });
    w.fields.fog.fill(fog);
    w.hero!.waveTo = 'a';
    const events = resolveMeeting(w, get(w, 'a'), get(w, HERO), t, scriptedRng([0, 0, 0.9, 0, 0.9, 0, 0]));
    return { events, warmth: warmthOf(w, 'a', HERO), heroWarmth: warmthOf(w, HERO, 'a') };
  };
  const glass = meet('glassling', 1);
  expect(glass.events).toMatchObject([
    { t: 'bid', from: HERO, to: 'a', reply: 'toward', seenAs: 'toward' },
    { t: 'gift', from: HERO, move: 'give', seenAs: 'give' },
    { t: 'gift', from: 'a', move: 'keep', seenAs: 'keep' },
  ]);
  expect(glass.warmth).toBeCloseTo(0.225, 12);
  // The hero's own side is not scaled: the toward it saw, and the keep after its gift.
  expect(glass.heroWarmth).toBeCloseTo(t.warmth.toward + t.warmth.keepAfterGift, 12);
  expect(meet('lantern', 1).events[1]).toMatchObject({ move: 'give', seenAs: 'keep' });
  expect(meet('lantern', 0).warmth).toBeCloseTo(0.15, 12);

  // Every warmth change on the local's side toward a Glassling: a toward it saw, a keep after its gift.
  const g = heroWorld([{ id: 'a' }], { kind: 'glassling' });
  g.hero!.gift = 'keep';
  resolveMeeting(g, get(g, 'a'), get(g, HERO), t, scriptedRng([0, 0, 0.9, 0, 0, 0.9, 0.9]));
  expect(warmthOf(g, 'a', HERO)).toBeCloseTo(1.5 * (t.warmth.toward + t.warmth.keepAfterGift), 12);
});

test('a Kite-rider walks 1.5 times as far in 10 ticks', () => {
  const far = (kind: HeroKind) => {
    const w = heroWorld([], { kind, x: 100, y: 450 });
    const hero = get(w, HERO);
    run(w, { t: 'walk', x: 1500, y: 450 });
    for (let i = 0; i < 20; i++) moveCreatures(w, t, none()); // up to top speed
    const x0 = hero.x;
    for (let i = 0; i < 10; i++) moveCreatures(w, t, none());
    return hero.x - x0;
  };
  expect(far('lantern')).toBeCloseTo(t.move.speed, 9);
  expect(far('kite')).toBeCloseTo(1.5 * t.move.speed, 9);
});

test("a Mosscoat's slight fades at Memory 1 when the holder's Memory is 0.5", () => {
  const dusk = (kind: HeroKind) => {
    const w = heroWorld([{ id: 'a', memory: 0.5 }, { id: 'b' }], { kind });
    for (const [from, to] of [
      ['a', HERO],
      [HERO, 'a'],
      ['a', 'b'],
    ] as const) {
      setWarmth(w, from, to, 0.5);
      side(getTie(w, from, to)!, from).slights = 1;
    }
    w.day = 1; // no meeting today
    driftWarmth(w, t, none());
    decaySlights(w, t, none());
    const at = (from: string, to: string) => side(getTie(w, from, to)!, from);
    return { local: at('a', HERO), hero: at(HERO, 'a'), other: at('a', 'b') };
  };
  const fade = (memory: number) =>
    exp2neg(1 / (t.memory.halfLifeMinDays + t.memory.halfLifeSpanDays * memory));
  const moss = dusk('mosscoat');
  const lantern = dusk('lantern');
  expect(moss.local.slights).toBe(fade(1));
  expect(lantern.local.slights).toBe(fade(0.5));
  expect(moss.local.warmth).toBeCloseTo(0.5 * (1 - t.warmth.dailyDrift / 2), 12);
  expect(lantern.local.warmth).toBeCloseTo(0.5 * (1 - t.warmth.dailyDrift), 12);
  // The hero's own side and a tie between locals are as before.
  expect(moss.hero).toEqual(lantern.hero);
  expect(moss.other).toEqual(lantern.other);
});

test('a planted gift costs 1 berry, holds 3 berries two dusks later, and warms each first taker by 0.1', () => {
  const w = heroWorld(
    [
      { id: 'a', x: 800, y: 450, berries: 0 },
      { id: 'b', x: 805, y: 450, berries: 0 },
    ],
    {
      kind: 'seedcarrier',
    },
  );
  const hero = get(w, HERO);
  expect(run(w, { t: 'plant' })).toEqual([]);
  expect(hero.berries).toBe(2);
  const bush = w.bushes[0]!;
  expect(bush).toEqual({
    id: 'bush-1',
    x: 800,
    y: 450,
    berries: 0,
    gift: { from: HERO, readyDay: 2, found: [] },
  });
  for (const day of [0, 1]) {
    w.day = day;
    regrowBushes(w, t, none());
    expect(bush.berries).toBe(0);
  }
  w.day = 2;
  regrowBushes(w, t, none());
  expect(bush.berries).toBe(t.knack.seedBerries);
  w.day = 3;
  regrowBushes(w, t, none());
  expect(bush.berries).toBe(3); // it never regrows

  hero.x = hero.goalX = 100; // out of reach, so only the locals take
  get(w, 'b').state = 'sleep';
  const rng = createRng(1);
  moveCreatures(w, t, rng);
  expect(get(w, 'a').berries).toBe(1);
  expect(warmthOf(w, 'a', HERO)).toBeCloseTo(0.1, 12);
  get(w, 'a').forageReadyTick = 0;
  get(w, 'b').state = 'wander';
  moveCreatures(w, t, rng);
  expect(get(w, 'a').berries).toBe(2);
  expect(warmthOf(w, 'a', HERO)).toBeCloseTo(0.1, 12); // once per gift
  expect(warmthOf(w, 'b', HERO)).toBeCloseTo(0.1, 12);
  expect(bush.gift!.found).toEqual(['a', 'b']);
  expect(bush.berries).toBe(0);
});

test('a Bellchime wave answers separately from every wandering creature within 72 units', () => {
  const wave = (kind: HeroKind, draws: number[]) => {
    const w = heroWorld(
      [
        { id: 'a', x: 810, y: 450 }, // the one it waved at
        { id: 'b', x: 860, y: 450 }, // within 72
        { id: 'c', x: 800, y: 500 }, // within 72 but asleep
        { id: 'd', x: 873, y: 450 }, // beyond 72
        { id: 'e', x: 800, y: 378 }, // at 72
      ],
      { kind },
    );
    get(w, 'c').state = 'sleep';
    w.hero!.waveTo = 'a';
    return { w, events: resolveMeeting(w, get(w, 'a'), get(w, HERO), t, scriptedRng(draws)) };
  };
  const main = [0, 0, 0.9, 0.9, 0.9, 0.9, 0.9];
  const bell = wave('bellchime', [...main, 0, 0.99]);
  expect(bell.events).toMatchObject([
    { t: 'bid', from: HERO, to: 'a' },
    { t: 'gift', from: HERO },
    { t: 'gift', from: 'a' },
    { t: 'bid', from: HERO, to: 'b', reply: 'toward', seenAs: 'toward' },
    { t: 'bid', from: HERO, to: 'e', reply: 'away', seenAs: 'away' },
  ]);
  expect(bell.events).toHaveLength(5);
  for (const [who, d] of [
    ['b', t.warmth.toward],
    ['e', t.warmth.away],
  ] as const) {
    expect(warmthOf(bell.w, HERO, who)).toBeCloseTo(d, 12);
    expect(warmthOf(bell.w, who, HERO)).toBeCloseTo(d, 12);
  }
  expect(getTie(bell.w, HERO, 'c')).toBeUndefined();
  expect(getTie(bell.w, HERO, 'd')).toBeUndefined();
  // A Lantern-bearer's wave reaches only the one it waved at, with the seven draws.
  expect(wave('lantern', main).events).toHaveLength(3);
  // A meeting the Bellchime did not wave at reaches no one else.
  const w = heroWorld(
    [
      { id: 'a', x: 810 },
      { id: 'b', x: 860 },
    ],
    { kind: 'bellchime' },
  );
  expect(resolveMeeting(w, get(w, 'a'), get(w, HERO), t, scriptedRng(main))).toHaveLength(3);
});

test('plant is ignored for other kinds and below 1 berry', () => {
  for (const [kind, berries] of [
    ['lantern', 3],
    ['bellchime', 3],
    ['seedcarrier', 0],
  ] as const) {
    const w = heroWorld([], { kind, berries });
    const before = structuredClone(w);
    expect(applyCommand(w, { t: 'plant' }, t, scriptedRng([]))).toEqual([]);
    expect(w).toEqual(before);
  }
  const w = makeWorld([{ id: 'a' }]);
  const before = structuredClone(w);
  expect(applyCommand(w, { t: 'plant' }, t, scriptedRng([]))).toEqual([]);
  expect(w).toEqual(before);
});

test('the m0 golden hash is unchanged', () => {
  expect(hashWorld(runGolden())).toBe('c29d2fa4dbda4dcf');
});
