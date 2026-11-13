/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a Hollow */
// Hearsay Hollow (ADR 0013 items 3 and 6, ADR 0007).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { createGrid } from '../../../../src/sim/grid.ts';
import { findMeetings } from '../../../../src/sim/meeting.ts';
import { canMeet, PACKS } from '../../../../src/sim/packs/index.ts';
import { step } from '../../../../src/sim/step.ts';
import type {
  BidReply,
  HeroKind,
  HollowState,
  Scenario,
  SimEvent,
  World,
} from '../../../../src/sim/types.ts';
import { HERO } from '../../../../src/sim/types.ts';
import { createWorld } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { get, hasBadNumber, scriptedRng, tuning as t } from '../helpers.ts';

type Local = { id: string; x: number; y: number };

const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const CENTER = { x: t.scene.width / 2, y: t.scene.height / 2 };

function heroAt(kind: HeroKind, x: number, y: number): NonNullable<Scenario['hero']> {
  return { kind, name: 'Wren', x, y, berries: 3, keepsakes: [], rumor: null };
}

/** A Hollow world with these locals, and a hero when given. */
function hollowWorld(locals: Local[], hero?: NonNullable<Scenario['hero']>): World {
  return createWorld(1, t, {
    valleyId: 'hollow',
    season: 'summer',
    creatures: locals.map((c) => ({ ...c, speciesId: 'kith', name: c.id, berries: 3, dials: { ...DIALS } })),
    bushes: [],
    structures: [],
    pack: { id: 'hollow' },
    ...(hero ? { hero } : {}),
  });
}

function hollow(w: World): HollowState {
  const p = w.pack!;
  if (p.id !== 'hollow') throw new Error('not a Hollow');
  return p;
}

/** Runs the Hollow's own step at `tick` with these events, with no draws. */
function hollowStep(w: World, tick: number, events: SimEvent[] = []): SimEvent[] {
  w.tick = tick;
  return PACKS.hollow.step(w, events, t, scriptedRng([]));
}

/** The three events of a meeting where `from` bids and `to` replies. */
function meeting(from: string, to: string, reply: BidReply, give: [boolean, boolean]): SimEvent[] {
  const move = (g: boolean) => (g ? ('give' as const) : ('keep' as const));
  return [
    { t: 'bid', from, to, reply, seenAs: reply },
    { t: 'gift', from, to, move: move(give[0]), seenAs: move(give[0]) },
    { t: 'gift', from: to, to: from, move: move(give[1]), seenAs: move(give[1]) },
  ];
}

const pair = (): World =>
  hollowWorld([
    { id: 'a', x: 400, y: 300 },
    { id: 'b', x: 410, y: 300 },
  ]);

test('the sky starts at the scene center, as the lens, and the Hollow takes no draws', () => {
  const w = pair();
  expect(hollow(w)).toEqual({ id: 'hollow', sky: CENTER, drama: [], fame: {}, front: null });
  expect(w.fields.light).toEqual(CENTER);
  expect(w.rngState).toBe(1);
});

test.each([
  ['against', 3],
  ['away', 1],
  ['toward', 0],
] as const)('a %s reply scores %i drama for the replier', (reply, score) => {
  const w = pair();
  hollowStep(w, 0, meeting('a', 'b', reply, [true, true]));
  expect(hollow(w).drama).toEqual(
    score === 0 ? [] : [{ subject: 'b', x: 405, y: 300, score, day: 0, hero: false }],
  );
});

test('a keep after the other side gift scores 2 for the keeper', () => {
  const w = pair();
  hollowStep(w, 0, meeting('a', 'b', 'toward', [true, false]));
  expect(hollow(w).drama).toEqual([{ subject: 'b', x: 405, y: 300, score: 2, day: 0, hero: false }]);
  // Both keep: no one kept after a gift.
  const both = pair();
  hollowStep(both, 0, meeting('a', 'b', 'toward', [false, false]));
  expect(hollow(both).drama).toEqual([]);
  // A later drama adds to the subject's entry and moves it to the newest spot and day.
  w.day = 2;
  get(w, 'a').x = 600;
  get(w, 'b').x = 620;
  hollowStep(w, 1, meeting('a', 'b', 'against', [false, false]));
  expect(hollow(w).drama).toEqual([{ subject: 'b', x: 610, y: 300, score: 5, day: 2, hero: false }]);
});

test('pose scores 3 at the hero with the hero as subject', () => {
  const w = hollowWorld([{ id: 'a', x: 400, y: 300 }], heroAt('kite', 700, 200));
  expect(applyCommand(w, { t: 'local', verb: { verb: 'pose' } }, t, scriptedRng([]))).toEqual([]);
  expect(hollow(w).drama).toEqual([{ subject: HERO, x: 700, y: 200, score: 3, day: 0, hero: true }]);
  // Without a hero, or with another verb, nothing.
  const lone = pair();
  for (const verb of [
    { verb: 'pose' as const },
    { verb: 'join' as const, on: true },
    { verb: 'keepsake' as const, to: 'a', item: 'feather' },
  ]) {
    applyCommand(lone, { t: 'local', verb }, t, scriptedRng([]));
  }
  expect(hollow(lone).drama).toEqual([]);
});

test('the sky moves 12 units a tick toward the top score; 24 toward a Lantern-bearer meeting', () => {
  const perTick = t.hollow.skySpeed / t.sim.stepsPerSecond;
  expect(perTick).toBe(12);
  const w = pair();
  const h = hollow(w);
  h.drama = [
    { subject: 'a', x: CENTER.x + 100, y: CENTER.y, score: 1, day: 0, hero: false },
    { subject: 'c', x: CENTER.x, y: CENTER.y + 100, score: 3, day: 0, hero: false },
    { subject: 'b', x: CENTER.x - 100, y: CENTER.y, score: 3, day: 0, hero: false },
  ];
  hollowStep(w, 0); // the tie at 3 goes to b
  expect(h.sky).toEqual({ x: CENTER.x - 12, y: CENTER.y });
  expect(w.fields.light).toEqual(h.sky);
  h.drama[2]!.x = h.sky.x - 5; // within a tick's reach: the sky stops on it
  hollowStep(w, 1);
  expect(h.sky).toEqual({ x: CENTER.x - 17, y: CENTER.y });

  // A Lantern-bearer, in a real step: the hero turns a local's bid against, and the sky moves 24.
  const lit = hollowWorld([{ id: 'a', x: 400, y: 300 }], heroAt('lantern', 405, 300));
  lit.hero!.reply = 'against';
  step(lit, [], t);
  const top = hollow(lit).drama[0]!;
  expect(top).toMatchObject({ subject: HERO, score: 3, hero: true });
  expect(Math.hypot(lit.fields.light!.x - CENTER.x, lit.fields.light!.y - CENTER.y)).toBeCloseTo(24, 9);

  // A Lantern-bearer's 2x needs the hero in the top drama; another hero kind moves 12.
  for (const [kind, hero, moved] of [
    ['lantern', false, 12],
    ['kite', true, 12],
    ['lantern', true, 24],
  ] as const) {
    const x = hollowWorld([], heroAt(kind, 100, 100));
    hollow(x).drama = [{ subject: HERO, x: CENTER.x + 200, y: CENTER.y, score: 1, day: 0, hero }];
    hollowStep(x, 0);
    expect(hollow(x).sky).toEqual({ x: CENTER.x + moved, y: CENTER.y });
  }
});

test('at dusk the gazette prints the top drama in the lens: fame +0.2, then every fame falls by a tenth', () => {
  const dusk = (w: World) => hollowStep(w, w.ticksPerDay - 1);
  const w = pair();
  w.day = 1;
  const h = hollow(w);
  h.fame = { c: 0.5 };
  h.drama = [
    { subject: 'a', x: CENTER.x + 30, y: CENTER.y, score: 3, day: 1, hero: false },
    { subject: 'b', x: CENTER.x + 400, y: CENTER.y, score: 5, day: 1, hero: false }, // out of the lens
    { subject: 'd', x: CENTER.x - 30, y: CENTER.y, score: 4, day: 0, hero: false }, // yesterday's
  ];
  const fameA = t.hollow.fameStep - t.hollow.fameFade * t.hollow.fameStep;
  expect(dusk(w)).toEqual([{ t: 'print', subject: 'a', fame: fameA }]);
  expect(h.fame).toEqual({ c: 0.5 - t.hollow.fameFade * 0.5, a: fameA });
  expect(fameA).toBeCloseTo(0.18, 12);
  expect(h.front).toBe('a');
  // Not at dusk, nothing prints.
  expect(hollowStep(w, 3)).toEqual([]);
  // With nothing in the lens today, nothing prints, and every fame still fades.
  w.day = 2;
  expect(dusk(w)).toEqual([]);
  expect(h.fame.a).toBe(fameA - t.hollow.fameFade * fameA);
  expect(h.front).toBe('a');
});

test('a creature with fame above 0.5 meets no local', () => {
  const w = hollowWorld(
    [
      { id: 'a', x: 400, y: 300 },
      { id: 'b', x: 405, y: 300 },
      { id: 'c', x: 800, y: 300 },
    ],
    heroAt('kite', 805, 300),
  );
  const h = hollow(w);
  const [a, b, c, hero] = [get(w, 'a'), get(w, 'b'), get(w, 'c'), get(w, HERO)];
  expect(t.hollow.fearAt).toBe(0.5);
  h.fame.a = 0.5;
  expect(canMeet(w, a, b, t)).toBe(true);
  h.fame.a = 0.51;
  expect(canMeet(w, a, b, t)).toBe(false);
  expect(canMeet(w, b, a, t)).toBe(false);
  // A famous local still meets the hero; a famous hero meets no local.
  expect(canMeet(w, a, hero, t)).toBe(true);
  h.fame[HERO] = 0.6;
  expect(canMeet(w, hero, c, t)).toBe(false);
  expect(canMeet(w, c, hero, t)).toBe(false);
  const meetings = findMeetings(w, createGrid(t.scene.width, t.scene.height, t.meet.radius), t);
  expect(meetings).toEqual([]);
});

test('a Glassling away scores 3; a Bellchime print raises fame by 0.4', () => {
  const glass = hollowWorld(
    [
      { id: 'a', x: 400, y: 300 },
      { id: 'b', x: 500, y: 300 },
    ],
    heroAt('glassling', 410, 300),
  );
  hollowStep(glass, 0, [
    ...meeting('a', HERO, 'away', [true, true]),
    ...meeting(HERO, 'b', 'away', [true, true]),
  ]);
  expect(hollow(glass).drama).toEqual([
    { subject: HERO, x: 405, y: 300, score: 3, day: 0, hero: true },
    { subject: 'b', x: 455, y: 300, score: 1, day: 0, hero: true },
  ]);

  const printed = (kind: HeroKind, subject: string) => {
    const w = hollowWorld([{ id: 'a', x: 100, y: 100 }], heroAt(kind, 200, 100));
    hollow(w).drama = [{ subject, x: CENTER.x, y: CENTER.y, score: 3, day: 0, hero: true }];
    hollowStep(w, w.ticksPerDay - 1);
    return hollow(w).fame[subject];
  };
  const twice = t.hollow.fameStep + t.hollow.fameStep;
  expect(printed('bellchime', HERO)).toBe(twice - t.hollow.fameFade * twice);
  expect(printed('bellchime', HERO)).toBeCloseTo(0.4 * 0.9, 12);
  const once = t.hollow.fameStep - t.hollow.fameFade * t.hollow.fameStep;
  expect(printed('bellchime', 'a')).toBe(once);
  expect(printed('kite', HERO)).toBe(once);
});

test('scores halve at each dusk', () => {
  const w = pair();
  const h = hollow(w);
  h.drama = [
    { subject: 'a', x: 100, y: 100, score: 3, day: 0, hero: false },
    { subject: 'b', x: 100, y: 100, score: 1, day: 0, hero: false },
  ];
  hollowStep(w, 5);
  expect(h.drama.map((d) => d.score)).toEqual([3, 1]);
  hollowStep(w, w.ticksPerDay - 1);
  expect(h.drama.map((d) => d.score)).toEqual([1.5, 0.5]);
});

test('heroFame and the snapshot read the fame; an empty Hollow gives no NaN', () => {
  const w = hollowWorld([{ id: 'a', x: 100, y: 100 }], heroAt('kite', 200, 100));
  expect(PACKS.hollow.metrics(w, t)).toEqual({ heroFame: 0 });
  expect(toLite(w, t).pack).toEqual({ id: 'hollow', fame: {}, front: null });
  hollow(w).fame = { [HERO]: 0.3, a: 0.1 };
  hollow(w).front = 'a';
  expect(PACKS.hollow.metrics(w, t)).toEqual({ heroFame: 0.3 });
  const lite = toLite(w, t);
  expect(lite.pack).toEqual({ id: 'hollow', fame: { [HERO]: 0.3, a: 0.1 }, front: 'a' });
  expect(lite.pack?.id === 'hollow' && lite.pack.fame).not.toBe(hollow(w).fame);

  const empty = hollowWorld([]);
  for (let i = 0; i < 2 * empty.ticksPerDay; i++) step(empty, [], t);
  expect(hasBadNumber(empty)).toBe(false);
  expect(hasBadNumber(toLite(empty, t))).toBe(false);
  expect(PACKS.hollow.metrics(empty, t)).toEqual({ heroFame: 0 });
});
