import { expect, test } from 'vitest';
import { runDusk } from '../../../../src/sim/daily/index.ts';
import { ambientSkyBid } from '../../../../src/sim/daily/sky-bid.ts';
import { createRng } from '../../../../src/sim/rng.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

function skyWorld() {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], { ambientSkyBids: true });
  get(w, 'a').skyWarmth = 0.2;
  get(w, 'b').skyWarmth = 0.5;
  get(w, 'c').skyWarmth = 0.5;
  get(w, 'd').skyWarmth = 0.9;
  get(w, 'd').state = 'sleep';
  return w;
}

test('ambient: with chance draw 0.4, the awake creature with the highest sky warmth bids; at 0.6 nobody does', () => {
  // d is warmest but asleep; b and c tie, so the lower id bids.
  const low = scriptedRng([0.4]);
  expect(ambientSkyBid(skyWorld(), t, low)).toEqual([{ t: 'skyBid', who: 'b', ambient: true }]);
  expect(low.used()).toBe(1);
  const high = scriptedRng([0.6]);
  expect(ambientSkyBid(skyWorld(), t, high)).toEqual([]);
  expect(high.used()).toBe(1);
});

test('ambient: away creatures never bid', () => {
  const w = skyWorld();
  get(w, 'b').state = 'away';
  get(w, 'c').state = 'away';
  expect(ambientSkyBid(w, t, scriptedRng([0]))).toEqual([{ t: 'skyBid', who: 'a', ambient: true }]);
});

test('ambient: a world without ambientSkyBids takes no draw at dusk', () => {
  // the rngState after runDusk equals the M0 value for the same world
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c', berries: 0 }]);
  w.day = 6;
  get(w, 'c').state = 'away';
  befriend(w, 'a', 'b');
  const rng = createRng(42);
  runDusk(w, t, rng);
  expect(rng.state()).toBe(2654435811); // one return draw for c, as before the rule existed
  expect(ambientSkyBid(w, t, scriptedRng([]))).toEqual([]);
});

test('ambient: runDusk runs the bid last, after every other daily rule', () => {
  const w = makeWorld([{ id: 'a', berries: 0 }], { ambientSkyBids: true });
  get(w, 'a').hungryDusks = 3;
  // a leaves at this dusk, so nobody is awake to bid when the rule runs.
  expect(runDusk(w, t, scriptedRng([0]))).toEqual([{ t: 'leave', who: 'a' }]);
});
