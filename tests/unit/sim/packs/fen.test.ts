/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a Fen */
// Rule packs and Murmuration Fen (ADR 0013 items 4 and 5, ADR 0007).
import { expect, test } from 'vitest';
import golden from '../../../golden/m0-hash.json';
import { runGolden } from '../../../golden/run-golden.ts';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { createGrid } from '../../../../src/sim/grid.ts';
import { hashWorld } from '../../../../src/sim/hash.ts';
import { findMeetings } from '../../../../src/sim/meeting.ts';
import { perceivedShares, TOVE } from '../../../../src/sim/packs/fen.ts';
import { canMeet, giftCost, giftWarmth, PACKS } from '../../../../src/sim/packs/index.ts';
import { createRng } from '../../../../src/sim/rng.ts';
import { step } from '../../../../src/sim/step.ts';
import type { FenState, Scenario, World } from '../../../../src/sim/types.ts';
import { createWorld } from '../../../../src/sim/world.ts';
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
  const spokes: Bird[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    id: `s${String(i)}`,
    x: 800 + 10 * Math.cos((i * Math.PI) / 3),
    y: 450 + 10 * Math.sin((i * Math.PI) / 3),
  }));
  // Each spoke's 3 nearest are the hub (10) and its two adjacent spokes (10); the rest are 17 or more.
  const w = fenWorld([{ id: 'hub', x: 800, y: 450 }, ...spokes], { restless: ['hub'] });
  const perceived = perceivedShares(w, t3);
  // s0 sees 1 of 3 in flight; the hub, listed by all 6 spokes, counts for at least half.
  expect(perceived.s0).toBeGreaterThanOrEqual(0.5);
  expect(perceived.s0).toBeGreaterThan(1 / 3);
  expect(perceived.hub).toBe(0);
  expect(PACKS.fen.metrics(w, t3)).toEqual({ flyingShare: 1 / 7, tovePerceived: 0 });
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
