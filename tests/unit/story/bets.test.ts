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
      dials,
    })),
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth, friendPairs },
    structures: [],
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
