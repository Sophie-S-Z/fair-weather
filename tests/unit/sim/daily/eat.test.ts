import { expect, test } from 'vitest';
import { eat } from '../../../../src/sim/daily/eat.ts';
import { get, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

test('eat: 0 berries counts a hungry dusk and adds 0.05 bristle; 2 berries eats 1', () => {
  const w = makeWorld([
    { id: 'empty', berries: 0 },
    { id: 'fed', berries: 2 },
  ]);
  expect(eat(w, t, scriptedRng([]))).toEqual([]);
  const empty = get(w, 'empty');
  const fed = get(w, 'fed');
  expect(empty.hungryDusks).toBe(1);
  expect(empty.shell.bristle).toBeCloseTo(0.05, 12);
  expect(empty.berries).toBe(0);
  expect(fed.berries).toBe(1);
  expect(fed.hungryDusks).toBe(0);
  expect(fed.shell.bristle).toBe(0);
});

test('eat: hungry dusks count in a row and reset on a fed dusk; bristle clamps at 1', () => {
  const w = makeWorld([{ id: 'a', berries: 0 }]);
  const a = get(w, 'a');
  a.shell.bristle = 0.98;
  eat(w, t, scriptedRng([]));
  eat(w, t, scriptedRng([]));
  expect(a.hungryDusks).toBe(2);
  expect(a.shell.bristle).toBe(1);
  a.berries = 1;
  eat(w, t, scriptedRng([]));
  expect(a.hungryDusks).toBe(0);
  expect(a.berries).toBe(0);
});

test('eat: away creatures do not eat', () => {
  const w = makeWorld([{ id: 'a', berries: 0 }]);
  get(w, 'a').state = 'away';
  eat(w, t, scriptedRng([]));
  expect(get(w, 'a').hungryDusks).toBe(0);
});
