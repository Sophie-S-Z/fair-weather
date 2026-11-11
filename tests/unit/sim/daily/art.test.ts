import { expect, test } from 'vitest';
import { makeArt } from '../../../../src/sim/daily/art.ts';
import { befriend, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

function warmWorld(warmth = 0.5, berries = 2) {
  const w = makeWorld([
    { id: 'a', berries },
    { id: 'b', berries },
  ]);
  befriend(w, 'a', 'b', warmth);
  return w;
}

test('art: two qualifying dusks in a row give one art event on the second', () => {
  const w = warmWorld();
  expect(makeArt(w, t, scriptedRng([]))).toEqual([]);
  expect(w.artStreak).toBe(1);
  // Draws: who (0.5 -> b), kind (0.4 -> index 1, spiral).
  expect(makeArt(w, t, scriptedRng([0.5, 0.4]))).toEqual([{ t: 'art', who: 'b', kind: 'spiral' }]);
  expect(makeArt(w, t, scriptedRng([0, 0.9]))).toEqual([{ t: 'art', who: 'a', kind: 'chime' }]);
});

test('art: a dusk that does not qualify resets the streak', () => {
  const w = warmWorld();
  makeArt(w, t, scriptedRng([]));
  for (const tie of w.ties.values()) tie.ab.warmth = tie.ba.warmth = 0.4; // not above 0.4
  expect(makeArt(w, t, scriptedRng([]))).toEqual([]);
  expect(w.artStreak).toBe(0);
});

test('art: berries per creature must be above 1.5', () => {
  const w = warmWorld(0.5, 1.5);
  makeArt(w, t, scriptedRng([]));
  expect(makeArt(w, t, scriptedRng([]))).toEqual([]);
  expect(w.artStreak).toBe(0);
});
