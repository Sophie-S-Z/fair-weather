import { expect, test } from 'vitest';
import { metric } from '../../../src/sim/metrics.ts';
import { get, makeWorld, setWarmth, tuning as t } from './helpers.ts';

test('maxBerries returns the richest id, ties to the lower id', () => {
  const w = makeWorld([
    { id: 'c', berries: 5 },
    { id: 'b', berries: 5 },
    { id: 'a', berries: 2 },
  ]);
  expect(metric(w, { kind: 'maxBerries' }, t)).toBe('b');
  get(w, 'a').berries = 9;
  expect(metric(w, { kind: 'maxBerries' }, t)).toBe('a');
});

test('friendPairs counts pairs where both sides are above the threshold', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  setWarmth(w, 'a', 'b', 0.4);
  setWarmth(w, 'b', 'a', 0.4);
  setWarmth(w, 'a', 'c', 0.9);
  setWarmth(w, 'c', 'a', 0.3);
  expect(metric(w, { kind: 'friendPairs' }, t)).toBe(1);
});

test('averageWarmth is the mean over tie sides', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  setWarmth(w, 'a', 'b', 0.5);
  setWarmth(w, 'b', 'a', 0.1);
  expect(metric(w, { kind: 'averageWarmth' }, t)).toBeCloseTo(0.3);
});
