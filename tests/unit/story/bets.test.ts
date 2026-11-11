import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { measureBet } from '../../../src/story/bets.ts';

const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
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
    })),
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth, friendPairs },
    structures: [],
  };
}

test('maxBerries returns the id with the most berries', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({ pim: 2, krit: 7, echo: 3 }))).toBe('krit');
});

test('maxBerries breaks a tie toward the lower id', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({ pim: 4, krit: 4, moss: 1 }))).toBe('krit');
});

test('maxBerries is empty with no creatures', () => {
  expect(measureBet({ kind: 'maxBerries' }, lite({}))).toBe('');
});

test('averageWarmth and friendPairs read the snapshot metrics', () => {
  const l = lite({ pim: 1 }, 0.35, 4);
  expect(measureBet({ kind: 'averageWarmth' }, l)).toBe(0.35);
  expect(measureBet({ kind: 'friendPairs' }, l)).toBe(4);
});
