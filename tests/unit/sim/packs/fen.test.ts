/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a Fen */
// Rule packs and Murmuration Fen (ADR 0013 items 4 and 5, ADR 0007).
import { expect, test } from 'vitest';
import golden from '../../../golden/m0-hash.json';
import { runGolden } from '../../../golden/run-golden.ts';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { createGrid } from '../../../../src/sim/grid.ts';
import { hashWorld } from '../../../../src/sim/hash.ts';
import { findMeetings, resolveMeeting } from '../../../../src/sim/meeting.ts';
import { perceivedShares, TOVE } from '../../../../src/sim/packs/fen.ts';
import { canMeet, giftCost, giftWarmth, PACKS } from '../../../../src/sim/packs/index.ts';
import { createRng } from '../../../../src/sim/rng.ts';
import { step } from '../../../../src/sim/step.ts';
import type { FenState, Scenario, World } from '../../../../src/sim/types.ts';
import { HERO } from '../../../../src/sim/types.ts';
import { createWorld, getTie } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { get, hasBadNumber, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

type Bird = { id: string; x: number; y: number; speciesId?: string };

const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };

/** A Fen world with these birds (starlings unless set), Tove fixed at 0.5. */
function fenWorld(
  birds: Bird[],
  pack: { restless?: string[]; fixed?: Record<string, number> } = {},
  over: Partial<Scenario> = {},
  seed = 1,
): World {
  return createWorld(seed, t, {
    valleyId: 'fen',
    season: 'summer',
    creatures: birds.map((b) => ({
      id: b.id,
      speciesId: b.speciesId ?? 'starling',
      name: b.id,
      x: b.x,
      y: b.y,
      berries: 3,
      dials: { ...DIALS },
    })),
    bushes: [],
    structures: [],
    pack: { id: 'fen', restless: pack.restless ?? [], fixed: pack.fixed ?? { [TOVE]: 0.5 } },
    ...over,
  });
}

function fen(w: World): FenState {
  return w.pack!;
}

/** Runs the Fen's own step at `tick`, with no draws. */
function fenStep(w: World, tick: number): void {
  w.tick = tick;
  PACKS.fen.step(w, [], t, scriptedRng([]));
}

/**
 * Tove at (800, 450), its seven nearest n1..n7 at 10 to 16 units, and three far birds. Every
 * bird but Tove holds a threshold of 1, so only Tove can rise; n1..n3 are restless.
 */
function toveWorld(over: Partial<Scenario> = {}): World {
  const near: [number, number][] = [
    [810, 450],
    [800, 461],
    [788, 450],
    [800, 437],
    [814, 456],
    [785, 444],
    [806, 434],
  ];
  const birds: Bird[] = [
    { id: TOVE, x: 800, y: 450 },
    ...near.map(([x, y], i) => ({ id: `n${String(i + 1)}`, x, y })),
    { id: 'far1', x: 100, y: 100 },
    { id: 'far2', x: 110, y: 100 },
    { id: 'far3', x: 100, y: 110 },
  ];
  const fixed: Record<string, number> = { [TOVE]: 0.5 };
  for (const b of birds) if (b.id !== TOVE) fixed[b.id] = 1;
  return fenWorld(birds, { restless: ['n1', 'n2', 'n3'], fixed }, over);
}

test('thresholds are drawn from 0.2 to 0.8 in creature order; Tove holds 0.5', () => {
  const w = fenWorld(
    [
      { id: 's1', x: 100, y: 100 },
      { id: TOVE, x: 200, y: 100 },
      { id: 'pim', x: 300, y: 100, speciesId: 'kith' },
      { id: 's2', x: 400, y: 100 },
      { id: 's3', x: 500, y: 100 },
    ],
    { restless: ['s3', 'pim', 'nobody'] },
    {},
    7,
  );
  const rng = createRng(7);
  const [d1, d2, d3] = [rng.next(), rng.next(), rng.next()];
  expect(fen(w).thresholds).toEqual({
    s1: 0.2 + 0.6 * d1,
    [TOVE]: 0.5,
    s2: 0.2 + 0.6 * d2,
    s3: 0.2 + 0.6 * d3,
  });
  for (const v of Object.values(fen(w).thresholds)) expect(v >= 0.2 && v < 0.8).toBe(true);
  expect(w.rngState).toBe(rng.state());
  // Only restless starlings fly from the start.
  expect(fen(w)).toMatchObject({ id: 'fen', flying: ['s3'], restless: ['s3'], heroFlying: false });
});

test('a starling flies when the share of its 7 nearest in flight reaches its threshold, and not one tick sooner', () => {
  const w = toveWorld();
  fenStep(w, 0); // 3 of 7 fly: below 0.5
  expect(fen(w).flying).toEqual(['n1', 'n2', 'n3']);
  fen(w).flying.push('n4'); // now 4 of 7, between checks
  for (let tick = 1; tick < t.fen.everyTicks; tick++) {
    fenStep(w, tick);
    expect(fen(w).flying).not.toContain(TOVE);
  }
  fenStep(w, t.fen.everyTicks);
  expect(fen(w).flying).toEqual([TOVE, 'n1', 'n2', 'n3', 'n4']);

  // The share reaching the threshold exactly is enough.
  const exact = toveWorld();
  fen(exact).thresholds[TOVE] = 3 / 7;
  fenStep(exact, 0);
  expect(fen(exact).flying).toContain(TOVE);
});

test('from duskAt the thresholds are 0.15 lower; at dawn all but the restless land', () => {
  const w = toveWorld();
  const day = w.ticksPerDay;
  const duskTick = Math.ceil((t.fen.duskAt * day) / t.fen.everyTicks) * t.fen.everyTicks;
  fenStep(w, duskTick - t.fen.everyTicks); // 3 of 7 is below 0.5
  expect(fen(w).flying).not.toContain(TOVE);
  fenStep(w, duskTick); // and at or above 0.5 - 0.15
  expect(fen(w).flying).toContain(TOVE);
  fen(w).flying.push('far1');
  fenStep(w, day); // dawn: Tove and far1 land, the restless stay up, and 3 of 7 is below 0.5 again
  expect(fen(w).flying).toEqual(['n1', 'n2', 'n3']);
});

test('a joined hero counts as flying for its neighbors', () => {
  const hero = {
    kind: 'kite' as const,
    name: 'Wren',
    x: 795,
    y: 455,
    berries: 3,
    keepsakes: [],
    rumor: null,
  };
  // The hero stands nearer Tove than n7, so Tove's seven nearest are n1..n6 and the hero.
  const w = toveWorld({ hero });
  const join = (on: boolean) =>
    applyCommand(w, { t: 'local', verb: { verb: 'join', on } }, t, scriptedRng([]));
  expect(join(true)).toEqual([]);
  expect(fen(w).heroFlying).toBe(true);
  fenStep(w, 0); // n1..n3 and the hero: 4 of 7
  expect(fen(w).flying).toContain(TOVE);
  join(false);
  expect(fen(w).heroFlying).toBe(false);
  // Without the hero, a join changes nothing.
  const lone = toveWorld();
  applyCommand(lone, { t: 'local', verb: { verb: 'join', on: true } }, t, scriptedRng([]));
  expect(fen(lone).heroFlying).toBe(false);
});

test('perceived share weights each flying neighbor by its degree (ADR 0007)', () => {
  // hand-built: a hub listed by 6 birds flies; the perceived share near it is above the real share
  const t3 = { ...t, fen: { ...t.fen, neighbors: 3 } };
  // No two squared distances tie. Each bird's 3 nearest (squared distance):
  //   hub: s1 106, s0 121, s2 149      s0: s1 117, hub 121, s5 178     s1: hub 106, s0 117, s2 145
  //   s2: s3 130, s1 145, hub 149      s3: s2 130, hub 197, s4 205     s4: s3 205, hub 208, s5 257
  //   s5: s0 178, hub 233, s4 257
  // So the hub's degree is 6, s0, s1, and s2 have 3, and s3, s4, and s5 have 2.
  const w = fenWorld(
    [
      { id: 'hub', x: 800, y: 450 },
      { id: 's0', x: 811, y: 450 },
      { id: 's1', x: 805, y: 459 },
      { id: 's2', x: 793, y: 460 },
      { id: 's3', x: 786, y: 451 },
      { id: 's4', x: 792, y: 438 },
      { id: 's5', x: 808, y: 437 },
    ],
    { restless: ['hub'] },
  );
  const perceived = perceivedShares(w, t3);
  // s0 sees 1 of 3 in flight; weighted, the hub counts 6 of 3 + 6 + 2.
  expect(perceived.s0).toBe(6 / 11);
  expect(perceived.s0).toBeGreaterThan(1 / 3);
  expect(perceived.s4).toBe(6 / 10);
  expect(perceived.hub).toBe(0);
  expect(PACKS.fen.metrics(w, t3)).toEqual({ flyingShare: 1 / 7, tovePerceived: 0 });
});

test('neighbors at equal distance go by id, and an away creature is no neighbor', () => {
  const t1 = { ...t, fen: { ...t.fen, neighbors: 1 } };
  // a and b stand 10 from Tove; with one neighbor, Tove counts only a.
  const tie = (flier: string) => {
    const w = fenWorld(
      [
        { id: TOVE, x: 800, y: 450 },
        { id: 'b', x: 810, y: 450 },
        { id: 'a', x: 790, y: 450 },
      ],
      { restless: [flier], fixed: { [TOVE]: 0.5, a: 1, b: 1 } },
    );
    w.tick = 0;
    PACKS.fen.step(w, [], t1, scriptedRng([]));
    return fen(w).flying.includes(TOVE);
  };
  expect(tie('a')).toBe(true);
  expect(tie('b')).toBe(false);

  // Away, the flying n1 is no neighbor: Tove sees n2 and n3 of n2..n7 and far1, 2 of 7.
  const w = toveWorld();
  fen(w).thresholds[TOVE] = 3 / 7;
  get(w, 'n1').state = 'away';
  fenStep(w, 0);
  expect(fen(w).flying).not.toContain(TOVE);
  expect(perceivedShares(w, t)).not.toHaveProperty('n1');
});

test("a flying starling does not answer a Bellchime's wave", () => {
  const hero = {
    kind: 'bellchime' as const,
    name: 'Wren',
    x: 800,
    y: 450,
    berries: 3,
    keepsakes: [],
    rumor: null,
  };
  const w = fenWorld(
    [
      { id: 'mate', x: 810, y: 450 },
      { id: 'up', x: 830, y: 450 },
      { id: 'down', x: 800, y: 480 },
    ],
    { restless: ['up'] },
    { hero },
  );
  w.hero!.waveTo = 'mate';
  const events = resolveMeeting(w, get(w, HERO), get(w, 'mate'), t, createRng(5));
  const bids = events.filter((e) => e.t === 'bid').map((e) => e.to);
  expect(bids).toEqual(['mate', 'down']);
  expect(getTie(w, HERO, 'up')).toBeUndefined();
});

test('a flying creature meets no one', () => {
  const hero = {
    kind: 'kite' as const,
    name: 'Wren',
    x: 805,
    y: 450,
    berries: 3,
    keepsakes: [],
    rumor: null,
  };
  const w = fenWorld(
    [
      { id: 'a', x: 800, y: 450 },
      { id: 'b', x: 802, y: 450 },
      { id: 'c', x: 500, y: 450 },
      { id: 'd', x: 502, y: 450 },
    ],
    { restless: ['a'] },
    { hero },
  );
  expect(canMeet(w, get(w, 'a'), get(w, 'b'))).toBe(false);
  expect(canMeet(w, get(w, 'c'), get(w, 'd'))).toBe(true);
  const meetings = () =>
    findMeetings(w, createGrid(t.scene.width, t.scene.height, t.meet.radius), t).map(
      ([x, y]) => `${x.id}|${y.id}`,
    );
  expect(meetings()).toEqual(['b|hero', 'c|d']);
  fen(w).heroFlying = true;
  expect(meetings()).toEqual(['c|d']);
  // Through a full step, the flier holds its state.
  step(w, [], t);
  expect(get(w, 'a').state).toBe('wander');
  expect(get(w, 'c').state).toBe('meet');
});

test('a world without a pack takes no pack draw (golden hash unchanged)', () => {
  const plain = makeWorld([{ id: 'a' }, { id: 'b' }]);
  expect(plain).not.toHaveProperty('pack');
  expect(plain.rngState).toBe(1);
  expect(applyCommand(plain, { t: 'local', verb: { verb: 'join', on: true } }, t, scriptedRng([]))).toEqual(
    [],
  );
  expect(canMeet(plain, get(plain, 'a'), get(plain, 'b'))).toBe(true);
  expect(giftCost(plain, t)).toBe(t.gift.cost);
  expect(giftWarmth(plain, t)).toBe(t.warmth.giftReceived);
  expect(hashWorld(runGolden())).toBe(golden.hash);
  expect(golden.hash).toBe('c29d2fa4dbda4dcf');

  // In the Fen, gifts are plain, and pose and keepsake change nothing and draw nothing.
  const w = toveWorld();
  expect(giftCost(w, t)).toBe(t.gift.cost);
  expect(giftWarmth(w, t)).toBe(t.warmth.giftReceived);
  const before = hashWorld(w);
  for (const verb of [{ verb: 'pose' as const }, { verb: 'keepsake' as const, to: 'n1', item: 'feather' }]) {
    expect(applyCommand(w, { t: 'local', verb }, t, scriptedRng([]))).toEqual([]);
  }
  expect(hashWorld(w)).toBe(before);
});

test('empty and one-bird Fen worlds give no NaN', () => {
  for (const birds of [[], [{ id: TOVE, x: 800, y: 450 }]]) {
    const w = fenWorld(birds, { restless: [TOVE] });
    for (let i = 0; i < 2 * t.fen.everyTicks; i++) step(w, [], t);
    const metrics = PACKS.fen.metrics(w, t);
    expect(hasBadNumber(metrics)).toBe(false);
    expect(hasBadNumber(perceivedShares(w, t))).toBe(false);
    expect(hasBadNumber(toLite(w, t))).toBe(false);
    expect(hasBadNumber(w)).toBe(false);
  }
  expect(PACKS.fen.metrics(fenWorld([]), t)).toEqual({ flyingShare: 0, tovePerceived: 0 });
  expect(perceivedShares(fenWorld([{ id: TOVE, x: 800, y: 450 }]), t)).toEqual({ [TOVE]: 0 });
});
