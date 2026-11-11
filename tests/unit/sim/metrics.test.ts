import { expect, test } from 'vitest';
import { friendPairs } from '../../../src/sim/metrics.ts';
import { averageWarmth } from '../../../src/sim/world.ts';
import { makeWorld, setWarmth, tuning as t } from './helpers.ts';

test('friendPairs counts pairs where both sides are above the threshold', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  setWarmth(w, 'a', 'b', 0.4);
  setWarmth(w, 'b', 'a', 0.4);
  setWarmth(w, 'a', 'c', 0.9);
  setWarmth(w, 'c', 'a', 0.3);
  expect(friendPairs(w, t)).toBe(1);
});

test('averageWarmth is the mean over tie sides', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  setWarmth(w, 'a', 'b', 0.5);
  setWarmth(w, 'b', 'a', 0.1);
  expect(averageWarmth(w)).toBeCloseTo(0.3);
});
