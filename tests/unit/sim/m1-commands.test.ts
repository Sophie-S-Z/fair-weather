import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { step } from '../../../src/sim/step.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { dist2 } from '../../../src/sim/math.ts';
import { resolveMeeting } from '../../../src/sim/meeting.ts';
import type { Command } from '../../../src/sim/types.ts';
import { lightSkyWarmth } from '../../../src/sim/light.ts';
import { get, makeWorld, scriptedRng, tuning as t } from './helpers.ts';

const run = (w: ReturnType<typeof makeWorld>, cmd: Parameters<typeof applyCommand>[1]) =>
  applyCommand(w, cmd, t, scriptedRng([]));

test('wake turns a sleeper into a wanderer with a wake event, and ignores others with none', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
  get(w, 'a').state = 'sleep';
  expect(run(w, { t: 'wake', who: 'a' })).toEqual([{ t: 'wake', who: 'a' }]);
  expect(get(w, 'a').state).toBe('wander');
  expect(run(w, { t: 'wake', who: 'a' })).toEqual([]); // already awake: no event
  get(w, 'b').state = 'meet';
  expect(run(w, { t: 'wake', who: 'b' })).toEqual([]);
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

test('after overPoke a creature in the lens walks out of it', () => {
  const w = makeWorld([{ id: 'a', x: 800, y: 450 }]);
  w.fields.light = { x: 800, y: 450 };
  run(w, { t: 'overPoke' });
  for (let i = 0; i < 600; i++) step(w, [], t);
  const a = get(w, 'a');
  expect(Math.sqrt(dist2(a.x, a.y, 800, 450))).toBeGreaterThan(t.light.lensRadius);
});

test('a lit meeting gives no boost to an avoiding creature', () => {
  const lit = (avoid: boolean) => {
    const w = makeWorld([{ id: 'a' }, { id: 'b' }]);
    w.fields.light = { x: 800, y: 450 };
    if (avoid) get(w, 'a').lensAvoidUntilDay = w.day;
    resolveMeeting(w, get(w, 'a'), get(w, 'b'), t, createRng(3));
    return w.boosts.length;
  };
  expect(lit(false)).toBeGreaterThan(0);
  expect(lit(true)).toBe(0);
});

test('wake, promptSkyBid and overPoke replay to the same hash', () => {
  const play = (): string => {
    const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    get(w, 'a').state = 'sleep';
    w.fields.light = { x: 800, y: 450 };
    for (let tick = 0; tick < 400; tick++) {
      const list: Command[] = [];
      if (tick === 5) list.push({ t: 'wake', who: 'a' }, { t: 'promptSkyBid', who: 'b' });
      if (tick === 50) list.push({ t: 'overPoke' });
      step(w, list, t);
    }
    return hashWorld(w);
  };
  expect(play()).toBe(play());
});
