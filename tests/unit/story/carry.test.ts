import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { carriedDiaries, carryFrom, restoreDials } from '../../../src/story/carry.ts';
import type { Carry } from '../../../src/story/carry.ts';
import type { Scenario } from '../../../src/sim/types.ts';

const shell = { tightness: 0.1, bristle: 0.2, color: 0.3, softness: 0.4 };
const dials = { opener: 0.2, forgiveness: 0.5, memory: 0.6, ear: 0.7, wanderlust: 0.8 };

test('carryFrom keeps dials, shell, sky warmth, away, gone, and tie warmths', () => {
  const creature = (id: string, state: 'wander' | 'away', gone = false): WorldLite['creatures'][number] => ({
    id,
    x: 10,
    y: 20,
    state,
    shell,
    berries: 3,
    skyWarmth: 0.4,
    dials,
    dancing: true,
    gone,
  });
  const lite: WorldLite = {
    creatures: [creature('pim', 'wander'), creature('krit', 'away'), creature('wisp', 'away', true)],
    ties: [{ a: 'krit', b: 'pim', ab: -0.3, ba: 0.6 }],
    rumor: null,
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth: 0, friendPairs: 0 },
    structures: [{ id: 'bench-1', kind: 'bench', x: 1, y: 1 }],
    water: [],
    banks: [],
    decks: [],
    islets: [],
    mushroom: null,
    bushes: [],
  };
  const carry = carryFrom(lite, new Map([['pim', ['Danced.']]]));
  expect(carry).toEqual({
    creatures: [
      { id: 'pim', dials, shell, skyWarmth: 0.4, away: false, gone: false, diary: ['Danced.'] },
      { id: 'krit', dials, shell, skyWarmth: 0.4, away: true, gone: false, diary: [] },
      { id: 'wisp', dials, shell, skyWarmth: 0.4, away: true, gone: true, diary: [] },
    ],
    ties: [{ a: 'krit', b: 'pim', ab: -0.3, ba: 0.6 }],
  });
  // Copies, so a scenario built from the carry never shares the snapshot's objects.
  expect(carry.creatures[0]?.dials).not.toBe(dials);
  expect(carry.creatures[0]?.shell).not.toBe(shell);
});

test("carriedDiaries keeps the base creatures' diaries; a newcomer's stays behind", () => {
  const entry = (id: string, diary: string[]): Carry['creatures'][number] => ({
    id,
    dials,
    shell,
    skyWarmth: 0,
    away: false,
    gone: false,
    diary,
  });
  const carry: Carry = { creatures: [entry('pim', ['Left.']), entry('newcomer-40', ['Came.'])], ties: [] };
  const base = { creatures: [{ id: 'pim' }, { id: 'krit' }] } as Scenario;
  expect(carriedDiaries(carry, base)).toEqual(new Map([['pim', ['Left.']]]));
});

test('restoreDials puts back the overridden dials only, from the received carry or else the base', () => {
  const end = { opener: 0.9, forgiveness: 0.1, memory: 0.6, ear: 0.3, wanderlust: 0.8 };
  const entry = (id: string) => ({
    id,
    dials: { ...end },
    shell,
    skyWarmth: 0,
    away: false,
    gone: false,
    diary: [],
  });
  const carry: Carry = { creatures: [entry('pim'), entry('krit')], ties: [] };
  const base = {
    creatures: [
      { id: 'pim', dials },
      { id: 'krit', dials },
    ],
  } as unknown as Scenario;
  restoreDials(carry, undefined, base, [{ dials: { pim: { opener: 1 } } }, { dials: { krit: { ear: 0 } } }]);
  expect(carry.creatures[0]?.dials).toEqual({ ...end, opener: 0.2 });
  expect(carry.creatures[1]?.dials).toEqual({ ...end, ear: 0.7 });
  const received: Carry = { creatures: [{ ...entry('pim'), dials: { ...dials, opener: 0.4 } }], ties: [] };
  restoreDials(carry, received, base, [{ dials: { pim: { opener: 1 } } }]);
  expect(carry.creatures[0]?.dials.opener).toBe(0.4);
});
