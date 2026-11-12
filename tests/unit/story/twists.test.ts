import { describe, expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import type { SimEvent } from '../../../src/sim/types.ts';
import { checkTwist } from '../../../src/story/twists.ts';

const lite = (averageWarmth: number, friendPairs: number): WorldLite => ({
  creatures: [],
  light: null,
  fog: { w: 0, h: 0, cells: new Float32Array(0) },
  metrics: { averageWarmth, friendPairs },
  structures: [],
  water: [],
  banks: [],
  decks: [],
  islets: [],
  mushroom: null,
  bushes: [],
  ties: [],
  rumor: null,
});
type LiteCreature = WorldLite['creatures'][number];
const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const creature = (id: string, o: Partial<LiteCreature> = {}): LiteCreature => ({
  id,
  x: 0,
  y: 0,
  state: 'wander',
  shell: { tightness: 0.2, bristle: 0, color: 0, softness: 0 },
  berries: 0,
  skyWarmth: 0,
  dials,
  dancing: false,
  gone: false,
  ...o,
});
const world = (o: Partial<WorldLite>): WorldLite => ({ ...lite(0, 0), ...o });
const tight = (id: string, tightness: number, o: Partial<LiteCreature> = {}): LiteCreature =>
  creature(id, { shell: { tightness, bristle: 0, color: 0, softness: 0 }, ...o });
const gift = (from: string, to: string, move: 'give' | 'keep'): SimEvent => ({
  t: 'gift',
  from,
  to,
  move,
  seenAs: move,
});

describe('kritExploitsPim', () => {
  const w = lite(0, 0);
  test('true when Pim gives to Krit and Krit keeps', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'give'), gift('krit', 'pim', 'keep')]),
    ).toBe(true);
  });
  test('false when Krit gives back', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'give'), gift('krit', 'pim', 'give')]),
    ).toBe(false);
  });
  test('false when Pim keeps, or the pair differs, or no events', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'keep'), gift('krit', 'pim', 'keep')]),
    ).toBe(false);
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'echo', 'give'), gift('krit', 'echo', 'keep')]),
    ).toBe(false);
    expect(checkTwist('kritExploitsPim', w, w, [])).toBe(false);
  });
});

describe('benchWarmsVillage', () => {
  test('true at the exact thresholds', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.4, 4), [])).toBe(true);
  });
  test('exactly +3 pairs and +0.25 warmth (exact floats) passes; +2 pairs fails', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.25, 0), lite(0.5, 3), [])).toBe(true);
    expect(checkTwist('benchWarmsVillage', lite(0.25, 0), lite(0.5, 2), [])).toBe(false);
  });
  test('warmth rise of 0.1 passes despite float rounding; just under fails', () => {
    expect(0.3 - 0.2 >= 0.1).toBe(false); // the raw comparison would miss it
    expect(checkTwist('benchWarmsVillage', lite(0.2, 0), lite(0.3, 3), [])).toBe(true);
    expect(checkTwist('benchWarmsVillage', lite(0.2, 0), lite(0.2999, 3), [])).toBe(false);
  });
  test('false when friend pairs rise by only 2', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.5, 3), [])).toBe(false);
  });
  test('false when warmth rises by under 0.1', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.29, 5), [])).toBe(false);
  });
});

describe('thornsGrow', () => {
  test('true when the mean tightness of creatures not away rose by 0.03', () => {
    const before = world({ creatures: [tight('pim', 0.2), tight('krit', 0.4)] });
    const now = world({ creatures: [tight('pim', 0.23), tight('krit', 0.43)] });
    expect(checkTwist('thornsGrow', before, now, [])).toBe(true);
  });
  test('false when only a creature that is away grew tighter', () => {
    const before = world({ creatures: [tight('pim', 0.2), tight('krit', 0.2)] });
    const now = world({ creatures: [tight('pim', 0.2), tight('krit', 0.9, { state: 'away' })] });
    expect(checkTwist('thornsGrow', before, now, [])).toBe(false);
  });
});

describe('rumorDrowns', () => {
  // Five creatures, Krit is `about`, Moss is away: the four others count, so two holders are half.
  const creatures = ['pim', 'krit', 'echo', 'bell', 'wisp']
    .map((id) => creature(id))
    .concat(creature('moss', { state: 'away' }));
  const w = world({});
  test('true when the holders are half of the creatures not away, about left out', () => {
    const now = world({ creatures, rumor: { about: 'krit', sign: -1, holders: ['echo', 'pim'] } });
    expect(checkTwist('rumorDrowns', w, now, [])).toBe(true);
  });
  test('false under half, or with no rumor', () => {
    const now = world({ creatures, rumor: { about: 'krit', sign: -1, holders: ['echo'] } });
    expect(checkTwist('rumorDrowns', w, now, [])).toBe(false);
    expect(checkTwist('rumorDrowns', w, world({ creatures }), [])).toBe(false);
  });
});

describe('revengeLoop', () => {
  const w = world({});
  test('true when both warmths of the Echo and Krit tie are below 0', () => {
    const now = world({ ties: [{ a: 'echo', b: 'krit', ab: -0.1, ba: -0.3 }] });
    expect(checkTwist('revengeLoop', w, now, [])).toBe(true);
  });
  test('false when one side is at 0, or with no tie', () => {
    const now = world({ ties: [{ a: 'echo', b: 'krit', ab: -0.1, ba: 0 }] });
    expect(checkTwist('revengeLoop', w, now, [])).toBe(false);
    expect(checkTwist('revengeLoop', w, w, [])).toBe(false);
  });
});

describe('wispLeaves', () => {
  const w = world({});
  test('true when Wisp is gone over the ridge', () => {
    const now = world({ creatures: [creature('wisp', { state: 'away', gone: true })] });
    expect(checkTwist('wispLeaves', w, now, [])).toBe(true);
  });
  test('false when Wisp is away but not gone: left hungry, or carried in away', () => {
    const now = world({ creatures: [creature('wisp', { state: 'away' })] });
    expect(checkTwist('wispLeaves', w, now, [])).toBe(false);
  });
  test('false while Wisp is leaving but not yet away', () => {
    const now = world({ creatures: [creature('wisp', { state: 'leave' })] });
    expect(checkTwist('wispLeaves', w, now, [])).toBe(false);
  });
});

describe('mossShares', () => {
  const w = world({});
  test('true on a give from Moss to Krit', () => {
    expect(checkTwist('mossShares', w, w, [gift('moss', 'krit', 'give')])).toBe(true);
  });
  test('false on a keep, or a give from Krit to Moss', () => {
    expect(checkTwist('mossShares', w, w, [gift('moss', 'krit', 'keep')])).toBe(false);
    expect(checkTwist('mossShares', w, w, [gift('krit', 'moss', 'give')])).toBe(false);
  });
});

describe('bellDances', () => {
  const w = world({});
  test('true when Bell is dancing', () => {
    expect(checkTwist('bellDances', w, world({ creatures: [creature('bell', { dancing: true })] }), [])).toBe(
      true,
    );
  });
  test('false when Bell is not', () => {
    const now = world({ creatures: [creature('bell'), creature('pim', { dancing: true })] });
    expect(checkTwist('bellDances', w, now, [])).toBe(false);
  });
});
