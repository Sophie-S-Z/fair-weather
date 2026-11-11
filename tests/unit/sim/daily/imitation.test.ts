/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { imitate } from '../../../../src/sim/daily/imitation.ts';
import { get, makeWorld, scriptedRng, setWarmth, tuning as t } from '../helpers.ts';

/** a (0 berries) and b (5 berries, every dial 0.9) at the given distance, on day `day`. */
function pairWorld(day: number, gap = 100, bBerries = 5) {
  const w = makeWorld([
    { id: 'a', x: 400, berries: 0 },
    {
      id: 'b',
      x: 400 + gap,
      berries: bBerries,
      opener: 0.9,
      forgiveness: 0.9,
      memory: 0.9,
      ear: 0.9,
      wanderlust: 0.9,
    },
  ]);
  w.day = day;
  return w;
}

test('imitation: a fitter neighbor is copied with chance 0.3; the dial is picked from the fixed order', () => {
  const w = pairWorld(2);
  // a: pick neighbor, chance 0.29 (copy), dial draw 0.5 -> index 2 (memory). b: pick neighbor (a is less fit).
  const rng = scriptedRng([0, 0.29, 0.5, 0]);
  const events = imitate(w, t, rng);
  expect(rng.used()).toBe(4);
  expect(events).toEqual([{ t: 'imitate', who: 'a', from: 'b', dial: 'memory' }]);
  expect(get(w, 'a').dials).toEqual({
    opener: 0.5,
    forgiveness: 0.5,
    memory: 0.9,
    ear: 0.5,
    wanderlust: 0.5,
  });
});

test('imitation: a draw of 0.3 or more gives no copy', () => {
  const w = pairWorld(2);
  const rng = scriptedRng([0, 0.3, 0]);
  expect(imitate(w, t, rng)).toEqual([]);
  expect(rng.used()).toBe(3);
});

test('imitation: equal fitness gives no copy and no chance draw', () => {
  const w = pairWorld(2, 100, 0);
  const rng = scriptedRng([0, 0]);
  expect(imitate(w, t, rng)).toEqual([]);
  expect(rng.used()).toBe(2);
});

test('imitation: fitness counts 2 per friend', () => {
  const w = pairWorld(2, 100, 1);
  // a has 0 berries and 1 friend, c (fitness 2), against b's 1 berry and 0 friends.
  w.creatures.push(makeWorld([{ id: 'c', x: 1500 }]).creatures[0]!);
  setWarmth(w, 'a', 'c', 0.5);
  // a: pick b (less fit: no chance draw). b: pick a (fitter), chance 0.1 (copy), dial 0 (opener). c: no neighbors.
  const rng = scriptedRng([0, 0, 0.1, 0]);
  expect(imitate(w, t, rng)).toEqual([{ t: 'imitate', who: 'b', from: 'a', dial: 'opener' }]);
  expect(get(w, 'b').dials.opener).toBe(0.5);
});

test('imitation: only neighbors within 200 count', () => {
  const w = pairWorld(2, 201);
  expect(imitate(w, t, scriptedRng([]))).toEqual([]);
});

test('imitation: runs only when day % 3 === 2', () => {
  for (const day of [0, 1, 3, 4, 6]) expect(imitate(pairWorld(day), t, scriptedRng([]))).toEqual([]);
  expect(imitate(pairWorld(5), t, scriptedRng([0, 0.1, 0, 0]))).toHaveLength(1);
});

test('imitation: copies read dials from before this dusk, so order does not matter', () => {
  // c copies b while b copies a; c must get b's old value.
  const w = makeWorld([
    { id: 'a', x: 400, berries: 9, opener: 0.9 },
    { id: 'b', x: 450, berries: 5, opener: 0.6 },
    { id: 'c', x: 500, berries: 0, opener: 0.1 },
  ]);
  w.day = 2;
  // a: pick from [b, c] -> b (less fit). b: pick from [a, c] -> a, copy, opener. c: pick from [a, b] -> b (0.5), copy, opener.
  const rng = scriptedRng([0, 0, 0.1, 0, 0.5, 0.1, 0]);
  imitate(w, t, rng);
  expect(get(w, 'b').dials.opener).toBe(0.9);
  expect(get(w, 'c').dials.opener).toBe(0.6);
});
