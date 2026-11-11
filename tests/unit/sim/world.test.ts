/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import type { Scenario } from '../../../src/sim/types.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import {
  activeCreatures,
  averageWarmth,
  byId,
  createWorld,
  ensureTie,
  friendCount,
  getTie,
  side,
  tieKey,
} from '../../../src/sim/world.ts';

const tuning = parseTuning(tuningJson);
const scenario = scenarioJson as Scenario;

test('the m0 scenario has the named cast, 24 villagers, 8 bushes, no benches', () => {
  expect(scenario.creatures.slice(0, 6).map((c) => c.id)).toEqual([
    'pim',
    'krit',
    'echo',
    'moss',
    'wisp',
    'bell',
  ]);
  expect(scenario.creatures.slice(0, 6).map((c) => c.name)).toEqual([
    'Pim',
    'Krit',
    'Echo',
    'Old Moss',
    'Wisp',
    'Bell',
  ]);
  expect(scenario.creatures).toHaveLength(30);
  expect(scenario.creatures[6]?.name).toBe('Villager 1');
  expect(scenario.creatures[29]?.name).toBe('Villager 24');
  expect(scenario.bushes).toHaveLength(8);
  expect(scenario.structures).toHaveLength(0);
});

test('createWorld copies the scenario and seeds the state', () => {
  const w = createWorld(12345, tuning, scenario);
  expect(w.rngState).toBe(12345);
  expect(w.ticksPerDay).toBe(400);
  expect(w.nextId).toBe(1);
  expect(w.creatures).toHaveLength(30);
  expect(w.creatures[0]?.goalX).toBe(w.creatures[0]?.x);
  expect(w.creatures[0]?.visits).toHaveLength(32);
  expect(w.creatures[0]?.restShell).toEqual(w.creatures[0]?.shell);
  expect(w.fields.fogW).toBe(40);
  expect(w.fields.fogH).toBe(23);
  expect(w.fields.fog).toHaveLength(40 * 23);
  expect(w.fields.fog.every((v) => v === 0)).toBe(true);
  w.creatures[0]!.dials.opener = 0;
  w.bushes[0]!.berries = 0;
  expect(scenario.creatures[0]?.dials.opener).toBe(0.9);
  expect(scenario.bushes[0]?.berries).toBe(5);
});

test('createWorld takes ticksPerDay from the scenario when given', () => {
  expect(createWorld(1, tuning, { ...scenario, ticksPerDay: 123 }).ticksPerDay).toBe(123);
});

test('tieKey sorts the ids', () => {
  expect(tieKey('pim', 'krit')).toBe('krit|pim');
  expect(tieKey('krit', 'pim')).toBe(tieKey('pim', 'krit'));
});

test('ensureTie starts warmth from the opinion, and is idempotent', () => {
  const w = createWorld(1, tuning, scenario);
  const pim = byId(w, 'pim')!;
  const krit = byId(w, 'krit')!;
  pim.opinions.krit = 0.6;
  krit.opinions.pim = -0.4;
  const t = ensureTie(w, pim, krit, tuning);
  expect(side(t, 'pim').warmth).toBeCloseTo(0.3, 12);
  expect(side(t, 'krit').warmth).toBeCloseTo(-0.2, 12);
  expect(ensureTie(w, krit, pim, tuning)).toBe(t);
  expect(getTie(w, 'krit', 'pim')).toBe(t);
  expect(getTie(w, 'pim', 'echo')).toBeUndefined();
});

test('ensureTie makes the first creature side a', () => {
  const w = createWorld(1, tuning, scenario);
  const t = ensureTie(w, byId(w, 'pim')!, byId(w, 'krit')!, tuning);
  expect([t.a, t.b]).toEqual(['pim', 'krit']);
});

test('averageWarmth is 0 with no ties and ignores sides touching an away creature', () => {
  const w = createWorld(1, tuning, scenario);
  expect(averageWarmth(w)).toBe(0);
  const pim = byId(w, 'pim')!;
  const krit = byId(w, 'krit')!;
  const echo = byId(w, 'echo')!;
  const t1 = ensureTie(w, pim, krit, tuning);
  const t2 = ensureTie(w, pim, echo, tuning);
  t1.ab.warmth = 0.5;
  t1.ba.warmth = 0.1;
  t2.ab.warmth = -1;
  t2.ba.warmth = -1;
  expect(averageWarmth(w)).toBeCloseTo((0.5 + 0.1 - 2) / 4, 12);
  echo.state = 'away';
  expect(averageWarmth(w)).toBeCloseTo(0.3, 12);
  krit.state = 'away';
  expect(averageWarmth(w)).toBe(0);
});

test('friendCount counts warm sides above the threshold, not away partners', () => {
  const w = createWorld(1, tuning, scenario);
  const pim = byId(w, 'pim')!;
  const krit = byId(w, 'krit')!;
  const echo = byId(w, 'echo')!;
  const t1 = ensureTie(w, pim, krit, tuning);
  const t2 = ensureTie(w, pim, echo, tuning);
  side(t1, 'pim').warmth = 0.31;
  side(t2, 'pim').warmth = 0.3;
  expect(friendCount(w, pim, tuning)).toBe(1);
  expect(friendCount(w, krit, tuning)).toBe(0);
  krit.state = 'away';
  expect(friendCount(w, pim, tuning)).toBe(0);
});

test('activeCreatures drops away creatures; byId finds by id', () => {
  const w = createWorld(1, tuning, scenario);
  byId(w, 'wisp')!.state = 'away';
  expect(activeCreatures(w)).toHaveLength(29);
  expect(byId(w, 'nobody')).toBeUndefined();
});
