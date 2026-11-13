/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a Halcyon */
// Halcyon (ADR 0013 item 7) and the postcard nudge (item 10).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { hashWorld } from '../../../../src/sim/hash.ts';
import { resolveMeeting } from '../../../../src/sim/meeting.ts';
import { giftCost, giftWarmth, PACKS } from '../../../../src/sim/packs/index.ts';
import { step } from '../../../../src/sim/step.ts';
import type {
  Command,
  HalcyonState,
  LocalVerb,
  Scenario,
  SimEvent,
  World,
} from '../../../../src/sim/types.ts';
import { HERO } from '../../../../src/sim/types.ts';
import { createWorld, ensureTie, getTie, side } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { get, hasBadNumber, makeWorld, scriptedRng, setWarmth, tuning as t } from '../helpers.ts';
import { runGolden } from '../../../golden/run-golden.ts';
import golden from '../../../golden/m0-hash.json';

const WISP = 'wisp';
const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const REACH = 2 * t.meet.radius;

type Local = { id: string; x: number; y: number; opener?: number };

/** A Halcyon world with Wisp as the seeker and Kith at `kithWarmth`, and a hero at (400, 300). */
function halcyonWorld(locals: Local[], kithWarmth = 0.2, keepsakes = ['feather', 'acorn']): World {
  const scenario: Scenario = {
    valleyId: 'halcyon',
    season: 'summer',
    creatures: locals.map(({ opener, ...c }) => ({
      ...c,
      speciesId: 'kith',
      name: c.id,
      berries: 2,
      dials: { ...DIALS, opener: opener ?? 0.5 },
    })),
    bushes: [],
    structures: [],
    hero: { kind: 'kite', name: 'Wren', x: 400, y: 300, berries: 2, keepsakes, rumor: null },
    pack: { id: 'halcyon', kithWarmth, seeker: WISP },
  };
  return createWorld(1, t, scenario);
}

function halcyon(w: World): HalcyonState {
  const p = w.pack!;
  if (p.id !== 'halcyon') throw new Error('not a Halcyon');
  return p;
}

const keepsake = (to: string, item: string): Command => ({
  t: 'local',
  verb: { verb: 'keepsake', to, item },
});

/** Wisp's warmth toward the hero: its side of their tie, 0 with none. */
function wispWarmth(w: World): number {
  const tie = getTie(w, WISP, HERO);
  return tie ? side(tie, WISP).warmth : 0;
}

/** Runs Halcyon's own step at `tick`, with no draws. */
function halcyonStep(w: World, tick: number): SimEvent[] {
  w.tick = tick;
  return PACKS.halcyon.step(w, [], t, scriptedRng([]));
}
const dusk = (w: World): SimEvent[] => halcyonStep(w, w.ticksPerDay * (w.day + 1) - 1);

const near = (): World =>
  halcyonWorld([
    { id: WISP, x: 400 + REACH, y: 300 },
    { id: 'a', x: 400, y: 300 - REACH },
  ]);

test('a gift in Halcyon costs nothing and warms by 0.03', () => {
  const w = halcyonWorld([
    { id: 'a', x: 800, y: 300, opener: 0.9 },
    { id: 'b', x: 810, y: 300 },
  ]);
  expect(w.rngState).toBe(1); // Halcyon's setup takes no draw
  expect(giftCost(w, t)).toBe(0);
  expect(giftWarmth(w, t)).toBe(t.warmth.giftReceived * t.halcyon.giftWarmthMultiplier);
  expect(giftWarmth(w, t)).toBeCloseTo(0.03, 12);
  // a bids, b turns toward, and both give, with no fog: each gives nothing up and gets gift.value.
  const [a, b] = [get(w, 'a'), get(w, 'b')];
  const events = resolveMeeting(w, a, b, t, scriptedRng([0, 0, 0.99, 0, 0, 0.99, 0.99]));
  expect(events.slice(0, 3)).toEqual([
    { t: 'bid', from: 'a', to: 'b', reply: 'toward', seenAs: 'toward' },
    { t: 'gift', from: 'a', to: 'b', move: 'give', seenAs: 'give' },
    { t: 'gift', from: 'b', to: 'a', move: 'give', seenAs: 'give' },
  ]);
  expect([a.berries, b.berries]).toEqual([2 + t.gift.value, 2 + t.gift.value]);
  const tie = getTie(w, 'a', 'b')!;
  expect(side(tie, 'b').warmth).toBeCloseTo(0.03, 12);
  expect(side(tie, 'a').warmth).toBeCloseTo(t.warmth.toward + 0.03, 12);
  // A creature with no berries can still give.
  a.berries = 0;
  w.day = 1;
  resolveMeeting(w, a, b, t, scriptedRng([0, 0, 0.99, 0, 0, 0.99, 0.99]));
  expect(a.berries).toBe(t.gift.value);
});

test('a keepsake within 48 units warms the receiver by 0.6 toward the hero and leaves the hero', () => {
  expect(REACH).toBe(48);
  const w = near();
  setWarmth(w, 'a', HERO, 0.1);
  const rng = scriptedRng([]);
  expect(applyCommand(w, keepsake(WISP, 'feather'), t, rng)).toEqual([
    { t: 'keepsake', to: WISP, item: 'feather' },
  ]);
  expect(w.hero!.keepsakes).toEqual(['acorn']);
  expect(wispWarmth(w)).toBe(t.halcyon.keepsakeWarmth);
  expect(get(w, WISP).opinions[HERO]).toBe(t.halcyon.keepsakeWarmth);
  expect(halcyon(w).given).toBe(true);
  // The tie it made is the one a first meeting makes, with the keepsake's warmth on Wisp's side.
  const made = getTie(w, WISP, HERO)!;
  const fresh = halcyonWorld([{ id: WISP, x: 400 + REACH, y: 300 }]);
  const plain = ensureTie(fresh, get(fresh, WISP), get(fresh, HERO), t);
  expect(made).toEqual({ ...plain, [made.a === WISP ? 'ab' : 'ba']: { warmth: 0.6, slights: 0 } });
  // A keepsake to anyone else warms that creature, but Wisp has still been given only one.
  const other = near();
  setWarmth(other, 'a', HERO, 0.1);
  expect(applyCommand(other, keepsake('a', 'acorn'), t, rng)).toEqual([
    { t: 'keepsake', to: 'a', item: 'acorn' },
  ]);
  expect(side(getTie(other, 'a', HERO)!, 'a').warmth).toBeCloseTo(0.7, 12);
  expect(other.hero!.keepsakes).toEqual(['feather']);
  expect(halcyon(other).given).toBe(false);
  // Warmth stops at 1.
  setWarmth(other, 'a', HERO, 0.9);
  applyCommand(other, keepsake('a', 'feather'), t, rng);
  expect(side(getTie(other, 'a', HERO)!, 'a').warmth).toBe(1);
  expect(rng.used()).toBe(0);
});

test('a keepsake the hero lacks, or to a creature 49 units away, does nothing', () => {
  const w = halcyonWorld([
    { id: WISP, x: 400 + REACH + 1, y: 300 },
    { id: 'a', x: 400, y: 300 + REACH },
  ]);
  const before = hashWorld(w);
  for (const cmd of [
    keepsake(WISP, 'feather'), // 49 away
    keepsake('a', 'shell'), // the hero has none
    keepsake(HERO, 'feather'), // to the hero itself
    keepsake('nobody', 'feather'),
    { t: 'local', verb: { verb: 'pose' } } as const,
    { t: 'local', verb: { verb: 'join', on: true } } as const,
  ] satisfies Command[]) {
    expect(applyCommand(w, cmd, t, scriptedRng([]))).toEqual([]);
  }
  expect(hashWorld(w)).toBe(before);
  // Once given, a keepsake is gone.
  const once = near();
  applyCommand(once, keepsake('a', 'feather'), t, scriptedRng([]));
  const after = hashWorld(once);
  expect(applyCommand(once, keepsake(WISP, 'feather'), t, scriptedRng([]))).toEqual([]);
  expect(hashWorld(once)).toBe(after);
  // Without a hero, nothing.
  const lone = createWorld(1, t, {
    valleyId: 'halcyon',
    season: 'summer',
    creatures: [{ id: WISP, speciesId: 'kith', name: 'Wisp', x: 400, y: 300, berries: 2, dials: DIALS }],
    bushes: [],
    structures: [],
    pack: { id: 'halcyon', kithWarmth: 0.2, seeker: WISP },
  });
  const verb: LocalVerb = { verb: 'keepsake', to: WISP, item: 'feather' };
  expect(PACKS.halcyon.onVerb(lone, verb, t, scriptedRng([]))).toEqual([]);
});

test('Wisp chooses home at the dusk after a keepsake when its warmth is 0.6 and Kith is 0.2', () => {
  const w = near();
  applyCommand(w, keepsake(WISP, 'feather'), t, scriptedRng([]));
  expect(wispWarmth(w)).toBe(t.wisp.minWarmth);
  expect(halcyon(w).kithWarmth).toBe(t.wisp.minKithWarmth);
  expect(halcyonStep(w, 5)).toEqual([]); // not yet dusk
  expect(halcyon(w).chose).toBeNull();
  expect(dusk(w)).toEqual([{ t: 'goHome', who: WISP }]);
  expect(halcyon(w).chose).toBe('home');
  expect(toLite(w, t).pack).toEqual({ id: 'halcyon', chose: 'home' });
  // Just under 0.6 toward the hero, it stays.
  const cool = near();
  applyCommand(cool, keepsake(WISP, 'feather'), t, scriptedRng([]));
  setWarmth(cool, WISP, HERO, 0.59);
  expect(dusk(cool)).toEqual([{ t: 'stay', who: WISP }]);
  expect(halcyon(cool).chose).toBe('stay');
});

test('Wisp stays when Kith is 0.19, and chooses by the third dusk with no keepsake', () => {
  const w = halcyonWorld([{ id: WISP, x: 400 + REACH, y: 300 }], 0.19);
  applyCommand(w, keepsake(WISP, 'feather'), t, scriptedRng([]));
  expect(dusk(w)).toEqual([{ t: 'stay', who: WISP }]);

  // With no keepsake, Wisp waits through the dusks of days 0 and 1 and chooses at the third dusk (day 2).
  expect(t.halcyon.chooseByDay).toBe(3);
  const late = halcyonWorld([{ id: WISP, x: 400 + REACH, y: 300 }]);
  setWarmth(late, WISP, HERO, 0.8);
  for (let day = 0; day < 2; day++) {
    late.day = day;
    expect(dusk(late)).toEqual([]);
  }
  late.day = 2;
  expect(halcyonStep(late, 2 * late.ticksPerDay + 7)).toEqual([]);
  expect(dusk(late)).toEqual([{ t: 'goHome', who: WISP }]);

  // Through real steps, from a fresh world, the choice comes at the third dusk.
  const run = halcyonWorld([{ id: WISP, x: 1200, y: 800 }]);
  const chose: { tick: number; e: SimEvent }[] = [];
  for (let i = 0; i < 5 * run.ticksPerDay; i++) {
    const tick = run.tick;
    for (const e of step(run, [], t)) if (e.t === 'goHome' || e.t === 'stay') chose.push({ tick, e });
  }
  expect(chose).toEqual([{ tick: 3 * run.ticksPerDay - 1, e: { t: 'stay', who: WISP } }]);
});

test('Wisp chooses once', () => {
  const w = near();
  applyCommand(w, keepsake(WISP, 'feather'), t, scriptedRng([]));
  expect(dusk(w)).toEqual([{ t: 'goHome', who: WISP }]);
  // A later keepsake, a colder Wisp, and more dusks change nothing.
  applyCommand(w, keepsake(WISP, 'acorn'), t, scriptedRng([]));
  setWarmth(w, WISP, HERO, -1);
  for (let day = 1; day < 6; day++) {
    w.day = day;
    expect(dusk(w)).toEqual([]);
  }
  expect(halcyon(w).chose).toBe('home');
  expect(PACKS.halcyon.metrics(w, t)).toEqual({});
  expect(hasBadNumber(toLite(w, t))).toBe(false);
});

test('nudge raises one dial of every creature not gone by 0.1, clamped', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b', ear: 0.95 }, { id: 'c', ear: 0.02 }, { id: 'd' }]);
  get(w, 'c').state = 'away'; // away for now, not gone
  get(w, 'd').gone = true;
  get(w, 'd').state = 'away';
  const rng = scriptedRng([]);
  const nudge = (dial: unknown, amount: unknown) =>
    applyCommand(w, { t: 'nudge', dial, amount } as Command, t, rng);
  expect(nudge('ear', t.postcard.nudge)).toEqual([]);
  expect(['a', 'b', 'c', 'd'].map((id) => get(w, id).dials.ear)).toEqual([0.5 + 0.1, 1, 0.02 + 0.1, 0.5]);
  expect(get(w, 'a').dials).toEqual({ ...DIALS, ear: 0.6 });
  nudge('ear', -0.5);
  expect(['a', 'b', 'c', 'd'].map((id) => get(w, id).dials.ear)).toEqual([0.5 + 0.1 - 0.5, 1 - 0.5, 0, 0.5]);
  // An unknown dial or a non-finite amount changes nothing; no nudge draws.
  const before = hashWorld(w);
  nudge('courage', 0.1);
  nudge('ear', NaN);
  nudge('ear', Infinity);
  expect(hashWorld(w)).toBe(before);
  expect(rng.used()).toBe(0);
  // The plain world keeps the golden hash.
  expect(hashWorld(runGolden())).toBe(golden.hash);
});
