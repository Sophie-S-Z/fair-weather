import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { measureBet } from '../../../src/story/bets.ts';

const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
function lite(berries: Record<string, number>, averageWarmth = 0, friendPairs = 0): WorldLite {
  return {
    creatures: Object.entries(berries).map(([id, b]) => ({
      id,
      x: 0,
      y: 0,
      state: 'wander' as const,
      shell,
      berries: b,
      skyWarmth: 0,
      dancing: false,
      gone: false,
      dials,
    })),
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth, friendPairs },
    structures: [],
    water: [],
    mushroom: null,
    bushes: [],
    ties: [],
    rumor: null,
  };
}

const CAST = ['pim', 'krit', 'echo', 'moss'];

test('maxBerries returns the option with the most berries', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({ pim: 2, krit: 7, echo: 3 }), CAST)).toBe('krit');
});

test('maxBerries counts only the options: a villager with more berries is never the answer', () => {
  const l = lite({ pim: 2, krit: 5, 'villager-16': 9 });
  expect(measureBet({ kind: 'maxBerries' }, l, CAST)).toBe('krit');
});

test('maxBerries breaks a tie toward the lower id', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({ pim: 4, krit: 4, moss: 1 }), CAST)).toBe('krit');
});

test('maxBerries is empty when no option is in the snapshot', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({}), CAST)).toBe('');
  expect(measureBet({ kind: 'maxBerries' }, lite({ 'villager-1': 3 }), CAST)).toBe('');
});

test('averageWarmth and friendPairs read the snapshot metrics', () => {
  const l = lite({ pim: 1 }, 0.35, 4);
  expect(measureBet({ kind: 'averageWarmth' }, l, CAST)).toBe(0.35);
  expect(measureBet({ kind: 'friendPairs' }, l, CAST)).toBe(4);
});

const liteWith = (rumorShare: number): WorldLite => {
  // Ten creatures: eight count (Krit is `about`, villager-9 is away), and `rumorShare × 8` hold the rumor.
  const ids = ['krit', 'pim', ...Array.from({ length: 8 }, (_, i) => `villager-${String(i + 1)}`)];
  const l = lite(Object.fromEntries(ids.map((id) => [id, 0])));
  const last = l.creatures.at(-1);
  if (last) last.state = 'away';
  const holders = ids.slice(1, 1 + rumorShare * 8);
  return { ...l, rumor: { about: 'krit', sign: -1, holders } };
};
const liteWarmth = (echoToKrit: number): WorldLite => ({
  ...lite({ echo: 0, krit: 0 }),
  ties: [{ a: 'echo', b: 'krit', ab: echoToKrit, ba: 0.5 }],
});

test('a bucket bet answers the option whose bucket holds the value', () => {
  expect(measureBet({ kind: 'rumorShare' }, liteWith(0.5), ['few', 'half', 'most'], [0.25, 0.5])).toBe(
    'most',
  );
  expect(measureBet({ kind: 'warmth', from: 'echo', to: 'krit' }, liteWarmth(-0.1), ['no', 'yes'], [0])).toBe(
    'no',
  );
});

test('a bucket bet: below the first bucket is the first option, between buckets the middle', () => {
  const options = ['few', 'half', 'most'];
  expect(measureBet({ kind: 'rumorShare' }, liteWith(0.125), options, [0.25, 0.5])).toBe('few');
  expect(measureBet({ kind: 'rumorShare' }, liteWith(0.375), options, [0.25, 0.5])).toBe('half');
  expect(measureBet({ kind: 'warmth', from: 'echo', to: 'krit' }, liteWarmth(0), ['no', 'yes'], [0])).toBe(
    'yes',
  );
});

test('rumorShare is 0 with no rumor; warmth reads either side of the tie and is 0 with none', () => {
  expect(measureBet({ kind: 'rumorShare' }, lite({ pim: 0 }), CAST)).toBe(0);
  expect(measureBet({ kind: 'warmth', from: 'krit', to: 'echo' }, liteWarmth(-0.1), CAST)).toBe(0.5);
  expect(measureBet({ kind: 'warmth', from: 'echo', to: 'pim' }, liteWarmth(-0.1), CAST)).toBe(0);
});

test('rumorShare counts only holders among the creatures it counts, so it never exceeds 1', () => {
  const l = lite({ pim: 0, krit: 0, echo: 0 });
  const echo = l.creatures[2];
  if (echo) echo.state = 'away';
  // Pim counts; Echo is away and Krit is `about`, so only Pim's holding counts.
  expect(
    measureBet(
      { kind: 'rumorShare' },
      { ...l, rumor: { about: 'krit', sign: -1, holders: ['pim', 'echo', 'krit'] } },
      CAST,
    ),
  ).toBe(1);
  expect(
    measureBet({ kind: 'rumorShare' }, { ...l, rumor: { about: 'krit', sign: -1, holders: ['echo'] } }, CAST),
  ).toBe(0);
});

test('awayCount counts the creatures away, gone ones included', () => {
  const l = lite({ pim: 0, krit: 0, wisp: 0 });
  const [, krit, wisp] = l.creatures;
  if (krit) krit.state = 'away';
  if (wisp) Object.assign(wisp, { state: 'away', gone: true });
  expect(measureBet({ kind: 'awayCount' }, l, ['none', 'few', 'many'], [1.5, 4.5])).toBe('few');
  expect(measureBet({ kind: 'awayCount' }, l, CAST)).toBe(2);
});

test('maxShell returns the option with the highest shell value; a tie goes to the lower id', () => {
  const l = lite({ pim: 0, krit: 0, echo: 0, 'villager-1': 0 });
  const tightness: Record<string, number> = { pim: 0.3, krit: 0.6, echo: 0.6, 'villager-1': 0.9 };
  for (const c of l.creatures) c.shell = { ...shell, tightness: tightness[c.id] ?? 0 };
  expect(measureBet({ kind: 'maxShell', shell: 'tightness' }, l, CAST)).toBe('echo');
  expect(measureBet({ kind: 'maxShell', shell: 'bristle' }, lite({}), CAST)).toBe('');
});
