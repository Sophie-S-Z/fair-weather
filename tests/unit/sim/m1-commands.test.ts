import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { lightSkyWarmth } from '../../../src/sim/light.ts';
import { get, makeWorld, scriptedRng, tuning as t } from './helpers.ts';

const run = (w: ReturnType<typeof makeWorld>, cmd: Parameters<typeof applyCommand>[1]) =>
  applyCommand(w, cmd, t, scriptedRng([]));

test('wake turns a sleeper into a wanderer and ignores others', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  get(w, 'a').state = 'sleep';
  expect(run(w, { t: 'wake', who: 'a' })).toEqual([]);
  expect(get(w, 'a').state).toBe('wander');
  get(w, 'b').state = 'meet';
  run(w, { t: 'wake', who: 'b' });
  expect(get(w, 'b').state).toBe('meet');
  get(w, 'a').state = 'away';
  run(w, { t: 'wake', who: 'a' });
  expect(get(w, 'a').state).toBe('away');
  expect(run(w, { t: 'wake', who: 'nobody' })).toEqual([]);
});

test('promptSkyBid emits skyBid for a present creature only', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  expect(run(w, { t: 'promptSkyBid', who: 'a' })).toEqual([{ t: 'skyBid', who: 'a' }]);
  expect(run(w, { t: 'promptSkyBid', who: 'nobody' })).toEqual([]);
  get(w, 'b').state = 'away';
  expect(run(w, { t: 'promptSkyBid', who: 'b' })).toEqual([]);
  expect(run(w, { t: 'promptSkyBid', who: 7 as unknown as string })).toEqual([]);
});

test('overPoke cools active creatures and makes them avoid the lens', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  get(w, 'b').state = 'away';
  expect(run(w, { t: 'overPoke' })).toEqual([]);
  expect(get(w, 'a').skyWarmth).toBeCloseTo(t.overPoke.skyWarmth);
  expect(get(w, 'b').skyWarmth).toBe(0);
  w.fields.light = { x: get(w, 'a').x, y: get(w, 'a').y };
  lightSkyWarmth(w, t);
  expect(get(w, 'a').skyWarmth).toBeCloseTo(t.overPoke.skyWarmth);
  w.day += t.light.days + 1;
  lightSkyWarmth(w, t);
  expect(get(w, 'a').skyWarmth).toBeGreaterThan(t.overPoke.skyWarmth);
});
